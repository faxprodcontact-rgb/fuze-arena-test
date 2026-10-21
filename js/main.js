// =====================================================================
//  INTERFACE — écrans Héros / Coffres / Sac / Arène / Donjons / Guerre
// =====================================================================
import {
  CLASSES, STATS, STAT_KEYS, RARITIES, ITEMS, SLOTS, SLOT_ORDER, SPELLS, FRIENDS,
  CHEST_MAX, CHEST_ODDS, OPEN_MAX, MAX_ACTIVE_SPELLS, WINS_PER_COMBAT_CHEST, MAX_LEVEL,
  THRONE, AUTO, DUNGEONS, DUNGEON_RUNS, DUNGEON_KEYS_MAX, DUNGEON_SKIP_KEEP, HORDE, SETS, WAR, COSMETICS, COSMETIC, RAID, TOWER, MISSIONS_BONUS,
  KEY_PRICE, SHOP_DAILY, CHAMP, STORY, RECHARGE, SET_TIERS, PVP, SELL_PRICE, STAT_RESET_COST, PETS, PET_EVERY, ITEM_LIST, AUCTION, REMATCH_CLAT, DAILY_LOGIN,
} from './data.js?v=20261021235041';
import * as E from './engine.js?v=20261021235041';
import { playBattle, playTraining, idlePreview, playSkirmish, dollPreview, playMelee, loadDecorArt } from './battle.js?v=20261021235041';
import { itemIcon, chestCanvas, paint, heroPortrait, monsterCanvas, clatCanvas, keyCanvas, spellIcon, modeEmblem, uiIcon, loadHeroArt, loadMonsterArt, loadIconArt, loadItemArt, prepareSkin } from './sprites.js?v=20261021235041';
import { hashStr, makeRng } from './rng.js?v=20261021235041';
import { APP_VERSION } from './version.js?v=20261021235041';
import { PATCH_NOTES } from './patchnotes.js?v=20261021235041';
import * as NET from './net.js?v=20261021235041';
import * as AUC from './encheres.js?v=20261021235041';
import { SFX, unlock as unlockSound, getPref, setPref, startMusic, stopMusic } from './sfx.js?v=20261021235041';

// ------------------------------ Sauvegarde ------------------------------
// Hors ligne : sauvegarde dans le téléphone. En ligne : sur le serveur.
const KEY = 'fuzev2-save-v1';
let memSave = null;
function load() {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) { /* stockage indisponible */ }
  return memSave;
}
function save() {
  memSave = acc;
  if (NET.online) { NET.queueSave(acc); return; }
  try { localStorage.setItem(KEY, JSON.stringify(acc)); } catch (e) { /* stockage indisponible */ }
}
function wipe() {
  memSave = null;
  try { localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ }
}

let acc = null;        // le compte (pseudo, coffres, section…)
let hero = null;       // le personnage actif du compte
let players = [];      // les autres joueurs (en ligne)
let tab = 'hero';
let lastTab = null;
let rankMode = 'level';
let pickedClass = 'guerrier';
let rebirth = null;    // Fuze Arena 2.0 : compte de l'ancien jeu qui doit choisir son nouveau héros ({ pseudo })
let authMode = 'signup';
let stopPreviews = [];
let chatMsgs = [];     // messages du tchat
let chatUnread = 0;
let chatDraft = '';

const others = () => (NET.online ? players : null);

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ------------------------------ Journée & adversaires ------------------------------
function ensureDay() {
  const day = E.dayKey();
  if (acc.fights.day !== day) acc.fights = { day, done: {}, lvl: hero.level };
}
const msToMidnight = () => { const d = new Date(); const m = new Date(d); m.setHours(24, 0, 0, 0); return m - d; };

/** Adversaires : les vrais joueurs en ligne (leur perso actif), sinon des bots */
function opponents() {
  if (NET.online) {
    return players.map(p => {
      const h = E.strongestHero(p.data);   // on affronte toujours son perso le plus fort
      const snap = snapOf(p.data, h, p.pseudo);
      return { id: p.id, name: p.pseudo, classId: h.classId, level: h.level, dye: h.dye, data: p.data, snap, section: p.data.war && p.data.war.section, done: acc.fights.done[p.id] };
    });
  }
  return FRIENDS.map(f => {
    const bot = E.buildBot(f, acc.fights.lvl || hero.level, acc.fights.day);
    return { id: f.id, name: f.name, classId: f.classId, level: bot.level, snap: E.snapshot(bot), section: acc.war.sides[f.id], done: acc.fights.done[f.id] };
  });
}

async function refreshPlayers() {
  if (!NET.online || !acc) return;
  try { players = (await NET.fetchOthers()).filter(p => E.isEra(p.data)); } catch (e) { toast(e.message); }
  warmSkins();
}
/** Prépare en arrière-plan les skins élémentaires portés (les miens et ceux des autres) pour qu'ils soient prêts en combat */
function warmSkins() {
  if (!acc) return;
  const list = [acc, ...players.map(p => p.data)].flatMap(a => (a && a.heroes) || []).filter(h => h.dye && COSMETIC[h.dye] && COSMETIC[h.dye].art);
  if (!list.length) return;
  Promise.all(list.map(h => prepareSkin(h.classId, h.dye))).then(() => softRender());
}

// ------------------------------ Rendu ------------------------------
/** Petite icône en pixel art (à la place d'un emoji) */
/** Les persos rangés du plus haut niveau (à gauche) au plus bas, avec leur place d'origine dans le compte */
const byLevel = (heroes) => heroes.map((h, i) => [h, i]).sort(([a, i], [b, j]) => b.level - a.level || b.xp - a.xp || i - j);
const ico = (name, cls = '') => `<canvas class="px ico ${cls}" data-ico="${name}"></canvas>`;
function hydrate(root = document) {
  // icônes d'objets : avec un gros sac, on ne dessine que celles qui arrivent à l'écran (le reste au fil du défilement)
  const icons = root.querySelectorAll('canvas[data-icon]');
  if (icons.length > 48 && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((list) => list.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      paint(e.target, itemIcon(e.target.dataset.icon), { scale: 4 });
    }), { rootMargin: '400px 0px' });
    icons.forEach(c => io.observe(c));
  } else icons.forEach(c => paint(c, itemIcon(c.dataset.icon), { scale: 4 }));
  root.querySelectorAll('canvas[data-portrait]').forEach(c => paint(c, heroPortrait(c.dataset.portrait, CLASSES[c.dataset.portrait].weapon, c.dataset.dye || null), { scale: 4 }));
  root.querySelectorAll('canvas[data-monster]').forEach(c => paint(c, monsterCanvas(c.dataset.monster), { scale: 3 }));
  root.querySelectorAll('canvas[data-clat]').forEach(c => paint(c, clatCanvas(), { scale: 3 }));
  root.querySelectorAll('canvas[data-key]').forEach(c => paint(c, keyCanvas(), { scale: 3 }));
  root.querySelectorAll('canvas[data-emblem]').forEach(c => paint(c, modeEmblem(c.dataset.emblem), { scale: 4 }));
  root.querySelectorAll('canvas[data-ico]').forEach(c => paint(c, uiIcon(c.dataset.ico), { scale: 4 }));
  root.querySelectorAll('canvas[data-spell]').forEach(c => paint(c, spellIcon(c.dataset.spell), { scale: 3 }));
  root.querySelectorAll('canvas[data-chest]').forEach(c => paint(c, chestCanvas(c.dataset.chest, c.dataset.open === '1'), { scale: 6 }));
  root.querySelectorAll('canvas[data-hero]').forEach(c => stopPreviews.push(idlePreview(c, c.dataset.hero, c.dataset.pet || null, c.dataset.dye || null)));
  root.querySelectorAll('canvas[data-auto]').forEach(c => stopPreviews.push(startAutoVisual(c)));
  root.querySelectorAll('canvas[data-doll]').forEach(c => stopPreviews.push(dollPreview(c, c.dataset.doll, c.dataset.pet || null, c.dataset.dye || null)));
}

function render() {
  renderOnClose = false;
  stopPreviews.forEach(f => f());
  stopPreviews = [];
  if (!acc) { if (rebirth) renderRebirth(); else if (NET.online) renderAuth(); else renderCreate(); return; }
  hero = E.activeHero(acc);
  if (E.applySpecialReset(acc)) { save(); setTimeout(() => toast('Remise à zéro spéciale de 20 h : tout est rechargé !'), 400); }
  if (E.applyLevelFixes(acc).length) { save(); hero = E.activeHero(acc); setTimeout(() => toast('Correction : un perso monté trop vite pendant les changements d’XP a été remis à son niveau.'), 600); }
  ensureDay();
  E.ensureWar(acc, others());
  acc.heroes.forEach(h => { E.refreshChests(h); E.dungeonRuns(h); });
  updateXpBonus();
  const need = E.xpForLevel(hero.level);
  const xpPct = hero.level >= MAX_LEVEL ? 100 : Math.round((hero.xp / need) * 100);
  const fightsLeft = opponents().filter(o => !o.done).length;
  const chests = E.openableChests(hero) + acc.combatChests + acc.warChests;
  const pts = E.freePoints(hero);
  const combatBadge = fightsLeft + claimableMissions();
  const socialBadge = chatUnread + journalUnseen;
  const fusable = countFusable();

  app.innerHTML = `
    <header class="topbar cls-${hero.classId}">
      <button class="tb-portrait" data-act="myCard" aria-label="Ma fiche"><canvas class="px" data-portrait="${hero.classId}" data-dye="${hero.dye || ''}"></canvas><span class="tb-lvl t${lvlTier(hero.level)}">${hero.level}</span></button>
      <div class="tb-info">
        <div class="tb-name">${nameHtml(acc.pseudo, acc)}</div>
        <div class="tb-sub"><span class="tb-cls">${CLASSES[hero.classId].name}</span><span class="tb-flouze"><canvas class="px" data-clat></canvas>${fmtNum(acc.clat)}</span></div>
        <div class="xpbar"><div style="width:${xpPct}%"></div><span>${hero.level >= MAX_LEVEL ? 'NIVEAU MAX' : `XP ${fmtNum(hero.xp)} / ${fmtNum(need)}`}</span></div>
      </div>
      <button class="tb-gear" data-act="patchNotes" aria-label="Notes de mise à jour">${ico('scroll')}<span class="badge dot" id="patch-badge" ${patchUnseen() ? '' : 'hidden'}>!</span></button>
      <button class="tb-gear ${tab === 'chat' ? 'on' : ''}" data-act="tab" data-id="chat" aria-label="Tchat">${ico('chat')}<span class="badge" id="chat-badge" ${chatUnread ? '' : 'hidden'}>${chatUnread}</span></button>
      <button class="tb-gear" data-act="settings" aria-label="Réglages">${ico('gear')}</button>
    </header>
    <main id="view" class="${tab === 'chat' ? 'is-chat' : ''}">${PARENT[tab] ? `<button class="backbar" data-act="tab" data-back="1" data-id="${PARENT[tab]}">‹ ${PARENT_NAME[PARENT[tab]]}</button>` : ''}${VIEWS[tab]()}</main>
    <nav class="tabs">
      ${tabBtn('hero', 'Héros', pts)}
      ${tabBtn('chests', 'Coffres', chests)}
      ${tabBtn('bag', 'Sac', fusable)}
      ${tabBtn('combat', 'Combats', combatBadge)}
      ${tabBtn('social', 'Social', socialBadge)}
      ${tabBtn('shop', 'Boutique', 0)}
    </nav>`;
  hydrate(app);
  paintTabIcons();
  // petite animation d'entrée quand on change d'onglet
  if (tab !== lastTab) { document.getElementById('view')?.classList.add('enter'); lastTab = tab; }
  if (tab === 'chat') { markChatSeen(); scrollChat(); }
  if (tab === 'journal') markJournalSeen();
  if (tab === 'hero') startTraining();
  if (tab === 'war') startSkirmish();
  maybeShowGift();
}

// ------------------------------ Entraînement (onglet Héros) ------------------------------
// Ton perso tape un épouvantail en continu ; les compteurs montrent l'effet de tes stats.
let T = null;
const resetTraining = () => { T = { acts: 0, foeActs: 0, hits: 0, dmg: 0, crits: 0, maxHit: 0, foeHits: 0, dodges: 0, taken: 0, heal: 0 }; };

function dummySnap(level) {
  const p = Math.round(4 + level * 0.8);   // tape doucement : il montre ta défense sans te tuer
  return {
    name: 'Épouvantail', monster: 'scarecrow', classId: null, level,
    stats: { vit: 999, atk: p, mag: p, def: 0, spd: 25, lck: 0 }, maxHp: 99999999, spells: [],
    basic: { name: 'Coup de balai', scale: 'atk', mult: 1, melee: true, fx: 'bash' }, pet: null,
  };
}

function trainingStatsHtml() {
  if (!T) resetTraining();
  const st = E.computeStats(hero);
  const gx = E.gearExtras(hero);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const box = (ico, label, val, sub) => `<div class="ts"><span><i class="ts-ico">${ico}</i>${label}</span><b>${val}</b><small>${sub}</small></div>`;
  const speedRatio = T.foeActs ? (T.acts / T.foeActs).toFixed(1) : '—';
  return [
    box(ico('swords'), 'Dégâts', T.hits ? Math.round(T.dmg / T.hits) : '—', `moyen · max ${T.maxHit}`),
    box(ico('boom'), 'Critiques', `${pct(T.crits, T.hits)} %`, `chance ${Math.round(E.finalCrit(st.lck, gx.crit) * 100)} %`),
    box(ico('wind'), 'Esquives', `${pct(T.dodges, T.foeHits + T.dodges)} %`, `chance ${Math.round(E.finalDodge(st.lck, gx.dodge) * 100)} %`),
    box(ico('shield'), 'Défense', `−${Math.round((1 - 100 / (100 + st.def)) * 100)} %`, `dégâts reçus ${T.foeHits ? Math.round(T.taken / T.foeHits) : '—'}`),
    box(ico('bolt'), 'Vitesse', `×${speedRatio}`, 'par tour adverse'),
    box(ico('heart'), 'Soins', T.heal, `PV max ${E.maxHp(st, hero.level)}`),
  ].join('');
}

/** Record d'entraînement (plus gros coup) de tous les joueurs, tous persos confondus */
function trainingBest() {
  let best = { dmg: (acc.trainRecord && acc.trainRecord.dmg) || 0, name: acc.pseudo, data: acc };
  if (NET.online) for (const p of players) { const r = p.data.trainRecord; if (r && r.dmg > best.dmg) best = { dmg: r.dmg, name: p.pseudo, data: p.data }; }
  return best;
}
const trainRecHtml = () => { const b = trainingBest(); return b.dmg ? `<b>${esc(b.name)}</b> a mis <b>${fmtNum(b.dmg)}</b> dégâts` : 'Pas encore de record'; };

function onTrainingEntry(e) {
  onTrainSpells(e);
  if (!T || e.type !== 'action' || e.pet) return;
  if (e.actor === 0) {
    T.acts++;
    for (const r of e.results) {
      if (r.target === 1 && r.type === 'hit') { T.hits++; T.dmg += r.dmg; if (r.crit) T.crits++; T.maxHit = Math.max(T.maxHit, r.dmg); }
      if (r.target === 0 && r.type === 'heal') T.heal += r.amount;
    }
  } else {
    T.foeActs++;
    for (const r of e.results) {
      if (r.target === 0 && r.type === 'hit') { T.foeHits++; T.taken += r.dmg; }
      if (r.target === 0 && r.type === 'dodge') T.dodges++;
    }
  }
  const el = document.getElementById('train-stats');
  if (el) { el.innerHTML = trainingStatsHtml(); hydrate(el); }
  // nouveau record personnel ?
  if (T.maxHit > ((acc.trainRecord && acc.trainRecord.dmg) || 0)) {
    const isTop = T.maxHit > trainingBest().dmg;
    acc.trainRecord = { dmg: T.maxHit, classId: hero.classId };
    E.missionEvent(acc, 'train_rec');
    save();
    const r = document.getElementById('train-rec');
    if (r) { r.innerHTML = trainRecHtml(); hydrate(r); if (isTop) { r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); } }
  }
}

// Sorts de l'entraînement : les sorts de combat du perso, sous l'épouvantail. Le héros ne fait que des attaques simples ;
// toucher un sort le fait lancer à sa prochaine action (combat en direct), et affiche ce qu'il a fait.
let trainFight = null, trainCast = null, trainWait = 0;
const trainSpellList = () => hero.spells.filter(id => SPELLS[id] && SPELLS[id].lvl <= hero.level).slice(0, MAX_ACTIVE_SPELLS);
function trainSpellsHtml() {
  const list = trainSpellList();
  if (!list.length) return '';
  return `<div class="train-spells" id="train-spells">
    ${list.map((id, i) => `<button class="tsp" data-act="trainCast" data-id="${id}" data-i="${i}" aria-label="${esc(SPELLS[id].name)}"><canvas class="px" data-spell="${id}"></canvas><span class="cd"></span></button>`).join('')}
  </div><div class="train-cast" id="train-cast">Touche un sort pour le lancer</div>`;
}
/** Recharges des sorts (en tours) et sort lancé : met à jour les boutons et la ligne de résultat */
function onTrainSpells(e) {
  const box = document.getElementById('train-spells');
  if (box && e.s && e.s[0] && e.s[0].cd) box.querySelectorAll('.tsp').forEach(b => {
    const left = Math.max(0, (e.s[0].cd[+b.dataset.i] || 0) - 1);
    b.classList.toggle('wait', left > 0);
    b.querySelector('.cd').textContent = left || '';
  });
  if (e.type !== 'action' || e.actor !== 0 || e.pet || !trainCast) return;
  // l'action qui suit le toucher est parfois déjà décidée : on laisse au sort une action de plus pour partir
  if (e.id !== trainCast && ++trainWait < 2) return;
  const asked = trainCast;
  trainCast = null;
  if (box) box.querySelectorAll('.tsp.queued').forEach(b => b.classList.remove('queued'));
  const out = document.getElementById('train-cast');
  if (!out) return;
  if (e.id !== asked) { out.innerHTML = `${esc(SPELLS[asked].name)} pas prêt : réessaie`; return; }
  const dmg = e.results.filter(r => r.type === 'hit' && r.target === 1).reduce((a, r) => a + r.dmg, 0);
  const crit = e.results.some(r => r.type === 'hit' && r.target === 1 && r.crit);
  const heal = e.results.filter(r => r.type === 'heal' && r.target === 0).reduce((a, r) => a + r.amount, 0);
  const parts = [dmg ? `<b>${fmtNum(dmg)}</b> dégâts${crit ? ' <em>critique</em>' : ''}` : '', heal ? `<b class="g">+${fmtNum(heal)}</b> PV` : ''].filter(Boolean);
  out.innerHTML = `${esc(SPELLS[asked].name)} : ${parts.join(' · ') || 'effet lancé'}`;
  out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop');
}

function startTraining() {
  const cv = document.getElementById('train-cv');
  if (!cv) return;
  resetTraining();
  stopPreviews.push(playTraining(cv, () => {
    const me = mySnap();
    const foe = dummySnap(hero.level);
    trainCast = null;
    trainFight = E.createFight(me, foe, (Math.random() * 2 ** 31) | 0, { maxActions: 30, timeoutWinner: false, manual: true });   // attaques simples : un sort part seulement quand on le touche
    return { me, foe, result: trainFight };
  }, { onEntry: onTrainingEntry }));
}

function tabBtn(id, label, badge) {
  return `<button class="tab ${rootTab(tab) === id ? 'on' : ''}" data-act="tab" data-id="${id}">
    <canvas class="px" data-tabicon="${id}"></canvas>${label}
    <span class="badge" id="badge-${id}" ${badge > 0 ? '' : 'hidden'}>${badge}</span></button>`;
}
function paintTabIcons() {
  const src = {
    hero: () => heroPortrait(hero.classId, CLASSES[hero.classId].weapon, hero.dye),
    combat: () => uiIcon('swords'),
    social: () => modeEmblem('players'),
    shop: () => clatCanvas(),
    chests: () => chestCanvas('normal', false),
    bag: () => uiIcon('bag'),
    fights: () => uiIcon('swords'),
    dungeons: () => modeEmblem('dungeons'),
    war: () => modeEmblem('war'),
  };
  app.querySelectorAll('canvas[data-tabicon]').forEach(c => paint(c, src[c.dataset.tabicon](), { scale: 2 }));
}

function countFusable() {
  const count = new Map();   // une seule passe sur le sac (avant : une recherche par objet, lent avec un gros sac)
  for (const it of hero.inventory) if (it.rarity < RARITIES.length - 1) { const key = it.itemId + ':' + it.rarity; count.set(key, (count.get(key) || 0) + 1); }
  let n = 0;
  for (const [key, c] of count) if (c >= E.fuseNeed(+key.split(':')[1])) n++;
  return n;
}

// ------------------------------ Création / connexion ------------------------------
const classGrid = () => `
  <div class="class-grid">
    ${Object.entries(CLASSES).map(([id, c]) => `
      <button class="class-card ${pickedClass === id ? 'sel' : ''}" data-act="pickClass" data-id="${id}">
        <canvas class="px" data-portrait="${id}"></canvas>
        <b>${c.name}</b><small>${c.desc}</small>
      </button>`).join('')}
  </div>`;

function renderCreate() {
  app.innerHTML = `
    <div class="create">
      <img class="logo-img" src="icons/icon.svg?v=2" alt=""><h1 class="logo">FUZE<span>ARENA</span></h1>
      <p class="lead">Choisis ta classe. Tu pourras la faire évoluer jusqu’au niveau 100.</p>
      ${classGrid()}
      <label class="field">Ton pseudo
        <input id="hero-name" maxlength="14" placeholder="ex : Tu sais ce que c'est un pseudo" autocomplete="off">
      </label>
      <button class="btn primary block" data-act="create">Commencer l’aventure</button>
    </div>`;
  hydrate(app);
}

/** Fuze Arena 2.0 : de la mise en ligne à 19 h, le logo et le compte à rebours ; « Jouer » s'allume à 19 h */
let countdownTimer = null;
function renderCountdown() {
  app.innerHTML = `
    <div class="create era-wait">
      <img class="logo-img" src="icons/icon.svg?v=2" alt=""><h1 class="logo">FUZE<span>ARENA</span></h1>
      <div class="era-v">2.0</div>
      <div class="era-timer" id="era-timer"></div>
      <button class="btn primary block" id="era-play" data-act="eraPlay" disabled>Jouer</button>
    </div>`;
  const tick = () => {
    const left = E.eraStart() - Date.now(), el = document.getElementById('era-timer'), b = document.getElementById('era-play');
    if (!el) { clearInterval(countdownTimer); return; }
    el.textContent = fmt(Math.max(0, left));
    if (b) b.disabled = left > 0;
  };
  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
}

/** Fuze Arena 2.0 : un ancien compte repart de zéro et choisit la classe de son premier héros */
function renderRebirth() {
  app.innerHTML = `
    <div class="create">
      <img class="logo-img" src="icons/icon.svg?v=2" alt=""><h1 class="logo">FUZE<span>ARENA</span></h1>
      <p class="lead"><b>Bienvenue dans Fuze Arena 2.0, ${esc(rebirth.pseudo)} !</b><br>Tout le monde repart de zéro. Choisis la classe de ton premier héros.</p>
      ${classGrid()}
      <button class="btn primary block" data-act="rebirth">Commencer l’aventure</button>
    </div>`;
  hydrate(app);
}

/** En ligne, une fois le compte chargé : les autres joueurs, le tchat, le direct et la présence */
async function goOnline() {
  await refreshPlayers();
  await Promise.all([initChat(), initLive()]);
  NET.joinPresence(acc.pseudo, onPresence).catch(() => {});
}

function renderAuth(msg = '') {
  const signup = authMode === 'signup';
  app.innerHTML = `
    <div class="create">
      <img class="logo-img" src="icons/icon.svg?v=2" alt=""><h1 class="logo">FUZE<span>ARENA</span></h1>
      <div class="seg">
        <button class="${signup ? 'on' : ''}" data-act="authMode" data-mode="signup">Créer mon compte</button>
        <button class="${!signup ? 'on' : ''}" data-act="authMode" data-mode="login">Me connecter</button>
      </div>
      ${signup ? `<p class="lead">Choisis la classe de ton premier personnage.</p>${classGrid()}` : '<p class="lead">Content de te revoir !</p>'}
      <label class="field">Pseudo
        <input id="auth-pseudo" maxlength="14" placeholder="ex : Tu sais ce que c'est un pseudo" autocomplete="username">
      </label>
      <label class="field">Mot de passe (6 caractères minimum)
        <input id="auth-pass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}">
      </label>
      ${msg ? `<p class="auth-msg">${esc(msg)}</p>` : ''}
      <button class="btn primary block" data-act="auth" id="auth-btn">${signup ? 'Créer mon compte' : 'Me connecter'}</button>
    </div>`;
  hydrate(app);
}

async function doAuth() {
  const pseudo = (document.getElementById('auth-pseudo').value || '').trim();
  const pass = document.getElementById('auth-pass').value || '';
  if (!pseudo || pass.length < 6) { renderAuth('Entre un pseudo et un mot de passe de 6 caractères minimum.'); return; }
  const btn = document.getElementById('auth-btn');
  btn.disabled = true; btn.textContent = 'Connexion…';
  try {
    let row;
    if (authMode === 'signup') {
      row = await NET.signUp(pseudo, pass, E.newAccount(pseudo, pickedClass));
    } else {
      row = await NET.signIn(pseudo, pass);
      if (!row.data) { row.data = E.newAccount(row.pseudo || pseudo, pickedClass); await NET.createRow(row.pseudo || pseudo, row.data); }
    }
    if (!E.isEra(row.data)) { rebirth = { pseudo: row.pseudo || pseudo }; render(); return; }
    acc = E.migrate(row.data);
    acc.pseudo = row.pseudo || acc.pseudo;
    await refreshPlayers();
    initChat().then(() => render());
    initLive().then(() => softRender());
    NET.joinPresence(acc.pseudo, onPresence).catch(() => {});
    tab = authMode === 'signup' ? 'chests' : 'hero';
    render();
    toast(authMode === 'signup' ? 'Bienvenue ! Tu as 5 coffres à ouvrir.' : `Salut ${acc.pseudo} !`);
  } catch (e) {
    renderAuth(e.message);
  }
}

// ------------------------------ Panoplies ------------------------------
const bonusText = (b) => Object.entries(b).map(([k, v]) => `+${Math.round(v * 100)} % ${STATS[k].name}`).join(', ');

function setBox(setId) {
  const set = SETS[setId];
  const active = E.activeSets(hero).find(a => a.setId === setId);
  const n = active ? active.count : 0;
  const tier = [...SET_TIERS].reverse().find(([k]) => n >= k);
  return `
    <div class="setcard">
      <div class="sc-top"><b>${set.name}</b><span class="sc-pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span></div>
      <div class="sc-line">
        ${set.spec.map(k => `<span class="sc-st" style="--sc:${STATS[k].color}">${ico(STAT_ICON[k])}${STATS[k].short}</span>`).join('')}
        <span class="sc-tiers">${SET_TIERS.map(([k, p]) => `<i class="${tier && tier[0] === k ? 'on' : ''}">${k}p <b>+${Math.round(p * 100)}%</b></i>`).join('')}</span>
      </div>
    </div>`;
}

// ------------------------------ Vue Héros ------------------------------
function viewHero() {
  const st = E.computeStats(hero);
  const base = E.computeStats({ ...hero, equipped: {} });
  const raw = E.computeStats({ ...hero, equipped: {}, alloc: {} });   // classe + niveau seulement
  const gx = E.gearExtras(hero);
  const hp = E.maxHp(st, hero.level);
  const pts = E.freePoints(hero);
  const snap = E.snapshot(hero);
  const eq = E.equippedItems(hero);
  const all = E.classSpells(hero.classId);
  const active = hero.spells.map(id => SPELLS[id]).filter(Boolean);
  const others = all.filter(s => !hero.spells.includes(s.id));
  const need = E.xpForLevel(hero.level);
  const power = E.powerScore(snap);
  const defender = acc.heroes.length > 1 && E.strongestHero(acc) === hero;
  const xpPct = hero.level >= MAX_LEVEL ? 100 : Math.round((hero.xp / need) * 100);
  const sets = E.activeSets(hero).filter(a => a.bonus);
  const aff = E.petAffinity(eq.pet && eq.pet.itemId, hero.classId);
  const title = titleOf(acc);
  return `
    <section class="hero-banner cls-${hero.classId}">
      <div class="hb-main">
        <div class="hb-id">
          <div class="hb-name">${nameHtml(acc.pseudo, acc)}</div>
          <div class="hb-title">${title ? `« ${esc(title)} »` : 'Sans titre'}</div>
          <div class="hb-class">${CLASSES[hero.classId].name}${defender ? ' · <b>défenseur</b>' : ''}${acc.war.section ? ` · <span style="color:${WAR.sections[acc.war.section].color}">${WAR.sections[acc.war.section].name}</span>` : ''}</div>
        </div>
        ${lvlBadge(hero.level)}
      </div>
      <div class="hb-xp"><div style="width:${xpPct}%"></div><span>${hero.level >= MAX_LEVEL ? 'Niveau max !' : `XP ${hero.xp} / ${need}`}</span></div>
      <div class="hb-stats">
        <div><small>Puissance</small><b class="gold">${fmtNum(power)}</b></div>
        <div><small>Vie</small><b>${fmtNum(hp)}</b></div>
        <div><small>Victoires</small><b>${hero.stats.wins}<i>/${hero.stats.wins + hero.stats.losses}</i></b></div>
      </div>
      <div class="hb-chips">
        <span class="pill clat"><canvas class="px" data-clat></canvas>${acc.clat}</span>
        <span class="pill gold"><canvas class="px" data-key></canvas>${hero.keys}</span>
        ${E.getAltXpBonus() > 1 ? `<span class="pill green">Perso secondaire XP ×${E.getAltXpBonus()}</span>` : ''}
        ${E.getXpBonus() > 1 ? `<span class="pill green">Rattrapage +${Math.round((E.getXpBonus() - 1) * 100)} % XP</span>` : ''}
        ${acc.titles.warHero ? `<span class="pill gold">${ico('swords')} Héros de guerre ×${acc.titles.warHero}</span>` : ''}
      </div>
    </section>

    <section class="card train hx hx-gold">
      <div class="hx-head"><span class="hx-ico">${ico('swords')}</span><div><h2>Entraînement</h2></div></div>
      <div class="train-wrap framed"><canvas id="train-cv"></canvas><div class="train-rec" id="train-rec">${trainRecHtml()}</div></div>
      <div class="hero-switch">
        ${byLevel(acc.heroes).map(([h, i]) => `
          <button class="hs ${i === acc.active ? 'on' : ''}" data-act="switchHero" data-i="${i}" aria-label="${CLASSES[h.classId].name} niveau ${h.level}">
            <canvas class="px" data-portrait="${h.classId}" data-dye="${h.dye || ''}"></canvas><small>Nv.${h.level}</small>
          </button>`).join('')}
      </div>
      ${trainSpellsHtml()}
      <div class="train-stats" id="train-stats">${trainingStatsHtml()}</div>
    </section>

    <section class="card hx hx-blue stats-card">
      <div class="hx-head"><span class="hx-ico">${ico('sparkle')}</span><div><h2>Caractéristiques</h2>${pts > 0 ? '<small>Touche + pour rendre ton héros plus fort</small>' : ''}</div></div>
      ${pts > 0 ? `<div class="pts-bar"><b>${pts}</b><span>point${pts > 1 ? 's' : ''} à placer</span>
        ${pts >= 5 ? `<div class="pts-step">${[1, 5].map(n => `<button class="${statStep === n ? 'on' : ''}" data-act="statStep" data-n="${n}">+${n}</button>`).join('')}</div>` : ''}</div>` : ''}
      <div class="stat-sum">
        <div class="sum-hp"><small>${ico('heart')} Vie</small><b>${fmtNum(hp)}</b></div>
        <div><small>${ico('boom')} Critique</small><b>${Math.round(E.finalCrit(st.lck, gx.crit) * 100)} %</b><i>${gx.crit ? `dont +${pctTxt(gx.crit)} objets` : 'max 40 %'}</i></div>
        <div><small>${ico('wind')} Esquive</small><b>${Math.round(E.finalDodge(st.lck, gx.dodge) * 100)} %</b><i>${gx.dodge ? `dont +${pctTxt(gx.dodge)} objets` : 'max 25 %'}</i></div>
      </div>
      <div class="srows">
      ${STAT_KEYS.map(k => {
        const mine = hero.alloc[k] || 0, gear = st[k] - base[k], reco = statAdvice(hero.classId).includes(k);
        return `
        <div class="srow ${reco ? 'reco' : ''}" style="--sc:${STATS[k].color}">
          <span class="sr-ico">${ico(STAT_ICON[k])}</span>
          <div class="sr-txt">
            <b>${STATS[k].name}${reco ? '<em>conseillé</em>' : ''}</b>
            <span class="sr-from">${raw[k]} de base${mine ? ` <i class="p">+${mine} tes points</i>` : ''}${gear > 0 ? ` <i class="g">+${gear} objets</i>` : ''}</span>
          </div>
          <span class="sr-val">${fmtNum(st[k])}</span>
          ${pts > 0 ? `<button class="sr-plus" data-act="addStat" data-k="${k}" aria-label="Ajouter en ${STATS[k].name}">+${Math.min(statStep, pts) > 1 ? Math.min(statStep, pts) : ''}</button>` : ''}
        </div>`;
      }).join('')}
      </div>
      ${sets.length || aff ? `
        <div class="bonus-box">
          <div class="sub" style="margin:0 0 6px">BONUS ACTIFS</div>
          ${sets.map(a => `<div class="set-line on">${SETS[a.setId].name} (${a.count} pièces) : ${bonusText(a.bonus)}</div>`).join('')}
          ${aff ? `<div class="set-line on">Familier ${esc(ITEMS[eq.pet.itemId].name)} : +5 % ${STATS[aff.stat].name}</div>` : ''}
        </div>` : ''}
      ${E.spentPoints(hero) > 0 ? `<button class="btn small block st-reset" data-act="resetStats" ${acc.clat < STAT_RESET_COST ? 'disabled' : ''}>Replacer tous mes points · ${STAT_RESET_COST}<canvas class="px" data-clat></canvas></button>` : ''}
    </section>

    <section class="card spells-card hx cls-${hero.classId}">
      <div class="hx-head"><span class="hx-ico">${ico('magic')}</span><div><h2>Sorts</h2><small>${MAX_ACTIVE_SPELLS} sorts en combat · touche un sort pour l’équiper ou le retirer</small></div></div>
      <div class="spell-slots">
        ${Array.from({ length: MAX_ACTIVE_SPELLS }, (_, i) => {
          const sp = active[i];
          return sp
            ? `<button class="sslot filled" data-act="spellInfo" data-id="${sp.id}"><canvas class="px" data-spell="${sp.id}"></canvas><small>${esc(sp.name)}</small></button>`
            : `<div class="sslot"><span class="sempty">Vide</span></div>`;
        }).join('')}
      </div>
      <div class="sub">TA COLLECTION · ${all.filter(s => s.lvl <= hero.level).length} / ${all.length} DÉBLOQUÉS</div>
      <div class="spell-grid">
        ${all.map(sp => {
          const locked = sp.lvl > hero.level;
          const pos = hero.spells.indexOf(sp.id);
          return `<button class="sgrid ${locked ? 'locked' : ''} ${pos >= 0 ? 'on' : ''}" data-act="spellInfo" data-id="${sp.id}">
            <canvas class="px" data-spell="${sp.id}"></canvas>
            ${locked ? `<span class="slock">Nv.${sp.lvl}</span>` : ''}
            <small>${esc(sp.name)}</small>
          </button>`;
        }).join('')}
      </div>
    </section>`;
}

/** Fiche d'un sort : l'équiper, le retirer ou changer sa place */
function openSpell(id) {
  const sp = SPELLS[id];
  if (!sp) return;
  const locked = sp.lvl > hero.level;
  const pos = hero.spells.indexOf(id);
  const active = hero.spells.map(x => SPELLS[x]).filter(Boolean);
  const full = active.length >= MAX_ACTIVE_SPELLS;
  openModal(`
    <div class="item-head">
      <div class="big-ic spell-ic"><canvas class="px" data-spell="${id}"></canvas></div>
      <div>
        <h3>${esc(sp.name)}</h3>
        <div class="rar" style="color:var(--gold)">${locked ? `Débloqué au niveau ${sp.lvl}` : pos >= 0 ? 'Équipé' : 'Dans ta collection'}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:6px">Recharge : ${sp.cd} tours${sp.lvl > 1 ? ` · sort du niveau ${sp.lvl}` : ''}</div>
      </div>
    </div>
    <div class="spell-demo"><canvas id="spell-demo-cv"></canvas><div class="sd-out" id="sd-out">${esc(sp.name)}</div></div>
    <p style="margin:0 0 6px;line-height:1.45">${esc(sp.desc)}</p>
    ${locked ? '<p class="hint" style="margin-top:10px">Monte de niveau pour le débloquer.</p>' : pos >= 0 ? '' : full ? `
      <div class="sub">REMPLACER UN SORT ÉQUIPÉ</div>
      <div class="spell-replace">
        ${active.map((o, i) => `<button class="sslot filled" data-act="spellReplace" data-id="${id}" data-i="${i}"><canvas class="px" data-spell="${o.id}"></canvas><small>${esc(o.name)}</small></button>`).join('')}
      </div>` : ''}
    <div class="close-row">
      ${locked ? '' : pos >= 0 ? `<button class="btn danger" data-act="spellRemove" data-id="${id}">Retirer</button>` : full ? '' : `<button class="btn primary" data-act="spellEquip" data-id="${id}">Équiper</button>`}
      <button class="btn" data-act="closeModal">Fermer</button>
    </div>`);
  startSpellDemo(id);
}
/** Aperçu d'un sort : ton héros le lance en boucle sur l'épouvantail, avec ce qu'il fait à chaque fois */
let spellDemoStop = null;
function startSpellDemo(id) {
  const cv = document.getElementById('spell-demo-cv');
  if (!cv) return;
  spellDemoStop = playTraining(cv, () => {
    const me = { ...mySnap(), spells: [id] }, foe = dummySnap(hero.level);
    return { me, foe, result: E.createFight(me, foe, (Math.random() * 2 ** 31) | 0, { maxActions: 24, timeoutWinner: false, demo: id }) };
  }, { speed: 1.2, hud: 'corner', onEntry: (e) => {
    if (e.type !== 'action' || e.actor !== 0 || e.pet) return;
    const out = document.getElementById('sd-out');
    if (!out) return;
    const dmg = e.results.filter(r => r.type === 'hit' && r.target === 1).reduce((a, r) => a + r.dmg, 0);
    const crit = e.results.some(r => r.type === 'hit' && r.target === 1 && r.crit);
    const heal = e.results.filter(r => r.type === 'heal' && r.target === 0).reduce((a, r) => a + r.amount, 0);
    const parts = [dmg ? `<b>${fmtNum(dmg)}</b> dégâts${crit ? ' <em>critique !</em>' : ''}` : '', heal ? `<b class="g">+${fmtNum(heal)}</b> PV` : ''].filter(Boolean);
    out.innerHTML = parts.join(' · ') || esc(SPELLS[id].name);
    out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop');
  } });
}

// ------------------------------ Blason de niveau ------------------------------
// Il change toutes les 10 niveaux : de plus en plus précieux, avec des rivets, des gemmes, des ailes, des pointes,
// des flammes… et au niveau 100, le blason Légende avec sa couronne.
const LVL_TIERS = [
  { n: 'Bois', a: '#d9a36b', b: '#7a4a26', rim: '#3e220e', txt: '#2a1406' },
  { n: 'Bronze', a: '#ffc58f', b: '#a8612c', rim: '#4e280e', txt: '#3a1c08' },
  { n: 'Fer', a: '#e6ebf2', b: '#7c8799', rim: '#2e3442', txt: '#1c2230' },
  { n: 'Argent', a: '#ffffff', b: '#a9b8d0', rim: '#46526b', txt: '#25304a' },
  { n: 'Or', a: '#fff07a', b: '#e8901c', rim: '#6b3d07', txt: '#3a2208' },
  { n: 'Émeraude', a: '#a6ffc2', b: '#159a52', rim: '#063d20', txt: '#04260f' },
  { n: 'Saphir', a: '#b4dcff', b: '#2a62e0', rim: '#0c2a6b', txt: '#fff' },
  { n: 'Améthyste', a: '#ecc4ff', b: '#8a3ee0', rim: '#331066', txt: '#fff' },
  { n: 'Rubis', a: '#ffb0b0', b: '#d01e3a', rim: '#4a0612', txt: '#fff' },
  { n: 'Diamant', a: '#ffffff', b: '#6fdcff', rim: '#135a80', txt: '#062a40' },
  { n: 'Légende', a: '#7a3ad0', b: '#1a0633', rim: '#ffcf4a', txt: '#ffe36b' },
];
const lvlTier = (lv) => Math.min(LVL_TIERS.length - 1, Math.floor(lv / 10));
function lvlBadge(lv) {
  const t = lvlTier(lv), T = LVL_TIERS[t], id = `lb${t}`;
  const gold = t === 10 ? '#ffcf4a' : T.rim;
  const wing = (big) => `<path d="M8,30 C-6,18 -20,8 -${big ? 38 : 26},2 C-${big ? 32 : 22},14 -${big ? 30 : 20},20 -${big ? 24 : 16},26 C-${big ? 34 : 24},26 -${big ? 38 : 27},32 -${big ? 42 : 29},38 C-${big ? 30 : 20},40 -${big ? 24 : 16},42 -${big ? 18 : 12},44 C-${big ? 26 : 18},48 -${big ? 28 : 20},54 -${big ? 30 : 21},60 C-12,58 -2,54 8,56 Z"
    fill="url(#${id}w)" stroke="${gold}" stroke-width="3" stroke-linejoin="round"/>`;
  const deco = [];
  if (t >= 8) deco.push(`<g class="lb-fire"><path d="M50,-26 C62,-8 80,-4 84,16 C92,10 96,2 94,-8 C108,10 110,36 98,56 L2,56 C-10,36 -8,10 6,-8 C4,2 8,10 16,16 C20,-4 38,-8 50,-26 Z" fill="url(#${id}f)"/></g>`);
  if (t >= 6) deco.push(`<g class="lb-wings">${wing(t >= 9)}<g transform="translate(100,0) scale(-1,1)">${wing(t >= 9)}</g></g>`);
  if (t >= 7) deco.push([28, 50, 72].map((x, i) => `<path d="M${x - 7},14 L${x},${i === 1 ? -10 : -2} L${x + 7},14 Z" fill="url(#${id}g)" stroke="${gold}" stroke-width="3" stroke-linejoin="round"/>`).join(''));
  const body = `
    <polygon points="50,2 98,16 98,78 50,108 2,78 2,16" fill="${gold}"/>
    <polygon points="50,9 91,21 91,74 50,100 9,74 9,21" fill="url(#${id}g)"/>
    <polygon points="50,9 91,21 91,46 9,46 9,21" fill="#fff" opacity=".22"/>
    <polygon points="50,9 91,21 91,74 50,100 9,74 9,21" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
  if (t >= 3) deco.push(`<g class="lb-front">${[[50, 15], [85, 25], [85, 70], [50, 93], [15, 70], [15, 25]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${gold}" stroke="#fff" stroke-opacity=".5"/>`).join('')}</g>`);
  if (t >= 5) deco.push(`<g class="lb-front">${[[2, 47], [98, 47]].map(([x, y]) => `<path d="M${x},${y - 9} L${x + 7},${y} L${x},${y + 9} L${x - 7},${y} Z" fill="${t === 10 ? '#ff4a6e' : T.b}" stroke="${gold}" stroke-width="2.5"/>`).join('')}</g>`);
  if (t === 10) deco.push(`<path class="lb-front" d="M26,6 L30,-18 L40,-6 L50,-26 L60,-6 L70,-18 L74,6 Z" fill="url(#lb10c)" stroke="#6b3d07" stroke-width="3" stroke-linejoin="round"/>
    <circle class="lb-front" cx="50" cy="-8" r="4" fill="#ff4a6e" stroke="#6b3d07" stroke-width="2"/>`);
  const back = deco.filter(d => !d.includes('lb-front')), front = deco.filter(d => d.includes('lb-front'));
  return `<div class="hb-lvl t${t}" title="Blason ${T.n}" style="--lb:${T.b};--lbt:${T.txt}">
    <svg viewBox="-46 -30 192 142" aria-hidden="true"><defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.a}"/><stop offset="1" stop-color="${T.b}"/></linearGradient>
      <linearGradient id="${id}w" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.a}"/><stop offset="1" stop-color="${t === 10 ? '#ffcf4a' : T.b}"/></linearGradient>
      <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffde3a"/><stop offset=".5" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ff2a4a" stop-opacity=".2"/></linearGradient>
      <linearGradient id="lb10c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset="1" stop-color="#f2a91e"/></linearGradient>
    </defs>${back.join('')}${body}${front.join('')}</svg>
    <small>NIV.</small><b>${lv}</b><em>${T.n}</em></div>`;
}

// ------------------------------ Vue Coffres ------------------------------
function viewChests() {
  const n = hero.chest.stored;
  const keys = hero.keys || 0;
  const all = n + keys;
  const wait = E.nextChestIn(hero);
  const total = all + acc.combatChests + acc.warChests + (acc.epicChests || 0) + (acc.legendaryChests || 0);
  // barre des chances de rareté
  const oddsBar = (odds) => `
    <div class="odds-bar">${odds.map((p, r) => p > 0 ? `<i style="flex:${p};background:${RARITIES[r].color}"></i>` : '').join('')}</div>
    <div class="odds-legend">${odds.map((p, r) => p > 0 ? `<span><b style="background:${RARITIES[r].color}"></b>${RARITIES[r].name} ${p} %</span>` : '').join('')}</div>`;
  // compteur d'ouvertures depuis le début et bonus de chance
  const luckLine = (kind) => {
    if (kind === 'epic' || kind === 'legendary') return '';   // coffres offerts : pas de bonus de chance
    const L = E.chestLuck(acc, kind);
    return `<div class="v-luck"><span><b>${L.count}</b> ouvert${L.count > 1 ? 's' : ''}</span>${L.bonus ? `<span class="lk">Bonus +${L.bonus} %</span>` : ''}<span>${L.next ? `Bonus +2 % dans <b>${L.next}</b>` : 'Bonus au maximum'}</span></div>`;
  };
  const card = ({ kind, title, sub, count, cls, body, buttons, odds }) => `
    <section class="vault ${cls} ${count > 0 ? 'has' : ''}">
      <div class="v-head"><h2>${title}</h2><span class="v-count">×${count}</span></div>
      <div class="v-stage"><div class="v-rays"></div><canvas class="px" data-chest="${kind}"></canvas></div>
      <div class="v-sub">${sub}</div>
      ${body || ''}
      <div class="v-btns">${buttons}</div>
      ${luckLine(kind)}
      ${oddsBar(odds)}
    </section>`;
  return `
    <section class="vault-top">
      <div><h1>Salle des coffres</h1><p>${total ? `<b>${total}</b> coffre${total > 1 ? 's' : ''} à ouvrir pour ton ${CLASSES[hero.classId].name}` : 'Aucun coffre à ouvrir pour l’instant'}</p></div>
      <span class="pill gold"><canvas class="px" data-key></canvas>${keys} clef${keys > 1 ? 's' : ''}</span>
    </section>
    ${card({
      kind: 'normal', title: 'Coffre', count: all, cls: 'v-normal', odds: E.chestOdds(acc, 'normal'),
      sub: n >= CHEST_MAX ? 'Stock plein ! Ouvre-les vite.' : `<span data-timer="chest">Prochain coffre dans <b>${fmt(wait)}</b></span>`,
      body: `<div class="v-stock">${Array.from({ length: CHEST_MAX }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}<span>${n}/${CHEST_MAX} en stock${keys ? ` + ${keys} clef${keys > 1 ? 's' : ''}` : ''}</span></div>`,
      buttons: `<button class="btn primary" data-act="openChest" data-kind="normal" ${all > 0 ? '' : 'disabled'}>Ouvrir${n <= 0 && keys > 0 ? ' (clef)' : ''}</button>
        <button class="btn green" data-act="openAll" ${all > 1 ? '' : 'disabled'}>${all > OPEN_MAX ? `Ouvrir ${OPEN_MAX}` : `Tout ouvrir (${all})`}</button>`,
    })}
    ${card({
      kind: 'combat', title: 'Coffre de combat', count: acc.combatChests, cls: 'v-combat', odds: E.chestOdds(acc, 'combat'),
      sub: `Gagne ${WINS_PER_COMBAT_CHEST} combats d’arène pour en obtenir un. Il contient <b>2 objets</b> !`,
      body: `<div class="pips">${Array.from({ length: WINS_PER_COMBAT_CHEST }, (_, i) => `<div class="pip ${i < acc.winProgress ? 'on' : ''}"></div>`).join('')}</div>`,
      buttons: `<button class="btn danger" data-act="openChest" data-kind="combat" ${acc.combatChests > 0 ? '' : 'disabled'}>Ouvrir</button>`,
    })}
    ${card({
      kind: 'war', title: 'Coffre de guerre', count: acc.warChests, cls: 'v-war', odds: E.chestOdds(acc, 'war'),
      sub: `Gagné à la guerre des sections et au raid. <b>${WAR.warChestItems} objets</b>, jamais de Commun !`,
      buttons: `<button class="btn" style="background:linear-gradient(#d9a8ff,#8c3fe0)" data-act="openChest" data-kind="war" ${acc.warChests > 0 ? '' : 'disabled'}>Ouvrir</button>`,
    })}
    ${acc.epicChests > 0 ? card({
      kind: 'epic', title: 'Coffre Épique', count: acc.epicChests, cls: 'v-epic', odds: E.chestOdds(acc, 'epic'),
      sub: 'Un cadeau rare : <b>99 % Épique</b>, 1 % Légendaire !',
      buttons: `<button class="btn" style="--b0:#f0d0ff;--b1:#c98bff;--b2:#a64dff;--b3:#8c3fe0;--bi:#6a2bb0;--bo:#3d1666" data-act="openChest" data-kind="epic">Ouvrir</button>`,
    }) : ''}
    ${acc.legendaryChests > 0 ? card({
      kind: 'legendary', title: 'Coffre Légendaire', count: acc.legendaryChests, cls: 'v-legendary', odds: E.chestOdds(acc, 'legendary'),
      sub: 'Le plus beau des cadeaux : <b>99 % Légendaire</b>, 1 % Mythique !',
      buttons: `<button class="btn primary" data-act="openChest" data-kind="legendary">Ouvrir</button>`,
    }) : ''}`;
}

// ------------------------------ Vue Sac ------------------------------
let bagMode = 'rarity';   // 'rarity' = classé par rareté, 'slot' = par emplacement (arme, chapeau…), 'set' = par panoplie
let bagSet = 'all';       // panoplie affichée ('all', un id de panoplie ou 'pet')

function stacks() {
  const map = new Map();
  const eqUids = new Set(Object.values(hero.equipped));
  for (const it of hero.inventory) {
    const key = it.itemId + ':' + it.rarity;
    if (!map.has(key)) map.set(key, { itemId: it.itemId, rarity: it.rarity, items: [], equipped: false });
    const s = map.get(key);
    s.items.push(it);
    if (eqUids.has(it.uid)) s.equipped = true;
  }
  return [...map.values()].sort((a, b) => b.rarity - a.rarity || SLOT_ORDER.indexOf(ITEMS[a.itemId].slot) - SLOT_ORDER.indexOf(ITEMS[b.itemId].slot) || a.itemId.localeCompare(b.itemId));
}

const groupOf = (itemId) => ITEMS[itemId].set || 'pet';
const STAT_ICO = { vit: 'VIE', atk: 'ATQ', mag: 'MAG', def: 'DÉF', spd: 'VIT', lck: 'CHA' };
const STAT_ICON = { vit: 'heart', atk: 'sword', mag: 'magic', def: 'shield', spd: 'boot', lck: 'dice' };
/** Les 2 caractéristiques conseillées pour une classe (les plus importantes de son profil) */
const statAdvice = (cls) => Object.entries(E.BOT_WEIGHTS[cls] || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
let statStep = 1;   // + ajoute 1 point, ou 5 d'un coup
const SLOT_GLYPH = { hat: ico('helmet'), weapon: ico('swords'), armor: ico('shield'), boots: ico('boot'), amulet: ico('amulet'), pet: ico('paw') };
const groupName = (g) => (g === 'pet' ? 'Familiers' : SETS[g].name.replace(/^Panoplie (de |d’|du )?/, ''));

function invGrid(list) {
  return `<div class="inv">${list.map(s => `
    <button class="it r${s.rarity}" style="--rc:${RARITIES[s.rarity].color}" data-act="item" data-id="${s.itemId}" data-r="${s.rarity}">
      <canvas class="px" data-icon="${s.itemId}"></canvas>
      ${s.items.length > 1 ? `<span class="n">x${s.items.length}</span>` : ''}
      ${s.equipped ? '<span class="eq">ÉQUIPÉ</span>' : ''}
      ${s.items.length >= E.fuseNeed(s.rarity) && s.rarity < RARITIES.length - 1 ? '<span class="fu">✦</span>' : ''}
    </button>`).join('')}</div>`;
}

/** Choix d'un objet pour un emplacement : l'objet porté en haut, puis tous ceux qui vont à cet endroit */
function openSlotPicker(slot) {
  const cur = E.equippedItems(hero)[slot];
  const list = stacks().filter(s => ITEMS[s.itemId].slot === slot);
  const statsTxt = (itemId, r) => statChips(itemId, r);
  const row = (s) => `
    <button class="pick-row ${s.equipped ? 'on' : ''}" style="--rc:${RARITIES[s.rarity].color}" data-act="${s.equipped ? 'item' : 'equip'}" data-id="${s.itemId}" data-r="${s.rarity}">
      <span class="it r${s.rarity} pick-ic" style="--rc:${RARITIES[s.rarity].color}"><canvas class="px" data-icon="${s.itemId}"></canvas>${s.items.length > 1 ? `<span class="n">x${s.items.length}</span>` : ''}</span>
      <span class="pick-txt"><b>${esc(ITEMS[s.itemId].name)}</b><small style="color:${RARITIES[s.rarity].color}">${RARITIES[s.rarity].name}${ITEMS[s.itemId].set ? ` · ${esc(SETS[ITEMS[s.itemId].set].name)}` : ''}</small><small class="pick-st">${statsTxt(s.itemId, s.rarity)}</small></span>
      <span class="pick-go">${s.equipped ? 'Porté' : `${gainPill(powerGain(s.itemId, s.rarity))}Équiper`}</span>
    </button>`;
  openModal(`
    <h3>${SLOT_GLYPH[slot]} ${SLOTS[slot].name}</h3>
    <p class="hint" style="margin-top:4px">${list.length ? 'Touche un objet pour l’équiper tout de suite.' : 'Aucun objet pour cet emplacement : va ouvrir des coffres !'}</p>
    <div class="pick-list">${list.map(row).join('')}</div>
    <div class="close-row">
      ${cur ? `<button class="btn" data-act="item" data-id="${cur.itemId}" data-r="${cur.rarity}">Voir la fiche</button><button class="btn danger" data-act="unequip" data-slot="${slot}">Retirer</button>` : ''}
      <button class="btn" data-act="closeModal">Fermer</button>
    </div>`);
}

/** Gain de « Équiper le meilleur », recalculé seulement quand le sac, l'équipement ou les points changent */
let bestMemo = { key: '', gain: 0 };
function bestGainOf(h) {
  if (!h.inventory.length) return 0;
  const key = `${h.id}|${h.nextUid}|${h.inventory.length}|${h.level}|${JSON.stringify(h.equipped)}|${JSON.stringify(h.alloc)}`;
  if (bestMemo.key !== key) bestMemo = { key, gain: E.bestGear(h).gain };
  return bestMemo.gain;
}

function viewBag() {
  const eq = E.equippedItems(hero);
  const slotHtml = (slot) => {
    const it = eq[slot];
    return it
      ? `<button class="slot filled r${it.rarity}" style="--rc:${RARITIES[it.rarity].color}" data-act="slotPick" data-slot="${slot}"><canvas class="px" data-icon="${it.itemId}"></canvas><span class="sl-name">${SLOTS[slot].name}</span></button>`
      : `<button class="slot empty-slot" data-act="slotPick" data-slot="${slot}"><span class="sl-ghost">${SLOT_GLYPH[slot]}</span><span class="sl-name">${SLOTS[slot].name}</span></button>`;
  };
  const power = E.powerScore(E.snapshot(hero));
  const bestGain = bestGainOf(hero);   // le bouton « Équiper le meilleur » n'apparaît que s'il y a mieux
  const filled = Object.keys(eq).length;
  const setsOn = E.activeSets(hero).filter(a => a.bonus);
  const st = stacks();
  const eqUids = new Set(Object.values(hero.equipped));
  const commons = hero.inventory.filter(i => i.rarity === 0 && !eqUids.has(i.uid)).length;
  let body = '';
  if (!st.length) body = '<p class="empty">Ton sac est vide. Va ouvrir des coffres !</p>';
  else if (bagMode === 'rarity') {
    body = [...RARITIES].reverse().map(R => {
      const list = st.filter(s => s.rarity === R.id);
      if (!list.length) return '';
      const n = list.reduce((t, s) => t + s.items.length, 0);
      return `<div class="bag-head r${R.id}" style="--rc:${R.color}"><i class="gem"></i><span>${R.name}</span><small>${n} objet${n > 1 ? 's' : ''} · revente ${SELL_PRICE[R.id]} Flouze</small></div>${invGrid(list)}`;
    }).join('');
  } else if (bagMode === 'slot') {
    // par emplacement : chapeaux, armes, armures… (les plus rares d'abord), avec l'objet porté
    body = SLOT_ORDER.map(slot => {
      const list = st.filter(s => ITEMS[s.itemId].slot === slot).sort((a, b) => b.rarity - a.rarity);
      if (!list.length) return '';
      const n = list.reduce((t, s) => t + s.items.length, 0);
      const worn = hero.inventory.find(i => i.uid === hero.equipped[slot]);
      return `<div class="bag-head set"><span>${SLOTS[slot].name}</span><small>${n} objet${n > 1 ? 's' : ''}${worn ? ` · porté : ${esc(ITEMS[worn.itemId].name)} (${RARITIES[worn.rarity].name})` : ''}</small></div>${invGrid(list)}`;
    }).join('');
  } else {
    const groups = [...Object.keys(SETS), 'pet'];
    const owned = (g) => st.filter(s => groupOf(s.itemId) === g);
    const chips = `<div class="chips">
      <button class="chip ${bagSet === 'all' ? 'on' : ''}" data-act="bagSet" data-id="all">Toutes</button>
      ${groups.filter(g => owned(g).length).map(g => `<button class="chip ${bagSet === g ? 'on' : ''}" data-act="bagSet" data-id="${g}">${groupName(g)} <small>${owned(g).length}</small></button>`).join('')}
    </div>`;
    const show = bagSet === 'all' ? groups : [bagSet];
    body = chips + show.map(g => {
      const list = owned(g);
      if (!list.length) return bagSet === 'all' ? '' : '<p class="empty">Aucun objet de cette panoplie.</p>';
      if (g === 'pet') return `<div class="bag-head set"><span>Familiers</span><small>affinité + attaque en combat</small></div>${invGrid(list)}`;
      const slots = new Set(list.map(s => ITEMS[s.itemId].slot));
      const worn = (E.activeSets(hero).find(a => a.setId === g) || {}).count || 0;
      return `<div class="bag-head set"><span>${SETS[g].name}</span><small>${STATS[SETS[g].spec[0]].name} + ${STATS[SETS[g].spec[1]].name} · ${slots.size}/5 pièces · ${worn} portée${worn > 1 ? 's' : ''}</small></div>
        <div class="set-mini">${SET_TIERS.map(([k, p]) => `<span class="${worn >= k ? 'on' : ''}">${k} : +${Math.round(p * 100)} %</span>`).join('')}</div>
        ${invGrid(list.sort((a, b) => SLOT_ORDER.indexOf(ITEMS[a.itemId].slot) - SLOT_ORDER.indexOf(ITEMS[b.itemId].slot) || b.rarity - a.rarity))}`;
    }).join('');
  }
  return `
    <section class="card armory arm2 cls-${hero.classId}">
      <img class="dg2-bg" src="art/decors/castle.svg" alt=""><i class="arm2-shade"></i><i class="arm2-rays"></i>
      <div class="arm2-power">${ico('bolt')}<b>${fmtNum(power)}</b><small>Puissance</small></div>
      <div class="doll">
        <div class="doll-col">${['hat', 'armor', 'boots'].map(slotHtml).join('')}</div>
        <div class="doll-stage"><i class="arm2-pedestal"></i><canvas class="px" data-doll="${hero.classId}" data-pet="${eq.pet ? eq.pet.itemId : ''}" data-dye="${hero.dye || ''}"></canvas>
          <div class="doll-name">${CLASSES[hero.classId].name} <span>Nv.${hero.level}</span></div></div>
        <div class="doll-col">${['weapon', 'amulet', 'pet'].map(slotHtml).join('')}</div>
      </div>
      <div class="arm2-chips">
        <span class="${filled === 6 ? 'ok' : ''}">${ico('swords')} ${filled}/6</span>
        <span>${ico('bag')} ${hero.inventory.length}</span>
        ${setsOn.map(a => `<span class="set">${groupName(a.setId)} ${a.count}/5</span>`).join('')}
      </div>
      ${bestGain > 0 ? `<button class="btn primary block arm2-best" data-act="bestGear">${ico('bolt')} Équiper le meilleur <span class="gain up">▲ +${fmtNum(bestGain)}</span></button>` : ''}
    </section>
    <section class="card hx bag-card ${infoCls('bag')}" data-info="bag" style="--hc:#c9a24a">
      ${secHead(ico('bag'), 'Sac', `${hero.inventory.length} objet${hero.inventory.length > 1 ? 's' : ''}${countFusable() ? ` · <b class="fuse-hint">${countFusable()} fusion${countFusable() > 1 ? 's' : ''} possible${countFusable() > 1 ? 's' : ''}</b>` : ''}`)}
      <div class="rar-strip">${RARITIES.map(R => { const n = hero.inventory.filter(i => i.rarity === R.id).length; return `<div class="${n ? '' : 'none'}" style="--rc:${R.color}"><i></i><b>${n}</b><small>${R.name}</small></div>`; }).join('')}</div>
      <div class="seg seg3" style="margin-bottom:12px">
        <button class="${bagMode === 'rarity' ? 'on' : ''}" data-act="bagMode" data-mode="rarity">Par rareté</button>
        <button class="${bagMode === 'slot' ? 'on' : ''}" data-act="bagMode" data-mode="slot">Par type</button>
        <button class="${bagMode === 'set' ? 'on' : ''}" data-act="bagMode" data-mode="set">Par panoplie</button>
      </div>
      ${countFusable() ? `<button class="btn small block fuse-all" style="margin-bottom:12px;background:linear-gradient(#c58bff,#8c3fe0)" data-act="fuseAll">${ico('sparkle')} Tout fusionner</button>` : ''}
      ${body}
      ${commons ? `<button class="btn small block sell-all" style="margin-top:14px" data-act="sellCommons">Vendre tous les Communs non équipés (${commons}) · +${commons * SELL_PRICE[0]}<canvas class="px" data-clat></canvas></button>` : ''}
      <div class="more-txt">2 objets identiques (même objet, même rareté) = 1 objet de la rareté au-dessus. Mythique et Chaotique ne s’obtiennent que par fusion : il faut <b>3 Légendaires</b> identiques pour 1 Mythique, et <b>3 Mythiques</b> pour 1 Chaotique. Touche un objet pour l’équiper, le fusionner ou le vendre. L’objet équipé n’est jamais vendu.</div>
      ${moreBtn('bag')}
    </section>`;
}

/** Liste des objets obtenus par « Tout fusionner », les plus rares d'abord */
const FUSE_SHOW = 20;   // au plus 20 lignes (les meilleures) : une longue liste d'images faisait ramer les téléphones
function fuseSummary(made) {
  const groups = {};
  for (const it of made) (groups[it.itemId + ':' + it.rarity] ||= { ...it, n: 0 }).n++;
  const all = Object.values(groups).sort((a, b) => b.rarity - a.rarity);
  const more = all.length - FUSE_SHOW, rest = all.slice(FUSE_SHOW).reduce((t, g) => t + g.n, 0);
  return all.slice(0, FUSE_SHOW).map(g => `
    <div class="fl-row" style="--rc:${RARITIES[g.rarity].color}">
      <span class="it r${g.rarity}" style="--rc:${RARITIES[g.rarity].color}"><canvas class="px" data-icon="${g.itemId}"></canvas></span>
      <b>${esc(ITEMS[g.itemId].name)}</b><small>${RARITIES[g.rarity].name}${g.n > 1 ? ` ×${g.n}` : ''}</small>
    </div>`).join('') + (more > 0 ? `<p class="hint fl-more">… et ${rest} autre${rest > 1 ? 's' : ''} objet${rest > 1 ? 's' : ''} plus faible${rest > 1 ? 's' : ''}</p>` : '');
}

/** Puissance du héros s'il portait cet objet, comparée à maintenant (null si c'est déjà l'objet porté) */
function powerGain(itemId, rarity) {
  const st = E.stackOf(hero, itemId, rarity);
  const slot = ITEMS[itemId].slot;
  if (!st.length || st.some(s => s.uid === hero.equipped[slot])) return null;
  const now = E.powerScore(E.snapshot(hero));
  const then = E.powerScore(E.snapshot({ ...hero, equipped: { ...hero.equipped, [slot]: st[0].uid } }));
  return then - now;
}
const gainPill = (g, big = false) => g === null ? '' : g > 0 ? `<span class="gain up ${big ? 'big' : ''}">▲ +${fmtNum(g)}</span>` : g < 0 ? `<span class="gain down ${big ? 'big' : ''}">▼ ${fmtNum(g)}</span>` : `<span class="gain eq ${big ? 'big' : ''}">= égal</span>`;
/** Tuiles de stats d'un objet : icône et valeur (l'écart global est la puissance, dans l'en-tête) */
function statTiles(itemId, rarity) {
  const stats = E.itemStats(itemId, rarity);
  const keys = STAT_KEYS.filter(k => stats[k] > 0);
  keys.sort((a, b) => (stats[b] || 0) - (stats[a] || 0));
  const max = Math.max(1, ...keys.map(k => stats[k] || 0));
  return `<div class="stiles">${keys.map(k => {
    const v = stats[k] || 0;
    return `<div class="stile ${v ? '' : 'lost'}" style="--sc:${STATS[k].color}">
      <span class="sti-ic">${ico(STAT_ICON[k])}</span>
      <span class="sti-txt"><b>${v ? '+' + fmtNum(v) : '0'}</b><small>${STATS[k].name}</small></span>
      <i class="sti-bar" style="width:${Math.round(100 * v / max)}%"></i>
    </div>`;
  }).join('')}</div>`;
}
/** Critique et esquive de l'objet (à partir de Légendaire), en pastilles */
function extraChips(itemId, rarity) {
  if (ITEMS[itemId].slot === 'pet') return '';
  const x = E.itemExtras(itemId, rarity);
  if (!x.crit && !x.dodge) return '';
  const chip = (cls, icon, name, v) => `<span class="xchip ${cls}">${ico(icon)}<b>+${pctTxt(v)}</b> ${name}</span>`;
  return `<div class="xchips">${chip('crit', 'boom', 'critique', x.crit)}${chip('dodge', 'wind', 'esquive', x.dodge)}</div>`;
}
/** Petites pastilles de stats (listes d'objets) */
const statChips = (itemId, r, n = 3) => Object.entries(E.itemStats(itemId, r)).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([k, v]) => `<i class="schip" style="--sc:${STATS[k].color}">${STATS[k].short}<b>${fmtNum(v)}</b></i>`).join('');


const pctTxt = (v) => `${Math.round(v * 1000) / 10} %`;

function openItem(itemId, rarity) {
  const it = ITEMS[itemId];
  const stack = E.stackOf(hero, itemId, rarity);
  if (!stack.length) { closeModal(); render(); return; }
  const stats = E.itemStats(itemId, rarity);
  const slot = it.slot;
  const curUid = hero.equipped[slot];
  const isEq = stack.some(s => s.uid === curUid);
  const cur = !isEq && curUid ? hero.inventory.find(i => i.uid === curUid) : null;
  const need = E.fuseNeed(rarity);
  const canFuse = stack.length >= need && rarity < RARITIES.length - 1;
  const spare = stack.filter(s => s.uid !== curUid).length;
  const R = RARITIES[rarity];
  const next = RARITIES[rarity + 1];
  const gain = powerGain(itemId, rarity);
  // gain de puissance si on le porte : juste la flèche et la valeur, dans l'en-tête
  const gainTxt = isEq || gain === null ? '' : gain > 0 ? `<span class="ih-gain up">▲ +${fmtNum(gain)}</span>` : gain < 0 ? `<span class="ih-gain down">▼ ${fmtNum(gain)}</span>` : '<span class="ih-gain eq">=</span>';
  openModal(`
    <div class="ihero" style="--rc:${R.color}">
      <div class="ih-art"><canvas class="px" data-icon="${itemId}"></canvas>${stack.length > 1 ? `<span class="ih-n">×${stack.length}</span>` : ''}</div>
      <div class="ih-txt">
        <span class="ih-rar">${R.name}</span>
        <h3>${esc(it.name)}</h3>
        <small>${SLOTS[slot].name}${it.set ? ` · ${esc(SETS[it.set].name)}` : ''}</small>
      </div>
      ${gainTxt}
    </div>
    ${statTiles(itemId, rarity)}
    ${extraChips(itemId, rarity)}
    ${it.set ? setBox(it.set) : ''}
    ${PETS[itemId] ? petBox(itemId, rarity) : ''}
    ${canFuse ? `
      <div class="fuse-box">
        <div style="font-weight:800">Fusion disponible !</div>
        <div class="fuse-anim" id="fuse-anim">
          ${Array.from({ length: need }, () => `<div class="it" style="--rc:${R.color}"><canvas class="px" data-icon="${itemId}"></canvas></div>`).join('<b>+</b>')}
          <b>→</b>
          <div class="it" style="--rc:${next.color}"><canvas class="px" data-icon="${itemId}"></canvas></div>
        </div>
        <div class="fuse-st">${Object.entries(E.itemStats(itemId, rarity + 1)).map(([k, v]) => `<span style="--sc:${STATS[k].color}">${STATS[k].short} <s>${fmtNum(stats[k] || 0)}</s> → <b>${fmtNum(v)}</b></span>`).join('')}</div>
        <button class="btn block" style="margin-top:12px;background:linear-gradient(#c58bff,#8c3fe0)" data-act="fuse" data-id="${itemId}" data-r="${rarity}">Fusionner en ${next.name}</button>
      </div>` : ''}
    ${spare ? `<div class="sell-row"><button class="sell-btn" data-act="sellAsk" data-id="${itemId}" data-r="${rarity}"><canvas class="px" data-clat></canvas>Vendre · ${SELL_PRICE[rarity]} pièce</button></div>` : ''}
    <div class="close-row">
      ${isEq
        ? `<button class="btn" data-act="unequip" data-slot="${slot}">Retirer</button>`
        : `<button class="btn primary" data-act="equip" data-id="${itemId}" data-r="${rarity}">Équiper</button>`}
      <button class="btn" data-act="closeModal">Fermer</button>
    </div>`);
}
/** Confirmation avant de vendre (pour ne rien vendre par erreur) */
function openSellConfirm(itemId, rarity) {
  const it = ITEMS[itemId], R = RARITIES[rarity];
  const spare = E.stackOf(hero, itemId, rarity).filter(s => s.uid !== hero.equipped[it.slot]).length;
  if (!spare) return;
  const p = SELL_PRICE[rarity];
  openModal(`
    <div class="sell-confirm" style="--rc:${R.color}">
      <div class="it r${rarity} sc-ic" style="--rc:${R.color}"><canvas class="px" data-icon="${itemId}"></canvas></div>
      <h3>Vendre ${esc(it.name)} ?</h3>
      <p class="hint"><b style="color:${R.color}">${R.name}</b> · tu en as ${spare} en trop${E.stackOf(hero, itemId, rarity).length > spare ? ' (celui que tu portes est gardé)' : ''}. Une vente ne s’annule pas.</p>
      <div class="sell-choices">
        <button class="btn danger" data-act="sell" data-id="${itemId}" data-r="${rarity}" data-n="1">Vendre 1 · +${p}<canvas class="px" data-clat></canvas></button>
        ${spare > 1 ? `<button class="btn danger" data-act="sell" data-id="${itemId}" data-r="${rarity}" data-n="${spare}">Vendre les ${spare} · +${spare * p}<canvas class="px" data-clat></canvas></button>` : ''}
        <button class="btn" data-act="item" data-id="${itemId}" data-r="${rarity}">Annuler</button>
      </div>
    </div>`, { center: true });
}

/** Fiche d'un familier : son affinité de classe et son attaque */
function petBox(itemId, rarity) {
  const P = PETS[itemId];
  const on = P.aff[0] === hero.classId;
  const boost = Math.round(20 * rarity);
  return `
    <div class="set-box pet-box">
      <div class="row"><b>Attaque : ${esc(P.atk.name)}</b><span class="spacer"></span><span class="pill">toutes les ${PET_EVERY} actions</span></div>
      <div class="set-line">${esc(P.atk.desc)}${boost ? ` <b style="color:var(--green)">+${boost} % (rareté)</b>` : ''}</div>
      <div class="set-line ${on ? 'on' : ''}">Affinité ${CLASSES[P.aff[0]].name} : +5 % ${STATS[P.aff[1]].name}${on ? ' ✓' : ` (ton perso est ${CLASSES[hero.classId].name})`}</div>
    </div>`;
}

// ------------------------------ Vue Combats ------------------------------
// ------------------------------ En-tête commun des modes de combat ------------------------------
/** Bandeau d'un mode : dessin, titre, 3 compteurs, et les règles cachées derrière le « + » jaune */
function modeHead({ id, c, art, title, sub, chips = [], extra = '', info }) {
  return `
    <section class="card mhead ${infoCls(id)}" data-info="${id}" style="--tc:${c}">
      <div class="mh-top">
        <span class="mh-art">${art}</span>
        <div class="mh-txt"><h2>${title}</h2>${sub ? `<small>${sub}</small>` : ''}</div>
      </div>
      ${chips.length ? `<div class="mh-chips">${chips.join('')}</div>` : ''}
      ${extra}
      <div class="more-txt">${info}</div>
      ${moreBtn(id)}
    </section>`;
}
const mchip = (ico, label, val, cls = '') => `<div class="mchip ${cls}"><span class="mc-ico">${ico}</span><small>${label}</small><b>${val}</b></div>`;
const secHead = (ico, title, sub = '', right = '') => `<div class="hx-head"><span class="hx-ico">${ico}</span><div><h2>${title}</h2>${sub ? `<small>${sub}</small>` : ''}</div>${right}</div>`;
/** Sa puissance comparée à la tienne */
function powerCmp(foeSnap) {
  const r = E.powerScore(foeSnap) / Math.max(1, E.powerScore(E.snapshot(hero)));
  if (r > 1.12) return '<span class="cmp hard">Costaud</span>';
  if (r < 0.88) return '<span class="cmp easy">Facile</span>';
  return '<span class="cmp even">Serré</span>';
}
const foeAv = (o) => `<span class="foe-av"><canvas class="px" data-portrait="${o.classId}" data-dye="${o.dye || ''}"></canvas></span>`;
const foeInfo = (o, data = o.data) => `
  <div class="foe-body">
    <div class="foe-name">${dotHtml(o.id)}${nameHtml(o.name, data)}</div>
    <div class="foe-sub">${CLASSES[o.classId].name} · Nv.${o.level} · ${ico('bolt')}${E.powerScore(o.snap)}</div>
    ${powerCmp(o.snap)}
  </div>`;

function viewFights() {
  const list = opponents();
  const todo = list.filter(o => !o.done), done = list.filter(o => o.done);
  const clatGot = acc.fights.clat || {};
  return modeHead({
    id: 'arena', c: '#ff5d6c', art: '<canvas class="px" data-emblem="arena"></canvas>',
    title: 'Arène', sub: '',
    chips: [
      mchip(ico('swords'), 'Combats classés', `${todo.length} / ${list.length}`, todo.length ? 'hot' : ''),
      mchip('<canvas class="px" data-chest="combat"></canvas>', 'Coffre de combat', `${acc.winProgress} / ${WINS_PER_COMBAT_CHEST}`),
      mchip(ico('clock'), 'Remise à zéro', `<span data-timer="day3">${fmt(msToMidnight())}</span>`),
    ],
    info: `<b>${ico('swords')} Combat classé</b> : bats chacun de tes potes une fois par jour. Tant que tu ne l’as pas battu, tu peux le réattaquer autant que tu veux (une défaite ne rapporte rien). Chaque victoire avance ton coffre de combat (${WINS_PER_COMBAT_CHEST} victoires = 1 coffre). Tout repart à zéro à minuit. L’Arène ne rapporte pas d’XP.<br><br>
      <b>↻ Revanche</b> : une fois le combat classé fait, rejoue autant que tu veux, pour le fun. La 1ʳᵉ revanche gagnée contre chaque pote rapporte <b>${REMATCH_CLAT} Flouze</b> par jour.<br><br>
      <b>Costaud · Serré · Facile</b> : sa puissance comparée à la tienne.`,
  }) + `
    <section class="card hx" style="--hc:#ff5d6c">
      ${secHead(ico('swords'), 'À combattre', '', `<span class="pill ${todo.length ? 'red' : 'green'}">${todo.length}</span>`)}
      <div class="ar2-chest">${Array.from({ length: WINS_PER_COMBAT_CHEST }, (_, i) => `<i class="${i < acc.winProgress ? 'on' : ''}">${ico('swords')}</i>`).join('<b></b>')}<b></b><span class="ar2-box ${acc.winProgress >= WINS_PER_COMBAT_CHEST - 1 ? 'near' : ''}"><canvas class="px" data-chest="combat"></canvas></span></div>
      ${!list.length ? `<p class="empty">${NET.online ? 'Personne d’autre n’est encore inscrit. Invite tes potes !' : 'Aucun adversaire.'}</p>`
        : !todo.length ? '<div class="all-done">✓ Tous tes combats classés sont faits !<small>Nouveaux combats à minuit.</small></div>' : ''}
      <div class="ar2-grid">${todo.map(o => fighterCard(o)).join('')}</div>
    </section>
    ${done.length ? `
    <section class="card hx" style="--hc:#9d93d6">
      ${secHead('↻', 'Revanches')}
      <div class="ar2-grid">${done.map(o => fighterCard(o, true, clatGot[o.id])).join('')}</div>
    </section>` : ''}`;
}

/** Carte d'un adversaire de l'arène : son perso sur le sable de l'arène, sa force, et le bouton */
function fighterCard(o, done = false, got = false) {
  return `
    <div class="ar2 ${done ? 'done' : ''}">
      <div class="ar2-stage">
        <img class="dg2-bg" src="art/decors/arena.svg" alt="" loading="lazy"><i class="dg2-shade"></i>
        <canvas class="px" data-portrait="${o.classId}" data-dye="${o.dye || ''}"></canvas>
        <span class="ar2-lv">Nv.${o.level}</span>
        ${done ? '<span class="ar2-stamp">Gagné</span>' : ''}
      </div>
      <div class="ar2-info">
        <b>${dotHtml(o.id)}${nameHtml(o.name, o.data)}</b>
        <small>${ico('bolt')}${fmtNum(E.powerScore(o.snap))} ${powerCmp(o.snap)}</small>
      </div>
      ${done
        ? `<button class="ar2-btn re" data-act="friendly" data-id="${o.id}">↻ Revanche${got ? '' : ` <em>+${REMATCH_CLAT}<canvas class="px ico" data-clat></canvas></em>`}</button>`
        : `<button class="ar2-btn" data-act="fight" data-id="${o.id}">${ico('swords')} Combattre</button>`}
    </div>`;
}

// Charges qui reviennent une par une : petit chrono « +1 dans 2:13:05 » (mis à jour chaque seconde)
const chargeLine = (ms) => ms > 0 ? `<span class="charge-in">+1 dans <b data-charge="${Date.now() + ms}">${fmt(ms)}</b></span>` : '';
const chargeText = (n, ms, where) => `${n ? `Encore ${n} charge${n > 1 ? 's' : ''} ${where}` : `Plus de charge ${where}`}${ms > 0 ? ` · la prochaine revient dans ${fmt(ms)}` : ''}.`;

// ------------------------------ Vue Donjons ------------------------------
function viewDungeons() {
  const left = E.totalRunsLeft(hero);
  const open = DUNGEONS.filter(d => hero.level >= d.lvl).sort((a, b) => b.lvl - a.lvl);   // le plus dur (le plus rentable) en haut
  const lockedList = DUNGEONS.filter(d => hero.level < d.lvl);
  const nextLocked = lockedList[0], moreLocked = Math.max(0, lockedList.length - 1);
  return modeHead({
    id: 'dungeons', c: '#4cd964', art: '<canvas class="px" data-emblem="dungeons"></canvas>',
    title: 'Donjons', sub: '',
    chips: [
      mchip(ico('swords'), 'Combats dispo', left, left ? 'hot' : ''),
      mchip('<canvas class="px" data-key></canvas>', 'Clefs du jour', `${E.keysEarned(hero)} / ${DUNGEON_KEYS_MAX}`, E.keysLeftToEarn(hero) ? '' : 'full'),
      mchip(ico('clock'), 'Recharge', `1 toutes les ${RECHARGE.ms / 3600000} h`),
    ],
    info: `Chaque entrée est une <b>vague</b> : 2 monstres différents d’affilée, puis le boss. Tes PV ne remontent presque pas entre deux combats : si tu tombes, la vague s’arrête. Chaque donjon a <b>2 boss possibles</b>, tirés au hasard.<br><br>
      Chaque donjon a <b>${DUNGEON_RUNS} charges</b>, pour chacun de tes persos. Une charge utilisée revient au bout de <b>${RECHARGE.ms / 3600000} h</b> (le chrono démarre quand tu entres) : reviens plusieurs fois dans la journée !<br><br>
      Bats le boss : de l’XP et <b>1 clef</b> (1 clef = 1 coffre), jusqu’à <b>${DUNGEON_KEYS_MAX} clefs par jour</b> (remise à minuit). Ensuite, tu gagnes seulement l’XP. Chaque monstre battu rapporte un peu d’XP en plus, et même en cas de défaite tu gagnes un peu d’XP.<br><br>
      <b>${ico('skip')} Passer</b> : tes ${DUNGEON_SKIP_KEEP} donjons débloqués les plus durs se font en vrai. Les autres peuvent être passés d’un coup : tu reçois les récompenses de tes vagues restantes, mais avec <b>la moitié de l’XP</b>.`,
  }) + `
    <section class="card hx" style="--hc:#4cd964">
      ${secHead(ico('skull'), 'Choisis ton donjon', `${open.length} / ${DUNGEONS.length} débloqués`)}
      <div class="dg2-list">
        ${open.map((d, i) => dungeonCard(d, i === 0)).join('')}
        ${nextLocked ? dungeonCard(nextLocked, false) : ''}
        ${moreLocked ? `<div class="dg2-more">${ico('lock')} Encore ${moreLocked} donjon${moreLocked > 1 ? 's' : ''} à débloquer en montant de niveau</div>` : ''}
      </div>
    </section>`;
}

/** Une carte de donjon : son décor en fond, son boss en grand, ce qu'il rapporte et ses charges */
const THEME_C = { cave: '#8c7bff', forest: '#4cd964', crypt: '#b8c2d0', swamp: '#8fd16b', mine: '#e0a060', volcano: '#ff6a3d', glacier: '#7fd4ff', castle: '#c58bff', abyss: '#b05cff', meeting: '#ff5d6c' };
function dungeonCard(d, top) {
  const locked = hero.level < d.lvl, n = locked ? 0 : E.runsLeft(hero, d);
  const skip = !locked && n > 0 && E.canSkipDungeon(hero, d), keyOk = E.keysLeftToEarn(hero) > 0;
  const wait = !locked && n < DUNGEON_RUNS ? E.dungeonNextIn(hero, d) : 0;
  return `
    <div class="dg2 ${locked ? 'locked' : ''} ${!locked && !n ? 'empty' : ''} ${top ? 'top' : ''}" style="--dc:${THEME_C[d.theme] || '#4cd964'}">
      <img class="dg2-bg" src="art/decors/${d.theme}.svg" alt="" loading="lazy"><i class="dg2-shade"></i>
      ${top ? '<span class="dg2-ribbon">Recommandé</span>' : ''}
      <div class="dg2-boss"><canvas class="px" data-monster="${d.sprite}"></canvas>${d.alt ? `<canvas class="px alt" data-monster="${d.alt.sprite}"></canvas>` : ''}</div>
      <div class="dg2-info">
        <span class="dg2-lv">Nv.${d.lvl}</span>
        <b>${d.name}</b>
        <small>${d.boss}${d.alt ? ` ou ${d.alt.boss}` : ''}</small>
        ${locked ? `<span class="dg2-lock">${ico('lock')} Niveau ${d.lvl} requis</span>` : `
        <div class="dg2-rw"><span>+${fmtNum(E.waveXp(d))} XP</span><span class="${keyOk ? '' : 'off'}"><canvas class="px" data-key></canvas>+1</span></div>`}
      </div>
      ${locked ? '' : `
      <div class="dg2-go">
        <span class="dg2-pips">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(DUNGEON_RUNS - n)}</span>
        <button class="dg2-enter" data-act="dungeon" data-id="${d.id}" ${n > 0 ? '' : 'disabled'}>${n > 0 ? 'Entrer' : 'Recharge'}</button>
        ${skip ? `<button class="dg2-skip" data-act="skipDungeon" data-id="${d.id}"><span>${ico('skip')} Passer ×${n}</span><small>½ XP</small></button>` : ''}
        ${wait > 0 ? `<span class="dg2-wait">+1 dans <b data-charge="${Date.now() + wait}">${fmt(wait)}</b></span>` : ''}
      </div>`}
    </div>`;
}

// ------------------------------ Vue Classement ------------------------------
/** Le familier équipé d'un perso (pour l'afficher) */
const petOf = (h) => { const uid = h.equipped && h.equipped.pet; const it = uid && h.inventory.find(i => i.uid === uid); return it ? it.itemId : ''; };

function rankingEntries(key = rankMode) {
  ensureDay();
  const wins = (a) => a.heroes.reduce((t, h) => t + h.stats.wins, 0);
  const tow = (a) => Math.max(0, ...a.heroes.map(h => (h.tower && h.tower.best) || 0));
  const sh = E.strongestHero(acc);
  const hor = (a) => (a.horde && a.horde.best) || 0;
  const pow = (h) => Math.round(E.powerScore(E.snapshot(h)));   // puissance du perso le plus fort
  const me = { id: myId(), name: acc.pseudo, data: acc, classId: sh.classId, dye: sh.dye, pet: petOf(sh), level: sh.level, power: pow(sh), wins: wins(acc), tower: tow(acc), horde: hor(acc), me: true };
  let rest;
  if (NET.online) {
    rest = players.map(p => { const h = E.strongestHero(p.data); return { id: p.id, name: p.pseudo, data: p.data, classId: h.classId, dye: h.dye, pet: petOf(h), level: h.level, power: pow(h), wins: wins(p.data), tower: tow(p.data), horde: hor(p.data) }; });
  } else {
    const totalMine = hero.stats.wins + hero.stats.losses;
    rest = opponents().map(o => {
      const r = makeRng(hashStr('rank' + o.id));
      return { name: o.name, classId: o.classId, level: o.level, power: Math.round(E.powerScore(o.snap)), wins: Math.round(totalMine * (0.3 + r() * 0.6)), tower: Math.round(o.level * 0.75), horde: Math.max(1, Math.round(o.level / 4)) };
    });
  }
  return [me, ...rest].sort((a, b) => b[key] - a[key] || b.wins - a.wins || (b.me ? 1 : 0) - (a.me ? 1 : 0));
}

const RANK_MODES = [['level', 'Niveau'], ['wins', 'Victoires'], ['tower', 'Tour'], ['horde', 'Horde']];
const rankScore = (key) => (e) => (key === 'power' ? `Puiss. ${fmtNum(e.power)}` : key === 'level' ? `Nv.${e.level}` : key === 'wins' ? `${e.wins} V` : key === 'tower' ? `Étage ${e.tower}` : `${e.horde} monstres`);

function viewRanking() {
  const list = rankingEntries();
  const key = rankMode;
  const medal = [ico('medal1'), ico('medal2'), ico('medal3')];
  const scoreOf = rankScore(key);
  const myPos = list.findIndex(e => e.me) + 1;
  return modeHead({
    id: 'ranking', c: '#ffd45a', art: '<canvas class="px" data-emblem="ranking"></canvas>',
    title: 'Classement', sub: '',
    chips: [
      mchip(ico('trophy'), 'Ta place', `${myPos} / ${list.length}`, myPos <= 3 ? 'hot' : ''),
      mchip(ico('medal1'), 'En tête', esc(list[0].name)),
      mchip(ico('star'), 'Ton score', scoreOf(list[myPos - 1])),
    ],
    info: `<b>Niveau</b> : ton perso le plus fort. <b>Victoires</b> : celles de tous tes persos. <b>Tour</b> : ton meilleur étage. <b>Horde</b> : ton record de monstres battus.<br><br>Touche un joueur pour voir sa carte.${NET.online ? '' : '<br><br>Hors ligne : tes amis sont des bots.'}`,
  }) + `
    <section class="card hx" style="--hc:#ffd45a">
      <div class="seg seg4">${RANK_MODES.map(([k, n]) => `<button class="${key === k ? 'on' : ''}" data-act="rank" data-mode="${k}">${n}</button>`).join('')}</div>
      ${podium(list, scoreOf)}
      ${list.slice(3).map((e, j) => ({ e, i: j + 3 })).map(({ e, i }) => `
        <button class="opp rank ${e.me ? 'me' : ''}" ${e.id ? `data-act="playerCard" data-id="${e.id}"` : ''}>
          <div class="pos">${medal[i] || i + 1}</div>
          <div class="av"><canvas class="px" data-portrait="${e.classId}" data-dye="${e.dye || ''}"></canvas></div>
          <div class="o-body">
            <div class="o-name">${dotHtml(e.id)}${nameHtml(e.name, e.data)}${e.me ? ' <span class="pill gold">toi</span>' : ''}</div>
            <div class="o-sub">${CLASSES[e.classId].name} ${titleHtml(e.data)}</div>
          </div>
          <div class="score">${scoreOf(e)}</div>
        </button>`).join('')}
    </section>`;
}

/** Message de podium d'un joueur (les 3 premiers peuvent en écrire un) */
const podMsg = (e) => (e.data && e.data.podiumMsg && e.data.podiumMsg.text) || '';

/** Podium des 3 premiers (2e à gauche, 1er au milieu, 3e à droite), avec leur message au-dessus de la tête */
function podium(list, scoreOf, { bubbles = false } = {}) {
  const top = list.slice(0, 3);
  if (!top.length) return '';
  const order = [1, 0, 2].filter(i => top[i]);
  if (bubbles) return podiumStage(top, order, scoreOf);
  return `<div class="podium">${order.map(i => {
    const e = top[i];
    return `
    <button class="pod p${i + 1} ${e.me ? 'me' : ''}" ${e.id ? `data-act="playerCard" data-id="${e.id}"` : ''}>
      ${i === 0 ? `<span class="pod-crown">${ico('crown')}</span>` : ''}
      <div class="pod-av"><canvas class="px" data-portrait="${e.classId}" data-dye="${e.dye || ''}"></canvas></div>
      <div class="pod-name">${dotHtml(e.id)}${nameHtml(e.name, e.data)}</div>
      <div class="pod-score">${scoreOf(e)}</div>
      <div class="pod-step"><span>${ico(['medal1', 'medal2', 'medal3'][i])}</span><b>${i + 1}</b></div>
    </button>`;
  }).join('')}</div>`;
}

/** La couronne du podium posée juste au-dessus de la tête du 1er (on cherche le haut de son dessin, quelle que soit sa classe), la bulle au-dessus */
function placeCrown() {
  const pod = document.querySelector('.pstage .pod.p1');
  const cv = pod && pod.querySelector('.pod-av canvas'), cr = pod && pod.querySelector('.pod-crown');
  if (!cv || !cr || !cv.width) return;
  const x0 = Math.round(cv.width * 0.42), x1 = Math.round(cv.width * 0.78), w = x1 - x0;
  let data;
  try { data = cv.getContext('2d').getImageData(x0, 0, w, cv.height).data; } catch (e) { return; }
  let top = -1;
  for (let y = 0; y < cv.height && top < 0; y++) {
    let n = 0;   // une vraie ligne du dessin, pas une étincelle d'aura
    for (let i = 0; i < w; i++) if (data[(y * w + i) * 4 + 3] > 80 && ++n >= 6) { top = y; break; }
  }
  if (top < 0) return;
  const r = cv.getBoundingClientRect(), p = pod.getBoundingClientRect();
  const crownTop = Math.round(r.top - p.top + top * r.height / cv.height - cr.offsetHeight + 8);
  cr.style.top = crownTop + 'px';
  const b = pod.querySelector('.pod-bubble');
  if (b) b.style.bottom = Math.round(p.height - crownTop + 4) + 'px';
}

/** Le podium du Social : une remise des prix sur scène (rideaux, projecteurs, confettis), les héros debout sur les marches */
function podiumStage(top, order, scoreOf) {
  const conf = Array.from({ length: 16 }, (_, k) => `<i style="--x:${(k * 37) % 100}%;--d:${(k * 0.53) % 4}s;--c:${['#ffd84a', '#ff5d6c', '#4cd964', '#3d9bff', '#c58bff'][k % 5]};--r:${(k * 47) % 360}deg"></i>`).join('');
  return `
    <div class="pstage">
      <img class="dg2-bg" src="art/decors/meeting.svg" alt=""><i class="ps-shade"></i>
      <i class="ps-beam b2"></i><i class="ps-beam b1"></i><i class="ps-beam b3"></i>
      <div class="ps-confetti">${conf}</div>
      <div class="podium big">${order.map(i => {
        const e = top[i], msg = podMsg(e);
        return `
        <button class="pod p${i + 1} ${e.me ? 'me' : ''}" ${e.id ? `data-act="playerCard" data-id="${e.id}"` : ''}>
          ${msg ? `<span class="pod-bubble">${esc(msg)}</span>` : ''}
          ${i === 0 ? `<span class="pod-crown">${ico('crown')}</span>` : ''}
          <div class="pod-av"><canvas class="px" data-hero="${e.classId}" data-pet="${e.pet || ''}" data-dye="${e.dye || ''}"></canvas></div>
          <div class="pod-step">
            <span class="ps-medal">${ico(['medal1', 'medal2', 'medal3'][i])}</span>
            <div class="pod-name">${dotHtml(e.id)}${nameHtml(e.name, e.data)}</div>
            <div class="pod-score">${scoreOf(e)}</div>
          </div>
        </button>`;
      }).join('')}</div>
    </div>`;
}

// ------------------------------ Vue Guerre ------------------------------
const fmtLong = (ms) => { const d = Math.floor(ms / 86400000); return (d > 0 ? `${d} j ` : '') + fmt(ms % 86400000); };
const secTag = (sec) => `<b style="color:${WAR.sections[sec].color}">${WAR.sections[sec].name}</b>`;

const WAR_RULES = () => `<details class="rules"><summary>Règles de la guerre</summary>${WAR_RULES_UL()}</details>`;
const WAR_RULES_UL = () => `
    <ul class="rules-ul">
      <li>2 camps de ${WAR.maxPerSection} joueurs maximum : les <b style="color:${WAR.sections.rouge.color}">Assassins</b> et les <b style="color:${WAR.sections.bleue.color}">Templiers</b>. Chacun choisit le sien pour la semaine.</li>
      <li>Une guerre dure 7 jours complets, puis la suivante commence aussitôt : <b>tout le monde rechoisit son camp</b>.</li>
      <li>Chaque jour, tu peux attaquer <b>une fois chaque combattant</b> de l’autre section. Tout repart à zéro à minuit.</li>
      <li>Victoire contre plus fort que toi : <b>+3 pts</b>. Contre un niveau égal : <b>+2</b>. Contre plus faible : <b>+1</b>.</li>
      <li>Si ton attaque échoue, la section adverse gagne <b>+1 pt</b> de défense.</li>
      <li>Fin de semaine : la section avec le plus de points gagne. Ses membres ayant fait au moins ${WAR.minAttacks} attaques reçoivent un <b>Coffre de guerre</b> (${WAR.warChestItems} objets, jamais de Commun).</li>
      <li>La section perdante (${WAR.minAttacks} attaques minimum) reçoit 1 coffre de combat. En cas d’égalité, tout le monde a un coffre de combat.</li>
      <li>Le meilleur marqueur de la semaine devient <b>Héros de guerre</b> et reçoit un coffre de guerre en plus.</li>
    </ul>`;

function viewWar() {
  const war = acc.war;
  const head = (sub, chips, extra = '') => modeHead({
    id: 'war', c: '#3d9bff', art: '<canvas class="px" data-emblem="war"></canvas>',
    title: 'Guerre', sub, chips, extra, info: WAR_RULES_UL(),
  });
  if (!war.section) {
    return head('', [], `
      <div class="sec-pick" style="margin-top:12px">
        ${Object.entries(WAR.sections).map(([id, s]) => `
          <button class="sec-card" style="--sc:${s.color}" data-act="joinSection" data-sec="${id}">
            <span class="flag"></span><b>${s.name}</b>
            <small>${NET.online ? `${E.sectionCount(acc, id, players)} / ${WAR.maxPerSection} joueurs` : 'Rejoindre'}</small>
          </button>`).join('')}
      </div>`);
  }
  const mine = war.section, other = E.otherSide(mine);
  const { score, members } = E.warStandings(acc, E.weekKey(), others());
  const total = Math.max(1, score[mine] + score[other]);
  const enemies = opponents().filter(o => o.section === other);
  const allies = members.filter(m => m.section === mine);
  const wk = E.warWeek(acc);
  const myPower = E.powerScore(E.snapshot(hero));
  const left = enemies.filter(o => !war.done[o.id]).length;
  const p = war.pending;
  const outcomeTxt = p && ({ win: 'Victoire de ta section !', loss: 'Défaite de ta section…', tie: 'Égalité !' }[p.outcome]);
  const lead = score[mine] - score[other];
  return `
    ${p ? `
      <section class="card war-reward">
        <h2>Résultat de la semaine dernière</h2>
        <div class="big-res">${outcomeTxt}</div>
        <p class="hint">${p.mine} pts contre ${p.theirs}. Tu as marqué ${p.points} pts en ${p.attacks} attaque${p.attacks > 1 ? 's' : ''}.${p.mvp ? ' Tu es le <b>Héros de guerre</b> de la semaine !' : ''}${!p.eligible ? ` Il fallait ${WAR.minAttacks} attaques minimum pour la récompense.` : ''}</p>
        <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">
          ${p.warChests ? `<span class="pill gold">${p.warChests} coffre${p.warChests > 1 ? 's' : ''} de guerre</span>` : ''}
          ${p.combatChests ? `<span class="pill red">1 coffre de combat</span>` : ''}
          ${!p.warChests && !p.combatChests ? '<span class="pill">Pas de récompense</span>' : ''}
        </div>
        <button class="btn primary block" data-act="claimWar">${p.warChests || p.combatChests ? 'Récupérer' : 'OK'}</button>
      </section>` : ''}
    ${head(`Ton camp : ${secTag(mine)}`, [
      mchip(ico('swords'), 'Attaques du jour', `${left} / ${enemies.length}`, left ? 'hot' : ''),
      mchip(ico('star'), 'Tes points', wk.points),
      mchip(ico('hourglass'), 'Fin de la guerre', `<span data-endlong="${Date.now() + E.msToWeekEnd()}">${fmtLong(E.msToWeekEnd())}</span>`),
    ])}
    <section class="card hx" style="--hc:#3d9bff">
      ${secHead(ico('crown'), 'Score de la semaine', lead > 0 ? 'Ta section mène !' : lead < 0 ? 'Ta section est derrière : attaque !' : 'Égalité parfaite')}
      <div class="train-wrap war-wrap"><canvas id="war-cv"></canvas></div>
      <div class="score-row">
        <div>${secTag(mine)}<div class="sc">${score[mine]}</div></div>
        <div class="vs">VS</div>
        <div style="text-align:right">${secTag(other)}<div class="sc">${score[other]}</div></div>
      </div>
      <div class="score-bar"><div style="width:${score[mine] + score[other] ? (score[mine] / total) * 100 : 50}%;background:${WAR.sections[mine].color}"></div><div style="flex:1;background:${WAR.sections[other].color}"></div></div>
      <div class="war-min ${wk.attacks >= WAR.minAttacks ? 'ok' : ''}">${wk.attacks >= WAR.minAttacks ? '✓' : '!'} Tes attaques cette semaine : <b>${wk.attacks} / ${WAR.minAttacks}</b> minimum pour la récompense</div>
    </section>
    <section class="card hx" style="--hc:#ff5d6c">
      ${secHead(ico('swords'), 'Attaquer', `1 attaque par adversaire et par jour · nouvelles dans <span data-timer="day3">${fmt(msToMidnight())}</span>`, `<span class="pill ${left ? 'red' : 'green'}">${left}</span>`)}
      ${enemies.length ? '' : '<p class="empty">Personne dans l’autre section pour l’instant.</p>'}
      ${enemies.map(o => {
        const done = war.done[o.id];
        const pts = E.warPoints(myPower, E.powerScore(o.snap));
        return `
        <div class="foe ${done ? (done === 'win' ? 'win' : 'loss') : 'todo'}">${foeAv(o)}${done ? `<span class="foe-res">${done === 'win' ? 'GAGNÉ' : 'PERDU'}</span>` : ''}${foeInfo(o)}
          ${done ? '<span class="foe-wait">Demain</span>' : `<button class="foe-btn fight" data-act="warAttack" data-id="${o.id}"><i>${ico('swords')}</i>Attaquer<small>+${pts} pts</small></button>`}
        </div>`;
      }).join('')}
    </section>
    <section class="card hx" style="--hc:${WAR.sections[mine].color}">
      ${secHead(ico('shield'), 'Ton camp', WAR.sections[mine].name)}
      <div class="opp rank me"><div class="o-body"><div class="o-name">${esc(acc.pseudo)} <span class="pill gold">toi</span></div></div><div class="score">${wk.points} pts</div></div>
      ${allies.map(m => `
        <div class="opp rank"><div class="av"><canvas class="px" data-portrait="${m.classId}"></canvas></div>
          <div class="o-body"><div class="o-name">${nameHtml(m.name, m.data)}</div><div class="o-sub">${CLASSES[m.classId].name}</div></div>
          <div class="score">${m.points} pts</div></div>`).join('')}
      ${war.log.length ? `<div class="sub">TES ATTAQUES</div>${war.log.map(l => `<div class="log-line">${l.won ? ico('check') : ico('cross')} ${esc(l.name)} ${l.won ? `<b>+${l.pts}</b>` : '(+1 pour eux)'}</div>`).join('')}` : ''}
    </section>`;
}

/** Animation de la guerre : les 4 bleus contre les 4 rouges, en boucle */
function startSkirmish() {
  const cv = document.getElementById('war-cv');
  if (!cv || !acc.war.section) return;
  const { members } = E.warStandings(acc, E.weekKey(), others());
  const sh = E.strongestHero(acc);
  const all = [...members.map(m => {
    const h = m.data ? E.strongestHero(m.data) : null;
    return { name: m.name, classId: m.classId, dye: h ? h.dye : null, section: m.section };
  }), { name: acc.pseudo, classId: sh.classId, dye: sh.dye, section: acc.war.section }];
  const side = (sec) => {
    const list = all.filter(m => m.section === sec);
    // s'il manque du monde, des recrues viennent compléter l'équipe
    const cls = Object.keys(CLASSES);
    for (let i = list.length; i < WAR.maxPerSection; i++) list.push({ name: 'Recrue', classId: cls[i % cls.length], dye: null });
    return list;
  };
  stopPreviews.push(playSkirmish(cv, side('bleue'), side('rouge'), { colors: [WAR.sections.bleue.color, WAR.sections.rouge.color] }));
}

function startWarAttack(foeId) {
  E.ensureWar(acc, others());
  const war = acc.war;
  if (war.done[foeId]) return;
  const opp = opponents().find(o => o.id === foeId);
  if (!opp) return;
  const me = mySnap();
  const seed = hashStr(war.day + foeId + 'guerre' + acc.pseudo);
  runBattle({
    me, foe: opp.snap, seed, theme: 'castle', victory: myVictory(),
    title: `${ico('swords')} ${secTag(war.section)} <span style="color:var(--gold)">VS</span> ${esc(opp.snap.name)}`,
    finish: (result) => {
      const won = result.winner === 0;
      E.missionEvent(acc, 'war');
      if (won) E.missionEvent(acc, 'war_win');
      logFight('war', foeId, opp.name, me, opp.snap, seed, won);
      const rw = E.warAttackResult(acc, hero, { id: foeId, name: opp.name, level: opp.level }, won, E.powerScore(me), E.powerScore(opp.snap));
      save();
      return {
        rewards: rw,
        rewardsHtml: `
          <div class="rw">
            ${won ? `<span class="pill green">+${rw.pts} pts pour ta section</span>` : '<span class="pill red">+1 pt pour la section adverse</span>'}
          </div>`,
      };
    },
  });
}

// ------------------------------ Tchat ------------------------------
const CHAT_SEEN = 'fuzev2-chat-seen';
const timeOf = (iso) => {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return E.dayKey(d) === E.dayKey() ? hm : `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
};
const msgHtml = (m) => {
  const mine = m.user_id === NET.myId();
  const txt = esc(m.text).replace(/\[\[combat:(\d+)\]\]/g, '<button class="btn small" data-act="replayId" data-id="$1">' + ico('play') + ' Revoir le combat</button>').replace(/⚔️?/g, ico('swords'));
  return `<div class="msg ${mine ? 'me' : ''}">${mine ? '' : `<b>${nameHtml(m.pseudo, dataOfPseudo(m.pseudo))}</b>`}<span class="txt">${txt}</span><small>${timeOf(m.created_at)}</small></div>`;
};

function viewChat() {
  if (!NET.online) return offlineCard('Tchat', 'Le tchat marche seulement dans la version en ligne.');
  return modeHead({
    id: 'chat', c: '#3d9bff', art: '<canvas class="px" data-emblem="talk"></canvas>',
    title: 'Tchat', sub: '',
    chips: [
      mchip('<i class="dot-on"></i>', 'En ligne', `${onlineCount()} / ${players.length + 1}`),
      mchip(ico('chat'), 'Messages', chatMsgs.length),
      mchip(ico('swords'), 'Combats partagés', chatMsgs.filter(m => /\[\[combat:/.test(m.text)).length),
    ],
    info: 'Écris en bas de l’écran. Depuis le Journal, tu peux partager un combat : il apparaît ici avec un bouton pour le revoir.',
  }) + `
    <section class="card hx chat" style="--hc:#3d9bff">
      <div class="chat-list" id="chat-list">${chatMsgs.length ? chatMsgs.map(msgHtml).join('') : '<p class="empty" id="chat-empty">Aucun message. Lance la discussion !</p>'}</div>
    </section>
    <div class="chat-bar">
      <input id="chat-input" maxlength="300" placeholder="Écris un message…" value="${esc(chatDraft)}" autocomplete="off" enterkeyhint="send">
      <button class="btn primary" data-act="sendChat">Envoyer</button>
    </div>`;
}

// le tchat défile avec la page : on descend tout en bas (dernier message juste au-dessus de la barre d'écriture)
function scrollChat() {
  if (!document.getElementById('chat-list')) return;
  requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
}
function markChatSeen() {
  chatUnread = 0;
  const b = document.getElementById('chat-badge');
  if (b) b.hidden = true;
  const last = chatMsgs[chatMsgs.length - 1];
  if (last) { try { localStorage.setItem(CHAT_SEEN, last.created_at); } catch (e) { /* stockage indisponible */ } }
}

function onChatMessage(m) {
  if (chatMsgs.some(x => x.id === m.id)) return;
  chatMsgs.push(m);
  chatMsgs = chatMsgs.slice(-100);
  if (tab === 'chat' && document.getElementById('chat-list')) {
    document.getElementById('chat-empty')?.remove();
    const list = document.getElementById('chat-list');
    list.insertAdjacentHTML('beforeend', msgHtml(m));
    hydrate(list.lastElementChild);
    scrollChat();
    markChatSeen();
  } else if (m.user_id !== NET.myId()) {
    chatUnread++;
    const b = document.getElementById('chat-badge');
    if (b) { b.hidden = false; b.textContent = chatUnread; }
    setBadge('social', chatUnread + journalUnseen);
    SFX.message();
    toast(`${m.pseudo} : ${m.text.length > 40 ? m.text.slice(0, 40) + '…' : m.text}`);
  }
}

async function initChat() {
  if (!NET.online) return;
  try {
    chatMsgs = await NET.fetchMessages();
    let seen = '';
    try { seen = localStorage.getItem(CHAT_SEEN) || ''; } catch (e) { /* stockage indisponible */ }
    chatUnread = chatMsgs.filter(m => m.user_id !== NET.myId() && m.created_at > seen).length;
    await NET.subscribeChat(onChatMessage);
  } catch (e) { /* le tchat est optionnel : le jeu continue sans */ }
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = (input && input.value || '').trim();
  if (!text) return;
  input.value = ''; chatDraft = '';
  try { onChatMessage(await NET.sendMessage(acc.pseudo, text)); E.missionEvent(acc, 'chat'); save(); }
  catch (e) { toast(e.message); input.value = text; chatDraft = text; }
}

// ------------------------------ Apparences ------------------------------
const cosOf = (data) => (data && data.cosmetics) || { owned: [], title: null, color: null, victory: null };
const titleOf = (data) => { const t = cosOf(data).title; return t && COSMETIC[t] ? COSMETIC[t].name : ''; };
const colorOf = (data) => { const c = cosOf(data).color; return c && COSMETIC[c] ? COSMETIC[c].color : null; };
const NAME_FX = ['rainbow', 'fire', 'galaxy'];   // pseudos animés
const nameHtml = (name, data) => {
  const col = colorOf(data);
  const fx = NAME_FX.includes(col);
  return `<span class="pname ${fx ? col : ''}" ${col && !fx ? `style="color:${col}"` : ''}>${esc(name)}</span>`;
};
const titleHtml = (data) => { const t = titleOf(data); return t ? `<span class="ptitle">« ${esc(t)} »</span>` : ''; };
const dataOfPseudo = (pseudo) => (pseudo === acc.pseudo ? acc : (players.find(p => p.pseudo === pseudo) || {}).data);

/** « Photo » d'un perso pour un combat, avec ses apparences */
function snapOf(data, h, name) {
  const s = E.snapshot({ ...h, name });
  s.dye = h.dye || null;
  s.title = titleOf(data);
  s.nameColor = colorOf(data);
  return s;
}
const mySnap = () => snapOf(acc, hero, acc.pseudo);
const myVictory = () => { const v = acc.cosmetics.victory; return v && COSMETIC[v] ? COSMETIC[v].colors : null; };
const myId = () => (NET.online ? NET.myId() : 'me');
const fmtNum = (n) => Math.round(n).toLocaleString('fr-FR');
const offlineCard = (title, text) => `<section class="card"><h2>${title}</h2><p class="hint">${text}</p></section>`;
/** Remonte tout en haut de la page, sans animation */
const scrollTop = () => { const h = document.documentElement, b = h.style.scrollBehavior; h.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); h.style.scrollBehavior = b; };
const softRender = () => { if (!modalRoot.innerHTML && !document.querySelector('.battle') && tab !== 'chat') render(); };

// ------------------------------ Navigation (hubs) ------------------------------
// Les modes de combat sont rangés en 3 grandes parties (PVP, COOP, PVM), chacune avec sa page.
const HUBS = {
  hub_pvp: { name: 'PVP', tag: 'Joueur contre joueur', desc: 'Affronte tes potes : arène, direct, trône et tournoi.', c: '#ff5d6c', c2: '#ff9a3d', ids: ['fights', 'pvp', 'throne', 'champ'] },
  hub_coop: { name: 'COOP', tag: 'Tous ensemble', desc: 'Faites équipe contre le gros boss et pour ton camp.', c: '#3d9bff', c2: '#4ce0ff', ids: ['raid', 'war'] },
  hub_pvm: { name: 'PVM', tag: 'Joueur contre monstres', desc: 'Histoire, donjons, tour infinie et Horde : chasse aux monstres.', c: '#4cd964', c2: '#c8ff4c', ids: ['story', 'dungeons', 'tower', 'horde'] },
};
const PARENT = { hub_pvp: 'combat', hub_coop: 'combat', hub_pvm: 'combat', bets: 'hub_pvp', journal: 'social', chat: 'social', ranking: 'social', players: 'social' };
for (const [h, x] of Object.entries(HUBS)) for (const id of x.ids) PARENT[id] = h;
const PARENT_NAME = { combat: 'Combats', social: 'Social', hub_pvp: 'PVP', hub_coop: 'COOP', hub_pvm: 'PVM' };
/** L'onglet du bas auquel appartient une page (Combats pour l'arène, en passant par PVP) */
const rootTab = (id) => { while (PARENT[id]) id = PARENT[id]; return id; };

function setBadge(id, n) {
  const b = document.getElementById('badge-' + id);
  if (!b) return;
  b.hidden = !(n > 0);
  b.textContent = n;
}

// ------------------------------ Missions du jour ------------------------------
function claimableMissions() {
  const list = E.ensureMissions(acc);
  return list.filter(m => !acc.missions.claimed[m.id] && E.missionProgress(acc, m) >= m.n).length;
}

// petit « + » jaune en bas à droite d'une carte : montre / cache le texte d'explication
const infoOpen = new Set();
const moreBtn = (id) => `<button class="more-btn" data-act="info" data-id="${id}" aria-label="Plus d’infos">${infoOpen.has(id) ? '−' : '+'}</button>`;
const infoCls = (id) => `info-card${infoOpen.has(id) ? ' open' : ''}`;

// icône de chaque mission : emblème du mode, sprite ou petit symbole
const MISSION_ICO = {
  arena_win: 'e:arena', arena_fight: 'e:arena', rematch: 'e:arena', rematch_win: 'e:arena', revenge: 'e:arena', fight: 'e:arena', win: 'e:arena', manual_win: 'e:arena',
  dungeon_win: 'e:dungeons', dungeon: 'e:dungeons', dungeon_kinds: 'e:dungeons', tower: 'e:tower', tower_try: 'e:tower',
  raid: 'm:melenchon', raid_dmg: 'm:melenchon', war: 'e:war', war_win: 'e:war', bet: 'e:bets',
  chest: 'c', key_use: 'k', sell: 'f',
  fuse: 'i:sparkle', equip: 'i:shield', stat: 'i:plus', level: 'i:up', spell: 'i:magic', crit: 'i:boom', dodge: 'i:wind', pet: 'i:paw', chat: 'i:chat', share: 'i:chat', train_rec: 'i:trophy',
};
function missionIco(ev) {
  const k = ev === 'raid' || ev === 'raid_dmg' ? `m:${curRaid().sprite}` : MISSION_ICO[ev] || 'i:star';
  if (k.startsWith('e:')) return `<canvas class="px" data-emblem="${k.slice(2)}"></canvas>`;
  if (k.startsWith('i:')) return ico(k.slice(2));
  if (k.startsWith('m:')) return `<canvas class="px" data-monster="${k.slice(2)}"></canvas>`;
  if (k === 'c') return '<canvas class="px" data-chest="normal"></canvas>';
  if (k === 'k') return '<canvas class="px" data-key></canvas>';
  if (k === 'f') return '<canvas class="px" data-clat></canvas>';
  return `<i>${k}</i>`;
}

function missionsCard() {
  const list = E.ensureMissions(acc);
  const M = acc.missions;
  const nClaimed = list.filter(m => M.claimed[m.id]).length;
  return `
    <section class="card hx hx-green cbt-missions ${infoCls('missions')}" data-info="missions">
      <div class="hx-head"><span class="hx-ico">${ico('target')}</span><div><h2>Missions</h2><small data-timer="half">Nouvelles missions dans ${fmt(E.msToNextHalf())}</small></div></div>
      <div class="mgrid">
        ${list.map(m => {
          const p = Math.min(m.n, E.missionProgress(acc, m));
          const done = p >= m.n, claimed = M.claimed[m.id];
          return `
          <div class="mq ${claimed ? 'claimed' : done ? 'ready' : ''}">
            <div class="mq-ico">${missionIco(m.ev)}</div>
            <div class="mq-txt">${esc(m.text)}</div>
            <div class="mq-bar"><i style="width:${(p / m.n) * 100}%"></i></div>
            ${claimed
              ? '<div class="mq-done">✓ Fait</div>'
              : done
                ? `<button class="btn small green mq-btn" data-act="claimMission" data-id="${m.id}">+${m.reward}<canvas class="px" data-clat></canvas></button>`
                : `<div class="mq-prog">${p.toLocaleString('fr-FR')}/${m.n.toLocaleString('fr-FR')} · +${m.reward}<canvas class="px" data-clat></canvas></div>`}
          </div>`;
        }).join('')}
      </div>
      <div class="mq-bonus ${nClaimed >= list.length ? 'got' : ''}">
        <span class="pips">${list.map((m, i) => `<i class="${i < nClaimed ? 'on' : ''}"></i>`).join('')}</span>
        <span>Bonus des 3 missions : <b>+${MISSIONS_BONUS}</b></span><canvas class="px" data-clat></canvas>
      </div>
      <p class="more-txt">Fais les 3 missions pour gagner <b>+${MISSIONS_BONUS}</b> Flouze en bonus. 3 nouvelles missions, tirées au hasard, arrivent toutes les 12 h (minuit et midi).</p>
      ${moreBtn('missions')}
    </section>`;
}

function charsCard() {
  return `
    <section class="card hx hx-gold cbt-chars ${infoCls('chars')}" data-info="chars">
      <div class="hx-head"><span class="hx-ico">${ico('swords')}</span><div><h2>Ton combattant</h2><small>${CLASSES[hero.classId].name} Nv.${hero.level} part au combat</small></div><span class="pill">${acc.heroes.length} / ${E.MAX_HEROES}</span></div>
      <div class="fighters">
        ${byLevel(acc.heroes).map(([h, i]) => `
          <button class="fighter cls-${h.classId} ${i === acc.active ? 'on' : ''}" data-act="switchHero" data-i="${i}">
            ${E.openableChests(h) ? '<span class="badge pip" title="Des coffres à ouvrir"></span>' : ''}
            <span class="f-stage"><canvas class="px" data-portrait="${h.classId}" data-dye="${h.dye || ''}"></canvas></span>
            <b>${CLASSES[h.classId].name}</b><small>Nv.${h.level}</small>
          </button>`).join('')}
        ${acc.heroes.length >= E.MAX_HEROES ? '' : acc.heroes.length < E.heroSlots(acc)
          ? '<button class="fighter add" data-act="newHeroModal"><span>+</span><small>Nouveau</small></button>'
          : `<div class="fighter add locked"><span>${ico('lock')}</span><small>Niveau ${E.nextHeroLevel(acc)}</small></div>`}
      </div>
      <p class="more-txt">C’est ton perso <b>actif</b> qui part se battre (arène, donjons, tour, raid, guerre). Chaque perso a son niveau, ses objets, ses coffres, ses clefs et ses donjons. Quand on t’attaque, c’est ton perso <b>le plus fort</b> qui défend.<br>Nouveaux persos : le 2ᵉ au niveau <b>15</b>, le 3ᵉ au niveau <b>30</b> et le 4ᵉ au niveau <b>50</b> (niveau de ton perso le plus haut).</p>
      ${moreBtn('chars')}
    </section>`;
}

// ------------------------------ Hub Combats ------------------------------
function combatTiles() {
  const fightsLeft = opponents().filter(o => !o.done).length;
  const raidLeft = E.raidLeft(acc);
  const warLeft = acc.war.section ? opponents().filter(o => o.section === E.otherSide(acc.war.section) && !acc.war.done[o.id]).length : 0;
  const runs = E.totalRunsLeft(hero);
  const on = players.filter(p => isOnline(p.id)).length;
  return {
    fights: { name: 'Arène', sub: `${fightsLeft} combat${fightsLeft > 1 ? 's' : ''} restant${fightsLeft > 1 ? 's' : ''}`, tag: 'Bats chacun de tes potes une fois par jour', emblem: 'arena', badge: fightsLeft, c: '#ff5d6c' },
    pvp: { name: 'PvP en direct', sub: NET.online ? `${on} pote${on > 1 ? 's' : ''} en ligne` : 'En ligne seulement', tag: 'Ton équipe contre celle d’un pote connecté', emblem: 'pvp', badge: pvpIncoming().length, c: '#b05cff' },
    throne: { name: 'Le trône', sub: throneInfo.order.length ? `Ta place : ${throneRank() + 1} / ${throneInfo.order.length}` : 'Deviens le roi', tag: 'Défie ceux au-dessus de toi et prends leur place', emblem: 'throne', badge: 0, c: '#ffd45a' },
    champ: { name: 'Championnat', sub: champSub(), tag: 'Tournoi à 8 chaque semaine, combats à 19 h 30', emblem: 'champ', badge: 0, c: '#ffd45a' },
    raid: { name: curRaid().name, sub: `${raidLeft}/${RAID.attemptsPerHalf} assauts`, tag: 'Tout le groupe tape le même boss', monster: curRaid().sprite, badge: raidLeft, c: '#ff8a3d' },
    war: { name: 'Guerre', sub: acc.war.section ? WAR.sections[acc.war.section].name : 'Choisis ton camp', tag: 'Assassins contre Templiers, chaque semaine', emblem: 'war', badge: warLeft, c: '#3d9bff' },
    story: { name: 'Histoire', sub: storySub(), tag: '5 zones, des boss, et des étoiles à récolter', emblem: 'story', badge: E.storyClaimable(hero), c: '#ffb02e' },
    dungeons: { name: 'Donjons', sub: `${runs} combat${runs > 1 ? 's' : ''} dispo`, tag: 'Des vagues de monstres et des clefs à gagner', emblem: 'dungeons', badge: runs, c: '#4cd964' },
    tower: { name: 'Tour infinie', sub: `Étage ${hero.tower.best + 1}`, tag: 'Monte le plus haut possible, étage par étage', emblem: 'tower', badge: 0, c: '#a77bff' },
    horde: { name: 'La Horde', sub: `${E.hordeRunsLeft(hero)}/${HORDE.runsPerHalf} essais`, tag: 'Des monstres à la chaîne : va le plus loin possible', emblem: 'horde', badge: E.hordeRunsLeft(hero), c: '#ff3d6e' },
  };
}
const tileArt = (t) => `<canvas class="px" ${t.monster ? `data-monster="${t.monster}"` : `data-emblem="${t.emblem}"`}></canvas>`;

function viewCombat() {
  const T = combatTiles();
  return autoCard() + charsCard() + missionsCard() + `
    <section class="hubs">
      ${Object.entries(HUBS).map(([id, h]) => {
        const badge = h.ids.reduce((s, k) => s + (T[k].badge || 0), 0);
        return `
        <button class="hub" data-act="tab" data-id="${id}" style="--tc:${h.c};--tc2:${h.c2}">
          <span class="hub-art">${h.ids.map((k, i) => `<span style="--i:${i};--n:${h.ids.length}">${tileArt(T[k])}</span>`).join('')}</span>
          <span class="hub-txt"><em>${h.tag}</em><b>${h.name}</b><small>${h.ids.map(k => T[k].name).join(' · ')}</small></span>
          <span class="m-go">›</span>
          ${badge > 0 ? `<span class="badge">${badge}</span>` : ''}
        </button>`;
      }).join('')}
    </section>`;
}

/** La page d'une partie (PVP, COOP ou PVM) : ses modes, en grand */
function viewHub(id) {
  const h = HUBS[id], T = combatTiles();
  return `
    <section class="hub-head" style="--tc:${h.c};--tc2:${h.c2}"><b>${h.name}</b></section>
    <section class="modes">
      ${h.ids.map(k => { const x = T[k]; return `
        <button class="mode wide" data-act="tab" data-id="${k}" style="--tc:${x.c}">
          <span class="m-art">${tileArt(x)}</span>
          <span class="m-txt"><b>${x.name}</b><small>${x.sub}</small></span>
          <span class="m-go">›</span>
          ${x.badge > 0 ? `<span class="badge">${x.badge}</span>` : ''}
        </button>`; }).join('')}
    </section>`;
}

// ------------------------------ Hub Social ------------------------------
function viewSocial() {
  const tiles = [
    { id: 'journal', name: 'Journal', sub: '', emblem: 'journal', badge: journalUnseen, c: '#ff8a3d' },
    { id: 'chat', name: 'Tchat', sub: '', emblem: 'talk', badge: chatUnread, c: '#3d9bff' },
    { id: 'ranking', name: 'Classement', sub: '', emblem: 'ranking', badge: 0, c: '#ffd45a' },
    { id: 'players', name: 'Joueurs', sub: NET.online ? `<i class="dot-on"></i>${onlineCount()} en ligne` : 'En ligne seulement', emblem: 'players', badge: 0, c: '#4cd964' },
  ];
  const list = rankingEntries('power');
  const meTop = list.slice(0, 3).some(e => e.me);
  [250, 900].forEach(ms => setTimeout(placeCrown, ms));   // une fois le héros dessiné
  const myMsg = (acc.podiumMsg && acc.podiumMsg.text) || '';
  return `
    <section class="modes slim">
      ${tiles.map(t => `
        <button class="mode" data-act="tab" data-id="${t.id}" style="--tc:${t.c}">
          <span class="m-art"><canvas class="px" data-emblem="${t.emblem}"></canvas></span>
          <span class="m-txt"><b>${t.name}</b>${t.sub ? `<small>${t.sub}</small>` : ''}</span>
          ${t.badge > 0 ? `<span class="badge">${t.badge}</span>` : ''}
        </button>`).join('')}
    </section>
    <section class="card hx podium-card ${infoCls('podium')}" data-info="podium" style="--hc:#ffd45a">
      ${secHead(ico('crown'), 'Podium des champions', 'Les 3 plus puissants du groupe')}
      ${podium(list, rankScore('power'), { bubbles: true })}
      ${meTop ? `<button class="btn block pod-edit" data-act="podiumMsg">${ico('chat')} ${myMsg ? 'Changer mon message' : 'Écrire mon message de champion'}</button>` : ''}
      <div class="more-txt">Les 3 joueurs du podium (classés à la puissance de leur perso le plus fort) peuvent afficher un petit message dans une bulle au-dessus de leur héros. Tout le monde le voit ici. Si tu sors du podium, ton message disparaît.</div>
      ${moreBtn('podium')}
    </section>`;
}

function openPodiumMsg() {
  const cur = (acc.podiumMsg && acc.podiumMsg.text) || '';
  openModal(`
    <h3>${ico('crown')} Ton message de champion</h3>
    <p class="hint" style="margin-top:8px">Il s’affiche dans une bulle au-dessus de ton héros, sur le podium. 60 caractères maximum.</p>
    <input id="pod-msg" class="pod-input" maxlength="60" value="${esc(cur)}" placeholder="Ex. : Venez me chercher !" autocomplete="off">
    <div class="row" style="gap:8px;margin-top:12px">
      ${cur ? '<button class="btn block" data-act="podiumMsgSave" data-clear="1">Effacer</button>' : '<button class="btn block" data-act="closeModal">Annuler</button>'}
      <button class="btn primary block" data-act="podiumMsgSave">Enregistrer</button>
    </div>`, { center: true });
  setTimeout(() => document.getElementById('pod-msg')?.focus(), 50);
}

// ------------------------------ Joueurs en ligne ------------------------------
let onlineIds = new Set();
const isOnline = (id) => NET.online && onlineIds.has(id);
const onlineCount = () => [...onlineIds].length || (NET.online ? 1 : 0);
const dotHtml = (id) => (NET.online ? `<i class="${isOnline(id) ? 'dot-on' : 'dot-off'}" title="${isOnline(id) ? 'En ligne' : 'Hors ligne'}"></i>` : '');
const agoText = (iso) => {
  if (!iso) return 'jamais vu';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 2) return 'vu à l’instant';
  if (m < 60) return `vu il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `vu il y a ${h} h`;
  const d = Math.round(h / 24);
  return `vu il y a ${d} jour${d > 1 ? 's' : ''}`;
};

function onPresence(ids) {
  onlineIds = new Set(ids);
  if (['players', 'social', 'fights', 'ranking'].includes(tab)) softRender();
}

function viewPlayers() {
  if (!NET.online) return offlineCard('Joueurs', 'La liste des joueurs marche seulement dans la version en ligne.');
  const me = NET.myId();
  const rows = [{ id: me, name: acc.pseudo, data: acc, me: true }, ...players.map(p => ({ id: p.id, name: p.pseudo, data: p.data, seen: p.updated_at }))];
  rows.sort((a, b) => (isOnline(b.id) ? 1 : 0) - (isOnline(a.id) ? 1 : 0) || (b.me ? 1 : 0) - (a.me ? 1 : 0) || String(b.seen || '').localeCompare(String(a.seen || '')));
  const n = rows.filter(r => isOnline(r.id)).length;
  const strongest = rows.map(r => ({ r, p: E.powerScore(snapOf(r.data, E.strongestHero(r.data), r.name)) })).sort((a, b) => b.p - a.p)[0];
  return modeHead({
    id: 'players', c: '#4cd964', art: '<canvas class="px" data-emblem="players"></canvas>',
    title: 'Joueurs', sub: '',
    chips: [
      mchip('<i class="dot-on"></i>', 'En ligne', `${n} / ${rows.length}`, n > 1 ? 'hot' : ''),
      mchip(ico('bolt'), 'Le plus puissant', esc(strongest.r.name)),
      mchip('<canvas class="px" data-emblem="players"></canvas>', 'Joueurs', rows.length),
    ],
    info: 'Le voyant passe au vert dès qu’un pote ouvre l’appli. Touche un joueur pour voir sa carte : son héros, son équipement, sa puissance et ses records.',
  }) + `
    <section class="card hx" style="--hc:#4cd964">
      ${rows.map(r => {
        const h = E.strongestHero(r.data);
        const sec = r.data.war && r.data.war.section;
        const pow = E.powerScore(snapOf(r.data, h, r.name));
        return `
        <button class="foe player-row ${isOnline(r.id) ? 'on' : 'away'}" data-act="playerCard" data-id="${r.id}">
          <span class="foe-av"><canvas class="px" data-portrait="${h.classId}" data-dye="${h.dye || ''}"></canvas></span>
          <div class="foe-body">
            <div class="foe-name">${dotHtml(r.id)}${nameHtml(r.name, r.data)}${r.me ? ' <span class="pill gold">toi</span>' : ''}</div>
            <div class="foe-sub">${CLASSES[h.classId].name} · Nv.${h.level} · ${ico('bolt')}${pow}${sec ? ` · <span style="color:${WAR.sections[sec].color}">${WAR.sections[sec].name}</span>` : ''}</div>
            <span class="cmp ${isOnline(r.id) ? 'easy' : 'off'}">${isOnline(r.id) ? 'En ligne' : esc(agoText(r.seen))}</span>
          </div>
          <span class="pr-go">›</span>
        </button>`;
      }).join('')}
    </section>`;
}

const CLASS_COLOR = { guerrier: '#ff5d6c', mage: '#a77bff', archer: '#4cd964', paladin: '#ffd45a' };

/** Carte d'identité d'un joueur : son héros le plus fort, son équipement, sa puissance, ses records */
function openPlayerCard(id, heroIdx = null) {
  const isMe = id === myId();
  const p = isMe ? null : players.find(x => String(x.id) === String(id));
  if (!isMe && !p) return;
  const data = isMe ? acc : p.data, name = isMe ? acc.pseudo : p.pseudo;
  const strong = E.strongestHero(data);
  const h = heroIdx !== null && data.heroes[heroIdx] ? data.heroes[heroIdx] : strong;
  const snap = snapOf(data, h, name);
  const st = E.computeStats(h);
  const hp = E.maxHp(st, h.level);
  const itemOf = (slot) => { const uid = h.equipped && h.equipped[slot]; return uid ? h.inventory.find(i => i.uid === uid) : null; };
  const cell = (slot) => {
    const it = itemOf(slot);
    return it
      ? `<div class="idc-slot it r${it.rarity}" style="--rc:${RARITIES[it.rarity].color}"><canvas class="px" data-icon="${it.itemId}"></canvas><small>${esc(ITEMS[it.itemId].name)}</small></div>`
      : `<div class="idc-slot empty"><span class="sl-ghost">${SLOT_GLYPH[slot]}</span><small>${SLOTS[slot].name}</small></div>`;
  };
  const wins = data.heroes.reduce((t, x) => t + x.stats.wins, 0);
  const tower = Math.max(0, ...data.heroes.map(x => (x.tower && x.tower.best) || 0));
  const sec = data.war && data.war.section;
  const online = isMe || isOnline(id);
  const msg = data.podiumMsg && data.podiumMsg.text;
  openModal(`
    <div class="idcard" style="--cc:${CLASS_COLOR[h.classId]}">
      <div class="idc-head">
        <div class="idc-name">${dotHtml(id)}${nameHtml(name, data)}</div>
        ${titleHtml(data)}
        <div class="idc-sub">${CLASSES[h.classId].name} · Nv.${h.level} · ${online ? '<span class="good">En ligne</span>' : esc(agoText(p && p.updated_at))}</div>
        ${msg ? `<div class="idc-msg">« ${esc(msg)} »</div>` : ''}
      </div>
      <div class="idc-doll">
        <div class="idc-col">${['hat', 'armor', 'boots'].map(cell).join('')}</div>
        <div class="idc-hero"><canvas class="px" data-hero="${h.classId}" data-pet="${petOf(h)}" data-dye="${h.dye || ''}"></canvas></div>
        <div class="idc-col">${['weapon', 'amulet', 'pet'].map(cell).join('')}</div>
      </div>
      <div class="idc-power"><div><small>Puissance</small><b>${fmtNum(E.powerScore(snap))}</b></div><div><small>Vie</small><b>${fmtNum(hp)}</b></div></div>
      <div class="idc-stats">${STAT_KEYS.map(k => `<div style="--sc:${STATS[k].color}"><small>${STATS[k].name}</small><b>${fmtNum(st[k])}</b></div>`).join('')}</div>
      <div class="idc-rec">
        <span>${ico('trophy')} <b>${wins}</b> victoires</span>
        <span>${ico('up')} Tour <b>${tower}</b></span>
        <span>${ico('skull')} Horde <b>${(data.horde && data.horde.best) || 0}</b></span>
        ${sec ? `<span style="color:${WAR.sections[sec].color}">${ico('shield')} ${WAR.sections[sec].name}</span>` : ''}
      </div>
      ${data.heroes.length > 1 ? `<div class="idc-heroes">${byLevel(data.heroes).map(([x, i]) => `<button class="${x === h ? 'on' : ''}" data-act="playerCard" data-id="${id}" data-h="${i}"><canvas class="px" data-portrait="${x.classId}" data-dye="${x.dye || ''}"></canvas><small>Nv.${x.level}</small></button>`).join('')}</div>` : ''}
    </div>
    <div class="close-row"><button class="btn" data-act="closeModal">Fermer</button></div>`, { center: true });
}

// ------------------------------ Notes de mise à jour ------------------------------
const PATCH_SEEN = 'fuzev2-patch-seen';
/** Notes visibles par ce compte (une note avec « for » n'est montrée qu'aux pseudos listés) */
const myNotes = () => PATCH_NOTES.filter(n => !n.for || (acc && n.for.some(p => p.toLowerCase() === (acc.pseudo || '').trim().toLowerCase())));
const giftWaiting = () => myNotes().find(n => n.gift && !(acc.gifts && acc.gifts[n.gift.id]));
function patchUnseen() {
  if (acc && giftWaiting()) return true;
  try { return localStorage.getItem(PATCH_SEEN) !== myNotes()[0].id; } catch (e) { return false; }
}
let giftShown = false;   // le cadeau s'ouvre tout seul une fois par lancement
function maybeShowGift() {
  if (giftShown || !acc || !giftWaiting() || modalRoot.innerHTML || document.querySelector('.battle')) return;
  giftShown = true;
  setTimeout(() => { if (!modalRoot.innerHTML && !document.querySelector('.battle')) openPatchNotes(); }, 700);
}
/** Ce que contient un cadeau (Flouze et/ou coffres de combat) */
const giftLabel = (g) => [g.amount ? `${g.amount} Flouze` : '', g.chests ? `${g.chests} coffre${g.chests > 1 ? 's' : ''}` : '', g.combatChests ? `${g.combatChests} coffre${g.combatChests > 1 ? 's' : ''} de combat` : '',
  g.warChests ? `${g.warChests} coffre${g.warChests > 1 ? 's' : ''} de guerre` : '',
  g.title && COSMETIC[g.title] ? `le titre « ${COSMETIC[g.title].name} »` : '',
  g.epicChests ? `${g.epicChests} coffre${g.epicChests > 1 ? 's' : ''} Épique${g.epicChests > 1 ? 's' : ''}` : '', g.legendaryChests ? `${g.legendaryChests} coffre${g.legendaryChests > 1 ? 's' : ''} Légendaire${g.legendaryChests > 1 ? 's' : ''}` : ''].filter(Boolean).join(' + ');
// ------------------------------ Récompense de connexion ------------------------------
const loginIcon = (g) => g.amount ? '<canvas class="px" data-clat></canvas>'
  : `<canvas class="px" data-chest="${g.combatChests ? 'combat' : g.warChests ? 'war' : g.epicChests ? 'epic' : 'normal'}"></canvas>`;
/** La fenêtre du jour : les 7 jours de la série, celui d'aujourd'hui en avant */
function openLogin() {
  const s = E.loginState(acc);
  openModal(`
    <h3>${ico('star')} Récompense du jour</h3>
    <p class="hint" style="margin-top:4px">Connecte-toi chaque jour : la récompense grossit jusqu’au 7ᵉ jour. Un jour raté et la série repart du jour 1.</p>
    <div class="login-days">${DAILY_LOGIN.map((g, i) => `
      <div class="ld ${i < s.idx ? 'got' : ''} ${i === s.idx ? 'now' : ''} ${i === DAILY_LOGIN.length - 1 ? 'big' : ''}">
        <small>Jour ${i + 1}</small>${loginIcon(g)}<b>${giftLabel(g)}</b>${i < s.idx ? `<i>${ico('check')}</i>` : ''}
      </div>`).join('')}</div>
    <button class="btn primary block" data-act="claimLogin">Récupérer : ${giftLabel(DAILY_LOGIN[s.idx])}</button>`, { center: true });
}

function openPatchNotes() {
  try { localStorage.setItem(PATCH_SEEN, myNotes()[0].id); } catch (e) { /* stockage indisponible */ }
  const b = document.getElementById('patch-badge');
  if (b) b.hidden = !giftWaiting();
  const giftBox = (g) => {
    const got = acc.gifts && acc.gifts[g.id];
    return `
      <div class="gift ${got ? 'got' : ''}">
        <div class="gift-art"><canvas class="px" data-chest="war" data-open="${got ? 1 : 0}"></canvas></div>
        <p>${esc(g.text)}</p>
        ${got ? `<div class="gift-done">${ico('check')} ${giftLabel(g)} récupéré${g.amount ? 's' : ''}</div>`
          : `<button class="btn primary block gift-btn" data-act="claimGift" data-id="${g.id}">Récupérer ${giftLabel(g)}</button>`}
      </div>`;
  };
  openModal(`
    <div class="modal-top"><h3>Notes de mise à jour</h3><button class="modal-x" data-act="closeModal" aria-label="Fermer">×</button></div>
    <p class="hint" style="margin-top:6px">Les nouveautés du jeu, la plus récente en premier.</p>
    ${myNotes().map((n, i) => `
      <details class="patch" ${i === 0 || (n.gift && !(acc.gifts && acc.gifts[n.gift.id])) ? 'open' : ''}>
        <summary><span class="pdate">${n.date} · ${n.time}</span><b>${esc(n.title)}</b>${i === 0 ? '<span class="pill gold">NOUVEAU</span>' : ''}</summary>
        ${n.gift ? giftBox(n.gift) : ''}
        ${n.sections.map(sec => `<div class="psec">${esc(sec.title)}</div><ul>${sec.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>`).join('')}
      </details>`).join('')}
    <div class="close-row"><button class="btn" data-act="closeModal">Fermer</button></div>`);
}

// ------------------------------ Journal des combats ------------------------------
let journal = [];
let journalUnseen = 0;
const JOURNAL_SEEN = 'fuzev2-journal-seen';
const KIND_NAME = { arena: 'Arène', war: 'Guerre', rematch: 'Revanche', revenge: 'Vengeance', throne: 'Trône' };

async function loadJournal() {
  if (!NET.online) return;
  try {
    journal = (await NET.fetchMyFights()).filter(f => E.eraRow(f.created_at));   // rien de l'ancien jeu
    let seen = '';
    try { seen = localStorage.getItem(JOURNAL_SEEN) || ''; } catch (e) { /* stockage indisponible */ }
    journalUnseen = journal.filter(f => f.defender_id === NET.myId() && f.created_at > seen).length;
  } catch (e) { /* le journal est optionnel */ }
}
function markJournalSeen() {
  journalUnseen = 0;
  const top = journal.find(f => f.defender_id === NET.myId());
  if (top) { try { localStorage.setItem(JOURNAL_SEEN, top.created_at); } catch (e) { /* stockage indisponible */ } }
}

/** Enregistre un combat dans le journal (en ligne) */
function logFight(kind, foeId, foeName, me, foeSnap, seed, won) {
  if (!NET.online) return;
  const row = { defender_id: foeId, attacker_name: acc.pseudo, defender_name: foeName, kind, winner: won ? 0 : 1, seed, a_snap: me, d_snap: foeSnap };
  NET.logFight(row).then(r => journal.unshift({ ...row, ...r, attacker_id: NET.myId() })).catch(() => {});
}

function replayFight(row) {
  if (row.kind === 'throne') {   // le trône : mêlée à 4 contre 4, rejouée à l'identique avec la même graine
    const A = row.a_snap.team, B = row.d_snap.team;
    runMelee({
      teamA: A, teamB: B, fight: E.createMelee(A, B, Number(row.seed), { lines: !!row.a_snap.lines }),   // avant les lignes : rejoué comme à l'époque
      title: `Rediffusion · ${esc(row.attacker_name)} <span style="color:var(--gold)">VS</span> ${esc(row.defender_name)}`,
      finish: (r) => ({ headline: `${(r.winner === 0 ? row.attacker_name : row.defender_name).toUpperCase()} GAGNE !`, headClass: 'win' }),
    });
    return;
  }
  const result = E.simulate(row.a_snap, row.d_snap, Number(row.seed));
  const winName = result.winner === 0 ? row.attacker_name : row.defender_name;
  runBattle({
    me: row.a_snap, foe: row.d_snap, result, theme: row.kind === 'war' ? 'castle' : 'arena', track: false,
    title: `Rediffusion · ${esc(row.attacker_name)} <span style="color:var(--gold)">VS</span> ${esc(row.defender_name)}`,
    finish: () => ({ headline: `${winName.toUpperCase()} GAGNE !`, headClass: 'win' }),
  });
}

function viewJournal() {
  if (!NET.online) return offlineCard('Journal', 'Le journal des combats marche seulement en ligne.');
  const me = NET.myId();
  const res = journal.map(f => { const attacked = f.defender_id === me; return attacked ? f.winner === 1 : f.winner === 0; });
  const nWin = res.filter(Boolean).length;
  const nAtt = journal.filter(f => f.defender_id === me).length;
  return modeHead({
    id: 'journal', c: '#ff8a3d', art: '<canvas class="px" data-emblem="journal"></canvas>',
    title: 'Journal', sub: '',
    chips: [
      mchip(ico('check'), 'Gagnés', nWin, nWin ? 'hot' : ''),
      mchip(ico('cross'), 'Perdus', journal.length - nWin),
      mchip(ico('swords'), 'On t’a attaqué', nAtt),
    ],
    info: `${ico('play')} <b>Revoir</b> le combat. ${ico('chat')} <b>Partager</b> dans le tchat. <b>Vengeance</b> : quand on t’a attaqué, tu peux répondre tout de suite (pour le fun).`,
  }) + `
    <section class="card hx" style="--hc:#ff8a3d">
      ${journal.length ? journal.map((f, i) => {
        const attacked = f.defender_id === me;
        const youWon = res[i];
        const other = attacked ? f.attacker_name : f.defender_name;
        const otherId = attacked ? f.attacker_id : f.defender_id;
        const o = players.find(x => x.id === otherId);
        const oh = o ? E.strongestHero(o.data) : null;
        return `
        <div class="foe jrow2 ${youWon ? 'win' : 'loss'}">
          <span class="foe-av">${oh ? `<canvas class="px" data-portrait="${oh.classId}" data-dye="${oh.dye || ''}"></canvas>` : ico('swords')}</span>
          <span class="foe-res">${youWon ? 'GAGNÉ' : 'PERDU'}</span>
          <div class="foe-body">
            <div class="foe-name">${attacked ? `${ico('swords')} ${esc(other)} t’a attaqué` : `Tu as attaqué ${esc(other)}`}</div>
            <div class="foe-sub">${KIND_NAME[f.kind] || f.kind} · ${timeOf(f.created_at)}</div>
          </div>
          <div class="j-btns">
            <button class="ibtn" data-act="replayLog" data-id="${f.id}" aria-label="Revoir">${ico('play')}</button>
            <button class="ibtn" data-act="shareLog" data-id="${f.id}" aria-label="Partager">${ico('chat')}</button>
            ${attacked && o && f.kind !== 'throne' ? `<button class="ibtn red" data-act="revenge" data-id="${otherId}" aria-label="Vengeance">${ico('fist')}</button>` : ''}
          </div>
        </div>`;
      }).join('') : '<p class="empty">Aucun combat pour l’instant.</p>'}
    </section>`;
}

async function shareFight(id) {
  const f = journal.find(x => String(x.id) === String(id));
  if (!f) return;
  try {
    const m = await NET.sendMessage(acc.pseudo, `⚔️ ${f.attacker_name} vs ${f.defender_name} (${KIND_NAME[f.kind] || ''}) [[combat:${f.id}]]`);
    onChatMessage(m);
    E.missionEvent(acc, 'chat'); E.missionEvent(acc, 'share'); save();
    toast('Combat partagé dans le tchat !');
  } catch (e) { toast(e.message); }
}

async function replayById(id) {
  let f = journal.find(x => String(x.id) === String(id));
  if (!f) { try { f = await NET.fetchFight(id); } catch (e) { toast(e.message); return; } }
  if (f) replayFight(f); else toast('Combat introuvable.');
}

// ------------------------------ Paris & duels ------------------------------
let bets = { challenges: [], wagers: [] };
const BET_WINDOW = 86400000;
const fightAt = (c) => new Date(c.accepted_at).getTime() + BET_WINDOW;
const duelCache = {};
const duelResult = (c) => (duelCache[c.id] ||= E.simulate(c.from_snap, c.to_snap, Number(c.seed)));
const duelOdds = (c) => E.betOdds(E.powerScore(c.from_snap), E.powerScore(c.to_snap));

async function refreshBets() {
  if (!NET.online) return;
  try {
    const all = await NET.fetchChallenges();
    const ch = all.filter(c => !isPvp(c));
    pvpRows = all.filter(isPvp);
    const w = await NET.fetchWagers(ch.filter(c => c.status === 'accepted').map(c => c.id));
    bets = { challenges: ch, wagers: w };
  } catch (e) { toast(e.message); }
}

/** Mes gains de paris pas encore récupérés */
function pendingWinnings() {
  const me = NET.myId(), now = Date.now();
  const paid = new Set(acc.paidWagers);
  let total = 0;
  const ids = [];
  for (const c of bets.challenges) {
    if (c.status !== 'accepted' || now < fightAt(c)) continue;
    const winner = duelResult(c).winner;
    for (const w of bets.wagers) {
      if (w.challenge_id !== c.id || w.user_id !== me || paid.has(w.id)) continue;
      ids.push(w.id);
      if (w.side === winner) total += Math.round(w.amount * Number(w.odds));
    }
  }
  return { total, ids };
}

function duelSide(snap, odds, name) {
  return `
    <div class="d-side">
      <canvas class="px" data-portrait="${snap.classId}" data-dye="${snap.dye || ''}"></canvas>
      <b>${esc(name)}</b><small>Nv.${snap.level} · ${E.powerScore(snap)}</small>
      ${odds ? `<span class="pill gold">cote ${odds}</span>` : ''}
    </div>`;
}

function viewBets() {
  if (!NET.online) return offlineCard('Paris & duels', 'Les paris marchent seulement en ligne.');
  const me = NET.myId(), now = Date.now();
  const ch = bets.challenges;
  const received = ch.filter(c => c.status === 'pending' && c.to_id === me);
  const sent = ch.filter(c => c.status === 'pending' && c.from_id === me);
  const open = ch.filter(c => c.status === 'accepted' && now < fightAt(c));
  const done = ch.filter(c => c.status === 'accepted' && now >= fightAt(c)).slice(0, 8);
  const busy = new Set(ch.filter(c => c.status === 'pending' || (c.status === 'accepted' && now < fightAt(c))).filter(c => c.from_id === me || c.to_id === me).flatMap(c => [c.from_id, c.to_id]));
  const gains = pendingWinnings();
  const pot = (c, side) => bets.wagers.filter(w => w.challenge_id === c.id && w.side === side).reduce((t, w) => t + w.amount, 0);
  const myBets = (c) => bets.wagers.filter(w => w.challenge_id === c.id && w.user_id === me);
  return modeHead({
    id: 'bets', c: '#ffd45a', art: '<canvas class="px" data-emblem="bets"></canvas>',
    title: 'Paris & duels', sub: 'Défie un pote, tout le monde parie',
    chips: [
      mchip('<canvas class="px" data-clat></canvas>', 'Ton Flouze', acc.clat),
      mchip(ico('swords'), 'Défis reçus', received.length, received.length ? 'hot' : ''),
      mchip(ico('dice'), 'Paris ouverts', open.length),
    ],
    extra: gains.ids.length ? `<button class="btn block ${gains.total ? 'green' : ''}" style="margin-top:12px" data-act="claimBets">${gains.total ? `Récupérer ${gains.total} Flouze` : 'Voir mes paris perdus'}</button>` : '',
    info: `<b>1.</b> Défie un pote.<br><b>2.</b> S’il accepte, tout le monde a <b>24 h</b> pour miser du Flouze sur le gagnant.<br><b>3.</b> Le combat se joue tout seul, avec le perso le plus fort de chacun.<br><b>4.</b> Les gagnants touchent leur mise × la cote. Plus un combattant est donné perdant, plus sa cote est haute.`,
  }) + `
    ${received.length ? `<section class="card hx" style="--hc:#ff5d6c">${secHead(ico('swords'), 'Défis reçus', 'On te provoque : réponds !')}${received.map(c => `
      <div class="foe todo"><span class="foe-av big-ico">${ico('swords')}</span><div class="foe-body"><div class="foe-name">${esc(c.from_name)} te défie !</div><div class="foe-sub">${timeOf(c.created_at)}</div></div>
        <div class="foe-col"><button class="btn small green" data-act="acceptDuel" data-id="${c.id}">Accepter</button><button class="btn small" data-act="declineDuel" data-id="${c.id}">Refuser</button></div></div>`).join('')}</section>` : ''}

    ${open.length ? `<section class="card hx" style="--hc:#ffd45a">${secHead(ico('dice'), 'Paris ouverts', 'Mise sur le gagnant avant le combat')}${open.map(c => {
      const [oA, oB] = duelOdds(c);
      const mine = myBets(c);
      return `
      <div class="duel">
        <div class="d-vs">${duelSide(c.from_snap, oA, c.from_name)}<span class="vs">VS</span>${duelSide(c.to_snap, oB, c.to_name)}</div>
        <div class="d-info">Mises : <b>${pot(c, 0)}</b> – <b>${pot(c, 1)}</b> · combat dans <b data-countdown="${fightAt(c)}">${fmt(fightAt(c) - now)}</b></div>
        ${mine.length ? `<div class="d-info">Tes paris : ${mine.map(w => `${w.amount} sur ${esc(w.side === 0 ? c.from_name : c.to_name)} (×${w.odds})`).join(', ')}</div>` : ''}
        <div class="bet-row">
          <input id="bet-${c.id}" type="number" min="1" max="1000" value="5" inputmode="numeric">
          <button class="btn small primary" data-act="placeBet" data-id="${c.id}" data-side="0">${esc(c.from_name)} ×${oA}</button>
          <button class="btn small primary" data-act="placeBet" data-id="${c.id}" data-side="1">${esc(c.to_name)} ×${oB}</button>
        </div>
      </div>`;
    }).join('')}</section>` : ''}

    <section class="card hx" style="--hc:#ffd45a">
      ${secHead(ico('fist'), 'Lancer un défi', 'Choisis ton adversaire')}
      ${players.length ? players.map(p => {
        const h = E.strongestHero(p.data);
        const o = { id: p.id, name: p.pseudo, data: p.data, classId: h.classId, dye: h.dye, level: h.level, snap: snapOf(p.data, h, p.pseudo) };
        return `
        <div class="foe ${busy.has(p.id) ? 'busy' : 'todo'}">${foeAv(o)}${foeInfo(o)}
          ${busy.has(p.id) ? '<span class="foe-wait">En cours</span>' : `<button class="foe-btn fight gold" data-act="challenge" data-id="${p.id}"><i>${ico('fist')}</i>Défier</button>`}
        </div>`;
      }).join('') : '<p class="empty">Personne d’autre n’est inscrit.</p>'}
      ${sent.map(c => `<div class="log-line">${ico('hourglass')} En attente de ${esc(c.to_name)} <button class="btn small" data-act="cancelDuel" data-id="${c.id}">Annuler</button></div>`).join('')}
    </section>

    ${done.length ? `<section class="card hx" style="--hc:#9d93d6">${secHead(ico('flag'), 'Derniers résultats')}${done.map(c => {
      const win = duelResult(c).winner;
      return `<div class="opp"><div class="o-body"><div class="o-name">${ico('trophy')} ${esc(win === 0 ? c.from_name : c.to_name)} a gagné</div><div class="o-sub">${esc(c.from_name)} vs ${esc(c.to_name)}</div></div>
        <button class="btn small" data-act="replayDuel" data-id="${c.id}">${ico('play')} Revoir</button></div>`;
    }).join('')}</section>` : ''}`;
}

// ------------------------------ Combat auto ------------------------------
// Tes 4 persos enchaînent les paliers tout seuls (un toutes les 30 s), même jeu fermé (rattrapé au retour, 8 h max).
// Le combat montré en haut de l'onglet Combats est exactement celui qui est compté (même graine).
let autoVis = { n: -1, played: 0 };   // combat affiché et nombre d'événements déjà joués (pour reprendre au même endroit)
let autoCtl = null;
let autoAway = null;                  // rattrapage en cours après une absence : { fights, rewards, from }
const autoTeam = () => throneTeam(acc, acc.pseudo);
const autoLabel = (g) => `Difficulté ${E.autoDiff(g)} · Palier ${E.autoPalier(g)}`;

function autoTick() {
  const st = E.autoState(acc);
  if (st.g > E.AUTO_LAST) return;
  const pending = Math.floor((Math.min(Date.now() - st.last, AUTO.offlineMaxMs)) / AUTO.palierMs);
  if (!pending) return;
  if (autoCtl && pending < 3) return;   // le petit écran montre les combats : ils s'enchaînent tout seuls, sans attendre
  if (pending > 2 && !autoAway) autoAway = { fights: 0, rewards: 0, from: st.g };
  const res = E.autoCatchUp(acc, autoTeam(), 30);
  if (!res.length) return;
  save();
  if (autoCtl && autoVis.n < st.n) autoCtl.skip();   // le combat affiché est déjà compté : on le termine vite
  const rewards = res.filter(r => r.reward).length;
  if (autoAway) {
    autoAway.fights += res.length; autoAway.rewards += rewards;
    if (Date.now() - st.last < AUTO.palierMs) {   // rattrapage fini
      toast(`Combat auto pendant ton absence : ${autoAway.fights} combats, maintenant ${autoLabel(st.g > E.AUTO_LAST ? E.AUTO_LAST : st.g)}${autoAway.rewards ? ` · +${autoAway.rewards} coffre${autoAway.rewards > 1 ? 's' : ''} en réserve` : ''}`);
      autoAway = null;
    }
  } else if (rewards) {
    toast(`Combat auto : palier ${E.autoPalier(res.find(r => r.reward).g)} franchi ! +1 coffre en réserve`);
  }
  autoRefresh();
}

/** Met à jour le panneau et le titre dans le ciel après un combat */
function autoRefresh() {
  const box = document.querySelector('[data-auto-info]');
  if (box) { box.innerHTML = autoInfoHtml(); hydrate(box); }
  const sky = document.querySelector('[data-auto-sky]');
  if (sky) sky.innerHTML = autoSkyHtml();
}
/** Le titre dans le ciel du combat : « Difficulté 2 » et, en dessous, « Palier 50 » */
function autoSkyHtml() {
  const st = E.autoState(acc), g = Math.min(st.g, E.AUTO_LAST);
  return `<b>Difficulté ${E.autoDiff(g)}</b><span>Palier ${E.autoPalier(g)}<small> / ${AUTO.paliers}</small></span>`;
}
function autoInfoHtml() {
  const st = E.autoState(acc);
  if (st.g > E.AUTO_LAST) return `<p class="auto-done">${ico('crown')} Les ${AUTO.diffs} difficultés sont terminées : bravo !</p>${autoBankHtml(st)}`;
  const p = E.autoPalier(st.g), next = Math.ceil(p / 10) * 10;
  const inTen = ((p - 1) % 10) + 1;
  return `
    <div class="auto-bar" title="Palier ${next} : 1 coffre">${Array.from({ length: 10 }, (_, i) => `<i class="${i < inTen - 1 ? 'on' : i === inTen - 1 ? 'now' : ''}"></i>`).join('')}
      <canvas class="px" data-chest="normal"></canvas></div>
    <div class="auto-sub"><span>${st.g - p + next <= (st.paid || 0) ? `Palier ${next} : coffre déjà gagné` : `Prochain coffre : palier ${next}`}</span><span>${ico('crown')}Record ${autoLabel(st.best).replace('Difficulté ', 'D').replace(' · Palier ', ' · P')}</span></div>
    ${autoBankHtml(st)}`;
}
function autoBankHtml(st) {
  const n = st.bank.chests;
  const xp = hero.level < MAX_LEVEL ? Math.round(E.xpForLevel(hero.level) * E.autoXpFrac(acc)) : 0;
  const what = [n ? `${n} coffre${n > 1 ? 's' : ''}` : '', xp ? `${xp} XP` : ''].filter(Boolean).join(' + ');
  return what
    ? `<button class="btn primary block auto-claim" data-act="claimAuto">Récolter ${what}${n ? ' <canvas class="px" data-chest="normal"></canvas>' : ''}</button>`
    : '<button class="btn block auto-claim" disabled>Rien à récolter pour l’instant</button>';
}

function autoCard() {
  const st = E.autoState(acc);
  const done = st.g > E.AUTO_LAST;
  // en haut de l'onglet Combats : le combat sur toute la largeur, le titre dans le ciel, le panneau en dessous
  if (!done) return `
    <section class="auto-hero">
      <div class="auto-stage"><canvas data-auto></canvas><div class="auto-sky" data-auto-sky>${autoSkyHtml()}</div></div>
      <div class="auto-panel">
        <div class="auto-top">${ico('swords')}<b>Combat auto</b>${acc.heroes.length > 1 ? `<button class="auto-form" data-act="formation">Formation</button>` : ''}</div>
        <div data-auto-info>${autoInfoHtml()}</div>
      </div>
    </section>`;
  return `
    <section class="card hx auto-card" style="--hc:#4cd964">
      ${secHead(ico('swords'), 'Combat auto', 'Toutes les difficultés sont terminées')}
      <div data-auto-info>${autoInfoHtml()}</div>
    </section>`;
}

/** Affiche en boucle le combat auto en cours dans le petit écran (sans le son) */
function startAutoVisual(canvas) {
  const holder = { stop: () => {} };
  const play = () => {
    const st = E.autoState(acc);
    if (st.g > E.AUTO_LAST || !canvas.isConnected) return;
    const n = st.n, g = st.g;
    const team = autoTeam(), mons = E.autoMonsters(g);
    const skip = autoVis.n === n ? autoVis.played : 0;
    autoVis = { n, played: 0 };
    const short = team.map(m => ({ ...m, name: CLASSES[m.classId].name }));
    const ctl = playMelee(canvas, short, mons, E.createMelee(team, mons, E.autoSeed(acc, n)), {
      silent: true, ground: 0.9, skipFirst: skip, speed: 4, colors: ['#3d9bff', '#ff5d6c'], theme: ['cave', 'forest', 'crypt', 'swamp', 'mine', 'volcano', 'glacier', 'castle', 'abyss', 'meeting'][E.autoDiff(g) - 1],
      onEvent: () => { if (autoVis.n === n) autoVis.played++; },
    });
    autoCtl = ctl;
    if (E.autoState(acc).n > n) ctl.skip();
    let stopped = false;
    holder.stop = () => { stopped = true; ctl.destroy(); if (autoCtl === ctl) autoCtl = null; };
    ctl.promise.then(() => {
      if (stopped || !canvas.isConnected) return;
      // le combat affiché est fini : on le compte tout de suite (même graine, même résultat) et le suivant démarre aussitôt
      const st2 = E.autoState(acc);
      if (st2.n === n) {
        const r = E.autoResolve(acc, team);
        st2.last = Date.now();
        save();
        if (r.reward) toast(`Combat auto : palier ${E.autoPalier(r.g)} franchi ! +1 coffre en réserve`);
        autoRefresh();
      }
      ctl.destroy();
      play();
    });
  };
  play();
  return () => holder.stop();
}

// ------------------------------ Mode histoire ------------------------------
// Chaque perso a son histoire : 3 modes (Normal, Enfer, Chaotique) × 5 zones × 10 combats, dans l'ordre.
// La carte montre le chemin de la zone choisie ; on touche un combat pour voir ses monstres et le lancer.
let storySel = null;   // { m, z } : mode et zone affichés (par défaut, là où en est le perso)
const STORY_PTS = [[50, 92], [76, 84], [68, 73], [38, 67], [20, 56], [36, 45], [66, 40], [80, 30], [70, 21], [56, 12]];   // places des 10 combats sur la carte (%)
function storySub() {
  const S = E.storyState(hero);
  if (S.prog > E.STORY_LAST) return 'Histoire terminée !';
  const st = E.storyStage(S.prog);
  return `${STORY.modes[st.mode].name} · zone ${st.zone + 1} · combat ${st.fight + 1}`;
}
const storyUnlocked = (m, z) => E.storyState(hero).prog >= E.storyG(m, z, 0);
/** Où en sont les potes dans l'Histoire (en ligne) : pour chacun, son perso le plus avancé */
function storyPals() {
  return (others() || []).map(p => {
    const h = (p.data.heroes || []).reduce((b, x) => ((x.story && x.story.prog) || 0) > ((b && b.story && b.story.prog) || 0) ? x : b, null) || p.data.heroes[0];
    return h ? { name: p.pseudo, data: p.data, classId: h.classId, dye: h.dye, level: h.level, g: (h.story && h.story.prog) || 0 } : null;
  }).filter(x => x && x.g <= E.STORY_LAST);
}
const starsHtml = (n, cls = '') => `<span class="stars ${cls}">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;
function viewStory() {
  const S = E.storyState(hero);
  if (!storySel || storySel.hero !== hero.id) {
    const st = E.storyStage(Math.min(S.prog, E.STORY_LAST));
    storySel = { hero: hero.id, m: st.mode, z: st.zone };
  }
  const { m, z } = storySel, Z = STORY.zones[z], M = STORY.modes[m];
  const total = Object.values(S.stars).reduce((a, b) => a + b, 0);
  const zs = E.storyZoneStars(hero, m, z);
  // carte : le chemin (fait en or jusqu'au combat en cours), les combats avec leurs étoiles
  const pts = STORY_PTS;
  const curve = (list) => list.map((p, i) => {
    if (!i) return `M${p[0]} ${p[1]}`;
    const a = list[i - 2] || list[i - 1], b = list[i - 1], d = list[i + 1] || p;
    return `C${(b[0] + (p[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (p[1] - a[1]) / 6).toFixed(1)} ${(p[0] - (d[0] - b[0]) / 6).toFixed(1)} ${(p[1] - (d[1] - b[1]) / 6).toFixed(1)} ${p[0]} ${p[1]}`;
  }).join('');
  const g0 = E.storyG(m, z, 0), done = Math.max(0, Math.min(10, S.prog - g0));
  // les potes : une étiquette (portrait, pseudo, niveau) à côté du combat où ils en sont
  const pals = storyPals();
  const palsHere = {};
  for (const p of pals) if (p.g >= g0 && p.g < g0 + 10) (palsHere[p.g - g0] ||= []).push(p);
  const palTags = Object.entries(palsHere).map(([f, list]) => {
    const [x, y] = pts[f];
    return `<div class="st-pals ${x > 55 ? 'left' : ''}" style="left:${x}%;top:${y}%">${list.map(p => `
      <span class="st-pal"><i><canvas class="px" data-portrait="${p.classId}" data-dye="${p.dye || ''}"></canvas></i><b>${nameHtml(p.name, p.data)}</b><small>Nv.${p.level}</small></span>`).join('')}</div>`;
  }).join('');
  const palsInZone = (zi) => pals.filter(p => { const st = E.storyStage(p.g); return st.mode === m && st.zone === zi; }).length;
  const nodes = pts.map(([x, y], f) => {
    const g = g0 + f, kind = E.storyKind(g), stars = S.stars[g] || 0;
    const state = g < S.prog ? 'done' : g === S.prog ? 'now' : 'locked';
    const foes = E.storyFoes(g), big = foes[foes.length - 1];
    return `<button class="st-node ${kind} ${state}" style="left:${x}%;top:${y}%" data-act="storyNode" data-g="${g}" aria-label="Combat ${f + 1}">
      ${state === 'locked' ? '' : starsHtml(stars)}
      <span class="st-disc">${kind === 'mob' ? `<b>${f + 1}</b>` : `<canvas class="px" data-monster="${big.monster}"></canvas>`}${state === 'locked' ? `<em>${ico('lock')}</em>` : ''}</span>
      ${kind !== 'mob' ? `<small>${kind === 'boss' ? 'BOSS' : 'Petit boss'}</small>` : ''}
      ${state === 'now' ? `<span class="st-me"><canvas class="px" data-portrait="${hero.classId}" data-dye="${hero.dye || ''}"></canvas></span>` : ''}
    </button>`;
  }).join('');
  const reward = (tier) => {
    const got = S.claimed[`${m}-${z}-${tier}`], ready = zs >= tier && !got;
    const chest = tier === 20 ? 'normal' : M.id === 'chaos' ? 'legendary' : 'epic';
    const label = tier === 20 ? `${STORY.chests20} coffres` : M.id === 'chaos' ? 'Coffre Légendaire' : 'Coffre Épique';
    return `<div class="st-r ${got ? 'got' : ready ? 'ready' : ''}">
      <canvas class="px" data-chest="${chest}"></canvas>
      <div><b>${tier} ★</b><small>${label}</small></div>
      ${got ? `<span class="st-ok">${ico('check')}</span>` : ready ? `<button class="btn small primary" data-act="storyClaim" data-m="${m}" data-z="${z}" data-t="${tier}">Récupérer</button>` : `<span class="st-need">encore ${tier - zs} ★</span>`}
    </div>`;
  };
  return `
    <section class="st-top">
      <span class="st-hero"><canvas class="px" data-portrait="${hero.classId}" data-dye="${hero.dye || ''}"></canvas></span>
      <div><b>Histoire</b><small>Ton ${CLASSES[hero.classId].name} · niveau ${hero.level}</small></div>
      <span class="st-total">${fmtNum(total)}<i>★</i><small>/ ${(E.STORY_LAST + 1) * 3}</small></span>
    </section>
    <div class="st-modes">${STORY.modes.map((x, i) => `<button class="${i === m ? 'on' : ''} ${storyUnlocked(i, 0) ? '' : 'lock'}" style="--mc:${x.color}" data-act="storyMode" data-m="${i}">${storyUnlocked(i, 0) ? '' : ico('lock')}${x.name}</button>`).join('')}</div>
    <div class="st-zones">${STORY.zones.map((x, i) => `<button class="${i === z ? 'on' : ''} ${storyUnlocked(m, i) ? '' : 'lock'}" data-act="storyZone" data-z="${i}"><b>${i + 1}</b><small>${storyUnlocked(m, i) ? `${E.storyZoneStars(hero, m, i)}★` : ico('lock')}</small>${palsInZone(i) ? `<span class="st-zp"><canvas class="px" data-emblem="players"></canvas>${palsInZone(i)}</span>` : ''}</button>`).join('')}</div>
    <section class="st-map mode-${M.id}">
      <img class="st-bg" src="art/decors/${Z.theme}.svg" alt=""><i class="st-tint"></i>
      <div class="st-title"><small>${M.name} · zone ${z + 1}</small><b>${esc(Z.name)}</b></div>
      <svg class="st-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="${curve(pts)}" class="todo"/>
        ${done > 0 ? `<path d="${curve(pts.slice(0, Math.min(10, done + 1)))}" class="done"/>` : ''}
      </svg>
      ${nodes}
      ${palTags}
    </section>
    <section class="card st-rew">
      <div class="st-rew-top"><b>Étoiles de la zone</b><span>${zs} / 30 ★</span></div>
      <div class="st-bar"><i style="width:${Math.round(100 * zs / 30)}%"></i><span style="left:66.67%"></span></div>
      <div class="st-rs">${reward(20)}${reward(30)}</div>
      <p class="hint">1 ★ si tu gagnes, 2 ★ s’il te reste ${Math.round(STORY.stars[0] * 100)} % de vie, 3 ★ avec ${Math.round(STORY.stars[1] * 100)} %. Tu peux rejouer un combat pour avoir plus d’étoiles (l’XP ne se gagne qu’une fois).</p>
    </section>`;
}
/** Fiche d'un combat : ses monstres, la puissance conseillée, les étoiles déjà gagnées */
function openStoryFight(g) {
  const S = E.storyState(hero), st = E.storyStage(g), Z = STORY.zones[st.zone], kind = E.storyKind(g);
  const foes = E.storyFoes(g), need = E.storyNeed(g), power = E.powerScore(mySnap());
  const locked = g > S.prog, first = !S.stars[g];
  const ratio = power / need;
  openModal(`
    <div class="sf-head ${kind}">
      <small>${STORY.modes[st.mode].name} · ${esc(Z.name)}</small>
      <h3>${kind === 'boss' ? `BOSS : ${esc(foes[foes.length - 1].name)}` : kind === 'mini' ? `Petit boss : ${esc(foes[foes.length - 1].name)}` : `Combat ${st.fight + 1}`}</h3>
      ${locked ? '' : starsHtml(S.stars[g] || 0, 'big')}
    </div>
    <div class="sf-foes">${foes.map((f, i) => `<div class="sf-foe ${f.boss ? 'boss' : ''}"><canvas class="px" data-monster="${f.monster}"></canvas><b>${esc(f.name)}</b><small>Nv.${f.level}</small></div>${i < foes.length - 1 ? '<i>›</i>' : ''}`).join('')}</div>
    <p class="hint" style="text-align:center;margin:4px 0 10px">Les ${foes.length} monstres arrivent à la suite, sans pause.</p>
    <div class="sf-pow">
      <div><small>Puissance conseillée</small><b>${fmtNum(need)}</b></div>
      <div class="${ratio >= 1.1 ? 'good' : ratio >= 0.9 ? 'ok' : 'bad'}"><small>Ton héros</small><b>${fmtNum(power)}</b></div>
    </div>
    <div class="rw" style="display:flex;justify-content:center;margin:10px 0 4px">${first ? `<span class="pill gold">+${fmtNum(E.storyXp(g))} XP (1re victoire)</span>` : '<span class="pill">XP déjà gagnée</span>'}</div>
    <div class="row" style="gap:8px;margin-top:12px">
      <button class="btn block" data-act="closeModal">Fermer</button>
      ${locked ? `<button class="btn block" disabled>${ico('lock')} Gagne d’abord le combat d’avant</button>` : `<button class="btn primary block" data-act="storyFight" data-g="${g}">${ico('swords')} ${first ? 'Combattre' : 'Rejouer'}</button>`}
    </div>`, { center: true });
}
/** Lance un combat d'histoire : les monstres arrivent à la suite (comme une vague de donjon) */
function startStoryFight(g) {
  const S = E.storyState(hero);
  if (g > S.prog || g > E.STORY_LAST) return;
  closeModal();
  const h = hero, me = mySnap(), foes = E.storyFoes(g), last = foes.length - 1;
  const st = E.storyStage(g), Z = STORY.zones[st.zone], kind = E.storyKind(g);
  const title = (i) => `${esc(Z.name)} <span style="color:var(--gold)">·</span> ${foes[i].boss ? `${kind === 'boss' ? 'BOSS' : 'Petit boss'} : ${esc(foes[i].name)}` : `Combat ${st.fight + 1} · ${i + 1}/${foes.length}`}`;
  const live = E.createWave(me, foes, (Math.random() * 2 ** 31) | 0);
  let cur = 0;
  const prevProg = S.prog;
  runBattle({
    me, foe: foes[0], live, theme: Z.theme, manual: true, victory: myVictory(), title: title(0),
    onEvent: (e) => {
      if (e.type !== 'nextFoe') return;
      cur++;
      const t = document.querySelector('.battle-vs');
      if (t) t.innerHTML = title(cur);
    },
    finish: (result) => {
      const won = result.winner === 0;
      const rw = E.storyResult(h, g, won, result.hpFrac || 0);
      save();
      const S2 = E.storyState(h);
      let unlock = '';
      if (won && S2.prog > prevProg && S2.prog <= E.STORY_LAST) {
        const ns = E.storyStage(S2.prog);
        if (ns.fight === 0) unlock = ns.zone === 0 ? `Mode ${STORY.modes[ns.mode].name} débloqué !` : `Zone ${ns.zone + 1} débloquée : ${STORY.zones[ns.zone].name} !`;
        storySel = { hero: h.id, m: ns.mode, z: ns.zone };
      } else if (won && S2.prog > E.STORY_LAST && prevProg <= E.STORY_LAST) unlock = 'Tu as fini toute l’histoire. Légende !';
      const next = won && g + 1 <= E.STORY_LAST && g + 1 <= S2.prog ? () => startStoryFight(g + 1) : null;
      return {
        rewards: rw,
        headline: won ? (kind === 'boss' ? 'BOSS VAINCU !' : 'VICTOIRE !') : 'DÉFAITE…',
        next, nextLabel: 'Combat suivant ›', backLabel: 'Carte',
        auto: next && g + 1 === S2.prog ? 3000 : 0,   // un nouveau combat derrière : il part tout seul (pas pour rejouer les anciens)
        rewardsHtml: won ? `
          <div class="sr-stars">${[1, 2, 3].map(i => `<i class="${i <= rw.stars ? 'on' : ''}" style="animation-delay:${i * 0.25}s">★</i>`).join('')}</div>
          <p class="hint" style="margin:0">Il te reste ${Math.round((result.hpFrac || 0) * 100)} % de vie${rw.stars < 3 ? ` · 3 ★ à partir de ${Math.round(STORY.stars[1] * 100)} %` : ''}${rw.better && !rw.first ? ' · nouveau record d’étoiles !' : ''}</p>
          <div class="rw">${xpPills(rw)}</div>
          ${unlock ? `<div class="st-unlock">${ico('star')} ${unlock}</div>` : ''}`
          : `<p style="color:var(--muted);margin:0">${result.kills ? `${result.kills} monstre${result.kills > 1 ? 's' : ''} battu${result.kills > 1 ? 's' : ''} sur ${foes.length}. ` : ''}Rien de perdu : améliore ton héros et retente quand tu veux !</p>`,
      };
    },
  });
}

// ------------------------------ Le trône ------------------------------
// Classement de la semaine (lundi 0 h) : l'ordre de départ par puissance, puis chaque victoire contre quelqu'un
// au-dessus de soi échange les deux places. En ligne, l'ordre de départ et les défis sont rangés dans le journal
// des combats (kind « throne_start » et « throne »). Hors ligne, contre les bots.
let throneInfo = { week: '', order: [], prevWeek: '', prevOrder: [] };
let throneLoading = null, throneError = '';
const throneRank = (id = myId()) => throneInfo.order.indexOf(id);

/** L'équipe du trône d'un compte : ses 4 persos, les plus forts devant */
/** Équipe à 4 (trône, combat auto) : les 4 plus forts, rangés selon la formation du joueur (ligne 1 devant) ; sans formation, le plus fort devant */
function teamPairs(data, pseudo) {   // [[héros, photo], …] dans l'ordre des lignes
  const top = data.heroes.map(h => [h, snapOf(data, h, pseudo)]).sort((a, b) => E.powerScore(b[1]) - E.powerScore(a[1])).slice(0, 4);
  const f = data.formation || [];
  const rank = (h) => { const i = f.indexOf(h.id); return i < 0 ? 99 : i; };
  return top.sort((a, b) => rank(a[0]) - rank(b[0]));
}
function throneTeam(data, pseudo) { return teamPairs(data, pseudo).map(x => x[1]); }

/** Ma formation pour les combats à 4 : un petit terrain où les persos sont debout comme en combat.
 *  On les déplace en les faisant glisser sur une autre place, ou en touchant un perso puis un autre (ils échangent). */
const LINE_NAMES = ['devant', '2ᵉ ligne', '3ᵉ ligne', 'derrière'];
const FORM_SLOTS = [[61, 16], [46, 122], [31, 16], [16, 122]];   // place de chaque ligne sur le terrain : gauche (%), hauteur (px) — de devant (près des ennemis) à derrière, en quinconce
let formSel = null;
function openFormation() {
  const pairs = teamPairs(acc, acc.pseudo);
  formSel = null;
  openModal(`
    <h3>${ico('swords')} Ma formation</h3>
    ${pairs.length < 2 ? '<p class="empty">Il te faut au moins 2 persos pour choisir une formation.</p>' : `
    <div class="fm-field" id="fm-field">
      <img class="fm-bg" src="art/decors/castle.svg" alt=""><i class="fm-shade"></i>
      <div class="fm-foes"><span>${ico('swords')} Ennemis</span></div>
      ${pairs.map(([h], i) => { const [x, y] = FORM_SLOTS[i], cac = E.MELEE_CLASSES.includes(h.classId); return `
        <div class="fm-slot" data-i="${i}" style="left:${x}%;bottom:${y}px;z-index:${30 - Math.round(y / 10)}">
          <i class="fm-mark"><b>${i + 1}</b></i>
          <div class="fm-hero" data-i="${i}">
            <canvas class="px" data-hero="${h.classId}" data-dye="${h.dye || ''}"></canvas>
            <span class="fm-tag ${cac ? 'cac' : 'dist'}">${cac ? ico('sword') : ico('target')}</span>
          </div>
          <small class="fm-name">${CLASSES[h.classId].name}<span>Nv.${h.level}</span></small>
        </div>`; }).join('')}
    </div>
    <div class="fm-legend"><span class="cac">${ico('sword')} Corps à corps : lignes 1 et 2 d’abord</span><span class="dist">${ico('target')} À distance : toutes les lignes</span></div>
    <p class="hint fm-help">Fais glisser un perso sur une autre place, ou touche-en deux pour les échanger.</p>`}
    <div class="close-row"><button class="btn primary" data-act="closeModal">C’est bon</button></div>`, { center: true });
  initFormationField();
}
function formationSwap(i, j) {
  const ids = teamPairs(acc, acc.pseudo).map(([h]) => h.id);
  if (i === j || i < 0 || j < 0 || i >= ids.length || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  acc.formation = ids;
  SFX.click(); save();
  renderOnClose = true;   // l'équipe affichée derrière (combat auto, trône) se met à jour à la fermeture
  openFormation();
}
/** Glisser-déposer (doigt ou souris) et « touche-en deux » sur le terrain de formation */
function initFormationField() {
  const field = document.getElementById('fm-field');
  if (!field) return;
  let drag = null;
  const slotAt = (x, y) => {
    let best = null, bd = Infinity;
    field.querySelectorAll('.fm-slot').forEach(sl => {
      const r = sl.querySelector('.fm-hero').getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bd) { bd = d; best = +sl.dataset.i; }
    });
    return best;
  };
  field.querySelectorAll('.fm-hero').forEach(el => {
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      try { el.setPointerCapture(ev.pointerId); } catch (e) { /* certains navigateurs refusent : le glisser marche quand même */ }
      drag = { el, i: +el.dataset.i, x: ev.clientX, y: ev.clientY, moved: false };
    });
    el.addEventListener('pointermove', (ev) => {
      if (!drag || drag.el !== el) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      el.classList.add('drag');
      el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
      const over = slotAt(ev.clientX, ev.clientY);
      field.querySelectorAll('.fm-slot').forEach(sl => sl.classList.toggle('over', +sl.dataset.i === over && over !== drag.i));
    });
    const end = (ev) => {
      if (!drag || drag.el !== el) return;
      const d = drag;
      drag = null;
      if (d.moved) {
        el.style.transform = '';
        el.classList.remove('drag');
        field.querySelectorAll('.fm-slot').forEach(sl => sl.classList.remove('over'));
        const to = slotAt(ev.clientX, ev.clientY);
        if (to !== null && to !== d.i) formationSwap(d.i, to);
        return;
      }
      // simple toucher : on choisit un perso, puis un autre pour échanger
      if (formSel === null) { formSel = d.i; el.closest('.fm-slot').classList.add('sel'); SFX.click(); }
      else if (formSel === d.i) { formSel = null; el.closest('.fm-slot').classList.remove('sel'); }
      else formationSwap(formSel, d.i);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (ev) => { if (drag && drag.el === el) { drag.moved = true; end(ev); } });
  });
}
/** Équipe d'un bot hors ligne : 4 persos autour de son niveau */
function botThroneTeam(o) {
  const classes = [o.classId, ...Object.keys(CLASSES).filter(c => c !== o.classId)].slice(0, 3);
  return [0, 1, 2, 3].map(j => E.snapshot(E.buildBot({ id: `${o.id}-t${j}`, name: o.name, classId: classes[j % classes.length] }, Math.max(1, o.level - j * 2), E.throneRound())));
}
/** Tous les prétendants au trône : moi et les autres joueurs (ou les bots hors ligne) */
function throneContenders() {
  const me = { id: myId(), name: acc.pseudo, data: acc, team: throneTeam(acc, acc.pseudo) };
  const rest = NET.online
    ? players.filter(p => p.data && p.data.heroes && p.data.heroes.length).map(p => ({ id: p.id, name: p.pseudo, data: p.data, team: throneTeam(p.data, p.pseudo) }))
    : opponents().map(o => ({ id: o.id, name: o.name, data: null, classId: o.classId, team: botThroneTeam(o) }));
  return [me, ...rest].map(c => ({ ...c, power: Math.round(c.team.reduce((t, m) => t + E.powerScore(m), 0)) }));
}
const byPower = (list) => [...list].sort((a, b) => b.power - a.power).map(c => c.id);

function loadThrone() {
  if (throneLoading) return throneLoading;
  throneError = '';
  throneLoading = (async () => {
    try {
      const all = throneContenders();
      const ids = byPower(all);
      // une « semaine » du trône est maintenant une manche de 3 jours
      const week = E.throneRound();
      const prevWeek = E.throneRound(new Date(E.throneRoundStart() - 86400000));
      if (!NET.online) {
        // hors ligne : le classement est gardé dans la sauvegarde
        acc.throne ||= { claimed: {} };
        let L = acc.throne.local;
        if (!L || L.week !== week) {
          if (L && L.week === prevWeek) acc.throne.prev = { week: prevWeek, order: E.throneRanking(L.order, L.fights, ids) };
          L = acc.throne.local = { week, order: ids, fights: [] };
          save();
        }
        const P = acc.throne.prev && acc.throne.prev.week === prevWeek ? acc.throne.prev : null;
        throneInfo = { week, order: E.throneRanking(L.order, L.fights, ids), prevWeek, prevOrder: P ? P.order : [] };
        return;
      }
      const since = new Date(Math.max(E.throneRoundStart(new Date(E.throneRoundStart() - 86400000)) - 3600000, E.eraFrom())).toISOString();
      let rows = await NET.fetchThrone(since);
      const startOf = (w) => rows.find(r => r.kind === 'throne_start' && r.a_snap && r.a_snap.week === w);
      const fightsOf = (w) => rows.filter(r => r.kind === 'throne' && r.a_snap && r.a_snap.week === w);
      if (!startOf(week)) {
        // premier passage de la semaine : on fixe l'ordre de départ, par puissance (le plus ancien enregistrement fait foi)
        await NET.logFight({ defender_id: null, attacker_name: acc.pseudo, defender_name: '', kind: 'throne_start', winner: 0, seed: 0, a_snap: { week, order: ids }, d_snap: {} });
        rows = await NET.fetchThrone(since);
      }
      const start = startOf(week), prev = startOf(prevWeek);
      throneInfo = {
        week, prevWeek,
        order: E.throneRanking(start ? start.a_snap.order : ids, fightsOf(week), ids),
        prevOrder: prev ? E.throneRanking(prev.a_snap.order, fightsOf(prevWeek), ids) : [],
      };
    } catch (e) {
      throneError = e.message || 'Erreur inconnue';
    } finally {
      throneLoading = null;
    }
  })();
  return throneLoading;
}

function viewThrone() {
  if (throneInfo.week !== E.throneRound() || !throneInfo.order.length) {
    if (throneError) {
      return `<section class="card"><h2>Le trône</h2><p class="auth-msg">Impossible de charger le trône : ${esc(throneError)}</p>
        <button class="btn primary block" style="margin-top:12px" data-act="retryThrone">Réessayer</button></section>`;
    }
    if (!throneLoading) loadThrone().then(() => { if (tab === 'throne') softRender(); });
    return offlineCard('Le trône', 'Chargement du classement…');
  }
  const all = throneContenders();
  const byId = Object.fromEntries(all.map(c => [c.id, c]));
  const list = throneInfo.order.map(id => byId[id]).filter(Boolean);
  const me = myId();
  const myRank = list.findIndex(c => c.id === me);
  const king = list[0];
  // récompense de la manche précédente
  const prevRank = throneInfo.prevOrder.indexOf(me);
  const claimed = acc.throne && acc.throne.claimed && acc.throne.claimed[throneInfo.prevWeek] !== undefined;
  const prevCard = prevRank >= 0 && !claimed ? `
    <section class="card war-reward">
      <h2>Trône : la manche précédente</h2>
      <div class="big-res">${prevRank === 0 ? 'Tu étais le roi !' : `Tu as fini ${prevRank + 1}ᵉ`}</div>
      <p class="hint">+${E.throneFlouze(prevRank)} Flouze pour toi.</p>
      <button class="btn primary block" data-act="claimThrone">Récupérer mon Flouze</button>
    </section>` : '';
  const heroOf = (c) => (c.data ? E.strongestHero(c.data) : { classId: c.classId || c.team[0].classId, dye: null });
  const canFight = (i) => myRank > i;   // on ne défie que ceux au-dessus de soi
  const fightBtn = (c, i) => (canFight(i) ? `<button class="btn small danger tr-go" data-act="throneFight" data-id="${c.id}">${ico('swords')} Défier</button>` : '');
  const card = (c, i) => {
    const h = heroOf(c);
    return `
      <div class="tr-card ${c.id === me ? 'me' : ''} ${i < 3 ? `top${i + 1}` : ''}">
        <span class="tr-rank">${i < 3 ? [ico('medal1'), ico('medal2'), ico('medal3')][i] : i + 1}</span>
        <span class="tr-prize">+${E.throneFlouze(i)}<canvas class="px ico" data-clat></canvas></span>
        <canvas class="px" data-portrait="${h.classId}" data-dye="${h.dye || ''}"></canvas>
        <div class="tr-name">${nameHtml(c.name, c.data)}</div>
        <small class="tr-pow">${ico('bolt')} ${fmtNum(c.power)}</small>
        ${fightBtn(c, i)}
      </div>`;
  };
  // pyramide sous le roi : 2, puis 3, puis 4… joueurs par rangée
  const rows = [];
  for (let i = 1, n = 2; i < list.length; i += n, n++) rows.push(list.slice(i, i + n).map((c, j) => card(c, i + j)).join(''));
  const kh = heroOf(king);
  const kpet = king.data ? petOf(kh) : '';
  return prevCard + modeHead({
    id: 'throne', c: '#ffd45a', art: '<canvas class="px" data-emblem="throne"></canvas>',
    title: 'Le trône', sub: '',
    chips: [
      mchip(ico('crown'), 'Ta place', `${myRank + 1} / ${list.length}`, myRank === 0 ? 'hot' : ''),
      mchip(ico('medal1'), 'Le roi', esc(king.name)),
      mchip(ico('hourglass'), 'Fin de la manche', `<span data-endlong="${Date.now() + E.msToNextThrone()}">${fmtLong(E.msToNextThrone())}</span>`),
    ],
    extra: acc.heroes.length > 1 ? `<button class="btn small block form-open" data-act="formation">${ico('swords')} Ma formation (lignes 1 à ${Math.min(4, acc.heroes.length)})</button>` : '',
    info: `Une manche dure <b>${THRONE.days} jours</b>. Au début, tout le monde est classé selon la <b>puissance de ses 4 persos</b>. Défie qui tu veux <b>au-dessus de toi</b>, autant de fois que tu veux : si tu gagnes, vous échangez vos places ; si tu perds, rien ne bouge.<br><br>Combat à <b>4 contre 4</b> : tous tes persos contre tous les siens, en même temps, chacun selon sa vitesse. Choisis tes lignes dans « Ma formation » : le Guerrier et le Paladin frappent d’abord les lignes 1 et 2, le Mage et l’Archer toutes les lignes.<br><br>À la fin de la manche : <b>${THRONE.flouze[0]} Flouze</b> pour le roi, <b>${THRONE.flouze[1]}</b> pour le 2ᵉ, <b>${THRONE.flouzeRest}</b> pour tous les autres. Puis une nouvelle manche repart selon la puissance.`,
  }) + `
    <section class="card hx throne-hall" style="--hc:#ffd45a">
      <div class="tr-king ${king.id === me ? 'me' : ''}">
        <img class="dg2-bg" src="art/decors/castle.svg" alt=""><i class="dg2-shade"></i><i class="tr-rays"></i>
        <span class="tr-prize big">+${E.throneFlouze(0)}<canvas class="px ico" data-clat></canvas></span>
        <span class="tr-crown">${ico('crown')}</span>
        <div class="tr-king-art"><canvas class="px" data-hero="${kh.classId}" data-pet="${kpet}" data-dye="${kh.dye || ''}"></canvas></div>
        <div class="tr-king-name">${nameHtml(king.name, king.data)}</div>
        <small class="tr-pow">${ico('bolt')} ${fmtNum(king.power)} · Roi de la manche</small>
        ${fightBtn(king, 0)}
      </div>
      ${rows.map((r, j) => `<div class="tr-row" style="--n:${j + 2}">${r}</div>`).join('')}
    </section>`;
}

function claimThroneReward() {
  const rank = throneInfo.prevOrder.indexOf(myId());
  if (rank < 0) return;
  const n = E.claimThrone(acc, throneInfo.prevWeek, rank);
  if (!n) return;
  SFX.loot(3); save(); render();
  toast(`+${n} Flouze pour ta place au trône !`);
}

/** Défi du trône : mon équipe contre la sienne, en mêlée à 4 contre 4 */
function startThrone(targetId) {
  const all = throneContenders();
  const foe = all.find(c => c.id === targetId), meC = all.find(c => c.id === myId());
  const ri = throneRank(targetId), mi = throneRank();
  if (!foe || !meC || ri < 0 || mi <= ri) { toast('Tu ne peux défier que quelqu’un au-dessus de toi.'); return; }
  const seed = (Math.random() * 2 ** 31) | 0;
  const week = throneInfo.week;
  const fight = E.createMelee(meC.team, foe.team, seed);
  runMelee({
    teamA: meC.team, teamB: foe.team, fight,
    title: `Le trône <span style="color:var(--gold)">·</span> ${esc(acc.pseudo)} <span style="color:var(--gold)">VS</span> ${esc(foe.name)} (${ri + 1}ᵉ)`,
    finish: (result) => {
      const won = result.winner === 0;
      const row = { attacker_id: myId(), defender_id: foe.id, winner: won ? 0 : 1 };
      if (NET.online) {
        NET.logFight({ defender_id: foe.id, attacker_name: acc.pseudo, defender_name: foe.name, kind: 'throne', winner: won ? 0 : 1, seed, a_snap: { week, team: meC.team, lines: true }, d_snap: { team: foe.team } })
          .then(r => { journal.unshift({ ...r, ...row, attacker_name: acc.pseudo, defender_name: foe.name, kind: 'throne', seed, a_snap: { week, team: meC.team, lines: true }, d_snap: { team: foe.team } }); return loadThrone(); })
          .then(() => { if (tab === 'throne' && !document.querySelector('.battle')) softRender(); })
          .catch(e => toast(e.message));
      } else if (acc.throne && acc.throne.local && acc.throne.local.week === week) {
        acc.throne.local.fights.push(row);
      }
      if (won) { const o = throneInfo.order; o[mi] = foe.id; o[ri] = myId(); }   // échange des places tout de suite à l'écran
      save();
      return {
        headline: won ? (ri === 0 ? 'TU ES LE ROI !' : `TU PRENDS LA ${ri + 1}ᵉ PLACE !`) : 'DÉFAITE…',
        headClass: won ? 'win' : 'lose',
        rewardsHtml: `<p style="color:var(--muted);margin:0">${won ? `${esc(foe.name)} descend à ta place (${mi + 1}ᵉ).` : 'Tu gardes ta place. Retente quand tu veux !'}</p>`,
      };
    },
  });
}

/** Écran de combat du trône (mêlée), sur le même modèle que runBattle */
function runMelee({ teamA, teamB, fight, title, finish }) {
  stopPreviews.forEach(f => f());
  stopPreviews = [];
  const short = (team) => team.map(m => ({ ...m, name: CLASSES[m.classId].name }));
  const ov = document.createElement('div');
  ov.className = 'battle';
  ov.innerHTML = `
    <div class="battle-vs">${title}</div>
    <div class="battle-wrap"><canvas id="arena"></canvas></div>
    <div class="battle-ctrl nobar">
      <div class="dock">
        <div class="dock-side">
          <button class="dock-btn on" data-act="speed" id="speed-btn">x3</button>
          <button class="dock-btn" data-act="toggleSound" id="snd-btn" aria-label="Son">${ico(getPref('sfx') || getPref('music') ? 'speaker' : 'mute')}</button>
        </div>
      </div>
    </div>
    <div class="battle-after" id="result-slot"></div>`;
  document.body.appendChild(ov);
  hydrate(ov);
  battleFight = null;
  battleCtl = playMelee(ov.querySelector('#arena'), short(teamA), short(teamB), fight, { colors: ['#3d9bff', '#ff5d6c'] });
  battleCtl.speedIdx = 2; battleCtl.setSpeed(3);   // les combats partent en x3 (le bouton repasse en x1, x2…)
  battleCtl.promise.then(() => {
    const result = fight.result();
    const out = finish(result) || {};
    const won = result.winner === 0;
    ov.querySelector('.battle-ctrl')?.remove();
    const slot = ov.querySelector('#result-slot');
    slot.innerHTML = `
      <div class="result">
        <h2 class="${out.headClass || (won ? 'win' : 'lose')}">${pxCaps(out.headline || (won ? 'VICTOIRE' : 'DÉFAITE…')).replace(/\s*!+\s*$/, '')}</h2>
        ${out.rewardsHtml || ''}
        <button class="btn primary" data-act="endFight">Continuer</button>
      </div>`;
    hydrate(slot);
  });
}

// ------------------------------ PvP en direct ------------------------------
// Un défi PvP est une ligne de la table des défis marquée from_snap.pvp, avec l'équipe de chaque joueur.
// Le combat est calculé de la même façon chez les deux joueurs et chez ceux qui regardent.
let pvpRows = [];
const pvpCache = {};
const isPvp = (c) => !!(c && c.from_snap && c.from_snap.pvp);
/** L'équipe d'un joueur : tous ses persos (4 max), du plus faible au plus fort */
const teamOf = (data, pseudo) => data.heroes.map(h => snapOf(data, h, pseudo)).sort((a, b) => E.powerScore(a) - E.powerScore(b)).slice(0, 4);
const dataOfId = (id) => (id === myId() ? acc : (players.find(p => p.id === id) || {}).data);
function rowTeams(c) {
  const t = (snap, id, name) => (snap && snap.team) || (dataOfId(id) ? teamOf(dataOfId(id), name) : []);
  return [t(c.from_snap, c.from_id, c.from_name), t(c.to_snap, c.to_id, c.to_name)];
}
const pvpResult = (c) => (pvpCache[c.id] ||= E.simulateRelay(...rowTeams(c), Number(c.seed) || 1));
const pvpExpired = (c) => c.status === 'pending' && Date.now() - new Date(c.created_at).getTime() > PVP.expireMs;
const pvpIncoming = () => pvpRows.filter(c => c.status === 'pending' && c.to_id === myId() && !pvpExpired(c));
/** Les 4 persos d'une équipe, côte à côte (case vide si le joueur en a moins) */
const teamStrip = (team, cls = '') => `<div class="tm-strip ${cls}">${[0, 1, 2, 3].map(i => {
  const s = team[i];
  return s ? `<div class="tm-h cls-${s.classId}"><canvas class="px" data-portrait="${s.classId}" data-dye="${s.dye || ''}"></canvas><b>Nv.${s.level}</b></div>`
    : '<div class="tm-h empty"><span>—</span></div>';
}).join('')}</div>`;
const teamPower = (team) => team.reduce((t, s) => t + E.powerScore(s), 0);

function viewPvp() {
  if (!NET.online) return offlineCard('PvP en direct', 'Le PvP marche seulement en ligne, contre tes potes connectés.');
  const me = myId();
  const myTeam = teamOf(acc, acc.pseudo);
  const online = players.filter(p => isOnline(p.id));
  const open = pvpRows.filter(c => c.status === 'pending' && !pvpExpired(c));
  const incoming = open.filter(c => c.to_id === me), outgoing = open.filter(c => c.from_id === me);
  const busy = new Set(open.flatMap(c => [c.from_id, c.to_id]));
  const matches = pvpRows.filter(c => c.status === 'accepted').slice(0, 12);
  const left = E.pvpRewardsLeft(acc);
  return modeHead({
    id: 'pvp', c: '#b05cff', art: '<canvas class="px" data-emblem="pvp"></canvas>',
    title: 'PvP en direct', sub: '',
    chips: [
      mchip('<i class="dot-on"></i>', 'Potes en ligne', online.length, online.length ? 'hot' : ''),
      mchip('<canvas class="px" data-clat></canvas>', 'Gains du jour', `${PVP.rewardsPerDay - left} / ${PVP.rewardsPerDay}`),
      mchip(ico('swords'), 'Ton équipe', `${myTeam.length} perso${myTeam.length > 1 ? 's' : ''}`),
    ],
    info: `Défie un pote <b>connecté</b> : il reçoit une notification et a 3 minutes pour accepter. Le match se lance aussitôt pour vous deux.<br><br>
      Tous vos persos entrent l’un après l’autre, du plus faible au plus fort. Quand un perso tombe, le suivant de son équipe arrive ; le gagnant du duel garde ses PV. L’équipe qui n’a plus personne perd. Avec moins de 4 persos, tu peux jouer, mais tu es désavantagé.<br><br>
      Le gagnant touche <b>${PVP.reward} Flouze</b> (${PVP.rewardsPerDay} fois par jour maximum). Tout le monde peut regarder les matchs.`,
  }) + `
    <section class="card hx" style="--hc:#b05cff">
      ${secHead(ico('star'), 'Ton équipe', `Puissance totale ${fmtNum(teamPower(myTeam))}`)}
      ${teamStrip(myTeam, 'big')}
    </section>
    ${incoming.length ? `<section class="card hx" style="--hc:#ff5d6c">${secHead(ico('swords'), 'On te défie', 'Réponds vite : 3 minutes')}${incoming.map(c => `
      <div class="foe todo"><span class="foe-av big-ico">${ico('swords')}</span><div class="foe-body"><div class="foe-name">${esc(c.from_name)} te défie</div><div class="foe-sub">${timeOf(c.created_at)}</div></div>
        <button class="foe-btn fight" data-act="pvpVs" data-id="${c.id}"><i>${ico('swords')}</i>Voir</button></div>`).join('')}</section>` : ''}
    <section class="card hx" style="--hc:#b05cff">
      ${secHead('<i class="dot-on"></i>', 'Défier un pote', online.length ? 'Choisis ton adversaire' : 'Personne en ligne pour l’instant')}
      ${online.length ? online.map(p => {
        const t = teamOf(p.data, p.pseudo);
        const waiting = outgoing.find(c => c.to_id === p.id);
        return `
        <div class="pvp-row">
          <div class="pr-top"><div class="foe-name">${dotHtml(p.id)}${nameHtml(p.pseudo, p.data)}</div><small>${ico('bolt')}${fmtNum(teamPower(t))}</small></div>
          ${teamStrip(t)}
          ${waiting ? `<div class="pr-wait">${ico('hourglass')} En attente de sa réponse… <button class="btn small" data-act="pvpCancel" data-id="${waiting.id}">Annuler</button></div>`
            : `<button class="btn danger block" data-act="pvpChallenge" data-id="${p.id}" ${busy.has(p.id) || busy.has(me) ? 'disabled' : ''}>${ico('swords')} Défier ${esc(p.pseudo)}</button>`}
        </div>`;
      }).join('') : '<p class="empty">Dès qu’un pote ouvre l’appli, il apparaît ici.</p>'}
    </section>
    <section class="card hx" style="--hc:#ffd45a">
      ${secHead(ico('play'), 'Matchs', 'Les derniers combats PvP : regarde-les tous')}
      ${matches.length ? matches.map(c => {
        const r = pvpResult(c);
        const mine = c.from_id === me || c.to_id === me;
        const won = mine && r.winner === (c.from_id === me ? 0 : 1);
        return `
        <div class="pvp-match ${mine ? (won ? 'win' : 'loss') : ''}">
          <div class="pm-names"><b class="${r.winner === 0 ? 'w' : ''}">${esc(c.from_name)}</b><span>VS</span><b class="${r.winner === 1 ? 'w' : ''}">${esc(c.to_name)}</b></div>
          <small>${timeOf(c.accepted_at || c.created_at)} · ${ico('trophy')} ${esc(r.winner === 0 ? c.from_name : c.to_name)}</small>
          <button class="ibtn" data-act="pvpWatch" data-id="${c.id}" aria-label="Regarder">${ico('play')}</button>
        </div>`;
      }).join('') : '<p class="empty">Aucun match pour l’instant.</p>'}
    </section>`;
}

/** Écran VS : les deux équipes côte à côte (et, pour un défi reçu, accepter / refuser) */
function openPvpVs(c, invite = false) {
  const [A, B0] = rowTeams(c);
  const B = invite ? teamOf(acc, acc.pseudo) : B0;
  openModal(`
    <div class="pvp-vs">
      <div class="vs-title">${invite ? `${esc(c.from_name)} te défie` : 'Match PvP'}</div>
      <div class="vs-grid">
        <div class="vs-side blue"><b>${esc(c.from_name)}</b>${teamStrip(A, 'col')}<small>${ico('bolt')}${fmtNum(teamPower(A))}</small></div>
        <div class="vs-mid">VS</div>
        <div class="vs-side red"><b>${esc(c.to_name)}</b>${teamStrip(B, 'col')}<small>${ico('bolt')}${fmtNum(teamPower(B))}</small></div>
      </div>
      ${invite
        ? `<div class="row" style="gap:8px;margin-top:14px"><button class="btn block" data-act="pvpDecline" data-id="${c.id}">Refuser</button><button class="btn danger block" data-act="pvpAccept" data-id="${c.id}">${ico('swords')} Accepter</button></div>`
        : `<button class="btn danger block big-go" data-act="pvpWatch" data-id="${c.id}">${ico('play')} Regarder le match</button>`}
      <div class="close-row"><button class="btn" data-act="closeModal">Fermer</button></div>
    </div>`, { center: true });
}

async function pvpChallenge(id) {
  const p = players.find(x => x.id === id);
  if (!p || !isOnline(p.id)) { toast('Ce pote n’est plus en ligne.'); return; }
  try {
    const row = await NET.createPvp(p.id, acc.pseudo, p.pseudo, { pvp: 1, team: teamOf(acc, acc.pseudo) }, (Math.random() * 2 ** 31) | 0);
    if (row) pvpRows.unshift(row);
    toast(`Défi envoyé à ${p.pseudo} : il a 3 minutes pour répondre.`);
  } catch (e) { toast(e.message); }
  softRender();
}

async function pvpAccept(id) {
  const c = pvpRows.find(x => x.id === id);
  if (!c || pvpExpired(c)) { closeModal(); toast('Ce défi a expiré.'); await refreshBets(); softRender(); return; }
  const patch = { status: 'accepted', accepted_at: new Date().toISOString(), to_snap: { pvp: 1, team: teamOf(acc, acc.pseudo) } };
  try { await NET.answerChallenge(c.id, patch); } catch (e) { toast(e.message); return; }
  Object.assign(c, patch);
  closeModal();
  watchPvp(c);
}

function onPvpLive(row) {
  const me = myId();
  const i = pvpRows.findIndex(c => c.id === row.id);
  if (i >= 0) pvpRows[i] = { ...pvpRows[i], ...row }; else pvpRows.unshift(row);
  const free = !document.querySelector('.battle') && !modalRoot.innerHTML;
  if (row.status === 'pending' && row.to_id === me) {
    SFX.message();
    if (free) openPvpVs(row, true); else toast(`${row.from_name} te défie en PvP ! Va dans Combats › PvP.`);
  } else if (row.status === 'accepted' && row.from_id === me) {
    SFX.message();
    if (free) openPvpVs(pvpRows.find(c => c.id === row.id)); else toast(`${row.to_name} a accepté ton défi PvP !`);
  } else if (row.status === 'declined' && row.from_id === me) toast(`${row.to_name} a refusé ton défi.`);
  if (tab === 'pvp' || tab === 'combat' || tab === 'hub_pvp') softRender();
}

/** Regarder un match (en direct ou en rediffusion). Le gagnant touche son Flouze. */
function watchPvp(c) {
  const [A, B] = rowTeams(c);
  if (!A.length || !B.length) { toast('Match introuvable.'); return; }
  const result = pvpResult(c);
  const me = myId();
  const mySide = c.from_id === me ? 0 : c.to_id === me ? 1 : -1;
  const pips = (n, tot) => `<span class="pips-vs">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(tot - n)}</span>`;
  const head = (sc) => `${esc(c.from_name)} ${pips(sc[0], A.length)} <span style="color:var(--gold)">VS</span> ${pips(sc[1], B.length)} ${esc(c.to_name)}`;
  runBattle({
    me: A[0], foe: B[0], result, theme: 'arena', track: false, noBar: true, title: head([A.length, B.length]),
    onEvent: (e) => { if (e.score) { const t = document.querySelector('.battle-vs'); if (t) t.innerHTML = head(e.score); } },
    finish: (r) => {
      const wName = r.winner === 0 ? c.from_name : c.to_name;
      const iWon = mySide >= 0 && r.winner === mySide;
      const got = iWon ? E.pvpReward(acc, c.id) : 0;
      if (got) save();
      return {
        won: mySide < 0 || iWon,
        headline: mySide < 0 ? `${wName} GAGNE` : iWon ? 'VICTOIRE' : 'DÉFAITE',
        headClass: mySide < 0 || iWon ? 'win' : 'lose',
        rewardsHtml: got ? `<div class="rw"><span class="pill clat"><canvas class="px" data-clat></canvas>+${got} Flouze</span></div>`
          : iWon ? '<p style="color:var(--muted);margin:0">Gain déjà touché, ou maximum du jour atteint.</p>' : '',
      };
    },
  });
}

// ------------------------------ Championnat ------------------------------
// Tableau de 8 joueurs tiré au hasard chaque lundi ; quarts, demies et finale à 19 h 30 les trois premiers jours.
// En ligne, le tableau et chaque match joué sont rangés dans le journal des combats (le plus ancien enregistrement fait foi) ;
// hors ligne (jeu de test), dans la sauvegarde. Le premier joueur qui ouvre le jeu après 19 h 30 fait jouer les matchs du jour.
let champInfo = { week: '', slots: [], matches: {}, prev: null };
let champLoading = null, champError = '';
const champWeekStart = (week) => { const [y, m, d] = week.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const champRes = (matches) => Object.fromEntries(Object.entries(matches).map(([k, v]) => [k, v.ids[v.winner]]));
/** Joue les matchs dont l'heure est passée et qui n'ont pas encore de résultat ; save(key, match) les enregistre */
async function champPlay(week, slots, matches, byId, store) {
  const start = champWeekStart(week);
  for (let r = 0; r < CHAMP.days.length; r++) {
    if (Date.now() < E.champRoundAt(start, r)) break;
    const tree = E.champTree(slots, champRes(matches));
    for (let m = 0; m < tree[r].length; m++) {
      const x = tree[r][m], key = `${r}-${m}`;
      if (x.bye || x.a === undefined || x.b === undefined || matches[key]) continue;
      const A = byId[x.a], B = byId[x.b];
      if (!A || !B) continue;
      const seed = E.champSeed(week, r, m);
      const res = E.champMatch(A.team, B.team, seed);
      const row = { r, m, ids: [x.a, x.b], names: [A.name, B.name], teams: [A.team, B.team], games: res.games, wins: res.wins, winner: res.winner };
      matches[key] = await store(key, row, seed) || row;
    }
  }
}
function loadChamp() {
  if (champLoading) return champLoading;
  champError = '';
  champLoading = (async () => {
    try {
      const all = throneContenders();
      const byId = Object.fromEntries(all.map(c => [c.id, c]));
      const ids = all.map(c => c.id);
      const week = E.throneWeek();
      const prevWeek = E.throneWeek(new Date(E.throneWeekStart() - 3 * 86400000));
      if (!NET.online) {
        acc.champ ||= { claimed: {} };
        let L = acc.champ.local;
        if (!L || L.week !== week) {
          if (L && L.week === prevWeek) acc.champ.prev = L;
          L = acc.champ.local = { week, slots: E.champSlots(ids, week), matches: {} };
        }
        await champPlay(week, L.slots, L.matches, byId, async () => null);
        save();
        const P = acc.champ.prev && acc.champ.prev.week === prevWeek ? acc.champ.prev : null;
        champInfo = { week, slots: L.slots, matches: L.matches, prev: P };
        return;
      }
      // Fuze Arena 2.0 : le premier championnat commence la semaine qui suit la mise en ligne
      if (E.throneWeekStart() < E.eraStart()) { champInfo = { week, slots: [], matches: {}, prev: null, soon: E.champRoundAt(E.throneWeekStart(), 0) + 7 * 86400000 + 3 * 3600000 }; return; }   // lundi prochain (marge pour le changement d'heure)
      const since = new Date(Math.max(E.throneWeekStart() - 7 * 86400000, E.eraFrom())).toISOString();
      let rows = await NET.fetchChamp(since);
      const startOf = (w) => rows.find(r => r.kind === 'champ_start' && r.a_snap && r.a_snap.week === w);
      const matchesOf = (w) => {
        const out = {};
        for (const r of rows) if (r.kind === 'champ' && r.a_snap && r.a_snap.week === w && !out[r.a_snap.key]) out[r.a_snap.key] = r.a_snap;
        return out;
      };
      if (!startOf(week)) {
        await NET.logFight({ defender_id: null, attacker_name: acc.pseudo, defender_name: '', kind: 'champ_start', winner: 0, seed: 0, a_snap: { week, slots: E.champSlots(ids, week) }, d_snap: {} });
        rows = await NET.fetchChamp(since);
      }
      const slots = startOf(week).a_snap.slots, matches = matchesOf(week);
      let played = false;
      await champPlay(week, slots, matches, byId, async (key, row, seed) => {
        played = true;
        await NET.logFight({ defender_id: null, attacker_name: row.names[0], defender_name: row.names[1], kind: 'champ', winner: row.winner, seed, a_snap: { week, key, ...row }, d_snap: {} });
        return null;
      });
      if (played) {   // relire : si quelqu'un d'autre a joué le même match en même temps, le premier enregistré compte
        rows = await NET.fetchChamp(since);
        Object.assign(matches, matchesOf(week));
      }
      const ps = startOf(prevWeek);
      champInfo = { week, slots, matches, prev: ps ? { week: prevWeek, slots: ps.a_snap.slots, matches: matchesOf(prevWeek) } : null };
    } catch (e) {
      champError = e.message || 'Erreur inconnue';
    } finally {
      champLoading = null;
    }
  })();
  return champLoading;
}
/** Petit texte de la tuile du championnat */
function champSub() {
  if (champInfo.soon && champInfo.week === E.throneWeek()) return 'Premier tournoi lundi';
  if (champInfo.week !== E.throneWeek()) return 'Tableau de la semaine';
  const nx = champNext();
  if (!nx) { const t = E.champTree(champInfo.slots, champRes(champInfo.matches)); const w = t[2][0].winner; const c = w && throneContenders().find(x => x.id === w); return c ? `Champion : ${c.name}` : 'Finale jouée'; }
  return `${CHAMP.roundNames[nx.r]} à 19 h 30`;
}
/** Prochain tour à jouer cette semaine (ou null si la finale est passée) */
function champNext() {
  const start = champWeekStart(champInfo.week);
  for (let r = 0; r < CHAMP.days.length; r++) if (Date.now() < E.champRoundAt(start, r)) return { r, at: E.champRoundAt(start, r) };
  return null;
}
const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function viewChamp() {
  if (champInfo.soon && champInfo.week === E.throneWeek()) return `<section class="card"><h2>Championnat</h2>
    <p class="lead">Le premier championnat commence le ${new Date(champInfo.soon).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à 19 h 30.</p></section>`;
  if (champInfo.week !== E.throneWeek() || !champInfo.slots.length) {
    if (champError) return `<section class="card"><h2>Championnat</h2><p class="auth-msg">Impossible de charger le championnat : ${esc(champError)}</p>
      <button class="btn primary block" style="margin-top:12px" data-act="retryChamp">Réessayer</button></section>`;
    if (!champLoading) loadChamp().then(() => { if (tab === 'champ') softRender(); });
    return offlineCard('Championnat', 'Chargement du tableau…');
  }
  const all = throneContenders();
  const byId = Object.fromEntries(all.map(c => [c.id, c]));
  const me = myId();
  const tree = E.champTree(champInfo.slots, champRes(champInfo.matches));
  const fin = tree[2][0];
  const start = champWeekStart(champInfo.week);
  const heroOf = (c) => (c && c.data ? E.strongestHero(c.data) : c ? { classId: c.classId || c.team[0].classId, dye: null } : null);
  const who = (id, won, lost) => {
    if (id === undefined) return '<div class="ch-p tbd"><span class="ch-av"></span><span class="ch-n">À venir</span></div>';
    if (id === null) return '<div class="ch-p empty"><span class="ch-av"></span><span class="ch-n">Place vide</span></div>';
    const c = byId[id], h = heroOf(c);
    return `<div class="ch-p ${won ? 'won' : ''} ${lost ? 'lost' : ''} ${id === me ? 'me' : ''}">
      <span class="ch-av">${h ? `<canvas class="px" data-portrait="${h.classId}" data-dye="${h.dye || ''}"></canvas>` : ''}</span>
      <span class="ch-n">${c ? nameHtml(c.name, c.data) : '?'}</span></div>`;
  };
  const roundOne = ['Quart de finale', 'Demi-finale', 'Finale'];
  const whenOf = (r) => { const at = E.champRoundAt(start, r), d = new Date(at); return { at, txt: `${DAY_NAMES[d.getDay()]} ${CHAMP.hour} h ${String(CHAMP.minute).padStart(2, '0')}` }; };
  // tout en haut : MON match (le dernier tour où j'apparais), à jouer ou déjà joué
  const myMatch = () => {
    if (!champInfo.slots.includes(me)) return `
      <section class="card ch-mine none"><div class="ch-stage">Cette semaine</div><p class="hint">Tu n’es pas dans le tableau de cette semaine. Le prochain tirage a lieu lundi.</p></section>`;
    let r = 2, m = -1;
    for (; r >= 0; r--) { m = tree[r].findIndex(x => x.a === me || x.b === me); if (m >= 0) break; }
    const x = tree[r][m], M = champInfo.matches[`${r}-${m}`], w = whenOf(r);
    const done = x.winner !== undefined && x.winner !== null;
    const won = done && x.winner === me, foe = x.a === me ? x.b : x.a;
    const mine = M ? (M.ids ? M.ids.indexOf(me) : x.a === me ? 0 : 1) : 0;
    const score = M ? `<b class="ch-sc">${M.wins[mine]} - ${M.wins[1 - mine]}</b>` : '<b class="ch-sc">VS</b>';
    const status = done
      ? (won ? (r === 2 ? `<div class="ch-verdict win">${ico('trophy')} Champion de la semaine !</div>` : x.bye ? `<div class="ch-verdict win">Qualifié d’office : ton adversaire n’était pas là</div>` : `<div class="ch-verdict win">Gagné ! Rendez-vous au tour suivant</div>`)
        : `<div class="ch-verdict lost">Perdu : éliminé en ${roundOne[r].toLowerCase()}</div>`)
      : Date.now() < w.at ? `<div class="ch-when">${ico('hourglass')} ${w.txt} · <span data-endlong="${w.at}">${fmtLong(w.at - Date.now())}</span></div>`
        : '<div class="ch-when">Le combat se joue…</div>';
    return `
      <section class="card ch-mine ${done ? (won ? 'won' : 'lost') : ''}">
        <div class="ch-stage">${roundOne[r]}</div>
        <div class="ch-match big">${who(me, done && won, done && !won)}${score}${who(foe, done && !won, done && won)}</div>
        ${status}
        ${M ? `<button class="btn small blue ch-watch" data-act="champMatch" data-k="${r}-${m}">${ico('play')} Revoir le match</button>` : ''}
      </section>`;
  };
  // en dessous : le tableau du tournoi dessiné (quarts → demies → finale → champion)
  const bkP = (id, x, side) => {
    const M = champInfo.matches[`${x.r}-${x.m}`];
    const done = x.winner !== undefined && x.winner !== null;
    if (id === undefined) return '<div class="bk-p tbd"><i></i><span>?</span></div>';
    if (id === null) return '<div class="bk-p empty"><i></i><span>—</span></div>';
    const c = byId[id], h = heroOf(c);
    const sc = M ? M.wins[M.ids ? M.ids.indexOf(id) : side] : '';
    return `<div class="bk-p ${done && x.winner === id ? 'won' : done ? 'lost' : ''} ${id === me ? 'me' : ''}">
      <i>${h ? `<canvas class="px" data-portrait="${h.classId}" data-dye="${h.dye || ''}"></canvas>` : ''}</i><span>${c ? esc(c.name) : '?'}</span>${sc !== '' && sc !== undefined ? `<b>${sc}</b>` : ''}</div>`;
  };
  const bkM = (x, r, m) => {
    const y = { ...x, r, m }, M = champInfo.matches[`${r}-${m}`];
    const path = x.a === me || x.b === me;
    return `<${M ? 'button' : 'div'} class="bk-m ${path ? 'mine' : ''}" ${M ? `data-act="champMatch" data-k="${r}-${m}"` : ''}>${bkP(x.a, y, 0)}${bkP(x.b, y, 1)}</${M ? 'button' : 'div'}>`;
  };
  const bracket = () => {
    const col = (r) => {
      const ms = tree[r].map((x, m) => bkM(x, r, m));
      const groups = r < 2 ? Array.from({ length: ms.length / 2 }, (_, i) => `<div class="bk-pair">${ms[2 * i]}${ms[2 * i + 1]}</div>`) : [`<div class="bk-pair one">${ms[0]}</div>`];
      return `<div class="bk-col"><div class="bk-h">${['Quarts', 'Demies', 'Finale'][r]}<small>${whenOf(r).txt.split(' ')[0]}</small></div><div class="bk-body">${groups.join('')}</div></div>`;
    };
    const ch = fin.winner ? byId[fin.winner] : null, hc = heroOf(ch);
    return `
      <section class="card hx ch-tree" style="--hc:#ffd45a">
        ${secHead(ico('trophy'), 'Le tableau', 'Touche un match joué pour le revoir')}
        <div class="bk">${[0, 1, 2].map(col).join('')}
          <div class="bk-col champ"><div class="bk-h">Champion<small>&nbsp;</small></div><div class="bk-body"><div class="bk-win ${ch ? 'on' : ''} ${fin.winner === me ? 'me' : ''}">
            <canvas class="px" data-emblem="champ"></canvas>${ch ? `<i>${hc ? `<canvas class="px" data-portrait="${hc.classId}" data-dye="${hc.dye || ''}"></canvas>` : ''}</i><span>${esc(ch.name)}</span>` : '<span>?</span>'}</div></div></div>
        </div>
      </section>`;
  };
  // récompenses (cette semaine ou la semaine dernière), à récupérer une fois
  const claimCard = (info) => {
    if (!info) return '';
    const t = E.champTree(info.slots, champRes(info.matches)), place = E.champPlace(t, me);
    acc.champ ||= { claimed: {} };
    if (!place || acc.champ.claimed[info.week]) return '';
    const txt = { win: ['Tu es champion !', `${CHAMP.flouze.win} Flouze pour toi.`], second: ['Tu es finaliste !', `${CHAMP.flouze.second} Flouze pour toi.`], other: ['Merci d’avoir joué !', `${CHAMP.flouze.other} Flouze pour toi.`] }[place];
    return `<section class="card war-reward"><h2>Championnat${info.week !== champInfo.week ? ' de la semaine dernière' : ''}</h2><div class="big-res">${txt[0]}</div><p class="hint">${txt[1]}</p>
      <button class="btn primary block" data-act="claimChamp" data-w="${info.week}">Récupérer ma récompense</button></section>`;
  };
  // l'heure d'un tour est passée et un match n'a pas encore de résultat : on le fait jouer
  const due = tree.some((rd, r) => Date.now() >= E.champRoundAt(start, r) && rd.some((x, m) => !x.bye && x.a != null && x.b != null && !champInfo.matches[`${r}-${m}`]));
  if (due && !champLoading) setTimeout(() => loadChamp().then(() => { if (tab === 'champ') softRender(); }), 0);
  return claimCard(champInfo.prev) + claimCard(champInfo) + myMatch() + bracket() + `
    <section class="card ch-rules ${infoCls('champ')}" data-info="champ">
      <div class="ch-rules-top">${ico('flag')}<b>Comment ça marche</b><small>Nouveau tableau dans <span data-endlong="${Date.now() + E.msToNextThroneWeek()}">${fmtLong(E.msToNextThroneWeek())}</span></small></div>
      <div class="more-txt">Chaque lundi, un tableau de <b>8 joueurs</b> est tiré au hasard (s’il manque quelqu’un, son adversaire passe directement). Les combats se lancent tout seuls à <b>19 h 30</b> : quarts de finale le lundi, demi-finales le mardi, finale le mercredi. Chaque match se joue en <b>3 manches</b> (2 manches gagnées suffisent), tes 4 persos contre les 4 siens en relais, sans soin entre deux duels. Tu peux revoir chaque manche.<br><br>Récompenses : <b>${CHAMP.flouze.win} Flouze</b> pour le champion, <b>${CHAMP.flouze.second}</b> pour le finaliste, <b>${CHAMP.flouze.other}</b> pour tous les autres. Puis tout recommence le lundi suivant.</div>
      ${moreBtn('champ')}
    </section>`;
}
/** Fiche d'un match : les manches, chacune à revoir */
function openChampMatch(key) {
  const M = champInfo.matches[key];
  if (!M) return;
  openModal(`
    <h3>${CHAMP.roundNames[M.r]} : ${esc(M.names[0])} contre ${esc(M.names[1])}</h3>
    <p class="hint" style="margin-top:6px">${esc(M.names[M.winner])} gagne ${M.wins[M.winner]} manche${M.wins[M.winner] > 1 ? 's' : ''} à ${M.wins[1 - M.winner]}.</p>
    <div class="ch-games">${M.games.map((g, i) => `
      <button class="ch-game" data-act="champGame" data-k="${key}" data-g="${i}"><b>Manche ${i + 1}</b><span>${esc(M.names[g.winner])} gagne</span>${ico('play')}</button>`).join('')}
    </div>
    <div class="close-row"><button class="btn" data-act="closeModal">Fermer</button></div>`);
}
function watchChampGame(key, gi) {
  const M = champInfo.matches[key], g = M && M.games[gi];
  if (!g) return;
  closeModal();
  const [A, B] = M.teams;
  const result = E.simulateRelay(A, B, g.seed);
  const pips = (n, tot) => `<span class="pips-vs">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(tot - n)}</span>`;
  const head = (sc) => `${esc(M.names[0])} ${pips(sc[0], A.length)} <span style="color:var(--gold)">VS</span> ${pips(sc[1], B.length)} ${esc(M.names[1])}`;
  runBattle({
    me: A[0], foe: B[0], result, theme: 'castle', track: false, noBar: true, skip: true, title: head([A.length, B.length]),
    onEvent: (e) => { if (e.score) { const t = document.querySelector('.battle-vs'); if (t) t.innerHTML = head(e.score); } },
    finish: (r) => ({ won: true, headline: `${M.names[r.winner]} GAGNE`, headClass: 'win', rewardsHtml: `<p style="color:var(--muted);margin:0">Manche ${gi + 1} sur ${M.games.length}</p>` }),
  });
}

// ------------------------------ Raid ------------------------------
let raidInfo = { week: '', raid: null, hits: [], prev: null, prevHits: [], prevWeek: '' };
/** Le boss du raid en cours (avant le chargement : le dernier connu) */
const curRaid = () => E.raidDef((raidInfo.raid && raidInfo.raid.boss) || acc.raid.lastTag || RAID.tag);
let raidLoading = null;   // chargement en cours (une seule requête à la fois)
let raidError = '';

function groupLevels() {
  const mine = E.strongestHero(acc).level;
  if (NET.online) return [mine, ...players.map(p => E.strongestHero(p.data).level)];
  return [mine, ...opponents().map(o => o.level)];
}

const RAID_DAYS = 7;
const raidEndOf = (startMs) => startMs + RAID_DAYS * 86400000;

/** Raid hors ligne (bots) : dure 7 jours à partir de son ouverture */
function localRaid() {
  const L = acc.raid.local;
  const botHits = (key, days, level) => FRIENDS.flatMap(f => {
    const out = [];
    for (let d = 0; d < days; d++) {
      const r = makeRng(hashStr('raid' + key + f.id + d));
      const n = Math.floor(r() * 4);
      for (let i = 0; i < n; i++) out.push({ user_id: f.id, pseudo: f.name, damage: Math.round(E.raidExpectedDamage(level) * (0.6 + r() * 0.8)) });
    }
    return out;
  });
  const hitsOf = (k) => { const R = L[k]; return [...R.hits, ...botHits(k, Math.min(RAID_DAYS, Math.floor((Date.now() - R.start) / 86400000) + 1), R.level)]; };
  const keys = Object.keys(L).filter(k => L[k].start).sort((a, b) => L[b].start - L[a].start);
  // raid en cours : pas fini et boss encore debout (s'il est battu, le suivant arrive tout de suite)
  let curKey = keys.find(k => E.isRaidTag(L[k].tag) && Date.now() < raidEndOf(L[k].start) && !raidSummary(L[k], hitsOf(k)).killed);
  if (!curKey) {
    const tag = keys.length ? E.nextRaidTag(L[keys[0]].tag) : RAID.tag;   // boss suivant de la rotation
    curKey = tag + E.dayKey();
    const lv = groupLevels();
    L[curKey] = { start: Date.now(), tag, hp: E.raidHp(lv, tag), level: Math.round(lv.reduce((a, b) => a + b, 0) / lv.length), hits: [] };
  }
  const prevKey = Object.keys(L).filter(k => k !== curKey && L[k].start).sort((a, b) => L[b].start - L[a].start)[0] || '';
  for (const k of Object.keys(L)) if (k !== curKey && k !== prevKey) delete L[k];
  const cur = L[curKey];
  const res = { week: curKey, prevWeek: prevKey, endsAt: raidEndOf(cur.start), raid: { hp: cur.hp, level: cur.level, boss: cur.tag }, hits: hitsOf(curKey), prev: null, prevHits: [] };
  if (prevKey) { const P = L[prevKey]; res.prev = { hp: P.hp, level: P.level, boss: P.tag }; res.prevHits = hitsOf(prevKey); }
  return res;
}

// Le boss a toujours au moins RAID.minHp PV
const fixRaid = (r) => (r ? { ...r, hp: Math.max(RAID.minHp, r.hp) } : r);

/** Raid en ligne : le plus récent encore actif (7 jours après son ouverture), sinon on en ouvre un nouveau */
function loadRaid() {
  if (!NET.online) { raidInfo = localRaid(); acc.raid.lastTag = raidInfo.raid.boss; save(); return Promise.resolve(); }
  if (raidLoading) return raidLoading;   // déjà en route : on attend la même réponse
  raidError = '';
  raidLoading = (async () => {
    try {
      const list = (await NET.fetchLatestRaids()).filter(r => E.eraRow(r.created_at)).map(fixRaid);   // rien de l'ancien jeu
      const endOf = (r) => raidEndOf(new Date(r.created_at).getTime());
      let raid = list.find(r => E.isRaidTag(r.boss) && Date.now() < endOf(r)) || null;
      // boss déjà battu : pas besoin d'attendre la fin des 7 jours, le suivant arrive tout de suite
      if (raid && raidSummary(raid, await NET.fetchRaidHits(raid.week)).killed) raid = null;
      const prev = list.find(r => r !== raid) || null;
      if (!raid) {
        // raid fini : on ouvre le boss suivant de la rotation (le même pour tout le monde, donc le même nom de semaine)
        const tag = E.nextRaidTag(list[0] && list[0].boss);
        const lv = groupLevels();
        const week = (E.eraLive() ? 'f2-' : 'f2t-') + (tag === RAID.tag ? 'v3' : tag.replace(':', '-')) + '-' + E.dayKey();   // « f2- » : jamais le nom d'un raid de l'ancien jeu (« f2t- » : essai avant 19 h)
        raid = fixRaid(await NET.openRaid(week, tag, E.raidHp(lv, tag), Math.round(lv.reduce((a, b) => a + b, 0) / lv.length)));
      }
      if (!raid) throw new Error('Le raid n’a pas pu être ouvert.');
      const [hits, prevHits] = await Promise.all([NET.fetchRaidHits(raid.week), prev ? NET.fetchRaidHits(prev.week) : []]);
      if (raidSummary(raid, hits).killed) throw new Error('Le boss suivant n’a pas pu être ouvert.');   // évite de recharger en boucle
      raidInfo = { week: raid.week, raid, hits, prev, prevHits, prevWeek: prev ? prev.week : '', endsAt: endOf(raid) };
      acc.raid.lastTag = raid.boss;
    } catch (e) {
      raidError = e.message || 'Erreur inconnue';
    } finally {
      raidLoading = null;
    }
  })();
  return raidLoading;
}

function raidSummary(raid, hits) {
  const total = hits.reduce((t, h) => t + h.damage, 0);
  const by = {};
  for (const h of hits) { (by[h.user_id] ||= { pseudo: h.pseudo, dmg: 0 }).dmg += h.damage; }
  const board = Object.entries(by).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.dmg - a.dmg);
  const remaining = Math.max(0, raid.hp - total);
  return { total, remaining, killed: remaining <= 0, board };
}

function viewRaid() {
  // raid fini, ou boss battu : on charge le suivant
  if (!raidInfo.raid || Date.now() >= raidInfo.endsAt || raidSummary(raidInfo.raid, raidInfo.hits).killed) {
    // Important : ne lancer le chargement qu'une fois (sinon l'écran se redessine en boucle et l'appli se fige)
    if (raidError) {
      return `<section class="card"><h2>Raid : ${curRaid().name}</h2>
        <p class="auth-msg">Impossible de charger le raid : ${esc(raidError)}</p>
        <button class="btn primary block" style="margin-top:12px" data-act="retryRaid">Réessayer</button></section>`;
    }
    if (!raidLoading) loadRaid().then(() => { if (tab === 'raid') softRender(); });
    return offlineCard(`Raid : ${curRaid().name}`, 'Chargement du raid…');
  }
  const me = myId();
  const S = raidSummary(raidInfo.raid, raidInfo.hits);
  const left = E.raidLeft(acc);
  const mine = S.board.find(b => b.id === me);
  const isMvp = S.board[0] && S.board[0].id === me;
  const canClaim = S.killed && mine && !acc.raid.claimed[raidInfo.week];
  let prevCard = '';
  if (raidInfo.prev && !acc.raid.claimed[raidInfo.prevWeek]) {
    const P = raidSummary(raidInfo.prev, raidInfo.prevHits);
    const PB = E.raidDef(raidInfo.prev.boss);
    const pm = P.board.find(b => b.id === me);
    if (pm) prevCard = `
      <section class="card war-reward">
        <h2>Raid précédent</h2>
        <div class="big-res">${P.killed ? `${PB.name} est tombé${PB.f ? 'e' : ''} !` : `${PB.name} a résisté…`}</div>
        <p class="hint">Tu lui as infligé ${fmtNum(pm.dmg)} dégâts.</p>
        <button class="btn primary block" data-act="claimRaid" data-week="${raidInfo.prevWeek}">Récupérer ma récompense</button>
      </section>`;
  }
  const R = RAID.rewards;
  const hp = raidInfo.raid.hp;
  const B = curRaid();
  return prevCard + modeHead({
    id: 'raid', c: '#ff8a3d', art: `<span class="mh-fire">${ico('fire')}</span>`,
    title: `Raid : ${B.name}`, sub: B.cycle ? `Tour ${B.cycle + 1} : il revient plus fort !` : '',
    chips: [
      mchip(ico('swords'), 'Tes assauts', `${left} / ${RAID.attemptsPerHalf}`, left && !S.killed ? 'hot' : ''),
      mchip(ico('clock'), 'Prochaine charge', E.raidNextIn(acc) ? `<span data-charge="${Date.now() + E.raidNextIn(acc)}">${fmt(E.raidNextIn(acc))}</span>` : 'Pleine'),
      mchip(ico('hourglass'), 'Fin du raid', `<span data-endlong="${raidInfo.endsAt}">${fmtLong(raidInfo.endsAt - Date.now())}</span>`),
    ],
    info: `Tout le groupe tape le même boss. <b>${RAID.attemptsPerHalf} charges d’assaut</b> par compte : une charge utilisée revient au bout de <b>${RECHARGE.ms / 3600000} h</b>. Le raid dure 7 jours.<br><br>S’il tombe avant la fin : <b>${R.killChests} coffre de guerre + ${R.killClat} Flouze</b> pour chaque participant, et un coffre de guerre en plus pour celui qui a fait le plus de dégâts. Sinon, ${R.failClat} Flouze de consolation.<br><br>Le gros boss ne rapporte pas d’XP : on vient pour les coffres et le Flouze.`,
  }) + `
    <section class="card hx rd2" style="--hc:#ff8a3d">
      <div class="rd2-stage">
        <img class="dg2-bg" src="art/decors/${B.theme || 'meeting'}.svg" alt=""><i class="dg2-shade"></i><i class="rd2-glow"></i>
        <span class="rd2-tag">Boss · Nv.${raidInfo.raid.level}</span>
        <div class="rd2-art"><canvas class="px" data-monster="${B.sprite}"></canvas></div>
        <div class="rd2-rw"><small>S’il tombe</small><span><canvas class="px" data-chest="war"></canvas>${R.killChests}</span><span><canvas class="px ico" data-clat></canvas>${R.killClat}</span></div>
      </div>
      <b class="rd2-name">${B.name}</b>
      <div class="rd2-hp ${S.killed ? 'dead' : ''}"><i style="width:${(S.remaining / hp) * 100}%"></i><span>${S.killed ? 'VAINCU !' : `${fmtNum(S.remaining)} / ${fmtNum(hp)} PV`}</span></div>
      <div class="hd2-charges rd2-charges">
        <span class="dg2-pips">${'<i class="on"></i>'.repeat(left)}${'<i></i>'.repeat(Math.max(0, RAID.attemptsPerHalf - left))}</span>
        <span>${left ? `${left} assaut${left > 1 ? 's' : ''}` : 'Plus d’assaut'}</span>
        ${E.raidNextIn(acc) ? `<span class="dg2-wait">+1 dans <b data-charge="${Date.now() + E.raidNextIn(acc)}">${fmt(E.raidNextIn(acc))}</b></span>` : ''}
      </div>
      ${canClaim
        ? `<button class="btn primary block big-go" data-act="claimRaid" data-week="${raidInfo.week}">Récupérer ma récompense</button>`
        : `<button class="btn danger block big-go" data-act="attackRaid" ${left > 0 && !S.killed ? '' : 'disabled'}>${S.killed ? 'Boss vaincu' : left > 0 ? `${ico('swords')} Attaquer` : 'Plus d’assaut : reviens plus tard'}</button>`}
    </section>
    <section class="card hx" style="--hc:#ff8a3d">
      ${secHead(ico('trophy'), 'Dégâts', `${fmtNum(S.total)} au total`)}
      ${S.board.length ? S.board.map((b, i) => `
        <div class="rd2-row ${b.id === me ? 'me' : ''}">
          <span class="rd2-pos">${[ico('medal1'), ico('medal2'), ico('medal3')][i] || i + 1}</span>
          <div class="rd2-who"><b>${nameHtml(b.pseudo, dataOfPseudo(b.pseudo))}</b><i style="width:${Math.max(4, b.dmg / Math.max(1, S.board[0].dmg) * 100)}%"></i></div>
          <span class="rd2-dmg">${fmtNum(b.dmg)}</span>
        </div>`).join('')
        : '<p class="empty">Personne ne l’a encore attaqué.</p>'}
    </section>`;
}

function attackRaid() {
  if (E.raidLeft(acc) <= 0 || !raidInfo.raid) return;
  const S = raidSummary(raidInfo.raid, raidInfo.hits);
  if (S.killed) return;
  const me = mySnap();
  const B = curRaid();
  const boss = E.raidBoss(raidInfo.raid.level, raidInfo.raid.hp, S.remaining, B.tag);
  if (!E.useRaidAssault(acc)) return;
  E.missionEvent(acc, 'raid');
  save();
  const week = raidInfo.week;
  const h = hero;
  runBattle({
    me, foe: boss, seed: (Math.random() * 2 ** 31) | 0, sim: { maxActions: RAID.maxActions, timeoutWinner: false },
    theme: B.theme, manual: true, victory: myVictory(), title: `Raid · ${B.name}`,
    finish: (result) => {
      const dmg = E.damageDealt(result, S.remaining);
      const hit = { user_id: myId(), pseudo: acc.pseudo, damage: dmg };
      if (raidInfo.week === week) raidInfo.hits.push(hit);
      if (NET.online) NET.addRaidHit(week, acc.pseudo, dmg).catch(e => toast(e.message));
      else if (acc.raid.local[week]) acc.raid.local[week].hits.push(hit);
      E.missionEvent(acc, 'raid_dmg', dmg);
      const lv = null;   // le gros boss ne donne plus d'XP
      save();
      const killed = dmg >= S.remaining;
      return {
        rewards: lv,
        headline: killed ? `${B.name.toUpperCase()} EST TOMBÉ${B.f ? 'E' : ''} !` : `${fmtNum(dmg)} DÉGÂTS`, headClass: 'win',
        rewardsHtml: `<div class="rw"><span class="pill gold">${fmtNum(dmg)} dégâts infligés</span><span class="pill">Reste ${fmtNum(Math.max(0, S.remaining - dmg))} PV</span></div>`,
      };
    },
  });
}

function claimRaid(week) {
  const cur = week === raidInfo.week;
  const S = cur ? raidSummary(raidInfo.raid, raidInfo.hits) : raidSummary(raidInfo.prev, raidInfo.prevHits);
  const me = myId();
  const rw = E.raidReward(acc, week, S.killed, S.board[0] && S.board[0].id === me, S.board.some(b => b.id === me));
  if (!rw) return;
  save(); render();
  toast(`Récompense : ${rw.chests ? `${rw.chests} coffre${rw.chests > 1 ? 's' : ''} de guerre + ` : ''}${rw.clat} Flouze !`);
}

// ------------------------------ La Horde ------------------------------
/** Les monstres qui défilent sur la scène de la Horde (de plus en plus gros) */
const HORDE_MOBS = ['rat', 'goblin', 'skeleton', 'mushroom', 'golem'];
function viewHorde() {
  const st = E.hordeState(acc);
  const left = E.hordeRunsLeft(hero);
  const best = st.best || 0, top = HORDE.keys[0][0] + 5;   // la piste va un peu au-delà du dernier palier
  return modeHead({
    id: 'horde', c: '#ff3d6e', art: '<canvas class="px" data-emblem="horde"></canvas>',
    title: 'La Horde', sub: '',
    chips: [
      mchip(ico('swords'), 'Charges', `${left} / ${HORDE.runsPerHalf}`, left ? 'hot' : ''),
      mchip(ico('trophy'), 'Ton record', `${st.best || 0}`),
      mchip(ico('clock'), 'Prochaine charge', E.hordeNextIn(hero) ? `<span data-charge="${Date.now() + E.hordeNextIn(hero)}">${fmt(E.hordeNextIn(hero))}</span>` : 'Pleine'),
    ],
    info: `Les monstres arrivent l’un après l’autre, sans pause, et de plus en plus forts (le 1<sup>er</sup> est niveau 1). <b>Aucun soin</b> entre deux monstres : tu gardes tes PV jusqu’à tomber.<br><br>
      Tu gagnes des <b>clefs</b> pour ton perso selon le nombre de monstres battus (${[...HORDE.keys].reverse().map(([k, n]) => `${k} monstres → ${n} clef${n > 1 ? 's' : ''}`).join(', ')}). <b>${HORDE.runsPerHalf} charges pour chaque perso</b> : une charge utilisée revient au bout de <b>${RECHARGE.ms / 3600000} h</b>. Change de perso actif pour en refaire.<br><br><b>XP</b> : chaque essai rapporte aussi de l’XP à ton perso actif. Plus tu vas loin, plus tu en gagnes.`,
  }) + `
    <section class="card hx hd2" style="--hc:#ff3d6e">
      <div class="hd2-stage">
        <img class="dg2-bg" src="art/decors/abyss.svg" alt=""><i class="dg2-shade"></i>
        <div class="hd2-mobs">${HORDE_MOBS.map((sp, i) => `<canvas class="px" data-monster="${sp}" style="--i:${i}"></canvas>`).join('')}</div>
        <div class="hd2-rec">${ico('trophy')}<small>Ton record</small><b>${best}</b><small>monstre${best > 1 ? 's' : ''}</small></div>
      </div>
      <div class="hd2-track">
        <small class="hd2-lbl">Clefs pour ton ${CLASSES[hero.classId].name} selon les monstres battus</small>
        <div class="hd2-bar"><i style="width:${Math.min(100, best / top * 100)}%"></i>
          ${[...HORDE.keys].reverse().map(([k, n]) => `<span class="hd2-tier ${best >= k ? 'got' : ''}" style="left:${k / top * 100}%"><em><canvas class="px ico" data-key></canvas>${n}</em><b>${k}</b></span>`).join('')}
        </div>
      </div>
      <div class="hd2-charges">
        <span class="dg2-pips">${'<i class="on"></i>'.repeat(left)}${'<i></i>'.repeat(HORDE.runsPerHalf - left)}</span>
        <span>${left ? `${left} essai${left > 1 ? 's' : ''} pour ce perso` : 'Plus d’essai pour ce perso'}</span>
        ${E.hordeNextIn(hero) ? `<span class="dg2-wait">+1 dans <b data-charge="${Date.now() + E.hordeNextIn(hero)}">${fmt(E.hordeNextIn(hero))}</b></span>` : ''}
      </div>
      <button class="btn danger block big-go" data-act="startHorde" ${left ? '' : 'disabled'}>${left ? `${ico('swords')} Lancer la horde` : 'Plus d’essai : change de perso ou attends la recharge'}</button>
    </section>
    <section class="card hx" style="--hc:#ff3d6e">
      ${secHead(ico('trophy'), 'Classement', 'Le record de chaque joueur')}
      ${hordeBoard().map((r, i) => `
        <div class="opp rank ${r.me ? 'me' : ''}"><div class="pos">${[ico('medal1'), ico('medal2'), ico('medal3')][i] || i + 1}</div>
          <div class="av"><canvas class="px" data-portrait="${r.classId}"></canvas></div>
          <div class="o-body"><div class="o-name">${nameHtml(r.name, r.data)}</div><div class="o-sub">${CLASSES[r.classId].name}</div></div>
          <div class="score">${r.best} monstre${r.best > 1 ? 's' : ''}</div></div>`).join('')}
    </section>`;
}

/** Classement de la horde : le record de chaque joueur (monstres battus en un essai) */
function hordeBoard() {
  const row = (name, data, best, me = false) => { const h = data ? E.strongestHero(data) : null; return { name, data, best, classId: h ? h.classId : 'guerrier', me }; };
  const rows = [row(acc.pseudo, acc, E.hordeState(acc).best || 0, true)];
  if (NET.online) players.forEach(p => rows.push(row(p.pseudo, p.data, (p.data.horde && p.data.horde.best) || 0)));
  else opponents().forEach(o => rows.push({ name: o.name, data: null, classId: o.classId, best: Math.max(1, Math.round(o.level / 4)) }));
  return rows.sort((a, b) => b.best - a.best || (b.me ? 1 : 0) - (a.me ? 1 : 0));
}

function startHorde() {
  if (!E.useHordeRun(hero)) { toast(`Plus de charge pour ton ${CLASSES[hero.classId].name} : la prochaine revient dans ${fmt(E.hordeNextIn(hero))} (ou change de perso).`); return; }
  save();
  const me = mySnap();
  const seed = (Math.random() * 2 ** 31) | 0;
  const live = E.createHorde(me, seed);
  const h = hero;
  const head = (kills) => `La Horde <span style="color:var(--gold)">·</span> ${kills} monstre${kills > 1 ? 's' : ''} battu${kills > 1 ? 's' : ''} <span style="color:var(--gold)">·</span> +${E.hordeKeys(kills)} <canvas class="px ico" data-key></canvas>`;
  runBattle({
    me, foe: E.hordeMonster(seed, 0), live, theme: 'abyss', manual: true, victory: myVictory(), skip: true,
    title: head(0),
    onEvent: (e) => {
      if (e.type !== 'kill') return;
      const t = document.querySelector('.battle-vs');
      if (t) { t.innerHTML = head(e.kills); hydrate(t); }
    },
    finish: (result) => {
      const rw = E.hordeResult(acc, result.kills, h);
      save();
      return {
        rewards: rw,
        headline: `${result.kills} MONSTRE${result.kills > 1 ? 'S' : ''}`, headClass: result.kills ? 'win' : 'lose',
        rewardsHtml: `
          <div class="rw"><span class="pill gold"><canvas class="px" data-key></canvas>+${rw.keys} clef${rw.keys > 1 ? 's' : ''}</span>${xpPills(rw)}${rw.record ? '<span class="pill gold">Nouveau record</span>' : ''}</div>
          <p style="color:var(--muted);margin:0">${chargeText(E.hordeRunsLeft(h), E.hordeNextIn(h), 'pour ce perso')}</p>`,
      };
    },
  });
}

// ------------------------------ Tour infinie ------------------------------
function towerBoard() {
  const bestOf = (data) => data.heroes.reduce((b, h) => ((h.tower && h.tower.best) > b.floor ? { floor: h.tower.best, classId: h.classId } : b), { floor: 0, classId: data.heroes[0].classId });
  const meB = bestOf(acc);
  const rows = [{ name: acc.pseudo, data: acc, ...meB, me: true }];
  if (NET.online) players.forEach(p => rows.push({ name: p.pseudo, data: p.data, ...bestOf(p.data) }));
  else opponents().forEach(o => rows.push({ name: o.name, data: null, floor: Math.round(o.level * 0.75), classId: o.classId }));
  return rows.sort((a, b) => b.floor - a.floor || (b.me ? 1 : 0) - (a.me ? 1 : 0));
}

function viewTower() {
  const t = E.towerState(hero);
  const next = t.best + 1;
  const m = E.towerMonster(next);
  const prizeAt = Math.ceil(next / 10) * 10;   // prochain palier de clefs (tous les 10 étages)
  return modeHead({
    id: 'tower', c: '#a77bff', art: '<canvas class="px" data-emblem="tower"></canvas>',
    title: 'Tour infinie', sub: '',
    chips: [
      mchip('▲', 'Prochain étage', next, 'hot'),
      mchip(ico('trophy'), `Record ${CLASSES[hero.classId].name}`, t.best),
      mchip('<canvas class="px" data-key></canvas>', `Étage ${prizeAt}`, `+${E.towerKeys(prizeAt)} clefs`),
    ],
    info: `Chaque étage est plus dur que le précédent. Tentatives <b>illimitées</b> : si tu perds, tu restes bloqué à cet étage jusqu’à le gagner.<br><br>Tous les 10 étages : <b>${TOWER.keysEvery10} clefs</b> pour ton perso, et <b>${TOWER.keysFrom50} clefs</b> à partir de l’étage 50 (50, 60, 70…). Chaque perso a son propre record.<br><br><b>XP</b> : chaque étage réussi rapporte de l’XP (une défaite ne rapporte rien).`,
  }) + `
    <section class="card hx tw2" style="--hc:#a77bff">
      <div class="tw2-wrap">
        <div class="tw2-shaft">${towerFloors(next)}</div>
        <div class="tw2-foe">
          <img class="dg2-bg" src="art/decors/${m.theme || 'castle'}.svg" alt=""><i class="dg2-shade"></i>
          <span class="tw2-tag">Étage ${next}</span>
          <div class="tw2-art"><canvas class="px" data-monster="${m.dungeon.sprite}"></canvas></div>
          <b class="tw2-name">${m.snap.name}</b>
          <div class="tw2-meta"><span class="pill">Nv.${m.snap.level}</span>${powerCmp(m.snap)}</div>
        </div>
      </div>
      <div class="tw2-goal">
        <div class="tw2-goal-txt"><span>${prizeAt - next ? `Encore <b>${prizeAt - next + 1}</b> étages` : '<b>Cet étage</b>'}</span><span class="tw2-prize"><canvas class="px ico" data-key></canvas>+${E.towerKeys(prizeAt)} clefs à l’étage ${prizeAt}</span></div>
        <div class="tw2-bar"><i style="width:${Math.round(((next - 1) % 10) / 10 * 100)}%"></i></div>
      </div>
      <button class="btn danger block big-go" data-act="attackTower">${ico('swords')} Attaquer l’étage ${next}</button>
    </section>
    <section class="card hx" style="--hc:#a77bff">
      ${secHead(ico('trophy'), 'Classement', 'Le meilleur étage de chaque joueur')}
      ${towerBoard().map((r, i) => `
        <div class="opp rank ${r.me ? 'me' : ''}"><div class="pos">${[ico('medal1'), ico('medal2'), ico('medal3')][i] || i + 1}</div>
          <div class="av"><canvas class="px" data-portrait="${r.classId}"></canvas></div>
          <div class="o-body"><div class="o-name">${nameHtml(r.name, r.data)}</div><div class="o-sub">${CLASSES[r.classId].name}</div></div>
          <div class="score">Étage ${r.floor}</div></div>`).join('')}
    </section>`;
}

/** La tour vue de côté : les étages autour du prochain, les paliers de clefs (tous les 10) en or */
function towerFloors(next) {
  const rows = [];
  const goal = Math.ceil(next / 10) * 10;
  if (goal > next + 3) {   // le prochain palier de clefs, tout en haut, même s'il est loin
    rows.push(`<div class="tw2-fl gift far"><span>${goal}</span><em><canvas class="px ico" data-key></canvas>+${E.towerKeys(goal)}</em></div>`, '<div class="tw2-gap">⋮</div>');
  }
  for (let f = Math.min(next + 3, goal); f >= Math.max(1, next - 2); f--) {
    const k = E.towerKeys(f);
    rows.push(`<div class="tw2-fl ${f < next ? 'done' : f === next ? 'now' : ''} ${k ? 'gift' : ''}"><span>${f}</span>${k ? `<em><canvas class="px ico" data-key></canvas>+${k}</em>` : f < next ? ico('check') : f === next ? ico('swords') : ''}</div>`);
  }
  return `<i class="tw2-roof"></i>${rows.join('')}<i class="tw2-base"></i>`;
}

function attackTower() {
  const t = E.towerState(hero);
  const next = t.best + 1;
  const m = E.towerMonster(next);
  const me = mySnap();
  const h = hero;
  runBattle({
    me, foe: m.snap, seed: (Math.random() * 2 ** 31) | 0, theme: m.theme, manual: true, victory: myVictory(),
    title: `Tour · Étage ${next}`,
    finish: (result) => {
      const won = result.winner === 0;
      const rw = E.towerResult(acc, h, won, m.snap.level);
      E.missionEvent(acc, 'tower_try');
      if (won) E.missionEvent(acc, 'tower');
      save();
      return {
        rewards: rw,
        headline: won ? `ÉTAGE ${next} RÉUSSI !` : 'ÉCHEC…', headClass: won ? 'win' : 'lose',
        rewardsHtml: won
          ? `<div class="rw">${rw.keys ? `<span class="pill gold"><canvas class="px" data-key></canvas>+${rw.keys} clefs</span>` : ''}${xpPills(rw)}</div>`
          : '<p style="color:var(--muted);margin:0">Tu restes à cet étage : réessaie autant que tu veux !</p>',
        // victoire : l'étage suivant part tout seul, jusqu'à la défaite (« Arrêter » pour sortir)
        ...(won ? { next: () => attackTower(), nextLabel: `Étage ${next + 1} ›`, backLabel: 'Arrêter', auto: 3000 } : {}),
      };
    },
  });
}

// ------------------------------ Boutique ------------------------------
let shopKind = 'skin';
const SHOP_TABS = [['skin', 'Skins'], ['title', 'Titres'], ['color', 'Pseudo'], ['auction', 'Enchères']];

function viewShop() {
  const owned = new Set(acc.cosmetics.owned);
  const daily = E.dailyShop(acc);
  const left = daily.filter(d => !d.bought).length;
  let list = COSMETICS.filter(c => c.kind === shopKind && (!c.unique || owned.has(c.id)));   // titre unique : seulement s'il l'a
  if (shopKind === 'skin') {
    list = [...list.filter(c => c.cls === hero.classId), ...COSMETICS.filter(c => c.kind === 'dye' && owned.has(c.id))];
    list.filter(c => c.art).forEach(c => prepareSkin(hero.classId, c.id));
  }
  list.sort((a, b) => !!b.unique - !!a.unique || (a.kind === 'dye') - (b.kind === 'dye') || a.price - b.price);
  const isOn = (c) => (c.kind === 'dye' || c.kind === 'skin' ? hero.dye === c.id : acc.cosmetics[c.kind] === c.id);
  const preview = (c) => {
    if (c.kind === 'title') return `<span class="ptitle big">« ${esc(c.name)} »</span>`;
    if (c.kind === 'color') { const fx = NAME_FX.includes(c.color); return `<span class="pname big ${fx ? c.color : ''}" ${fx ? '' : `style="color:${c.color}"`}>${esc(acc.pseudo)}</span>`; }
    if (c.kind === 'dye' || c.kind === 'skin') return `<canvas class="px" data-hero="${hero.classId}" data-dye="${c.id}"></canvas>`;
    return `<div class="dots">${c.colors.map(col => `<i style="background:${col}"></i>`).join('')}</div>`;
  };
  return modeHead({
    id: 'shop', c: '#ffd45a', art: '<canvas class="px" data-emblem="shop"></canvas>',
    title: 'Boutique', sub: '',
    chips: [
      mchip('<canvas class="px" data-clat></canvas>', 'Ton Flouze', fmtNum(acc.clat), 'hot'),
      mchip('<canvas class="px" data-key></canvas>', `Clefs ${CLASSES[hero.classId].name}`, hero.keys),
      mchip(ico('bag'), 'Objets du marchand', `${left} / ${SHOP_DAILY.count}`),
    ],
    info: `<b>Clef</b> : ouvre 1 coffre de ton perso actif. <b>Marchand</b> : 3 objets au hasard, du Commun à l’Épique (${SHOP_DAILY.prices.join(' / ')} Flouze selon la rareté), un seul exemplaire de chaque, renouvelés toutes les ${SHOP_DAILY.everyH} h. <b>Enchères</b> : 1 objet en vente à la fois pendant 24 h ; il part au plus offrant. Ton offre est bloquée, et rendue si quelqu’un met plus. <b>Apparences</b> : pour frimer, aucun effet sur la force. Les skins vont à ton perso actif (change-le en haut de l’onglet Combats).`,
  }) + `
    <section class="card hx merchant" style="--hc:#ffd45a">
      ${secHead(ico('star'), 'Le marchand', `Nouveaux objets dans <span data-timer="shop">${fmt(E.msToNextShop())}</span>`)}
      <div class="key-deal">
        <span class="kd-art"><canvas class="px" data-key></canvas></span>
        <div class="o-body"><b>Clef</b><small>Ouvre 1 coffre de ton ${CLASSES[hero.classId].name} · tu en as ${hero.keys}</small></div>
        <button class="foe-btn fight gold" data-act="buyKey" ${acc.clat < KEY_PRICE ? 'disabled' : ''}><i><canvas class="px ico" data-clat></canvas></i>${KEY_PRICE}</button>
      </div>
      <div class="daily">
        ${daily.map(d => `
          <div class="dl ${d.bought ? 'sold' : ''}">
            <div class="it r${d.rarity} dl-ico" style="--rc:${RARITIES[d.rarity].color}"><canvas class="px" data-icon="${d.itemId}"></canvas></div>
            <b>${esc(ITEMS[d.itemId].name)}</b><small>${SLOTS[ITEMS[d.itemId].slot].name} · <span style="color:${RARITIES[d.rarity].color}">${RARITIES[d.rarity].name}</span></small>
            <small class="dl-st">${statChips(d.itemId, d.rarity, 2)}</small>
            ${d.bought ? '<span class="dl-sold">Acheté</span>'
              : `<button class="btn small green" data-act="buyDaily" data-i="${d.i}" ${acc.clat < d.price ? 'disabled' : ''}>${d.price}<canvas class="px" data-clat></canvas></button>`}
          </div>`).join('')}
      </div>
    </section>
    <section class="card hx" style="--hc:#b05cff">
      ${shopKind === 'auction' ? secHead(ico('star'), 'Enchères', '1 objet en vente à la fois · 24 h · au plus offrant')
        : secHead(ico('magic'), 'Apparences', shopKind === 'skin' ? `Skins de ton ${CLASSES[hero.classId].name}` : 'Pour frimer : aucun effet sur la force')}
      <div class="seg seg4">${SHOP_TABS.map(([k, n]) => `<button class="${shopKind === k ? 'on' : ''}" data-act="shopKind" data-k="${k}">${n}</button>`).join('')}</div>
      ${shopKind === 'auction' ? viewAuction() : `<div class="shop ${shopKind === 'skin' ? 'skins' : ''}">
        ${list.map(c => `
          <div class="shop-item ${isOn(c) ? 'on' : ''} ${owned.has(c.id) ? 'owned' : ''} ${c.unique ? 'unique' : ''}">
            <div class="sh-prev">${preview(c)}</div>
            <div class="sh-name">${esc(c.name)}${c.kind === 'dye' ? '<small>ancienne teinture</small>' : ''}</div>
            ${owned.has(c.id)
              ? (c.unique && isOn(c) ? '<span class="dl-sold">Porté</span>' : `<button class="btn small ${isOn(c) ? '' : 'primary'}" data-act="equipCos" data-id="${c.id}">${isOn(c) ? 'Retirer' : 'Porter'}</button>`)
              : `<button class="btn small green" data-act="buyCos" data-id="${c.id}" ${acc.clat < c.price ? 'disabled' : ''}>${c.price}<canvas class="px" data-clat></canvas></button>`}
          </div>`).join('')}
      </div>`}
    </section>`;
}

// ------------------------------ Enchères ------------------------------
// Chaque joueur met 1 objet en vente à la fois, pendant 24 h ; il part au plus offrant.
// Le Flouze misé est retiré tout de suite et rendu si quelqu'un met plus ; le jeu de chaque joueur règle ce qui lui revient.
let auc = { auctions: [], bids: [], at: 0, loading: false };

/** Recharge les ventes et règle ce qui revient au joueur (Flouze, objets) */
async function loadAuc(quiet = false) {
  if (auc.loading) return;
  auc.loading = true;
  try {
    const d = await AUC.load();
    auc = { ...d, at: Date.now(), loading: false };
    const out = E.aucSettle(acc, AUC.myId(), d.auctions, d.bids);
    if (out.length) { save(); aucNews(out); }
  } catch (e) {
    auc.loading = false;
    if (!quiet) toast(e.message);
  }
}
function aucNews(out) {
  const nm = (a) => `${ITEMS[a.item_id].name} (${RARITIES[a.rarity].name})`;
  for (const o of out) {
    if (o.type === 'sold') toast(`Vendu ! ${nm(o.a)} part chez ${o.top.pseudo} pour ${fmtNum(o.top.amount)} Flouze.`);
    if (o.type === 'unsold') toast(`Personne n’a enchéri sur ${nm(o.a)} : il revient dans ton sac.`);
    if (o.type === 'won') toast(`Enchère gagnée ! ${nm(o.a)} est dans le sac de ton ${CLASSES[E.activeHero(acc).classId].name}.`);
  }
  const back = out.filter(o => o.type === 'back');
  if (back.length) toast(`On a mis plus que toi : ${fmtNum(back.reduce((n, o) => n + o.b.amount, 0))} Flouze te sont rendus.`);
  if (out.some(o => o.type !== 'back')) SFX.loot(3);
}

const aucItemHead = (itemId, rarity) => `
  <div class="pick-row auc-head" style="--rc:${RARITIES[rarity].color}">
    <span class="it r${rarity} pick-ic" style="--rc:${RARITIES[rarity].color}"><canvas class="px" data-icon="${itemId}"></canvas></span>
    <span class="pick-txt"><b>${esc(ITEMS[itemId].name)}</b><small style="color:${RARITIES[rarity].color}">${RARITIES[rarity].name} · ${SLOTS[ITEMS[itemId].slot].name}</small><small class="pick-st">${statChips(itemId, rarity)}</small></span>
  </div>`;

function aucCard(a, me, now) {
  const it = ITEMS[a.item_id], R = RARITIES[a.rarity];
  const top = E.aucTop(auc.bids, a.id), end = E.aucEnd(a);
  const mine = a.seller_id === me, lead = !!top && top.user_id === me;
  const price = top
    ? `<b>${fmtNum(top.amount)}<canvas class="px ico" data-clat></canvas></b><small>${lead ? 'ton offre' : esc(top.pseudo)}</small>`
    : `<b>${fmtNum(a.min_price)}<canvas class="px ico" data-clat></canvas></b><small>prix de départ</small>`;
  return `
    <div class="auc ${mine ? 'mine' : ''} ${lead ? 'lead' : ''}" style="--rc:${R.color}">
      <div class="it r${a.rarity} auc-ico" style="--rc:${R.color}"><canvas class="px" data-icon="${a.item_id}"></canvas></div>
      <div class="auc-body">
        <b>${esc(it.name)}</b>
        <small><span style="color:${R.color}">${R.name}</span>${mine ? '' : ` · ${esc(a.pseudo)}`}</small>
        <small class="dl-st">${statChips(a.item_id, a.rarity, 2)}</small>
        <span class="auc-time">${ico('clock')} <span data-countdown="${end}">${fmt(Math.max(0, end - now))}</span></span>
      </div>
      <div class="auc-side">
        <div class="auc-price">${price}</div>
        ${mine ? '' : lead ? '<span class="auc-lead">Tu mènes</span>' : `<button class="btn small green" data-act="aucBid" data-id="${a.id}">Enchérir</button>`}
      </div>
    </div>`;
}

function viewAuction() {
  // on recharge les ventes en arrivant, puis toutes les 30 s (et à la fin d'une vente, voir la minuterie)
  if (!auc.loading && Date.now() - auc.at > 30000) setTimeout(() => loadAuc(true).then(() => { if (tab === 'shop' && shopKind === 'auction' && !modalRoot.innerHTML) softRender(); }), 0);
  const me = AUC.myId(), now = Date.now();
  const ok = auc.auctions.filter(a => ITEMS[a.item_id]);
  const live = ok.filter(a => now < E.aucEnd(a));
  const mine = live.find(a => a.seller_id === me);
  const others = live.filter(a => a.seller_id !== me).sort((a, b) => E.aucEnd(a) - E.aucEnd(b));
  const ended = ok.filter(a => now >= E.aucEnd(a)).slice(0, 6);
  return `
    <div class="sub">TA VENTE</div>
    ${mine ? aucCard(mine, me, now) : `<button class="btn primary block auc-sell" data-act="aucSell">${ico('bag')} Mettre un objet en vente</button>`}
    <div class="sub">EN VENTE${others.length ? ` · ${others.length}` : ''}</div>
    ${others.length ? `<div class="auc-list">${others.map(a => aucCard(a, me, now)).join('')}</div>`
      : `<p class="hint">${auc.at ? 'Aucun objet en vente pour le moment.' : 'Chargement…'}</p>`}
    ${ended.length ? `<div class="sub">TERMINÉES</div>
      <div class="auc-done">${ended.map(a => {
        const top = E.aucTop(auc.bids, a.id);
        return `<div><span style="color:${RARITIES[a.rarity].color}">${esc(ITEMS[a.item_id].name)}</span><small>${a.seller_id === me ? 'toi' : esc(a.pseudo)}</small>
          <b>${top ? `${fmtNum(top.amount)} → ${top.user_id === me ? 'toi' : esc(top.pseudo)}` : 'pas vendu'}</b></div>`;
      }).join('')}</div>` : ''}`;
}

// ------------------------------ En direct ------------------------------
function onLive(kind, row) {
  if (kind === 'challenge' && isPvp(row)) { onPvpLive(row); return; }
  if (kind === 'fight') {
    journal.unshift(row);
    journalUnseen++;
    setBadge('social', journalUnseen + chatUnread);
    const won = row.winner === 0;
    SFX.message();
    if (row.kind === 'throne') {
      toast(`${row.attacker_name} t’a défié pour le trône : ${won ? 'il prend ta place !' : 'tu gardes ta place !'}`);
      loadThrone().then(() => { if (tab === 'throne' && !document.querySelector('.battle')) softRender(); });
    } else toast(`${row.attacker_name} t’a attaqué (${KIND_NAME[row.kind] || ''}) : ${won ? 'il a gagné' : 'tu as gagné'} !`);
    if (tab === 'journal') { markJournalSeen(); softRender(); }
  } else if (kind === 'challenge') {
    if (row.to_id === NET.myId() && row.status === 'pending') { SFX.message(); toast(`${row.from_name} te défie en duel !`); }
    refreshBets().then(() => { if (tab === 'bets' || tab === 'combat' || tab === 'hub_pvp') softRender(); });
  } else if (kind === 'wager') {
    if (tab === 'bets') refreshBets().then(softRender);
  } else if (kind === 'raid') {
    if (tab === 'raid') loadRaid().then(softRender);
  }
}

async function initLive() {
  if (!NET.online) return;
  await Promise.all([loadJournal(), refreshBets(), loadAuc(true)]);
  try { await NET.subscribeLive(onLive); } catch (e) { /* le direct est optionnel */ }
}

/** Bonus d'XP de rattrapage selon le retard sur le perso le plus haut du jeu (tous les persos de tous les joueurs, les miens compris) */
function updateXpBonus() {
  const top = Math.max(...[acc, ...players.map(p => p.data)].flatMap(a => (a && a.heroes || []).map(h => h.level)));
  const catchup = NET.online ? E.catchupBonus(hero.level, top) : 1;
  E.setXpBonus(catchup, E.altXpBonus(acc, hero));   // persos secondaires : ×2 en plus, jusqu'au niveau du perso le plus haut du compte
}

const VIEWS = { story: viewStory, hub_pvp: () => viewHub('hub_pvp'), hub_coop: () => viewHub('hub_coop'), hub_pvm: () => viewHub('hub_pvm'), throne: viewThrone, hero: viewHero, chests: viewChests, bag: viewBag, fights: viewFights, dungeons: viewDungeons, ranking: viewRanking, war: viewWar, chat: viewChat,
  combat: viewCombat, social: viewSocial, shop: viewShop, tower: viewTower, raid: viewRaid, horde: viewHorde, pvp: viewPvp, bets: viewBets, champ: viewChamp, journal: viewJournal, players: viewPlayers };

// ------------------------------ Modales & toasts ------------------------------
function openModal(html, { center = false } = {}) {
  if (spellDemoStop) { spellDemoStop(); spellDemoStop = null; }
  modalRoot.innerHTML = `<div class="modal-bg ${center ? 'mid' : ''}" data-act="bgClose"><div class="modal ${center ? 'center' : ''}">${html}</div></div>`;
  hydrate(modalRoot);
}
let renderOnClose = false;   // une page à redessiner dès que la fenêtre se ferme (après « Tout fusionner »)
function closeModal() {
  if (spellDemoStop) { spellDemoStop(); spellDemoStop = null; }
  modalRoot.innerHTML = '';
  if (renderOnClose) setTimeout(() => { if (renderOnClose) { renderOnClose = false; softRender(); } }, 0);   // sauf si la page vient d'être redessinée
}

function toast(text) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}
function announce(lv) {
  if (!lv) return;
  if (lv.levels > 0) { SFX.level(); E.missionEvent(acc, 'level', lv.levels); save(); toast(`Niveau ${hero.level} ! +${lv.levels * 3} points de caractéristiques`); }
  for (const s of lv.newSpells || []) toast(`Nouveau sort : ${s.name}`);
  if (lv.lvlKeys > 0) toast(`+${lv.lvlKeys} clef${lv.lvlKeys > 1 ? 's' : ''} de montée de niveau !`);
}

// ------------------------------ Ouverture de coffre ------------------------------
/** Couleur de la lumière du coffre selon la rareté (Légendaire en jaune) */
const CHEST_RAY = { 4: '#ffd23a' };
function openChestFlow(kind, all = false) {
  const res = all ? E.openAllChests(acc, hero) : E.openChest(acc, hero, kind);
  if (!res) return;
  E.missionEvent(acc, 'chest', all ? res.count : 1);
  E.missionEvent(acc, 'key_use', all ? res.keys : res.key ? 1 : 0);
  save();
  SFX.chest();
  openModal(`
    <div class="open-stage ${res.items.length > 4 ? 'many' : ''}">
      <h3>${all ? `${res.count} coffres${res.keys ? ` (dont ${res.keys} avec une clef)` : ''}` : ({ combat: 'Coffre de combat', war: 'Coffre de guerre', epic: 'Coffre Épique', legendary: 'Coffre Légendaire' }[kind] || (res.key ? 'Coffre (clef)' : 'Coffre'))}</h3>
      <div class="rays" id="chest-wrap"><canvas class="px chest-big shake" id="chest-cv" data-chest="${kind}"></canvas></div>
      <div id="loot"></div>
    </div>`, { center: true });
  const cv = document.getElementById('chest-cv');
  // la lumière derrière le coffre prend la couleur du meilleur objet (rien de spécial pour du Commun) :
  // une impulsion pendant que le coffre tremble, puis elle reste allumée à l'ouverture
  const best = Math.max(...res.items.map(it => it.rarity));
  const wrap = document.getElementById('chest-wrap');
  if (best > 0) {
    wrap.style.setProperty('--ray', CHEST_RAY[best] || RARITIES[best].color);
    setTimeout(() => wrap.classList.add('tease'), 380);
  }
  setTimeout(() => {
    paint(cv, chestCanvas(kind, true), { scale: 6 });
    cv.classList.remove('shake');
    cv.classList.add('burst');
    if (best > 0) { wrap.classList.remove('tease'); wrap.classList.add('lit'); }
    SFX.loot(best);
    document.getElementById('loot').innerHTML = `
      <div class="loot ${res.items.length > 4 ? 'many' : ''}">
        ${res.items.map((it, i) => `
          <div class="loot-card" style="--rc:${RARITIES[it.rarity].color};animation-delay:${Math.min(i * 0.18, 2)}s">
            <canvas class="px" data-icon="${it.itemId}"></canvas>
            <div class="ln">${esc(ITEMS[it.itemId].name)}</div>
            ${ITEMS[it.itemId].set ? `<div class="ls">${SETS[ITEMS[it.itemId].set].name}</div>` : ''}
            <div class="rar" style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name}</div>
          </div>`).join('')}
      </div>
      <p class="loot-xp">+${res.xp} XP${all && E.openableChests(hero) > 0 ? ` · encore ${E.openableChests(hero)} coffre${E.openableChests(hero) > 1 ? 's' : ''} à ouvrir` : ''}</p>
      ${res.items.some(it => E.stackOf(hero, it.itemId, it.rarity).length >= E.fuseNeed(it.rarity) && it.rarity < RARITIES.length - 1) ? '<p style="color:#c58bff;font-weight:800;margin:6px 0 0">✦ Une fusion est possible !</p>' : ''}
      <div class="close-row"><button class="btn primary" data-act="closeAndRender">Super !</button></div>`;
    hydrate(document.getElementById('loot'));
    announce(res);
  }, 900);
}

// ------------------------------ Combat ------------------------------
let battleCtl = null;
let battleFight = null;      // combat en direct (le mode manuel est possible)
const MANUAL_PREF = 'fuzev2-manual';
const manualPref = () => { try { return localStorage.getItem(MANUAL_PREF) === '1'; } catch (e) { return false; } };
const setManualPref = (v) => { try { localStorage.setItem(MANUAL_PREF, v ? '1' : '0'); } catch (e) { /* stockage indisponible */ } };

/** Compte ce qui s'est passé dans un combat, pour les missions */
function trackBattle(result) {
  let spells = 0, crits = 0, dodges = 0, pet = 0;
  for (const e of result.log) {
    if (e.type !== 'action') continue;
    if (e.actor === 0) {
      if (e.pet) pet++; else if (e.id) spells++;
      crits += e.results.filter(r => r.type === 'hit' && r.crit && r.target === 1).length;
    } else dodges += e.results.filter(r => r.type === 'dodge' && r.target === 0).length;
  }
  E.missionEvent(acc, 'fight');
  if (result.winner === 0) E.missionEvent(acc, 'win');
  if (result.winner === 0 && result.usedManual) E.missionEvent(acc, 'manual_win');
  E.missionEvent(acc, 'spell', spells);
  E.missionEvent(acc, 'crit', crits);
  E.missionEvent(acc, 'dodge', dodges);
  E.missionEvent(acc, 'pet', pet);
}

/** Barre des 4 sorts sous le héros : recharge, sort lancé, sort demandé (manuel) */
function updateSpellBar(e) {
  const bar = document.getElementById('spellbar');
  if (!bar || !e.s) return;
  const cds = e.s[0].cd || [];
  bar.querySelectorAll('.sb').forEach(b => {
    const left = Math.max(0, (cds[+b.dataset.i] || 0) - 1);
    b.classList.toggle('ready', left === 0);
    b.querySelector('.cd').textContent = left ? left : '';
    if (e.type === 'action' && e.actor === 0 && e.id === b.dataset.id) {
      b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire');
    }
    // sort demandé (manuel) : reste en surbrillance tant que le héros ne l'a pas lancé
    b.classList.toggle('queued', !!battleFight && battleFight.queued === b.dataset.id);
  });
}

/**
 * Combat en plein écran puis panneau de résultat.
 * - Contre un vrai joueur (manual = false) : combat calculé d'avance, mode auto obligatoire,
 *   et finish(result) est appelé tout de suite (impossible de « rejouer » en quittant).
 * - En donjon, à la tour et au raid (manual = true) : combat en direct, on peut passer en manuel ;
 *   finish(result) est appelé à la fin. finish renvoie { rewardsHtml, rewards, headline, headClass }.
 */
// La police pixel dessine les majuscules accentuées (É, À…) plus petites : on enlève l'accent des majuscules dans les gros titres
const PX_CAPS = { À: 'A', Â: 'A', Ä: 'A', É: 'E', È: 'E', Ê: 'E', Ë: 'E', Î: 'I', Ï: 'I', Ô: 'O', Ö: 'O', Ù: 'U', Û: 'U', Ü: 'U', Ç: 'C' };
const pxCaps = (t) => String(t);   // Lilita One affiche bien les capitales accentuées
/** Pastilles de récompense : XP gagnée et clefs de montée de niveau */
const xpPills = (rw) => `${rw && rw.xp ? `<span class="pill gold">+${fmtNum(rw.xp)} XP</span>` : ''}${rw && rw.lvlKeys ? `<span class="pill gold"><canvas class="px" data-key></canvas>+${rw.lvlKeys} clef${rw.lvlKeys > 1 ? 's' : ''} (niveau)</span>` : ''}`;
let waveNext = null;   // combat suivant d'une vague de donjon
function runBattle({ me, foe, theme, title, result = null, seed = 0, sim = {}, manual = false, victory = null, finish, track = true, live = null, onEvent = null, noBar = false, skip = false }) {
  stopPreviews.forEach(f => f());
  stopPreviews = [];
  let out = null;
  battleFight = null;
  if (live) { battleFight = live; live.setManual(manualPref()); }   // combat déjà préparé (la Horde)
  else if (manual) battleFight = E.createFight(me, foe, seed, { ...sim, manual: manualPref() });
  else {
    if (!result) result = E.simulate(me, foe, seed, sim);
    out = finish(result) || {};
    if (track) trackBattle(result);
  }
  const fight = battleFight;
  const spells = noBar ? [] : (me.spells || []).filter(id => SPELLS[id]);
  const ov = document.createElement('div');
  ov.className = 'battle';
  ov.innerHTML = `
    <div class="battle-vs">${title}</div>
    <div class="battle-wrap"><canvas id="arena"></canvas></div>
    <div class="battle-ctrl ${spells.length ? '' : 'nobar'}">
      ${skip ? `<button class="dock-skip" data-act="skip">Passer ${ico('skip')}</button>` : ''}
      <div class="dock">
        ${spells.length ? (fight ? `<button class="dock-mode ${fight.manual ? 'man' : ''}" data-act="toggleManual" id="mode-btn"><small>Sorts</small><b>${fight.manual ? 'MANUEL' : 'AUTO'}</b></button>`
          : `<span class="dock-mode lock"><small>Sorts</small><b>AUTO</b>${ico('lock')}</span>`) : ''}
        ${spells.length ? `<div class="spellbar" id="spellbar">
          ${spells.map((id, i) => `<button class="sb ready" data-act="cast" data-id="${id}" data-i="${i}" aria-label="${esc(SPELLS[id].name)}"><canvas class="px" data-spell="${id}"></canvas><span class="cd"></span></button>`).join('')}
        </div>` : ''}
        <div class="dock-side">
          <button class="dock-btn on" data-act="speed" id="speed-btn">x3</button>
          <button class="dock-btn" data-act="toggleSound" id="snd-btn" aria-label="Son">${ico(getPref('sfx') || getPref('music') ? 'speaker' : 'mute')}</button>
        </div>
      </div>
    </div>
    <div class="battle-after" id="result-slot"></div>`;
  document.body.appendChild(ov);
  hydrate(ov);
  battleCtl = playBattle(ov.querySelector('#arena'), me, foe, fight || result, { theme, victory, spellBar: spells.length > 0, onBegin: (e) => { updateSpellBar(e); if (onEvent) onEvent(e); } });
  battleCtl.speedIdx = 2; battleCtl.setSpeed(3);   // les combats partent en x3 (le bouton repasse en x1, x2…)
  battleCtl.promise.then(() => {
    if (fight) {
      result = fight.result();
      out = finish(result) || {};
      if (track) trackBattle(result);
      save();
    }
    battleFight = null;
    const won = out.won ?? result.winner === 0;
    ov.querySelector('.battle-ctrl')?.remove();
    const slot = ov.querySelector('#result-slot');
    slot.innerHTML = `
      <div class="result">
        <h2 class="${out.headClass || (won ? 'win' : 'lose')}">${pxCaps(out.headline || (won ? 'VICTOIRE' : 'DÉFAITE…')).replace(/\s*!+\s*$/, '')}</h2>
        ${out.rewardsHtml || ''}
        ${out.next ? `${out.backLabel ? `<div class="row" style="gap:8px;justify-content:center"><button class="btn" data-act="endFight">${out.backLabel}</button>` : ''}<button class="btn primary" data-act="waveNext">${out.nextLabel}</button>${out.backLabel ? '</div>' : ''}` : '<button class="btn primary" data-act="endFight">Continuer</button>'}
      </div>`;
    waveNext = out.next || null;
    hydrate(slot);
    announce(out.rewards);
    if (out.next && out.auto) {   // enchaînement automatique (Tour infinie) : le combat suivant part tout seul après un petit compte à rebours
      const go = out.next, b = slot.querySelector('[data-act="waveNext"]');
      let left = Math.ceil(out.auto / 1000);
      const tick = () => {
        if (waveNext !== go || !document.body.contains(slot)) return;   // il a touché « Arrêter » ou « Étage suivant » lui-même
        if (left <= 0) { ACTIONS.waveNext(); return; }
        if (b) b.textContent = `${out.nextLabel} (${left})`;
        left--;
        setTimeout(tick, 1000);
      };
      tick();
    }
  });
}

function startFight(foeId) {
  ensureDay();
  if (acc.fights.done[foeId]) return;
  const opp = opponents().find(o => o.id === foeId);
  if (!opp) return;
  const me = mySnap();
  acc.fights.tries ||= {};
  const tries = acc.fights.tries[foeId] = (acc.fights.tries[foeId] || 0) + 1;   // chaque essai est un combat différent
  const seed = hashStr(acc.fights.day + foeId + acc.pseudo + ':' + tries);
  save();
  runBattle({
    me, foe: opp.snap, seed, theme: 'arena', victory: myVictory(),
    title: `${esc(me.name)} <span style="color:var(--gold)">VS</span> ${esc(opp.snap.name)}`,
    finish: (result) => {
      const won = result.winner === 0;
      // gagné : le point de combat est acquis pour la journée ; perdu : rien, on peut retenter
      if (won) acc.fights.done[foeId] = 'win';
      const rw = won ? E.fightRewards(acc, hero, opp.level, true) : { chest: false };
      E.missionEvent(acc, 'arena_fight');
      if (won) E.missionEvent(acc, 'arena_win');
      logFight('arena', foeId, opp.name, me, opp.snap, seed, won);
      save();
      return {
        rewards: rw,
        rewardsHtml: `
          <div class="rw">
            ${won ? `<span class="pill green">Coffre de combat ${acc.winProgress}/${WINS_PER_COMBAT_CHEST}</span>` : '<span class="pill">Rien de perdu : retente-le quand tu veux !</span>'}
            ${rw.chest ? '<span class="pill red">Coffre de combat gagné !</span>' : ''}
          </div>`,
      };
    },
  });
}

/** Revanche ou vengeance : autant qu'on veut, pour le fun (5 Flouze par adversaire et par jour) */
function startFriendly(foeId, revenge = false) {
  ensureDay();
  if (!revenge && !acc.fights.done[foeId]) return;
  const opp = opponents().find(o => o.id === foeId);
  if (!opp) return;
  const me = mySnap();
  const seed = (Math.random() * 2 ** 31) | 0;
  runBattle({
    me, foe: opp.snap, seed, theme: 'arena', victory: myVictory(),
    title: `${revenge ? 'Vengeance' : 'Revanche'} · ${esc(me.name)} <span style="color:var(--gold)">VS</span> ${esc(opp.snap.name)}`,
    finish: (result) => {
      const won = result.winner === 0;
      const rw = E.friendlyRewards(acc, won, foeId);
      E.missionEvent(acc, revenge ? 'revenge' : 'rematch');
      if (won && !revenge) E.missionEvent(acc, 'rematch_win');
      logFight(revenge ? 'revenge' : 'rematch', foeId, opp.name, me, opp.snap, seed, won);
      save();
      return {
        rewardsHtml: rw.clat
          ? `<div class="rw"><span class="pill clat"><canvas class="px" data-clat></canvas>+${rw.clat} Flouze (${acc.clat})</span></div>`
          : `<p style="color:var(--muted);margin:0">${won ? 'Flouze déjà gagné contre lui aujourd’hui.' : 'C’était pour le fun : rien de perdu !'}</p>`,
      };
    },
  });
}

function startDungeon(id) {
  const d = DUNGEONS.find(x => x.id === id);
  if (!d || hero.level < d.lvl) return;
  if (!E.useDungeonRun(hero, d)) { toast(`Plus de charge dans ce donjon : la prochaine revient dans ${fmt(E.dungeonNextIn(hero, d))}.`); return; }
  E.missionEvent(acc, 'dungeon');
  save();
  const h = hero;
  const me = mySnap();
  const wave = E.dungeonWave(d);           // 2 monstres différents, puis l'un des 2 boss du donjon
  const last = wave.length - 1;
  // petite frise de la vague : monstres battus, monstre en cours, boss
  const waveBar = (i, won) => `<div class="wave-bar">${wave.map((f, j) => `<span class="${j < i || (j === i && won) ? 'ok' : j === i ? 'ko' : ''} ${j === last ? 'boss' : ''}">${j === last ? ico('crown') : j + 1}</span>`).join('<i></i>')}</div>`;
  const title = (i) => `${esc(d.name)} <span style="color:var(--gold)">·</span> ${i === last ? `BOSS : ${esc(wave[i].name)}` : `Monstre ${i + 1}/${last} : ${esc(wave[i].name)}`}`;
  // la vague se joue d'une traite, comme la Horde : le monstre tombe et le suivant arrive aussitôt
  const live = E.createWave(me, wave, (Math.random() * 2 ** 31) | 0);
  let cur = 0;
  runBattle({
    me, foe: wave[0], live, theme: d.theme, manual: true, victory: myVictory(),
    title: title(0),
    onEvent: (e) => {
      if (e.type !== 'nextFoe') return;
      cur++;
      const t = document.querySelector('.battle-vs');
      if (t) t.innerHTML = title(cur);
    },
    finish: (result) => {
      const won = result.winner === 0;
      const i = won ? last : result.kills;   // monstre sur lequel la vague s'est arrêtée
      const rw = E.dungeonRewards(h, d, won, won ? last : i);
      if (won) { E.missionEvent(acc, 'dungeon_win'); E.missionEvent(acc, 'dungeon_kinds', 1, d.id); }
      save();
      const left = E.runsLeft(h, d);
      return {
        rewards: rw,
        headline: won ? 'DONJON TERMINÉ !' : 'DÉFAITE…',
        // victoire et encore des charges : la vague suivante part toute seule (« Arrêter » pour garder ses charges)
        ...(won && left > 0 && hero === h ? { next: () => startDungeon(d.id), nextLabel: 'Vague suivante ›', backLabel: 'Arrêter', auto: 3000 } : {}),
        rewardsHtml: `${waveBar(i, won)}
          <div class="rw">${xpPills(rw)}</div>
          ${rw.key ? `
            <div class="loot-card" style="--rc:#ffd45a">
              <canvas class="px" data-key></canvas>
              <div class="ln">+1 clef</div>
              <div class="ls">Tu en as ${h.keys} : 1 clef = 1 coffre</div>
            </div>` : rw.keyCapped ? `<p style="color:var(--muted);margin:0">Tu as déjà gagné tes ${DUNGEON_KEYS_MAX} clefs du jour : nouvelles clefs à minuit.</p>`
            : `<p style="color:var(--muted);margin:0">${i === last ? 'Le boss était trop fort…' : `${esc(wave[i].name)} t’a arrêté avant le boss…`} Améliore ton héros et reviens !</p>`}
          <p style="color:var(--muted);margin:0">${chargeText(E.runsLeft(h, d), E.dungeonNextIn(h, d), 'dans ce donjon')}</p>`,
      };
    },
  });
}

/** Passe d'un coup les combats restants d'un donjon facile (la moitié de l'XP) */
function skipDungeonFlow(id, sure = false) {
  const d = DUNGEONS.find(x => x.id === id);
  if (!d || !E.canSkipDungeon(hero, d)) return;
  const n = E.runsLeft(hero, d);
  if (!n) return;
  if (!sure) {
    const keys = Math.min(n, E.keysLeftToEarn(hero));
    openModal(`
      <h3>${ico('skip')} Passer « ${esc(d.name)} » ?</h3>
      <p class="hint" style="margin-top:8px">Tes <b>${n} vague${n > 1 ? 's' : ''}</b> restante${n > 1 ? 's' : ''} compte${n > 1 ? 'nt' : ''} comme gagnée${n > 1 ? 's' : ''}, mais avec <b>la moitié de l’XP</b>.</p>
      <div class="rw" style="justify-content:center;margin:12px 0">
        <span class="pill gold">+${n * Math.round(E.waveXp(d) / 2)} XP</span>
        <span class="pill gold"><canvas class="px" data-key></canvas>+${keys} clef${keys > 1 ? 's' : ''}</span>
      </div>
      <div class="row" style="gap:8px"><button class="btn block" data-act="closeModal">Annuler</button><button class="btn primary block" data-act="skipDungeonGo" data-id="${d.id}">${ico('skip')} Passer</button></div>`, { center: true });
    return;
  }
  closeModal();
  const rw = E.skipDungeon(hero, d);
  if (!rw) return;
  E.missionEvent(acc, 'dungeon', rw.runs);
  E.missionEvent(acc, 'dungeon_win', rw.runs);
  E.missionEvent(acc, 'dungeon_kinds', 1, d.id);
  save(); render();
  SFX.loot(1);
  toast(`${d.name} passé : +${rw.xp} XP${rw.keys ? ` · +${rw.keys} clef${rw.keys > 1 ? 's' : ''}` : ''}`);
  announce(rw);
}

// ------------------------------ Réglages ------------------------------
function openSettings() {
  openModal(`
    <h3>Réglages</h3>
    ${NET.online ? `<p class="hint" style="margin-top:8px">Connecté en tant que <b>${esc(acc.pseudo)}</b>. Ta progression est sauvegardée en ligne.</p>` : `
      <label class="field" style="margin-top:12px">Pseudo
        <input id="rename" maxlength="14" value="${esc(acc.pseudo)}">
      </label>
      <button class="btn block" style="margin-top:10px" data-act="rename">Renommer</button>`}
    ${NET.online ? '' : `
    <div class="sub">OUTILS DE TEST (hors ligne uniquement)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn small" data-act="cheat" data-c="chests">+5 coffres</button>
      <button class="btn small" data-act="cheat" data-c="combat">+2 coffres combat</button>
      <button class="btn small" data-act="cheat" data-c="fights">Recharger combats + donjons</button>
      <button class="btn small" data-act="cheat" data-c="lvl">+5 niveaux</button>
      <button class="btn small" data-act="cheat" data-c="weekEnd">Finir la guerre</button>
      <button class="btn small" data-act="cheat" data-c="clat">+100 Flouze</button>
      <button class="btn small" data-act="cheat" data-c="auc">Finir les enchères</button>
    </div>`}
    <div class="sub">SON</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn small ${getPref('sfx') ? 'green' : ''}" data-act="soundPref" data-k="sfx">Bruitages : ${getPref('sfx') ? 'oui' : 'non'}</button>
      <button class="btn small ${getPref('music') ? 'green' : ''}" data-act="soundPref" data-k="music">Musique : ${getPref('music') ? 'oui' : 'non'}</button>
    </div>
    <div class="sub">PERSONNAGE</div>
    ${acc.heroes.length > 1 ? `<button class="btn danger block" data-act="deleteHero">Supprimer ce ${CLASSES[hero.classId].name} (Nv.${hero.level})</button>` : '<p class="hint">Tu ne peux pas supprimer ton seul personnage.</p>'}
    ${NET.online ? '<button class="btn block" style="margin-top:10px" data-act="logout">Me déconnecter</button>' : `
      <div class="sub">DANGER</div>
      <button class="btn danger block" data-act="wipe">Tout effacer</button>`}
    <div class="close-row"><button class="btn" data-act="closeModal">Fermer</button></div>`);
}

function openNewHero() {
  openModal(`
    <h3>Nouveau personnage</h3>
    <p class="hint" style="margin-top:8px">Il commence au niveau 1 avec un sac vide. Tes autres personnages gardent tout.</p>
    ${classGrid()}
    <div class="close-row">
      <button class="btn primary" data-act="createHero">Créer</button>
      <button class="btn" data-act="closeModal">Annuler</button>
    </div>`);
}

// ------------------------------ Actions ------------------------------
const ACTIONS = {
  tab: (d) => {
    SFX.click();
    const from = tab;
    tab = d.id; render(); window.scrollTo(0, 0);
    // retour depuis PVP, COOP ou PVM : on revient devant les 3 tuiles, en bas de la page Combats
    const toHubs = d.back && d.id === 'combat' && HUBS[from]
      ? () => setTimeout(() => { if (tab === 'combat') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); }, 0)
      : () => {};
    toHubs();
    if (d.id === 'champ' || d.id === 'combat' || d.id === 'hub_pvp') (NET.online ? refreshPlayers() : Promise.resolve()).then(loadChamp).then(() => { if (tab === d.id) { softRender(); toHubs(); } });
    if (NET.online && ['fights', 'war', 'ranking', 'bets', 'tower', 'horde', 'pvp', 'combat', 'hub_pvp', 'hub_coop', 'hub_pvm', 'players', 'social'].includes(d.id)) refreshPlayers().then(() => { if (tab === d.id) softRender(); });
    if (d.id === 'journal') loadJournal().then(() => { if (tab === 'journal') { markJournalSeen(); softRender(); } });
    if (d.id === 'bets' || d.id === 'pvp') refreshBets().then(() => { if (tab === d.id) softRender(); });
    if (d.id === 'raid') loadRaid().then(() => { if (tab === 'raid') softRender(); });
    if (d.id === 'throne') refreshPlayers().then(loadThrone).then(() => { if (tab === 'throne') softRender(); });
  },
  authMode: (d) => { authMode = d.mode; renderAuth(); },
  auth: () => doAuth(),
  soundPref: (d) => { setPref(d.k, !getPref(d.k)); openSettings(); },
  toggleSound: () => {
    const on = !(getPref('sfx') || getPref('music'));
    setPref('sfx', on); setPref('music', on);
    if (on) startMusic(); else stopMusic();
    const b = document.getElementById('snd-btn');
    if (b) { b.innerHTML = ico(on ? 'speaker' : 'mute'); hydrate(b); }
  },
  sendChat: () => sendChat(),
  info: (d, el) => {
    const card = el.closest('[data-info]');
    const on = card.classList.toggle('open');
    if (on) infoOpen.add(d.id); else infoOpen.delete(d.id);
    el.textContent = on ? '−' : '+';
  },
  skipDungeon: (d) => skipDungeonFlow(d.id),
  pvpChallenge: (d) => pvpChallenge(d.id),
  pvpAccept: (d) => pvpAccept(+d.id),
  pvpDecline: async (d) => { closeModal(); try { await NET.answerChallenge(+d.id, { status: 'declined' }); } catch (e) { toast(e.message); } await refreshBets(); softRender(); },
  pvpCancel: async (d) => { try { await NET.answerChallenge(+d.id, { status: 'cancelled' }); } catch (e) { toast(e.message); } await refreshBets(); softRender(); },
  pvpWatch: (d) => { const c = pvpRows.find(x => String(x.id) === String(d.id)); closeModal(); if (c) watchPvp(c); },
  pvpVs: (d) => { const c = pvpRows.find(x => String(x.id) === String(d.id)); if (c) openPvpVs(c, c.status === 'pending' && c.to_id === myId()); },
  claimLogin: () => {
    const got = E.claimLogin(acc, hero);
    closeModal();
    if (!got) return;
    SFX.loot(got.idx === DAILY_LOGIN.length - 1 ? 3 : 1); save(); render();
    toast(`Jour ${got.idx + 1} : +${giftLabel(got.reward)} !`);
  },
  claimGift: (d) => {
    const n = myNotes().find(x => x.gift && x.gift.id === d.id);
    const got = n ? E.claimGift(acc, n.gift, hero) : 0;
    if (!got) return;
    SFX.loot(4); save(); render(); openPatchNotes();
    toast(`+${giftLabel(n.gift)}, cadeau !`);
  },
  playerCard: (d) => openPlayerCard(d.id, d.h !== undefined ? +d.h : null),
  myCard: () => openPlayerCard(myId(), acc.active),   // ma propre fiche, comme les autres la voient (perso sélectionné)
  podiumMsg: () => openPodiumMsg(),
  throneFight: (d) => startThrone(d.id),
  claimThrone: () => claimThroneReward(),
  retryChamp: () => { champError = ''; loadChamp().then(() => { if (tab === 'champ') softRender(); }); },
  champMatch: (d) => openChampMatch(d.k),
  champGame: (d) => watchChampGame(d.k, +d.g),
  claimChamp: (d) => {
    const info = d.w === champInfo.week ? champInfo : champInfo.prev;
    if (!info) return;
    const place = E.champPlace(E.champTree(info.slots, champRes(info.matches)), myId());
    acc.champ ||= { claimed: {} };
    if (!place || acc.champ.claimed[info.week]) return;
    acc.champ.claimed[info.week] = place;
    const n = E.champReward(acc, hero, place);
    SFX.loot(place === 'win' ? 4 : 2); save(); render();
    toast(`+${n} Flouze pour le championnat !`);
  },
  claimAuto: () => {
    const r = E.autoClaim(acc, hero);
    if (!r.chests && !r.xp) return;
    SFX.loot(2); save(); render();
    toast(`${[r.chests ? `+${r.chests} coffre${r.chests > 1 ? 's' : ''}` : '', r.xp ? `+${r.xp} XP` : ''].filter(Boolean).join(' et ')} pour ${CLASSES[hero.classId].name}${r.chests ? ' : va les ouvrir dans Coffres !' : ''}`);
    announce(r.lv);
  },
  retryThrone: () => { throneError = ''; loadThrone().then(() => { if (tab === 'throne') softRender(); }); },
  podiumMsgSave: (d) => {
    const v = d.clear ? '' : (document.getElementById('pod-msg')?.value || '').trim().slice(0, 60);
    acc.podiumMsg = v ? { text: v, at: Date.now() } : null;
    save(); closeModal(); render();
    toast(v ? 'Message enregistré !' : 'Message effacé.');
  },
  startHorde: () => startHorde(),
  skipDungeonGo: (d) => skipDungeonFlow(d.id, true),
  switchHero: (d) => {
    const i = +d.i;
    if (i === acc.active) return;
    acc.active = i; save(); render();
    toast(`${CLASSES[E.activeHero(acc).classId].name} activé !`);
  },
  newHeroModal: () => openNewHero(),
  createHero: () => {
    const h = E.addCharacter(acc, pickedClass);
    if (!h) return;
    save(); closeModal(); render();
    toast(`Nouveau ${CLASSES[h.classId].name} créé !`);
  },
  deleteHero: () => {
    if (acc.heroes.length <= 1) return;
    if (!confirm(`Supprimer ce ${CLASSES[hero.classId].name} niveau ${hero.level} et tous ses objets ? C’est définitif.`)) return;
    acc.heroes.splice(acc.active, 1);
    acc.active = 0;
    save(); closeModal(); render();
  },
  logout: async () => {
    await NET.signOut();
    acc = null; hero = null; players = []; chatMsgs = []; chatUnread = 0; journal = []; journalUnseen = 0; authMode = 'login';
    closeModal(); render();
  },
  pickClass: (d) => {
    pickedClass = d.id;
    document.querySelectorAll('.class-card').forEach(c => c.classList.toggle('sel', c.dataset.id === d.id));
  },
  eraPlay: (d, el) => {
    if (!E.eraLive()) return;
    el.disabled = true; SFX.click();
    clearInterval(countdownTimer); start();
  },
  rebirth: async (d, el) => {
    el.disabled = true;
    acc = E.newAccount(rebirth.pseudo, pickedClass);
    rebirth = null;
    save();
    if (NET.online) { await NET.flush(); await goOnline(); }
    tab = 'chests';
    render();
    toast('C’est parti ! Tu as 5 coffres à ouvrir.');
  },
  create: () => {
    const name = (document.getElementById('hero-name').value || '').trim();
    if (!name) { document.getElementById('hero-name').focus(); toast('Choisis un pseudo !'); return; }
    acc = E.newAccount(name, pickedClass);
    save();
    tab = 'hero';
    render();
    toast('Bienvenue ! Tu as 5 coffres à ouvrir.');
  },
  addStat: (d) => {
    const n = Math.min(statStep, E.freePoints(hero));
    if (n <= 0) return;
    hero.alloc[d.k] = (hero.alloc[d.k] || 0) + n;
    E.missionEvent(acc, 'stat', n);
    SFX.click();
    save(); softRender();
  },
  statStep: (d) => { statStep = +d.n; softRender(); },
  storyMode: (d) => {
    const m = +d.m;
    if (!storyUnlocked(m, 0)) { toast(`Finis les 5 zones du mode ${STORY.modes[m - 1].name} pour débloquer le mode ${STORY.modes[m].name}.`); return; }
    const S = E.storyState(hero);
    let z = 0;
    while (z < STORY.zones.length - 1 && S.prog >= E.storyG(m, z + 1, 0)) z++;
    storySel = { hero: hero.id, m, z }; SFX.click(); render();
  },
  storyZone: (d) => {
    const z = +d.z;
    if (!storyUnlocked(storySel.m, z)) { toast('Finis le boss de la zone d’avant pour débloquer celle-ci.'); return; }
    storySel = { ...storySel, z }; SFX.click(); render();
  },
  storyNode: (d) => openStoryFight(+d.g),
  storyFight: (d) => startStoryFight(+d.g),
  storyClaim: (d) => {
    const r = E.storyClaim(acc, hero, +d.m, +d.z, +d.t);
    if (!r) return;
    save(); render(); SFX.loot(r.legendary ? 4 : r.epic ? 3 : 1);
    toast(r.chests ? `+${r.chests} coffres pour ton ${CLASSES[hero.classId].name} !` : r.legendary ? '+1 coffre Légendaire ! (onglet Coffres)' : '+1 coffre Épique ! (onglet Coffres)');
  },
  resetStats: () => {
    if (acc.clat < STAT_RESET_COST) { toast(`Il faut ${STAT_RESET_COST} Flouze pour replacer tes points.`); return; }
    if (!confirm(`Replacer tous tes points pour ${STAT_RESET_COST} Flouze ?`)) return;
    E.resetStats(acc, hero); save(); render(); toast(`Points remis à zéro (−${STAT_RESET_COST} Flouze). Replace-les comme tu veux !`);
  },
  spellUp: (d) => { const i = hero.spells.indexOf(d.id); if (i > 0) { [hero.spells[i - 1], hero.spells[i]] = [hero.spells[i], hero.spells[i - 1]]; save(); render(); } },
  spellDown: (d) => { const i = hero.spells.indexOf(d.id); if (i >= 0 && i < hero.spells.length - 1) { [hero.spells[i + 1], hero.spells[i]] = [hero.spells[i], hero.spells[i + 1]]; save(); render(); } },
  spellOff: (d) => { hero.spells = hero.spells.filter(id => id !== d.id); save(); render(); },
  spellInfo: (d) => openSpell(d.id),
  trainCast: (d) => {
    const b = document.querySelector(`.tsp[data-i="${d.i}"]`);
    if (!trainFight || !b) return;
    if (b.classList.contains('wait')) { toast(`${SPELLS[d.id].name} se recharge encore.`); return; }
    trainCast = d.id; trainWait = 0;
    trainFight.queue(d.id);
    document.querySelectorAll('.tsp.queued').forEach(x => x.classList.remove('queued'));
    b.classList.add('queued');
    SFX.click();
  },
  spellEquip: (d) => {
    if (hero.spells.length < MAX_ACTIVE_SPELLS && !hero.spells.includes(d.id) && SPELLS[d.id].lvl <= hero.level) { hero.spells.push(d.id); save(); }
    closeModal(); render(); SFX.click();
  },
  spellReplace: (d) => {
    const i = +d.i;
    if (!hero.spells.includes(d.id) && hero.spells[i] && SPELLS[d.id].lvl <= hero.level) { hero.spells[i] = d.id; save(); }
    closeModal(); render(); SFX.click();
  },
  spellRemove: (d) => { hero.spells = hero.spells.filter(x => x !== d.id); save(); closeModal(); render(); },
  spellMove: (d) => {
    const i = hero.spells.indexOf(d.id), j = i + +d.d;
    if (i >= 0 && j >= 0 && j < hero.spells.length) { [hero.spells[i], hero.spells[j]] = [hero.spells[j], hero.spells[i]]; save(); render(); openSpell(d.id); }
  },
  spellOn: (d) => { if (hero.spells.length < MAX_ACTIVE_SPELLS && !hero.spells.includes(d.id)) { hero.spells.push(d.id); save(); render(); } },
  openChest: (d) => openChestFlow(d.kind),
  openAll: () => openChestFlow('normal', true),
  buyDaily: (d) => {
    const it = E.buyDaily(acc, hero, +d.i);
    if (!it) { toast(`Il faut ${E.dailyShop(acc)[+d.i].price} Flouze.`); return; }
    SFX.loot(it.rarity); save(); render();
    toast(`${ITEMS[it.itemId].name} ajouté au sac de ton ${CLASSES[hero.classId].name} !`);
  },
  buyKey: () => {
    if (!E.buyKey(acc, hero)) { toast(`Il faut ${KEY_PRICE} Flouze.`); return; }
    SFX.loot(2); save(); render();
    toast(`Clef achetée pour ton ${CLASSES[hero.classId].name} !`);
  },
  bagMode: (d) => { bagMode = d.mode; render(); },
  bagSet: (d) => { bagSet = d.id; render(); },
  sellAsk: (d) => openSellConfirm(d.id, +d.r),
  sell: (d) => {
    const r = E.sellItems(acc, hero, d.id, +d.r, +d.n || 1);
    if (!r) return;
    E.missionEvent(acc, 'sell', r.n);
    SFX.click(); save(); render();
    if (E.stackOf(hero, d.id, +d.r).length) openItem(d.id, +d.r); else closeModal();
    toast(`Vendu : +${r.gain} Flouze`);
  },
  sellCommons: () => {
    const eqUids = new Set(Object.values(hero.equipped));
    const list = hero.inventory.filter(i => i.rarity === 0 && !eqUids.has(i.uid));
    if (!list.length) return;
    if (!confirm(`Vendre ${list.length} objet(s) Commun(s) pour ${list.length * SELL_PRICE[0]} Flouze ?`)) return;
    const ids = [...new Set(list.map(i => i.itemId))];
    let gain = 0;
    for (const id of ids) { const r = E.sellItems(acc, hero, id, 0, 999); if (r) gain += r.gain; }
    E.missionEvent(acc, 'sell', list.length);
    SFX.loot(1); save(); render();
    toast(`Vendu : +${gain} Flouze`);
  },
  cast: (d) => {
    const f = battleFight;
    if (!f) { toast('Contre un vrai joueur, le mode auto est obligatoire.'); return; }
    if (!f.manual) { toast('Passe en mode MANUEL pour lancer tes sorts toi-même.'); return; }
    const b = document.querySelector(`.sb[data-i="${d.i}"]`);
    if (!b || !b.classList.contains('ready')) return;
    f.queue(d.id);
    document.querySelectorAll('.sb.queued').forEach(x => x.classList.remove('queued'));
    b.classList.add('queued');
  },
  toggleManual: () => {
    const f = battleFight;
    if (!f) return;
    f.setManual(!f.manual);
    setManualPref(f.manual);
    const btn = document.getElementById('mode-btn');
    if (btn) { btn.querySelector('b').textContent = f.manual ? 'MANUEL' : 'AUTO'; btn.classList.toggle('man', f.manual); }
    document.querySelectorAll('.sb.queued').forEach(x => x.classList.remove('queued'));
    toast(f.manual ? 'Mode manuel : touche un sort prêt pour le lancer.' : 'Mode auto : ton héros lance ses sorts tout seul.');
  },
  item: (d) => openItem(d.id, +d.r),
  equip: (d) => {
    const stack = E.stackOf(hero, d.id, +d.r);
    if (!stack.length) return;
    hero.equipped[ITEMS[d.id].slot] = stack[0].uid;
    E.missionEvent(acc, 'equip');
    save(); closeModal(); render(); toast(`${ITEMS[d.id].name} équipé !`);
  },
  slotPick: (d) => openSlotPicker(d.slot),
  formation: () => openFormation(),
  bestGear: () => {
    const { equipped, gain } = E.bestGear(hero);
    if (gain <= 0) { toast('Tu portes déjà ton meilleur équipement !'); return; }
    hero.equipped = equipped;
    E.missionEvent(acc, 'equip');
    SFX.loot(3); save(); render();
    toast(`Meilleur équipement porté : +${fmtNum(gain)} de puissance !`);
  },
  unequip: (d) => { delete hero.equipped[d.slot]; save(); closeModal(); render(); },
  fuse: (d) => {
    const anim = document.getElementById('fuse-anim');
    if (anim) anim.classList.add('shake');
    setTimeout(() => {
      const res = E.fuse(hero, d.id, +d.r);
      if (!res) return;
      SFX.fuse();
      E.missionEvent(acc, 'fuse');
      save();
      render();
      openItem(res.itemId, res.rarity);
      const ic = modalRoot.querySelector('.big-ic');
      if (ic) ic.classList.add('burst');
      toast(`Fusion réussie : ${ITEMS[res.itemId].name} ${RARITIES[res.rarity].name} !`);
    }, 600);
  },
  fuseAll: (d) => {
    // d'abord, on montre ce que ça va donner (sur une copie du sac), puis on confirme
    if (!d.sure) {
      const preview = E.fuseAll(JSON.parse(JSON.stringify(hero)));
      if (!preview.fusions) return;
      openModal(`
        <h3>${ico('sparkle')} Tout fusionner ?</h3>
        <p class="hint" style="margin-top:8px"><b>${preview.fusions} fusion${preview.fusions > 1 ? 's' : ''}</b> en chaîne : les objets obtenus sont refusionnés tant que c’est possible. Ton équipement reste équipé (avec sa nouvelle rareté).</p>
        <div class="fuse-list">${fuseSummary(preview.made)}</div>
        <div class="close-row"><button class="btn" data-act="closeModal">Annuler</button><button class="btn primary" data-act="fuseAll" data-sure="1">Fusionner</button></div>`);
      return;
    }
    const res = E.fuseAll(hero);
    if (!res.fusions) { closeModal(); return; }
    E.missionEvent(acc, 'fuse', res.fusions);
    SFX.fuse();
    save();
    const best = Math.max(...res.made.map(it => it.rarity));
    // le résultat s'affiche tout de suite ; le sac se redessinera à la fermeture de la fenêtre
    openModal(`
      <h3>${ico('sparkle')} ${res.fusions} fusion${res.fusions > 1 ? 's' : ''} réussie${res.fusions > 1 ? 's' : ''} !</h3>
      <div class="fuse-list">${fuseSummary(res.made)}</div>
      <div class="close-row"><button class="btn primary" data-act="closeModal">Super</button></div>`);
    SFX.loot(best);
    renderOnClose = true;   // le sac (caché derrière la fenêtre) se redessine quand on la ferme : rien de lourd pendant que le résultat s'affiche
  },
  fight: (d) => startFight(d.id),
  friendly: (d) => startFriendly(d.id),
  revenge: (d) => startFriendly(d.id, true),
  replayLog: (d) => replayById(d.id),
  replayId: (d) => replayById(d.id),
  shareLog: (d) => shareFight(d.id),
  claimMission: (d) => {
    const got = E.claimMission(acc, d.id);
    if (!got) return;
    SFX.loot(1); save(); render();
    toast(`+${got} Flouze !`);
  },
  attackRaid: () => attackRaid(),
  retryRaid: () => { raidError = ''; render(); },
  claimRaid: (d) => claimRaid(d.week),
  attackTower: () => attackTower(),
  shopKind: (d) => { shopKind = d.k; render(); },
  aucSell: () => {
    const list = stacks().filter(st => st.items.length > (st.equipped ? 1 : 0));
    if (!list.length) { toast('Rien à vendre : les objets équipés ne se vendent pas.'); return; }
    openModal(`
      <h3>Quel objet vendre ?</h3>
      <p class="hint" style="margin-top:4px">Le sac de ton ${CLASSES[hero.classId].name}, sans les objets qu'il porte.</p>
      <div class="pick-list">${list.map(st => `
        <button class="pick-row" style="--rc:${RARITIES[st.rarity].color}" data-act="aucPick" data-id="${st.itemId}" data-r="${st.rarity}">
          <span class="it r${st.rarity} pick-ic" style="--rc:${RARITIES[st.rarity].color}"><canvas class="px" data-icon="${st.itemId}"></canvas>${st.items.length > 1 ? `<span class="n">x${st.items.length}</span>` : ''}</span>
          <span class="pick-txt"><b>${esc(ITEMS[st.itemId].name)}</b><small style="color:${RARITIES[st.rarity].color}">${RARITIES[st.rarity].name} · ${SLOTS[ITEMS[st.itemId].slot].name}</small><small class="pick-st">${statChips(st.itemId, st.rarity)}</small></span>
        </button>`).join('')}</div>
      <div class="close-row"><button class="btn" data-act="closeModal">Fermer</button></div>`);
  },
  aucPick: (d) => {
    const r = +d.r;
    openModal(`
      <h3>Mettre en vente</h3>
      ${aucItemHead(d.id, r)}
      <label class="field" style="margin-top:12px">Prix de départ (Flouze)
        <input id="auc-min" type="number" inputmode="numeric" min="1" max="${AUCTION.maxPrice}" value="${SELL_PRICE[r] * 2}">
      </label>
      <p class="hint" style="margin-top:8px">24 h, puis il part au plus offrant. Sans offre, il revient dans ton sac.</p>
      <div class="close-row"><button class="btn" data-act="aucSell">Retour</button><button class="btn primary" data-act="aucCreate" data-id="${d.id}" data-r="${r}">Mettre en vente</button></div>`, { center: true });
  },
  aucCreate: async (d) => {
    const r = +d.r;
    const min = Math.floor(+document.getElementById('auc-min').value || 0);
    if (min < 1 || min > AUCTION.maxPrice) { toast(`Prix de départ entre 1 et ${fmtNum(AUCTION.maxPrice)} Flouze.`); return; }
    const me = AUC.myId(), now = Date.now();
    if (auc.auctions.some(a => a.seller_id === me && now < E.aucEnd(a))) { toast('Tu as déjà un objet en vente.'); return; }
    const it = E.aucSellable(hero).find(i => i.itemId === d.id && i.rarity === r);
    if (!it) return;
    hero.inventory = hero.inventory.filter(i => i !== it);
    save();
    try {
      await AUC.create({ pseudo: acc.pseudo, hero_id: hero.id, item_id: d.id, rarity: r, min_price: min });
      SFX.click();
      toast(`${ITEMS[d.id].name} est en vente pour 24 h !`);
    } catch (e) { hero.inventory.push(it); save(); toast(e.message); }
    closeModal();
    await loadAuc(true);
    render();
  },
  aucBid: (d) => {
    const a = auc.auctions.find(x => String(x.id) === d.id);
    if (!a) return;
    const top = E.aucTop(auc.bids, a.id), next = E.aucNext(a, top);
    openModal(`
      <h3>Enchérir</h3>
      ${aucItemHead(a.item_id, a.rarity)}
      <div class="auc-now">${top ? `Meilleure offre : <b>${fmtNum(top.amount)}</b> (${esc(top.pseudo)})` : `Prix de départ : <b>${fmtNum(a.min_price)}</b>`} · vendu par ${esc(a.pseudo)}</div>
      <label class="field" style="margin-top:12px">Ton offre (au moins ${fmtNum(next)})
        <input id="auc-bid" type="number" inputmode="numeric" min="${next}" value="${next}">
      </label>
      <p class="hint" style="margin-top:8px">Tu as ${fmtNum(acc.clat)} Flouze. Ton offre est bloquée, et rendue si quelqu’un met plus.</p>
      <div class="close-row"><button class="btn" data-act="closeModal">Annuler</button><button class="btn primary" data-act="aucBidGo" data-id="${a.id}">Enchérir</button></div>`, { center: true });
  },
  aucBidGo: async (d) => {
    const amount = Math.floor(+document.getElementById('auc-bid').value || 0);
    await loadAuc(true);   // la meilleure offre a pu changer entre-temps
    const a = auc.auctions.find(x => String(x.id) === d.id);
    if (!a || Date.now() >= E.aucEnd(a)) { toast('Cette vente est finie.'); closeModal(); render(); return; }
    const next = E.aucNext(a, E.aucTop(auc.bids, a.id));
    if (amount < next) { toast(`Il faut au moins ${fmtNum(next)} Flouze.`); return; }
    if (amount > acc.clat) { toast('Pas assez de Flouze.'); return; }
    acc.clat -= amount;
    save();
    try {
      await AUC.bid(a.id, acc.pseudo, amount);
      SFX.click();
      toast(`Offre de ${fmtNum(amount)} Flouze : tu mènes !`);
    } catch (e) { acc.clat += amount; save(); toast(e.message); }
    closeModal();
    await loadAuc(true);
    render();
  },
  buyCos: (d) => {
    const c = COSMETIC[d.id];
    if (!E.buyCosmetic(acc, d.id)) { toast('Pas assez de Flouze.'); return; }
    E.equipCosmetic(acc, hero, d.id);
    SFX.loot(2); save(); render();
    toast(`${c.name} acheté !`);
  },
  equipCos: (d) => { E.equipCosmetic(acc, hero, d.id); SFX.click(); save(); render(); if (COSMETIC[d.id] && COSMETIC[d.id].art) prepareSkin(hero.classId, d.id).then(() => softRender()); },
  challenge: async (d) => {
    const p = players.find(x => x.id === d.id);
    if (!p) return;
    try { await NET.createChallenge(p.id, acc.pseudo, p.pseudo); toast(`Défi envoyé à ${p.pseudo} !`); } catch (e) { toast(e.message); }
    await refreshBets(); softRender();
  },
  acceptDuel: async (d) => {
    const c = bets.challenges.find(x => String(x.id) === d.id);
    const p = c && players.find(x => x.id === c.from_id);
    if (!p) { toast('Joueur introuvable.'); return; }
    try {
      await NET.answerChallenge(c.id, {
        status: 'accepted', accepted_at: new Date().toISOString(), seed: (Math.random() * 2 ** 31) | 0,
        from_snap: snapOf(p.data, E.strongestHero(p.data), p.pseudo),
        to_snap: snapOf(acc, E.strongestHero(acc), acc.pseudo),
      });
      toast('Duel accepté ! Les paris sont ouverts pendant 24 h.');
    } catch (e) { toast(e.message); }
    await refreshBets(); softRender();
  },
  declineDuel: async (d) => { try { await NET.answerChallenge(+d.id, { status: 'declined' }); } catch (e) { toast(e.message); } await refreshBets(); softRender(); },
  cancelDuel: async (d) => { try { await NET.answerChallenge(+d.id, { status: 'cancelled' }); } catch (e) { toast(e.message); } await refreshBets(); softRender(); },
  placeBet: async (d) => {
    const c = bets.challenges.find(x => String(x.id) === d.id);
    if (!c) return;
    const amount = Math.floor(+document.getElementById('bet-' + c.id).value || 0);
    if (amount < 1) { toast('Mise au moins 1 Flouze.'); return; }
    if (amount > acc.clat) { toast('Pas assez de Flouze.'); return; }
    const side = +d.side;
    const odds = duelOdds(c)[side];
    acc.clat -= amount; save();
    try {
      await NET.placeWager(c.id, acc.pseudo, side, amount, odds);
      E.missionEvent(acc, 'bet'); save();
      SFX.click();
      toast(`Pari placé : ${amount} sur ${side === 0 ? c.from_name : c.to_name} (×${odds})`);
    } catch (e) { acc.clat += amount; save(); toast(e.message); }
    await refreshBets(); softRender();
  },
  claimBets: () => {
    const g = pendingWinnings();
    if (!g.ids.length) return;
    acc.clat += g.total;
    acc.paidWagers = [...acc.paidWagers, ...g.ids].slice(-300);
    save(); render();
    if (g.total) { SFX.loot(3); toast(`+${g.total} Flouze gagné aux paris !`); } else toast('Paris perdus… la prochaine sera la bonne !');
  },
  replayDuel: (d) => {
    const c = bets.challenges.find(x => String(x.id) === d.id);
    if (!c) return;
    const result = duelResult(c);
    const winName = result.winner === 0 ? c.from_name : c.to_name;
    runBattle({ me: c.from_snap, foe: c.to_snap, result, theme: 'arena', track: false,
      title: `Duel · ${esc(c.from_name)} <span style="color:var(--gold)">VS</span> ${esc(c.to_name)}`,
      finish: () => ({ headline: `${winName.toUpperCase()} GAGNE !`, headClass: 'win' }) });
  },
  dungeon: (d) => startDungeon(d.id),
  warAttack: (d) => startWarAttack(d.id),
  joinSection: (d) => {
    const s = WAR.sections[d.sec];
    openModal(`
      <div class="sec-confirm" style="--sc:${s.color}">
        <span class="sc-flag"><canvas class="px" data-emblem="war"></canvas></span>
        <h3>Rejoindre ${s.the} ?</h3>
        <p class="sc-motto">« ${s.motto} »</p>
        <p class="hint">Tu te battras avec ${s.the} toute la semaine. À la prochaine guerre, tu rechoisis ton camp.</p>
      </div>
      <div class="close-row"><button class="btn" data-act="closeModal">Annuler</button><button class="btn ${d.sec === 'rouge' ? 'danger' : 'blue'}" data-act="joinSectionGo" data-sec="${d.sec}">Rejoindre ${s.the}</button></div>`, { center: true });
  },
  joinSectionGo: async (d) => {
    const s = WAR.sections[d.sec];
    closeModal();
    await refreshPlayers();
    if (!E.joinSection(acc, d.sec, others())) { toast(`Plus de place chez ${s.the} (${WAR.maxPerSection} max).`); render(); return; }
    save(); render(); toast(`Bienvenue chez ${s.the} !`);
  },
  claimWar: () => {
    const p = E.claimWarReward(acc);
    save(); render();
    if (p && (p.warChests || p.combatChests)) toast('Récompense ajoutée dans tes coffres !');
  },
  rank: (d) => { rankMode = d.mode; render(); },
  speed: () => {
    if (!battleCtl) return;
    const speeds = [1, 2, 3];
    battleCtl.speedIdx = (battleCtl.speedIdx + 1) % speeds.length;
    battleCtl.setSpeed(speeds[battleCtl.speedIdx]);
    const sb = document.getElementById('speed-btn');
    sb.textContent = `x${speeds[battleCtl.speedIdx]}`;
    sb.classList.toggle('on', battleCtl.speedIdx > 0);
  },
  skip: () => { if (battleFight) battleFight.setManual(false); if (battleCtl) battleCtl.skip(); },
  waveNext: () => {
    const go = waveNext;
    waveNext = null;
    if (battleCtl) battleCtl.destroy();
    battleCtl = null;
    document.querySelector('.battle')?.remove();
    if (go) go(); else { render(); scrollTop(); }
  },
  endFight: () => {
    if (battleCtl) battleCtl.destroy();
    battleCtl = null;
    document.querySelector('.battle')?.remove();
    render();
    scrollTop();   // après un combat, on revient toujours en haut de la page
  },
  settings: openSettings,
  patchNotes: () => openPatchNotes(),
  rename: () => {
    const v = (document.getElementById('rename').value || '').trim();
    if (v) { acc.pseudo = v; acc.heroes.forEach(h => { h.name = v; }); save(); closeModal(); render(); }
  },
  cheat: (d) => {
    if (NET.online) return;
    if (d.c === 'chests') hero.chest.stored = CHEST_MAX;
    if (d.c === 'combat') acc.combatChests += 2;
    if (d.c === 'fights') { acc.fights.done = {}; acc.fights.clat = {}; hero.runs = null; hero.horde = {}; acc.war.done = {}; acc.raid.ch = {}; }
    if (d.c === 'clat') acc.clat += 100;
    if (d.c === 'auc') { AUC.finishAllLocal(); auc.at = 0; }
    if (d.c === 'weekEnd' && acc.war.section) {
      const cur = E.warWeek(acc);
      acc.war.weeks['2000-01-03'] = { ...cur, attacks: Math.max(cur.attacks, WAR.minAttacks) };
      acc.war.lastWeek = '2000-01-03';
    }
    if (d.c === 'lvl') { let lv = { levels: 0, newSpells: [] }; for (let i = 0; i < 5; i++) { const r = E.gainXp(hero, E.xpForLevel(hero.level) - hero.xp); lv.levels += r.levels; lv.newSpells.push(...r.newSpells); } announce(lv); }
    save(); closeModal(); render();
  },
  wipe: () => {
    if (!confirm('Tout effacer (tous tes personnages) pour de bon ?')) return;
    wipe(); acc = null; hero = null; closeModal(); render();
  },
  closeModal: () => closeModal(),
  closeAndRender: () => { closeModal(); render(); },
  bgClose: (d, el, ev) => { if (ev.target === el) { closeModal(); render(); } },
};

document.addEventListener('click', (ev) => {
  unlockSound();
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset, el, ev);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'chat-input') { ev.preventDefault(); sendChat(); return; }
  if (document.getElementById('auth-btn')) doAuth();
});
document.addEventListener('input', (ev) => { if (ev.target.id === 'chat-input') chatDraft = ev.target.value; });

// Minuteurs (coffres, fin de journée, combat auto)
let eraReload = false;
setInterval(() => {
  if (!acc) return;
  if (!hero) return;
  // 19 h : le compte d'essai du propriétaire repart de zéro comme tout le monde
  if (NET.online && !eraReload && !E.isEra(acc)) { eraReload = true; NET.flush().then(() => location.reload()); return; }
  // récompense du jour : la fenêtre s'ouvre dès que l'écran est libre (pas en combat, pas d'autre fenêtre)
  if (!E.loginState(acc).claimed && !modalRoot.innerHTML && !document.querySelector('.battle')) { openLogin(); return; }
  autoTick();
  if (E.applySpecialReset(acc)) { save(); softRender(); toast('Remise à zéro spéciale de 20 h : tout est rechargé !'); return; }
  const before = hero.chest.stored;
  E.refreshChests(hero);
  const busy = modalRoot.innerHTML || document.querySelector('.battle') || tab === 'chat';
  if (hero.chest.stored !== before) { save(); if (!busy) render(); return; }
  if ((acc.fights.day !== E.dayKey() || acc.missions.day !== E.halfKey() || E.dungeonRuns(hero).day !== E.dayKey()) && !busy) { render(); return; }
  // enchères : une vente vient de finir sous nos yeux → on règle et on réaffiche
  if (!busy && tab === 'shop' && shopKind === 'auction' && [...document.querySelectorAll('.auc [data-countdown]')].some(el => +el.dataset.countdown <= Date.now())) { auc.at = 0; render(); return; }
  // une charge (donjon, Horde, gros boss) vient de revenir : on réaffiche
  if (!busy && [...document.querySelectorAll('[data-charge]')].some(el => +el.dataset.charge <= Date.now())) { render(); return; }
  const t = document.querySelector('[data-timer="chest"]');
  if (t && hero.chest.stored < CHEST_MAX) t.innerHTML = `Prochain coffre dans <b>${fmt(E.nextChestIn(hero))}</b>`;
  const d = document.querySelector('[data-timer="day"]');
  if (d) d.textContent = `Nouveaux combats dans ${fmt(msToMidnight())}`;
  const sh = document.querySelector('[data-timer="shop"]');
  if (sh) { if (acc.shop && acc.shop.day !== E.shopSlot() && !busy) { render(); return; } sh.textContent = fmt(E.msToNextShop()); }
  const d3 = document.querySelector('[data-timer="day3"]');
  if (d3) d3.textContent = fmt(msToMidnight());
  document.querySelectorAll('[data-timer="half"]').forEach(el => { el.textContent = el.textContent.replace(/\d\d:\d\d:\d\d/, fmt(E.msToNextHalf())); });
  document.querySelectorAll('[data-countdown]').forEach(el => { el.textContent = fmt(+el.dataset.countdown - Date.now()); });
  document.querySelectorAll('[data-charge]').forEach(el => { el.textContent = fmt(Math.max(0, +el.dataset.charge - Date.now())); });
  document.querySelectorAll('[data-endlong]').forEach(el => { el.textContent = fmtLong(Math.max(0, +el.dataset.endlong - Date.now())); });
  const wk = document.querySelector('[data-timer="week"]');
  if (wk) wk.textContent = `Fin dans ${fmtLong(E.msToWeekEnd())}`;
}, 1000);

// En ligne : on recharge les autres joueurs de temps en temps, et on sauvegarde avant de quitter
if (NET.online) {
  NET.setSaveErrorHandler((msg) => toast(`Sauvegarde en ligne impossible (${msg}). Nouvel essai…`));
  setInterval(() => { if (acc && !document.querySelector('.battle')) refreshPlayers(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') NET.flush(); });
}

// ------------------------------ Mise à jour automatique ------------------------------
// Le téléphone peut garder une ancienne version en mémoire : on compare avec version.json
// (jamais en cache) et on recharge la page si une nouvelle version est en ligne.
async function checkUpdate() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const { v } = await r.json();
    if (!v || v === APP_VERSION) return;
    if (document.querySelector('.battle') || modalRoot.innerHTML) return;   // pas en plein combat
    let tried = null;
    try { tried = sessionStorage.getItem('fuzev2-update'); } catch (e) { /* stockage indisponible */ }
    if (tried === v) { toast('Nouvelle version disponible : ferme et rouvre l’appli.'); return; }
    try { sessionStorage.setItem('fuzev2-update', v); } catch (e) { /* stockage indisponible */ }
    if (NET.online) await NET.flush();
    location.reload();
  } catch (e) { /* pas de réseau : on réessaiera */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
setInterval(checkUpdate, 5 * 60 * 1000);

let artReady = null;
async function boot() {
  // dessins vectoriels des héros (refonte) : chargés une fois avant le premier affichage
  artReady = Promise.all([loadHeroArt().catch(() => {}), loadMonsterArt().catch(() => {}), loadDecorArt().catch(() => {}), loadIconArt().catch(() => {}), loadItemArt().catch(() => {})]);
  try { localStorage.removeItem('fuzev2-early'); } catch (e) { /* stockage indisponible */ }   // l'ancienne entrée d'essai du propriétaire
  if (NET.online && !E.eraLive()) { renderCountdown(); return; }   // Fuze Arena 2.0 : on attend 19 h (les dessins chargent derrière)
  await start();
}
async function start() {
  await artReady;
  if (NET.online) {
    app.innerHTML = '<div class="create"><img class="logo-img" src="icons/icon.svg?v=2" alt=""><h1 class="logo">FUZE<span>ARENA</span></h1><p class="lead">Connexion…</p></div>';
    try {
      const row = await NET.restore();
      if (row && row.data && !E.isEra(row.data)) rebirth = { pseudo: row.pseudo };   // compte de l'ancien jeu : nouveau héros
      else if (row && row.data) {
        acc = E.migrate(row.data);
        acc.pseudo = row.pseudo;
        await goOnline();
      }
    } catch (e) {
      app.innerHTML = `<div class="create"><img class="logo-img" src="icons/icon.svg?v=2" alt=""><h1 class="logo">FUZE<span>ARENA</span></h1><p class="auth-msg">${esc(e.message)}</p><button class="btn primary block" onclick="location.reload()">Réessayer</button></div>`;
      return;
    }
  } else {
    const saved = load();
    if (saved) acc = E.migrate(saved);
  }
  render();
  warmSkins();
  checkUpdate();
}
boot();
