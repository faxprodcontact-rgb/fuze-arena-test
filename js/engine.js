// =====================================================================
//  MOTEUR DU JEU — règles pures (pas d'affichage). Pourra tourner
//  plus tard sur le serveur pour que personne ne puisse tricher.
// =====================================================================
import {
  SHOP_DAILY, PVP, THRONE, AUTO, ALT_XP_MULT, LEVEL_KEYS, SPECIAL_RESET, ERA, DAILY_LOGIN, LEVEL_FIXES, CLASSES, SPELLS, SPELL_LIST, ITEMS, ITEM_LIST, RARITIES, STAT_KEYS, SLOT_ORDER, SETS,
  MAX_LEVEL, POINTS_PER_LEVEL, WINS_PER_COMBAT_CHEST, CHEST_INTERVAL_MS, CHEST_MAX, CHEST_ODDS, MAX_ACTIVE_SPELLS, CHEST_LUCK, OPEN_MAX,
  CHAMP, STORY, RECHARGE, SET_TIERS, FUSE_NEED, DUNGEON_RUNS, DUNGEON_KEYS_MAX, DUNGEON_SKIP_KEEP, HORDE, WAR, FRIENDS, PETS, PET_EVERY, PET_AFFINITY, KEY_PRICE, SELL_PRICE, STAT_RESET_COST, RESET_ID, REMATCH_CLAT,
  ITEM_CRIT, ITEM_DODGE, CRIT_CAP, DODGE_CAP, AUCTION,
  XP_CATCHUP, XP_CURVE, TOWER, RAID, RAID_BOSSES, DUNGEONS, MISSION_POOL, MISSIONS_PER_DAY, MISSIONS_BONUS, COSMETIC,
} from './data.js?v=20261021235041';
import { makeRng, hashStr, pickWeighted } from './rng.js?v=20261021235041';

// ----------------------------- Progression -----------------------------
// XP pour passer un niveau : +2 % de plus à chaque niveau (exponentiel), la montée ralentit petit à petit jusqu'au niveau 100
export const xpForLevel = (lvl) => Math.round((XP_CURVE.base + XP_CURVE.per * lvl) * Math.pow(XP_CURVE.growth, lvl) * XP_CURVE.mult);
export const totalPoints = (lvl) => lvl * POINTS_PER_LEVEL;
export const spentPoints = (hero) => STAT_KEYS.reduce((a, k) => a + (hero.alloc[k] || 0), 0);
export const freePoints = (hero) => totalPoints(hero.level) - spentPoints(hero);

export function classSpells(classId) {
  return SPELL_LIST.filter(s => s.cls === classId).sort((a, b) => a.lvl - b.lvl);
}
export function unlockedSpells(classId, level) {
  return classSpells(classId).filter(s => s.lvl <= level);
}

// Bonus d'XP du moment (aide aux retardataires), réglé par l'interface
let xpBonus = 1;
let altBonus = { mult: 1, cap: 0 };   // bonus des persos secondaires : s'arrête net au niveau du perso le plus haut
export function setXpBonus(mult, alt = null) { xpBonus = Math.max(1, mult || 1); altBonus = alt && alt.mult > 1 ? alt : { mult: 1, cap: 0 }; }
export const getXpBonus = () => xpBonus;
export const getAltXpBonus = () => altBonus.mult;

/** Bonus de rattrapage : +5 % d'XP par niveau de retard sur le perso le plus haut du jeu (max +100 %) */
export function catchupBonus(myLevel, topLevel) {
  const gap = Math.max(0, topLevel - myLevel);
  return 1 + Math.min(XP_CATCHUP.max, gap * XP_CATCHUP.perLevel);
}

/** Bonus d'un perso secondaire : ×2 tant qu'il est sous le niveau du perso le plus haut du compte (cap = ce niveau) */
export function altXpBonus(acc, hero) {
  const top = Math.max(...acc.heroes.map(h => h.level));
  return hero.level < top ? { mult: ALT_XP_MULT, cap: top } : null;
}

/** Clefs gagnées en atteignant ce niveau */
export function levelKeys(lvl) {
  const tier = LEVEL_KEYS.tiers.find(([from]) => lvl >= from);
  const each = tier ? tier[1] : LEVEL_KEYS.each;
  return lvl % 10 === 0 ? Math.max(LEVEL_KEYS.every10, each) : each;
}

/** Ajoute de l'XP (avec le bonus de rattrapage). Renvoie { levels, newSpells, xp, lvlKeys } (lvlKeys = clefs de montée de niveau) */
export function gainXp(hero, amount) {
  const before = hero.level;
  // XP de base (avec le rattrapage), multipliée en plus par le bonus secondaire tant que le perso est sous le niveau plafond
  let raw = amount * xpBonus, gained = 0;
  while (raw > 0.0001 && hero.level < MAX_LEVEL) {
    const mult = hero.level < altBonus.cap ? altBonus.mult : 1;
    const need = Math.max(0, xpForLevel(hero.level) - hero.xp);
    if (raw * mult >= need) { raw -= need / mult; gained += need; hero.xp = 0; hero.level++; }
    else { const g = Math.round(raw * mult); hero.xp += g; gained += g; raw = 0; }
  }
  while (hero.level < MAX_LEVEL && hero.xp >= xpForLevel(hero.level)) { hero.xp -= xpForLevel(hero.level); hero.level++; }   // arrondi
  amount = Math.round(gained);
  if (hero.level >= MAX_LEVEL) hero.xp = 0;
  const newSpells = classSpells(hero.classId).filter(s => s.lvl > before && s.lvl <= hero.level);
  for (const s of newSpells) {
    if (hero.spells.length < MAX_ACTIVE_SPELLS) hero.spells.push(s.id);
  }
  // clefs de montée de niveau : de 1 à 5 par niveau selon le palier, 5 aux niveaux 10, 20, 30…
  let keys = 0;
  for (let l = before + 1; l <= hero.level; l++) keys += levelKeys(l);
  if (keys) hero.keys = (hero.keys || 0) + keys;
  return { levels: hero.level - before, newSpells, xp: amount, lvlKeys: keys };
}

// ------------------------------- Objets --------------------------------
export function itemStats(itemId, rarity) {
  const it = ITEMS[itemId];
  const m = RARITIES[rarity].mult;
  const out = {};
  for (const k in it.stats) out[k] = Math.round(it.stats[k] * m);
  return out;
}

export function equippedItems(hero) {
  const out = {};
  for (const slot of SLOT_ORDER) {
    const uid = hero.equipped[slot];
    const it = uid && hero.inventory.find(i => i.uid === uid);
    if (it) out[slot] = it;
  }
  return out;
}

// ------------------------------- Stats ---------------------------------
export function computeStats(hero) {
  const c = CLASSES[hero.classId];
  const st = {};
  const eq = equippedItems(hero);
  for (const k of STAT_KEYS) {
    st[k] = c.base[k] + c.growth[k] * (hero.level - 1) + (hero.alloc[k] || 0);
  }
  for (const slot in eq) {
    const s = itemStats(eq[slot].itemId, eq[slot].rarity);
    for (const k in s) st[k] += s[k];
  }
  // Bonus de panoplie (en %)
  for (const a of activeSets(hero)) {
    if (!a.bonus) continue;
    for (const k in a.bonus) st[k] *= 1 + a.bonus[k];
  }
  // Affinité du familier : +5 % dans une stat si le héros est de la bonne classe
  const aff = petAffinity(eq.pet && eq.pet.itemId, hero.classId);
  if (aff) st[aff.stat] *= 1 + PET_AFFINITY;
  for (const k of STAT_KEYS) st[k] = Math.round(st[k]);
  return st;
}

/** Affinité d'un familier avec une classe : { cls, stat, on } (on = vrai si la classe correspond) */
export function petAffinity(itemId, classId) {
  const p = itemId && PETS[itemId];
  if (!p) return null;
  return p.aff[0] === classId ? { cls: p.aff[0], stat: p.aff[1] } : null;
}

/** Attaque du familier dans un combat (plus forte selon sa rareté) */
export function petSpell(pet) {
  const p = pet && PETS[pet.itemId];
  if (!p) return null;
  const a = p.atk;
  const boost = 1 + 0.2 * (pet.rarity || 0);
  return {
    id: null, name: a.name, fx: a.fx || (a.kind === 'self' ? 'heal' : 'claw'), petKind: a.kind || 'shot',
    scale: a.scale, mult: a.mult ? a.mult * boost : 0, hits: a.hits, crit: a.crit, lifesteal: a.lifesteal,
    effects: (a.effects || []).map(e => (e.k === 'heal' ? { ...e, pctMax: e.pctMax * boost } : e)),
  };
}

/** Panoplies portées : [{ setId, count, bonus }] (bonus = null si moins de 2 pièces ; sinon le meilleur palier atteint) */
export function activeSets(hero) {
  const eq = equippedItems(hero);
  const counts = {};
  for (const slot in eq) {
    const set = ITEMS[eq[slot].itemId].set;
    if (set) counts[set] = (counts[set] || 0) + 1;
  }
  return Object.entries(counts).map(([setId, count]) => ({
    setId, count,
    bonus: SETS[setId].bonus[[...SET_TIERS].reverse().find(([n]) => count >= n)?.[0]] || null,
  }));
}

export const maxHp = (st, level) => Math.round(60 + st.vit * 8 + level * 4);
export const critChance = (lck) => 0.05 + 0.45 * lck / (lck + 120);
export const dodgeChance = (lck) => 0.03 + 0.25 * lck / (lck + 200);
/** Chances finales (Chance + bonus des objets), toujours plafonnées */
export const finalCrit = (lck, bonus = 0) => Math.min(CRIT_CAP, critChance(lck) + bonus);
export const finalDodge = (lck, bonus = 0) => Math.min(DODGE_CAP, dodgeChance(lck) + bonus);

/** Bonus de critique / d'esquive d'un objet */
export function itemExtras(itemId, rarity) {
  const it = ITEMS[itemId];
  return { crit: it && it.crit ? ITEM_CRIT[rarity] : 0, dodge: it && it.dodge ? ITEM_DODGE[rarity] : 0 };
}
/** Total des bonus de critique / d'esquive de l'équipement porté */
export function gearExtras(hero) {
  const eq = equippedItems(hero);
  const out = { crit: 0, dodge: 0 };
  for (const slot in eq) { const x = itemExtras(eq[slot].itemId, eq[slot].rarity); out.crit += x.crit; out.dodge += x.dodge; }
  return out;
}

export function powerScore(snap) {
  const s = snap.stats;
  return Math.round(snap.maxHp / 6 + s.atk + s.mag + s.def * 1.2 + s.spd * 1.3 + s.lck);
}

/** « Photo » du héros utilisée pour un combat */
export function snapshot(hero) {
  const stats = computeStats(hero);
  const eq = equippedItems(hero);
  const ex = gearExtras(hero);
  return {
    v: 3,                     // version des règles (2 = familiers qui attaquent, 3 = critique/esquive des objets + plafonds)
    critB: ex.crit, dodgeB: ex.dodge,
    name: hero.name,
    classId: hero.classId,
    level: hero.level,
    stats,
    maxHp: maxHp(stats, hero.level),
    spells: hero.spells.filter(id => SPELLS[id] && SPELLS[id].lvl <= hero.level),
    pet: eq.pet ? { itemId: eq.pet.itemId, rarity: eq.pet.rarity } : null,
    hat: eq.hat ? { itemId: eq.hat.itemId, rarity: eq.hat.rarity } : null,
  };
}

// ------------------------------- Combat --------------------------------
const GAUGE = 1000;
const RAGE_START = 40;    // après 40 actions, les dégâts augmentent
const MAX_ACTIONS = 160;

function isSelfOnly(sp) { return !sp.mult; }

/**
 * Combat « en direct » : fight.next() donne l'étape suivante (ou null à la fin).
 * En mode manuel, le joueur (côté 0) ne lance ses sorts que quand on les demande avec fight.queue(id) ;
 * sinon il fait son attaque de base. En automatique, c'est exactement le même calcul que simulate().
 */
export function createFight(A, B, seed, { maxActions = MAX_ACTIONS, timeoutWinner = true, manual = false, demo = null } = {}) {
  // demo = un sort que le héros (côté 0) lance à chaque action, sans recharge (aperçu d'un sort)
  const rng = makeRng(seed);
  const F = [A, B].map((s, i) => ({
    i, s, hp: s.hp ?? s.maxHp, max: s.maxHp, shield: s.shieldLeft || 0, gauge: rng() * 200,
    cds: { ...(s.cdsLeft || {}) }, buffs: [], dots: [], stun: 0, stunImmune: 0, petN: 0,   // cdsLeft / shieldLeft : repris d'un combat précédent (relais, horde)
    pet: (s.v || 0) >= 2 ? petSpell(s.pet) : null,
  }));
  const log = [];
  const out = [];
  let actions = 0;
  let rage = 1;
  let manualMode = manual, queued = null, usedManual = false, ended = false;

  const stat = (f, k) => {
    let pct = 0;
    for (const b of f.buffs) if (b.stat === k) pct += b.pct;
    return Math.max(1, f.s.stats[k] * (1 + pct));
  };
  const power = (f, scale) => scale === 'mix'
    ? (stat(f, 'atk') + stat(f, 'mag')) * 0.9
    : stat(f, scale);

  const summary = () => F.map(f => ({
    hp: f.hp, shield: Math.round(f.shield),
    tags: [
      ...f.buffs.map(b => ({ n: b.name, k: b.pct > 0 ? 'buff' : 'debuff' })),
      ...f.dots.map(d => ({ n: d.name, k: d.kind })),
      ...(f.stun > 0 ? [{ n: 'Étourdi', k: 'stun' }] : []),
    ],
    cd: f.s.spells.map(id => f.cds[id] || 0),
  }));
  const push = (e) => { e.s = summary(); log.push(e); out.push(e); };

  const worth = (sp, f, foe) => {
    if (!isSelfOnly(sp)) return true;
    const effs = sp.effects || [];
    if (effs.some(e => e.k === 'heal')) return f.hp / f.max < 0.6;
    if (effs.some(e => e.k === 'shield')) return f.shield < f.max * 0.05;
    if (effs.some(e => e.k === 'buff')) return !f.buffs.some(b => b.src === sp.id);
    return true;
  };

  const choose = (f, foe) => {
    if (demo && f.i === 0) return SPELLS[demo];
    if (manualMode && f.i === 0) {
      const sp = queued && SPELLS[queued];
      queued = null;
      if (sp && f.s.spells.includes(sp.id) && !((f.cds[sp.id] || 0) > 0)) { usedManual = true; return sp; }
      return { ...(f.s.basic || CLASSES[f.s.classId].basic), id: null };
    }
    for (const id of f.s.spells) {
      const sp = SPELLS[id];
      if (!sp || (f.cds[id] || 0) > 0) continue;
      if (worth(sp, f, foe)) return sp;
    }
    return { ...(f.s.basic || CLASSES[f.s.classId].basic), id: null };
  };

  const perform = (f, foe, sp, pet = false) => {
    const act = { type: 'action', actor: f.i, id: sp.id, name: sp.name, fx: sp.fx, melee: !!sp.melee, selfOnly: isSelfOnly(sp), hits: sp.mult ? (sp.hits || 1) : 0, results: [] };
    if (pet) { act.pet = sp.petKind; act.id = null; }
    const R = act.results;
    let landed = false;

    if (sp.mult) {
      for (let h = 0; h < (sp.hits || 1); h++) {
        if (foe.hp <= 0) break;
        const dodgeP = (foe.s.v || 0) >= 3 ? finalDodge(stat(foe, 'lck'), foe.s.dodgeB || 0) : dodgeChance(stat(foe, 'lck'));
        if (rng() < dodgeP) {
          R.push({ step: h, type: 'dodge', target: foe.i });
          continue;
        }
        let dmg = power(f, sp.scale) * sp.mult;
        const def = stat(foe, 'def') * (1 - (sp.pierce || 0));
        dmg *= 100 / (100 + def);
        dmg *= 0.9 + rng() * 0.2;
        if (sp.execute && foe.hp / foe.max < 0.35) dmg *= 1 + sp.execute;
        const critP = (f.s.v || 0) >= 3 ? finalCrit(stat(f, 'lck'), f.s.critB || 0) : critChance(stat(f, 'lck'));
        const crit = rng() < critP + (sp.crit || 0);
        if (crit) dmg *= 1.6;
        dmg = Math.max(1, Math.round(dmg * rage));
        const absorbed = Math.min(Math.round(foe.shield), dmg);
        foe.shield = Math.max(0, foe.shield - absorbed);
        foe.hp = Math.max(0, foe.hp - (dmg - absorbed));
        landed = true;
        R.push({ step: h, type: 'hit', target: foe.i, dmg, absorbed, crit, hp: foe.hp });
        if (sp.lifesteal) {
          const amount = Math.round(dmg * sp.lifesteal);
          f.hp = Math.min(f.max, f.hp + amount);
          R.push({ step: h, type: 'heal', target: f.i, amount, hp: f.hp });
        }
      }
    }

    const last = Math.max(0, (sp.hits || 1) - 1);
    for (const e of sp.effects || []) {
      const onFoe = e.k === 'dot' || e.k === 'stun' || e.k === 'debuff';
      if (onFoe && (!landed || foe.hp <= 0)) continue;
      if (e.k === 'dot') {
        const dmg = Math.max(1, Math.round(power(f, sp.scale) * e.mult * 100 / (100 + stat(foe, 'def') * 0.5)));
        foe.dots = foe.dots.filter(d => d.kind !== e.kind);
        foe.dots.push({ kind: e.kind, name: e.name, dmg, turns: e.turns });
        R.push({ step: last, type: 'status', target: foe.i, k: e.kind, n: e.name });
      } else if (e.k === 'stun') {
        if (foe.stunImmune <= 0 && rng() < e.chance) {
          foe.stun = 1;
          R.push({ step: last, type: 'status', target: foe.i, k: 'stun', n: 'Étourdi' });
        }
      } else if (e.k === 'debuff') {
        foe.buffs = foe.buffs.filter(b => b.src !== sp.id);
        foe.buffs.push({ stat: e.stat, pct: -e.pct, turns: e.turns, src: sp.id, name: `${STAT_SHORT[e.stat]} −${Math.round(e.pct * 100)}%` });
        R.push({ step: last, type: 'status', target: foe.i, k: 'debuff', n: `${STAT_SHORT[e.stat]} −${Math.round(e.pct * 100)}%` });
      } else if (e.k === 'buff') {
        f.buffs = f.buffs.filter(b => b.src !== sp.id);
        f.buffs.push({ stat: e.stat, pct: e.pct, turns: e.turns + 1, src: sp.id, name: `${STAT_SHORT[e.stat]} +${Math.round(e.pct * 100)}%` });
        R.push({ step: last, type: 'status', target: f.i, k: 'buff', n: `${STAT_SHORT[e.stat]} +${Math.round(e.pct * 100)}%` });
      } else if (e.k === 'heal') {
        const amount = Math.round(e.pctMax ? f.max * e.pctMax : power(f, e.scale) * e.mult);
        f.hp = Math.min(f.max, f.hp + amount);
        R.push({ step: last, type: 'heal', target: f.i, amount, hp: f.hp });
      } else if (e.k === 'shield') {
        const amount = Math.round(power(f, e.scale) * e.mult);
        f.shield = Math.min(f.max * 0.6, f.shield + amount);
        R.push({ step: last, type: 'shield', target: f.i, amount, shield: Math.round(f.shield) });
      }
    }
    if (sp.id && !demo) f.cds[sp.id] = sp.cd;
    push(act);
  };

  let winner = null;
  // Un tour : le plus rapide joue. Renvoie quand le tour est fini (winner est réglé si le combat s'arrête).
  function step() {
    // Jauge de vitesse : le plus rapide joue plus souvent
    let actor = null;
    while (!actor) {
      for (const f of F) f.gauge += stat(f, 'spd') + 60;
      const ready = F.filter(f => f.gauge >= GAUGE).sort((a, b) => b.gauge - a.gauge);
      actor = ready[0] || null;
    }
    actor.gauge -= GAUGE;
    const foe = F[1 - actor.i];
    actions++;

    if (actions === RAGE_START) push({ type: 'rage' });
    if (actions >= RAGE_START && actions % 5 === 0) rage += 0.15;

    // Recharges des sorts
    for (const id in actor.cds) if (actor.cds[id] > 0) actor.cds[id]--;

    // Dégâts sur la durée (brûlure, poison)
    for (const d of actor.dots) {
      const dmg = Math.max(1, Math.round(d.dmg * rage));
      actor.hp = Math.max(0, actor.hp - dmg);
      d.turns--;
      push({ type: 'dot', target: actor.i, k: d.kind, n: d.name, dmg, hp: actor.hp });
      if (actor.hp <= 0) break;
    }
    actor.dots = actor.dots.filter(d => d.turns > 0);
    if (actor.hp <= 0) { winner = foe.i; return; }

    if (actor.stun > 0) {
      actor.stun = 0;
      actor.stunImmune = 2;
      push({ type: 'stunned', target: actor.i });
    } else {
      perform(actor, foe, choose(actor, foe));
      if (foe.hp <= 0) { winner = actor.i; return; }
      // Le familier attaque toutes les PET_EVERY actions de son maître
      if (actor.pet && ++actor.petN % PET_EVERY === 0) {
        perform(actor, foe, actor.pet, true);
        if (foe.hp <= 0) { winner = actor.i; return; }
      }
    }

    // Fin du tour : effets temporaires
    for (const b of actor.buffs) b.turns--;
    actor.buffs = actor.buffs.filter(b => b.turns > 0);
    if (actor.stunImmune > 0) actor.stunImmune--;

    if (actions >= maxActions) {
      // temps écoulé : vainqueur aux PV restants (ou personne, pour un assaut de raid)
      winner = !timeoutWinner ? -1 : F[0].hp / F[0].max >= F[1].hp / F[1].max ? 0 : 1;
    }
  }
  function advance() {
    step();
    if (winner !== null) { push({ type: 'end', winner }); ended = true; }
  }

  return {
    next() { while (!out.length && !ended) advance(); return out.shift() || null; },
    /** Mode manuel : le sort sera lancé à la prochaine action du héros (s'il est prêt) */
    queue(id) { queued = id; },
    get queued() { return queued; },
    setManual(v) { manualMode = v; if (!v) queued = null; },
    get manual() { return manualMode; },
    /** Termine le combat (si besoin) et renvoie { log, winner, usedManual, hp } (hp = PV restants de chacun) */
    result() { while (!ended) advance(); out.length = 0; return { log, winner, usedManual, hp: F.map(f => Math.max(0, Math.round(f.hp))), carry: F.map(f => ({ cdsLeft: { ...f.cds }, shieldLeft: Math.round(f.shield) })) }; },
  };
}

/**
 * Mêlée en équipe (le trône) : les deux équipes (jusqu'à 4 persos chacune) se battent toutes en même temps.
 * Chacun joue selon sa vitesse (même jauge qu'en duel) et frappe un adversaire encore debout, tiré au hasard.
 * Lignes (lines) : l'ordre de l'équipe = ses lignes (1 devant … 4 derrière). Le Guerrier et le Paladin (corps à corps)
 * ne frappent que les lignes 1 et 2 tant qu'il y reste quelqu'un debout ; le Mage et l'Archer frappent toutes les lignes.
 * Mêmes règles qu'un duel : sorts, critiques, esquives, boucliers, brûlures, étourdissements, familiers, rage.
 * Les index des persos vont de 0 à n−1 (l'équipe A d'abord). Événements : ceux d'un duel (avec « target »),
 * plus { type: 'ko', target } quand un perso tombe. L'équipe qui n'a plus personne debout perd.
 */
/** Classes de corps à corps : en mêlée à 4, elles ne frappent que les 2 premières lignes (tant qu'il y a quelqu'un) */
export const MELEE_CLASSES = ['guerrier', 'paladin'];

export function createMelee(A, B, seed, { maxActions = null, lines = true } = {}) {
  const rng = makeRng(seed);
  const F = [...A.map((s, j) => [s, 0, j]), ...B.map((s, j) => [s, 1, j])].map(([s, side, line], i) => ({
    i, side, line, s, hp: s.maxHp, max: s.maxHp, shield: 0, gauge: rng() * 200,
    cds: {}, buffs: [], dots: [], stun: 0, stunImmune: 0, petN: 0,
    pet: (s.v || 0) >= 2 ? petSpell(s.pet) : null,
  }));
  const limit = maxActions ?? Math.round(MAX_ACTIONS * F.length / 2);   // plus de monde = combat plus long
  const rageAt = Math.round(RAGE_START * F.length / 2);
  const log = [], out = [];
  let actions = 0, rage = 1, winner = null, ended = false;

  const stat = (f, k) => {
    let pct = 0;
    for (const b of f.buffs) if (b.stat === k) pct += b.pct;
    return Math.max(1, f.s.stats[k] * (1 + pct));
  };
  const power = (f, scale) => (scale === 'mix' ? (stat(f, 'atk') + stat(f, 'mag')) * 0.9 : stat(f, scale));
  const standing = (side) => F.filter(f => f.side === side && f.hp > 0);
  const summary = () => F.map(f => ({
    hp: f.hp, shield: Math.round(f.shield),
    tags: [
      ...f.buffs.map(b => ({ n: b.name, k: b.pct > 0 ? 'buff' : 'debuff' })),
      ...f.dots.map(d => ({ n: d.name, k: d.kind })),
      ...(f.stun > 0 ? [{ n: 'Étourdi', k: 'stun' }] : []),
    ],
  }));
  const push = (e) => { e.s = summary(); log.push(e); out.push(e); };
  const ko = (f) => push({ type: 'ko', target: f.i, side: f.side });

  const worth = (sp, f) => {
    if (!isSelfOnly(sp)) return true;
    const effs = sp.effects || [];
    if (effs.some(e => e.k === 'heal')) return f.hp / f.max < 0.6;
    if (effs.some(e => e.k === 'shield')) return f.shield < f.max * 0.05;
    if (effs.some(e => e.k === 'buff')) return !f.buffs.some(b => b.src === sp.id);
    return true;
  };
  const choose = (f) => {
    for (const id of f.s.spells) {
      const sp = SPELLS[id];
      if (sp && !((f.cds[id] || 0) > 0) && worth(sp, f)) return sp;
    }
    return { ...(f.s.basic || CLASSES[f.s.classId].basic), id: null };
  };

  const perform = (f, foe, sp, pet = false) => {
    const act = { type: 'action', actor: f.i, target: foe.i, id: sp.id, name: sp.name, fx: sp.fx, melee: !!sp.melee, selfOnly: isSelfOnly(sp), hits: sp.mult ? (sp.hits || 1) : 0, results: [] };
    if (pet) { act.pet = sp.petKind; act.id = null; }
    const R = act.results;
    let landed = false;
    if (sp.mult) {
      for (let h = 0; h < (sp.hits || 1); h++) {
        if (foe.hp <= 0) break;
        const dodgeP = (foe.s.v || 0) >= 3 ? finalDodge(stat(foe, 'lck'), foe.s.dodgeB || 0) : dodgeChance(stat(foe, 'lck'));
        if (rng() < dodgeP) { R.push({ step: h, type: 'dodge', target: foe.i }); continue; }
        let dmg = power(f, sp.scale) * sp.mult;
        dmg *= 100 / (100 + stat(foe, 'def') * (1 - (sp.pierce || 0)));
        dmg *= 0.9 + rng() * 0.2;
        if (sp.execute && foe.hp / foe.max < 0.35) dmg *= 1 + sp.execute;
        const critP = (f.s.v || 0) >= 3 ? finalCrit(stat(f, 'lck'), f.s.critB || 0) : critChance(stat(f, 'lck'));
        const crit = rng() < critP + (sp.crit || 0);
        if (crit) dmg *= 1.6;
        dmg = Math.max(1, Math.round(dmg * rage));
        const absorbed = Math.min(Math.round(foe.shield), dmg);
        foe.shield = Math.max(0, foe.shield - absorbed);
        foe.hp = Math.max(0, foe.hp - (dmg - absorbed));
        landed = true;
        R.push({ step: h, type: 'hit', target: foe.i, dmg, absorbed, crit, hp: foe.hp });
        if (sp.lifesteal) {
          const amount = Math.round(dmg * sp.lifesteal);
          f.hp = Math.min(f.max, f.hp + amount);
          R.push({ step: h, type: 'heal', target: f.i, amount, hp: f.hp });
        }
      }
    }
    const last = Math.max(0, (sp.hits || 1) - 1);
    for (const e of sp.effects || []) {
      const onFoe = e.k === 'dot' || e.k === 'stun' || e.k === 'debuff';
      if (onFoe && (!landed || foe.hp <= 0)) continue;
      if (e.k === 'dot') {
        const dmg = Math.max(1, Math.round(power(f, sp.scale) * e.mult * 100 / (100 + stat(foe, 'def') * 0.5)));
        foe.dots = foe.dots.filter(d => d.kind !== e.kind);
        foe.dots.push({ kind: e.kind, name: e.name, dmg, turns: e.turns });
        R.push({ step: last, type: 'status', target: foe.i, k: e.kind, n: e.name });
      } else if (e.k === 'stun') {
        if (foe.stunImmune <= 0 && rng() < e.chance) { foe.stun = 1; R.push({ step: last, type: 'status', target: foe.i, k: 'stun', n: 'Étourdi' }); }
      } else if (e.k === 'debuff') {
        foe.buffs = foe.buffs.filter(b => b.src !== sp.id);
        foe.buffs.push({ stat: e.stat, pct: -e.pct, turns: e.turns, src: sp.id, name: `${STAT_SHORT[e.stat]} −${Math.round(e.pct * 100)}%` });
        R.push({ step: last, type: 'status', target: foe.i, k: 'debuff', n: `${STAT_SHORT[e.stat]} −${Math.round(e.pct * 100)}%` });
      } else if (e.k === 'buff') {
        f.buffs = f.buffs.filter(b => b.src !== sp.id);
        f.buffs.push({ stat: e.stat, pct: e.pct, turns: e.turns + 1, src: sp.id, name: `${STAT_SHORT[e.stat]} +${Math.round(e.pct * 100)}%` });
        R.push({ step: last, type: 'status', target: f.i, k: 'buff', n: `${STAT_SHORT[e.stat]} +${Math.round(e.pct * 100)}%` });
      } else if (e.k === 'heal') {
        const amount = Math.round(e.pctMax ? f.max * e.pctMax : power(f, e.scale) * e.mult);
        f.hp = Math.min(f.max, f.hp + amount);
        R.push({ step: last, type: 'heal', target: f.i, amount, hp: f.hp });
      } else if (e.k === 'shield') {
        const amount = Math.round(power(f, e.scale) * e.mult);
        f.shield = Math.min(f.max * 0.6, f.shield + amount);
        R.push({ step: last, type: 'shield', target: f.i, amount, shield: Math.round(f.shield) });
      }
    }
    if (sp.id) f.cds[sp.id] = sp.cd;
    push(act);
    if (foe.hp <= 0) ko(foe);
  };

  const wiped = (side) => !standing(side).length;
  function step() {
    let actor = null;
    while (!actor) {
      for (const f of F) if (f.hp > 0) f.gauge += stat(f, 'spd') + 60;
      actor = F.filter(f => f.hp > 0 && f.gauge >= GAUGE).sort((a, b) => b.gauge - a.gauge)[0] || null;
    }
    actor.gauge -= GAUGE;
    actions++;
    if (actions === rageAt) push({ type: 'rage' });
    if (actions >= rageAt && actions % 10 === 0) rage += 0.15;
    for (const id in actor.cds) if (actor.cds[id] > 0) actor.cds[id]--;

    for (const d of actor.dots) {
      const dmg = Math.max(1, Math.round(d.dmg * rage));
      actor.hp = Math.max(0, actor.hp - dmg);
      d.turns--;
      push({ type: 'dot', target: actor.i, k: d.kind, n: d.name, dmg, hp: actor.hp });
      if (actor.hp <= 0) break;
    }
    actor.dots = actor.dots.filter(d => d.turns > 0);
    if (actor.hp <= 0) { ko(actor); if (wiped(actor.side)) winner = 1 - actor.side; return; }

    if (actor.stun > 0) {
      actor.stun = 0;
      actor.stunImmune = 2;
      push({ type: 'stunned', target: actor.i });
    } else {
      let foes = standing(1 - actor.side);
      if (lines && MELEE_CLASSES.includes(actor.s.classId)) {   // corps à corps : d'abord les lignes 1 et 2
        const front = foes.filter(f => f.line < 2);
        if (front.length) foes = front;
      }
      const foe = foes[Math.floor(rng() * foes.length)];   // un adversaire encore debout (à sa portée), au hasard
      perform(actor, foe, choose(actor));
      if (wiped(foe.side)) { winner = actor.side; return; }
      if (actor.pet && ++actor.petN % PET_EVERY === 0) {
        const left = standing(1 - actor.side);
        perform(actor, left[Math.floor(rng() * left.length)], actor.pet, true);
        if (wiped(1 - actor.side)) { winner = actor.side; return; }
      }
    }
    for (const b of actor.buffs) b.turns--;
    actor.buffs = actor.buffs.filter(b => b.turns > 0);
    if (actor.stunImmune > 0) actor.stunImmune--;
    if (actions >= limit) {
      // temps écoulé : l'équipe qui a gardé le plus de PV (en part de ses PV max) gagne
      const left = (side) => F.filter(f => f.side === side).reduce((t, f) => t + f.hp / f.max, 0);
      winner = left(0) >= left(1) ? 0 : 1;
    }
  }
  function advance() {
    step();
    if (winner !== null) { push({ type: 'end', winner }); ended = true; }
  }
  return {
    next() { while (!out.length && !ended) advance(); return out.shift() || null; },
    queue() {}, get queued() { return null; }, setManual() {}, get manual() { return false; },
    result() { while (!ended) advance(); out.length = 0; return { log, winner, hp: F.map(f => Math.max(0, Math.round(f.hp))) }; },
  };
}

// ------------------------------ Combat auto ------------------------------
// g = palier global (1 à 1000) : difficulté = g / 100 (arrondi au-dessus), palier dans la difficulté = 1 à 100.
export const autoDiff = (g) => Math.ceil(g / AUTO.paliers);
export const autoPalier = (g) => ((g - 1) % AUTO.paliers) + 1;
export const AUTO_LAST = AUTO.diffs * AUTO.paliers;
export function autoState(acc) {
  acc.auto ||= { v: 2, g: 1, n: 0, best: 1, paid: 0, last: Date.now(), bank: { chests: 0 } };
  const st = acc.auto;
  delete st.bank.keys;   // le combat auto ne donne plus de clefs (seulement des coffres)
  if (st.v !== 2) {
    // nouvelle difficulté : tout le monde repart du palier 1, sans regagner les coffres déjà gagnés
    st.paid = Math.max(st.paid || 0, Math.floor((Math.min(st.best, AUTO_LAST + 1) - 1) / 10) * 10);
    st.g = 1; st.best = 1; st.v = 2;
  }
  return st;
}
/** Puissance d'équipe qu'il faut pour passer le palier g (montée régulière entre les repères de AUTO.need) */
export function autoNeed(g) {
  const N = AUTO.need;
  let i = 1;
  while (i < N.length - 1 && g > N[i][0]) i++;
  const [g0, p0] = N[i - 1], [g1, p1] = N[i];
  const t = Math.max(0, Math.min(1, (g - g0) / (g1 - g0)));
  return p0 * Math.pow(p1 / p0, t);
}
/** Les monstres d'un palier : 4 monstres, ou un boss et 2 sbires tous les 10 paliers. Leur force suit la puissance demandée. */
export function autoMonsters(g) {
  const pool = DUNGEONS.flatMap(dungeonFoes);
  const f = autoNeed(g) * AUTO.monsterK;
  const boss = g % 10 === 0;
  return (boss ? [0, 1, 2] : [0, 1, 2, 3]).map(j => {
    const m = buildMonster({ ...pool[(g * 7 + j * 11) % pool.length], lvl: 50 });
    const k = f * (boss && j === 0 ? AUTO.boss.power : 1);
    for (const q in m.stats) m.stats[q] = Math.max(1, Math.round(m.stats[q] * k));
    m.maxHp = Math.max(10, Math.round(m.maxHp * f * (boss && j === 0 ? AUTO.boss.hp : boss ? 0.8 : 1)));
    m.level = Math.max(1, Math.round(g / 10));
    if (boss && j === 0) m.boss = true;
    return m;
  });
}
/** Graine du n-ième combat auto d'un compte (le même combat est montré à l'écran et compté) */
export const autoSeed = (acc, n) => hashStr(`auto:${acc.pseudo}:${n}`);
/**
 * Joue le combat du palier en cours. Victoire : palier suivant (et tous les 10 paliers, 1 coffre normal en réserve).
 * Défaite : retour au premier palier de la dizaine (perdu au 37 → 31, donc jamais deux fois la même récompense).
 */
export function autoResolve(acc, team) {
  const st = autoState(acc);
  const g = st.g;
  const won = !!team.length && createMelee(team, autoMonsters(g), autoSeed(acc, st.n)).result().winner === 0;
  st.n++;
  let reward = false;
  if (won) {
    st.bank.wins = (st.bank.wins || 0) + 1;   // pour l'XP
    if (g % 10 === 0 && g > (st.paid || 0)) { st.bank.chests++; st.paid = g; reward = true; }   // jamais deux fois le même coffre
    st.g = Math.min(AUTO_LAST + 1, g + 1);   // AUTO_LAST + 1 = tout est fini
  } else {
    st.g = Math.floor((g - 1) / 10) * 10 + 1;
  }
  st.best = Math.max(st.best, Math.min(st.g, AUTO_LAST));
  return { g, won, reward };
}
/** Combats auto en retard (jeu fermé ou en arrière-plan) : 8 h au maximum, et au plus « max » combats d'un coup */
export function autoCatchUp(acc, team, max = 40, now = Date.now()) {
  const st = autoState(acc);
  if (st.g > AUTO_LAST) { st.last = now; return []; }
  if (now - st.last > AUTO.offlineMaxMs) st.last = now - AUTO.offlineMaxMs;
  const out = [];
  while (now - st.last >= AUTO.palierMs && out.length < max && st.g <= AUTO_LAST) {
    out.push(autoResolve(acc, team));
    st.last += AUTO.palierMs;
  }
  return out;
}
/** XP en réserve (en part d'un niveau du perso), limitée par le plafond du jour */
export function autoXpFrac(acc) {
  const st = autoState(acc), day = dayKey();
  const used = st.xpDay && st.xpDay.day === day ? st.xpDay.frac : 0;
  return Math.max(0, Math.min((st.bank.wins || 0) * AUTO.xpPerWin, AUTO.xpDayCap - used));
}
/** Récupère la réserve : les coffres normaux vont au perso actif (dans son stock de coffres à ouvrir), l'XP aussi */
export function autoClaim(acc, hero) {
  const st = autoState(acc), b = st.bank, day = dayKey();
  const got = b.chests;
  refreshChests(hero);
  hero.chest.stored += got;
  b.chests = 0;
  const frac = autoXpFrac(acc);
  let xp = 0, lv = null;
  if (frac > 0 && hero.level < MAX_LEVEL) {
    xp = Math.max(1, Math.round(xpForLevel(hero.level) * frac));
    st.xpDay = { day, frac: (st.xpDay && st.xpDay.day === day ? st.xpDay.frac : 0) + frac };
    lv = gainXp(hero, xp);
  }
  b.wins = 0;
  return { chests: got, xp, lv };
}

// ------------------------------ Le trône ------------------------------
/** La semaine du trône commence le lundi à 0 h : renvoie la date de ce lundi (« 2026-10-19 ») */
export function throneWeek(d = new Date()) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return dayKey(m);
}
/** Début (en ms) de la semaine du trône, et de la suivante */
export function throneWeekStart(d = new Date()) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m.getTime();
}
export const msToNextThroneWeek = (d = new Date()) => { const n = new Date(throneWeekStart(d)); n.setDate(n.getDate() + 7); return n - d; };
/**
 * Classement du trône : l'ordre de départ de la semaine (par puissance), puis chaque victoire contre quelqu'un
 * au-dessus échange les deux places. ids = tous les joueurs actuels, du plus puissant au moins puissant
 * (ceux qui n'étaient pas là au début de la semaine arrivent en bas).
 */
export function throneRanking(startOrder, fights, ids) {
  const known = new Set(ids);
  const order = (startOrder || []).filter(id => known.has(id));
  for (const id of ids) if (!order.includes(id)) order.push(id);
  for (const f of fights) {
    if (f.winner !== 0) continue;
    const a = order.indexOf(f.attacker_id), d = order.indexOf(f.defender_id);
    if (a > d && d >= 0) { order[a] = f.defender_id; order[d] = f.attacker_id; }
  }
  return order;
}
/** Les manches du trône : tous les THRONE.days jours à 0 h, depuis THRONE.start. Clé (« 2026-10-19 ») et début de la manche */
function throneStartOf(d = new Date()) {
  const s = new Date(THRONE.start[0], THRONE.start[1], THRONE.start[2]);
  const m = new Date(d); m.setHours(0, 0, 0, 0);
  const days = Math.round((m - s) / 86400000);   // arrondi : les changements d'heure ne décalent rien
  s.setDate(s.getDate() + Math.floor(days / THRONE.days) * THRONE.days);
  return s;
}
export const throneRound = (d = new Date()) => dayKey(throneStartOf(d));
export const throneRoundStart = (d = new Date()) => throneStartOf(d).getTime();
export const msToNextThrone = (d = new Date()) => { const n = throneStartOf(d); n.setDate(n.getDate() + THRONE.days); return n - d; };
/** Flouze de fin de manche selon la place (0 = le roi) */
export const throneFlouze = (rank) => (rank < THRONE.flouze.length ? THRONE.flouze[rank] : THRONE.flouzeRest);
/** Donne le Flouze de la manche finie (une seule fois) */
export function claimThrone(acc, round, rank) {
  acc.throne ||= { claimed: {} };
  if (acc.throne.claimed[round] !== undefined) return 0;
  const n = throneFlouze(rank);
  acc.throne.claimed[round] = rank;
  acc.clat += n;
  return n;
}

/** XP d'un assaut de raid (à chaque assaut, selon le niveau du perso) */
// le raid (gros boss) ne donne plus d'XP : il rapporte des coffres et du Flouze quand le boss tombe

// ------------------------------ PvP en relais ------------------------------
export { PVP };
/**
 * Combat en relais : les persos de chaque équipe entrent l'un après l'autre. Quand un perso tombe, le suivant
 * de son équipe arrive aussitôt ; le gagnant du duel garde ses PV. L'équipe qui n'a plus personne perd.
 * Événements en plus : { type: 'kill', target, score } puis { type: 'nextFoe', side, foe, score }.
 */
export function createRelay(teamA, teamB, seed) {
  const T = [teamA, teamB], idx = [0, 0], log = [], pending = [];
  let hp = [teamA[0].maxHp, teamB[0].maxHp], carry = [{}, {}], done = false, winner = null, n = 0;
  const alive = () => [T[0].length - idx[0], T[1].length - idx[1]];
  const start = () => createFight({ ...T[0][idx[0]], hp: hp[0], ...carry[0] }, { ...T[1][idx[1]], hp: hp[1], ...carry[1] }, seed + n * 101, {});
  let cur = start();
  const pull = () => {
    if (pending.length) return pending.shift();
    if (done) return null;
    const e = cur.next();
    if (!e) return null;
    if (e.type !== 'end') return e;
    const r = cur.result();
    const w = e.winner === 0 ? 0 : 1, l = 1 - w;
    idx[l]++;
    if (idx[l] >= T[l].length) { done = true; winner = w; return { ...e, winner: w, score: alive() }; }
    // aucun soin : le gagnant garde ses PV, ses recharges de sorts et son bouclier ; le nouvel arrivant entre frais
    hp[w] = Math.max(1, r.hp[w]); carry[w] = r.carry[w];
    hp[l] = T[l][idx[l]].maxHp; carry[l] = {};
    n++;
    cur = start();
    pending.push({ type: 'nextFoe', side: l, foe: T[l][idx[l]], score: alive() });
    return { type: 'kill', target: l, label: 'K.O.', score: alive(), s: e.s };
  };
  const api = {
    next() { const e = pull(); if (e) log.push(e); return e; },
    result() { while (api.next()); return { log, winner, score: alive() }; },
  };
  return api;
}
export const simulateRelay = (teamA, teamB, seed) => createRelay(teamA, teamB, seed).result();

/** Gain d'un match PvP gagné (10 Flouze, 5 fois par jour maximum). Renvoie le Flouze gagné. */
export function pvpReward(acc, matchId) {
  const day = dayKey();
  if (!acc.pvp || acc.pvp.day !== day) acc.pvp = { day, rewarded: 0, claimed: (acc.pvp && acc.pvp.claimed) || {} };
  if (acc.pvp.claimed[matchId]) return 0;
  acc.pvp.claimed[matchId] = true;
  if (acc.pvp.rewarded >= PVP.rewardsPerDay) return 0;
  acc.pvp.rewarded++;
  acc.clat += PVP.reward;
  return PVP.reward;
}
export const pvpRewardsLeft = (acc) => (acc.pvp && acc.pvp.day === dayKey() ? Math.max(0, PVP.rewardsPerDay - acc.pvp.rewarded) : PVP.rewardsPerDay);

// ------------------------------ Championnat ------------------------------
export { CHAMP };
/** Heure (ms) du tour r (0 = quarts, 1 = demies, 2 = finale) de la semaine qui commence le lundi weekStart (ms) */
export function champRoundAt(weekStart, r) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + CHAMP.days[r]);
  d.setHours(CHAMP.hour, CHAMP.minute, 0, 0);
  return d.getTime();
}
/** Tableau de départ : les joueurs tirés au hasard (graine = la semaine) sur 8 places ; null = place vide (l'adversaire passe) */
export function champSlots(ids, week) {
  const rng = makeRng(hashStr('champ:' + week)), list = ids.slice(0, CHAMP.size);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  // un joueur par match d'abord, puis les deuxièmes : les places vides tombent toujours face à quelqu'un
  const order = [0, 2, 4, 6, 1, 3, 5, 7], slots = Array(CHAMP.size).fill(null);
  list.forEach((id, k) => { slots[order[k]] = id; });
  return slots;
}
export const champSeed = (week, r, m) => hashStr(`champ:${week}:${r}:${m}`);
/** Un match en 3 manches (2 manches gagnées suffisent) entre deux équipes ; renvoie les manches et le vainqueur (0 ou 1) */
export function champMatch(teamA, teamB, seed) {
  const games = [], wins = [0, 0];
  for (let g = 0; g < CHAMP.bestOf && wins[0] < 2 && wins[1] < 2; g++) {
    const s = (seed + g * 7919) | 0, w = simulateRelay(teamA, teamB, s).winner === 1 ? 1 : 0;
    games.push({ seed: s, winner: w });
    wins[w]++;
  }
  return { games, wins, winner: wins[0] > wins[1] ? 0 : 1 };
}
/**
 * Le tableau complet : rounds[r][m] = { a, b, winner } (ids ; winner = undefined tant que le match n'est pas joué).
 * res = { 'r-m': id du gagnant } pour les matchs joués. Une place vide fait passer l'autre directement.
 */
export function champTree(slots, res = {}) {
  const rounds = [];
  let entrants = slots;
  for (let r = 0; r < CHAMP.days.length; r++) {
    const ms = [];
    for (let m = 0; m < entrants.length / 2; m++) {
      const a = entrants[2 * m], b = entrants[2 * m + 1];
      let winner;
      if (a === undefined || b === undefined) winner = undefined;          // on attend le tour d'avant
      else if (a === null || b === null) winner = a ?? b;                  // place vide : l'autre passe (null si les deux sont vides)
      else winner = res[`${r}-${m}`];
      ms.push({ a, b, winner, bye: a === null || b === null });
    }
    rounds.push(ms);
    entrants = ms.map(x => x.winner);
  }
  return rounds;
}
/** Place finale d'un joueur : 'win' (champion), 'second' (finaliste), 'other' (participant) ; null si pas fini ou absent */
export function champPlace(tree, id) {
  const fin = tree[tree.length - 1][0];
  if (fin.winner === undefined || !tree[0].some(m => m.a === id || m.b === id)) return null;
  if (fin.winner === id) return 'win';
  if (fin.a === id || fin.b === id) return 'second';
  return 'other';
}
/** Récompense (PVP = du Flouze) : 100 au champion, 50 au finaliste, 25 aux autres */
export function champReward(acc, hero, place) {
  const n = CHAMP.flouze[place] || 0;
  acc.clat += n;
  return n;
}

// ------------------------------ La Horde ------------------------------
export { HORDE };
/** Le n-ième monstre de la horde (n = 0, 1, 2…) : de plus en plus fort, jamais deux fois de suite le même */
export function hordeMonster(seed, n) {
  const pool = DUNGEONS.flatMap(dungeonFoes);
  const rng = makeRng(seed * 31 + n * 7919);
  let src = pool[Math.floor(rng() * pool.length)];
  if (n > 0) {
    const prev = pool[Math.floor(makeRng(seed * 31 + (n - 1) * 7919)() * pool.length)];
    if (src.sprite === prev.sprite) src = pool[(pool.indexOf(src) + 1) % pool.length];
  }
  // au-delà du niveau 100, les monstres gardent leurs stats de niveau 100 et prennent +8 % par monstre
  const lvl = 1 + HORDE.step * n, over = Math.max(0, lvl - 100) / HORDE.step, boost = Math.pow(1.08, over);
  const m = buildMonster({ ...src, lvl: Math.min(lvl, 100) });
  m.level = lvl;
  for (const k in m.stats) m.stats[k] = Math.max(1, Math.round(m.stats[k] * HORDE.power * boost));
  m.maxHp = Math.max(10, Math.round(m.maxHp * HORDE.hp * boost));
  m.hordeN = n + 1;
  return m;
}
/** Flouze gagné selon le nombre de monstres battus */
/** Clefs gagnées selon les monstres battus (voir HORDE.keys) */
export const hordeKeys = (kills) => (HORDE.keys.find(([k]) => kills >= k) || [0, 0])[1];

/**
 * Combat de la horde : même interface qu'un combat normal (next, queue, manual, result),
 * mais quand le monstre tombe, le suivant arrive aussitôt. Le héros garde ses PV (aucun soin).
 * Événements en plus : { type: 'kill', n } puis { type: 'nextFoe', foe, n }.
 */
export function createHorde(A, seed, { manual = false } = {}) {
  let n = 0, kills = 0, hp = A.maxHp, done = false, usedManual = false, manualMode = manual;
  const pending = [], log = [];
  let cur = createFight({ ...A, hp }, hordeMonster(seed, 0), seed, { manual: manualMode });
  const pull = () => {
    if (pending.length) return pending.shift();
    if (done) return null;
    const e = cur.next();
    if (!e) return null;
    if (e.type !== 'end') return e;
    const r = cur.result();
    if (r.usedManual) usedManual = true;
    if (e.winner !== 0) { done = true; return { ...e, winner: 1, kills }; }
    // monstre vaincu : le suivant arrive tout de suite, le héros garde ses PV
    kills++;
    hp = Math.max(1, r.hp[0]);
    n++;
    const foe = hordeMonster(seed, n);
    const q = cur.queued;
    cur = createFight({ ...A, hp, ...r.carry[0] }, foe, seed + n * 101, { manual: manualMode });   // aucun soin : PV, recharges et bouclier gardés
    if (q) cur.queue(q);
    pending.push({ type: 'nextFoe', foe, n: n + 1, kills });
    return { type: 'kill', kills, keys: hordeKeys(kills), s: e.s };
  };
  const api = {
    next() { const e = pull(); if (e) log.push(e); return e; },
    queue(id) { cur.queue(id); },
    get queued() { return cur.queued; },
    setManual(v) { manualMode = v; cur.setManual(v); },
    get manual() { return manualMode; },
    result() { while (api.next()); return { log, winner: 1, kills, usedManual }; },
  };
  return api;
}
/** Record de la horde (par compte) */
export function hordeState(acc) {
  acc.horde ||= { best: 0 };
  return acc.horde;
}
// ------------------------------ Charges (recharge une par une) ------------------------------
// st = { n: charges en réserve, t: début du chrono de la prochaine charge }. Pleine réserve : le chrono attend
// (il démarre quand on utilise une charge). Toutes les RECHARGE.ms, une charge revient, jusqu'au maximum.
export function charge(st, max = RECHARGE.max, now = Date.now()) {
  if (typeof st.n !== 'number' || !(st.t > 0)) { st.n = max; st.t = now; }
  if (st.n >= max) { st.n = max; st.t = now; return st; }
  const k = Math.floor((now - st.t) / RECHARGE.ms);
  if (k > 0) { st.n = Math.min(max, st.n + k); st.t = st.n >= max ? now : st.t + k * RECHARGE.ms; }
  return st;
}
/** Utilise une charge (false s'il n'y en a plus) */
export function useCharge(st, max = RECHARGE.max, now = Date.now()) {
  charge(st, max, now);
  if (st.n <= 0) return false;
  st.n--;
  return true;
}
/** Temps avant la prochaine charge (0 si la réserve est pleine) */
export function chargeIn(st, max = RECHARGE.max, now = Date.now()) {
  charge(st, max, now);
  return st.n >= max ? 0 : Math.max(0, st.t + RECHARGE.ms - now);
}

/** Charges de la horde : par personnage */
export function hordeRuns(hero) {
  if (!hero.horde || hero.horde.half !== undefined) hero.horde = {};
  return charge(hero.horde, HORDE.runsPerHalf);
}
export const hordeRunsLeft = (hero) => hordeRuns(hero).n;
export const useHordeRun = (hero) => { hordeRuns(hero); return useCharge(hero.horde, HORDE.runsPerHalf); };
export const hordeNextIn = (hero) => { hordeRuns(hero); return chargeIn(hero.horde, HORDE.runsPerHalf); };
/** Fin d'un essai : clefs (pour le perso qui a joué) selon les monstres battus, et record du compte */
export function hordeResult(acc, kills, hero = null) {
  const st = hordeState(acc);
  const keys = hordeKeys(kills);
  const kh = hero || activeHero(acc);
  kh.keys = (kh.keys || 0) + keys;
  const record = kills > (st.best || 0);
  if (record) st.best = kills;
  // XP à chaque essai : plus tu bats de monstres, plus tu en gagnes
  const lv = hero ? gainXp(hero, Math.round((25 + 5 * hero.level) * (0.4 + 0.1 * kills))) : { levels: 0, newSpells: [], xp: 0, lvlKeys: 0 };
  return { keys, record, ...lv };
}

/**
 * Simule un combat complet. Renvoie { log, winner }.
 * Le log est rejoué ensuite par l'écran de combat avec les animations.
 */
export function simulate(A, B, seed, opts = {}) {
  return createFight(A, B, seed, opts).result();
}


const STAT_SHORT = { vit: 'VIE', atk: 'ATQ', mag: 'MAG', def: 'DÉF', spd: 'VIT', lck: 'CHA' };

// ------------------------------- Coffres -------------------------------
/** Recharge un stock (coffres, entrées de donjon) selon le temps écoulé. */
function refreshStock(c, interval, max, now = Date.now()) {
  if (c.stored >= max) { c.last = now; return; }
  const gained = Math.floor((now - c.last) / interval);
  if (gained > 0) {
    c.stored = Math.min(max, c.stored + gained);
    c.last = c.stored >= max ? now : c.last + gained * interval;
  }
}
function nextIn(c, interval, max, now = Date.now()) {
  if (c.stored >= max) return 0;
  return Math.max(0, c.last + interval - now);
}
export const refreshChests = (hero, now) => refreshStock(hero.chest, CHEST_INTERVAL_MS, CHEST_MAX, now);
export const nextChestIn = (hero, now) => nextIn(hero.chest, CHEST_INTERVAL_MS, CHEST_MAX, now);

// ------------------------------ Demi-journées --------------------------
// Beaucoup de compteurs repartent à zéro à minuit et à midi.
export const halfKey = (d = new Date()) => dayKey(d) + (d.getHours() < 12 ? 'm' : 's');
export function msToNextHalf(d = new Date()) {
  const n = new Date(d);
  if (d.getHours() < 12) n.setHours(12, 0, 0, 0); else n.setHours(24, 0, 0, 0);
  return n - d;
}

export function rollItem(rng, kind) {
  const odds = Array.isArray(kind) ? kind : CHEST_ODDS[kind];
  const rarity = pickWeighted(rng, odds);
  const item = ITEM_LIST[Math.floor(rng() * ITEM_LIST.length)];
  return { itemId: item.id, rarity };
}

export function addItem(hero, itemId, rarity) {
  const it = { uid: `i${hero.nextUid++}`, itemId, rarity };
  hero.inventory.push(it);
  return it;
}

/** Chances de rareté d'un coffre pour ce compte, avec le bonus des coffres déjà ouverts */
export function chestOdds(acc, kind) {
  const odds = CHEST_ODDS[kind].slice();
  if (!CHEST_LUCK.step[kind]) return odds;   // coffres Épique et Légendaire : pas de bonus de chance
  const steps = Math.floor(((acc.chestCount || {})[kind] || 0) / CHEST_LUCK.step[kind]);
  const src = odds[0] > 0 ? 0 : 1, g = CHEST_LUCK.gain;
  for (let s = 0; s < steps; s++) {
    if (odds[src] - g * 3 + (src ? g : 0) < CHEST_LUCK.floor) break;
    odds[src] -= g * 3; odds[1] += g; odds[2] += g; odds[3] += g;
  }
  return odds;
}
/** Compteur d'ouvertures d'un coffre : total, bonus actuel (points par rareté), coffres avant le prochain bonus */
export function chestLuck(acc, kind) {
  const count = (acc.chestCount || {})[kind] || 0, step = CHEST_LUCK.step[kind];
  const bonus = chestOdds(acc, kind)[3] - CHEST_ODDS[kind][3];
  const maxed = chestOdds({ chestCount: { [kind]: count + step } }, kind)[3] === chestOdds(acc, kind)[3];
  return { count, bonus, step, next: maxed ? 0 : step - (count % step) };
}

/**
 * Ouvre un coffre. kind = 'normal' | 'combat' | 'war'.
 * Les coffres « normaux » se rechargent pour chaque personnage ; les coffres de combat
 * et de guerre sont gagnés par le compte. Les objets vont toujours au perso actif.
 */
export function openChest(acc, hero, kind, rng = Math.random) {
  let key = false;
  if (kind === 'normal') {
    refreshChests(hero);
    if (hero.chest.stored > 0) {
      if (hero.chest.stored >= CHEST_MAX) hero.chest.last = Date.now();
      hero.chest.stored--;
    } else if (hero.keys > 0) {
      hero.keys--;          // plus de coffre en stock : on utilise une clef
      key = true;
    } else return null;
  } else if (kind === 'epic' || kind === 'legendary') {
    const k = kind + 'Chests';
    if (!(acc[k] > 0)) return null;
    acc[k]--;
  } else if (kind === 'war') {
    if (acc.warChests <= 0) return null;
    acc.warChests--;
  } else {
    if (acc.combatChests <= 0) return null;
    acc.combatChests--;
  }
  const n = kind === 'war' ? WAR.warChestItems : kind === 'combat' ? 2 : 1;
  const items = [];
  const odds = chestOdds(acc, kind);
  if (!acc.chestCount) acc.chestCount = { normal: 0, combat: 0, war: 0 };
  acc.chestCount[kind] = (acc.chestCount[kind] || 0) + 1;
  for (let i = 0; i < n; i++) {
    const r = rollItem(rng, odds);
    items.push(addItem(hero, r.itemId, r.rarity));
  }
  const xp = { war: 120, combat: 60, epic: 150, legendary: 250 }[kind] || 20;
  const lv = gainXp(hero, xp);
  return { items, xp, key, ...lv };
}

/** Coffres normaux qu'on peut ouvrir tout de suite : le stock + les clefs */
export const openableChests = (hero) => hero.chest.stored + (hero.keys || 0);

/** Ouvre les coffres normaux d'un coup (stock + clefs), 10 au maximum */
export function openAllChests(acc, hero, rng = Math.random) {
  const out = { items: [], xp: 0, levels: 0, newSpells: [], keys: 0, lvlKeys: 0, count: 0 };
  let r;
  while (out.count < OPEN_MAX && (r = openChest(acc, hero, 'normal', rng))) {
    out.items.push(...r.items);
    out.xp += r.xp; out.levels += r.levels; out.newSpells.push(...r.newSpells); out.lvlKeys += r.lvlKeys || 0;
    if (r.key) out.keys++;
    out.count++;
  }
  return out.count ? out : null;
}

/** Achète une clef (pour le perso actif) */
export function buyKey(acc, hero) {
  if (acc.clat < KEY_PRICE) return false;
  acc.clat -= KEY_PRICE;
  hero.keys = (hero.keys || 0) + 1;
  return true;
}

/** Vend des objets (jamais celui qui est équipé). Renvoie le Flouze gagné. */
export function sellItems(acc, hero, itemId, rarity, count = 1) {
  const eqUids = new Set(Object.values(hero.equipped));
  const spare = hero.inventory.filter(i => i.itemId === itemId && i.rarity === rarity && !eqUids.has(i.uid)).slice(0, count);
  if (!spare.length) return 0;
  hero.inventory = hero.inventory.filter(i => !spare.includes(i));
  const gain = spare.length * SELL_PRICE[rarity];
  acc.clat += gain;
  return { gain, n: spare.length };
}

// ------------------------------ Enchères ------------------------------
/** Fin d'une enchère (24 h après sa mise en vente) */
export const aucEnd = (a) => new Date(a.created_at).getTime() + AUCTION.hours * 3600e3;
/** Meilleure offre d'une enchère (à égalité, la première arrivée) */
export function aucTop(bids, auctionId) {
  let t = null;
  for (const b of bids) if (b.auction_id === auctionId && (!t || b.amount > t.amount || (b.amount === t.amount && b.id < t.id))) t = b;
  return t;
}
/** Offre minimum pour passer devant : le prix de départ, ou la meilleure offre + 5 % (1 Flouze au moins) */
export const aucNext = (a, top) => top ? top.amount + Math.max(1, Math.ceil(top.amount * AUCTION.step)) : a.min_price;
/** Objets qu'on peut mettre en vente : ceux du sac, sauf ceux qui sont équipés */
export function aucSellable(hero) {
  const eq = new Set(Object.values(hero.equipped));
  return hero.inventory.filter(i => !eq.has(i.uid));
}
/**
 * Règle ce qui revient à ce compte : Flouze des mises dépassées, Flouze d'un objet vendu, objet gagné,
 * objet pas vendu rendu au vendeur. Chaque chose n'est réglée qu'une fois (acc.auc). Renvoie ce qui s'est passé.
 */
export function aucSettle(acc, me, auctions, bids, now = Date.now()) {
  if (!acc.auc) acc.auc = { done: [], back: [] };
  const done = new Set(acc.auc.done), back = new Set(acc.auc.back), out = [];
  for (const a of auctions) {
    if (!ITEMS[a.item_id]) continue;
    const top = aucTop(bids, a.id);
    for (const b of bids) {
      if (b.auction_id !== a.id || b.user_id !== me || b === top || back.has(b.id)) continue;
      acc.clat += b.amount; back.add(b.id);
      out.push({ type: 'back', a, b });
    }
    if (now < aucEnd(a) || done.has(a.id)) continue;
    if (a.seller_id === me) {
      if (top) { acc.clat += top.amount; out.push({ type: 'sold', a, top }); }
      else { addItem(acc.heroes.find(h => h.id === a.hero_id) || activeHero(acc), a.item_id, a.rarity); out.push({ type: 'unsold', a }); }
      done.add(a.id);
    } else if (top && top.user_id === me) {
      addItem(activeHero(acc), a.item_id, a.rarity);
      out.push({ type: 'won', a, top });
      done.add(a.id);
    }
  }
  acc.auc.done = [...done].slice(-300);
  acc.auc.back = [...back].slice(-600);
  return out;
}

/** Replacer ses points : payant */
export function resetStats(acc, hero) {
  if (acc.clat < STAT_RESET_COST) return false;
  acc.clat -= STAT_RESET_COST;
  hero.alloc = {};
  return true;
}

// ------------------------------- Fusion --------------------------------
export function stackOf(hero, itemId, rarity) {
  return hero.inventory.filter(i => i.itemId === itemId && i.rarity === rarity);
}

/** Fusionne 2 objets identiques en 1 de rareté supérieure. */
/** Exemplaires identiques qu'il faut pour fusionner un objet de cette rareté (2, ou 3 pour passer de Mythique à Chaotique) */
export const fuseNeed = (rarity) => FUSE_NEED[rarity] || 2;

export function fuse(hero, itemId, rarity) {
  if (rarity >= RARITIES.length - 1) return null;
  const need = fuseNeed(rarity);
  const stack = stackOf(hero, itemId, rarity);
  if (stack.length < need) return null;
  // On consomme en priorité les objets non équipés
  const equippedUids = new Set(Object.values(hero.equipped));
  stack.sort((a, b) => (equippedUids.has(a.uid) ? 1 : 0) - (equippedUids.has(b.uid) ? 1 : 0));
  const used = stack.slice(0, need);
  const wasEquipped = used.some(u => equippedUids.has(u.uid));
  hero.inventory = hero.inventory.filter(i => !used.includes(i));
  const res = addItem(hero, itemId, rarity + 1);
  const slot = ITEMS[itemId].slot;
  if (wasEquipped) hero.equipped[slot] = res.uid;
  return res;
}

/**
 * Fusionne tout ce qui peut l'être, en chaîne : on part des Communs, et les objets créés peuvent à leur tour
 * être fusionnés (2 Communs → 1 Peu commun, et s'il y en avait déjà un → 1 Rare…).
 * Renvoie { fusions, made } : le nombre de fusions et les objets obtenus à la fin (ceux qui n'ont pas été refusionnés).
 */
/**
 * Meilleur équipement : pour chaque emplacement, l'objet qui donne le plus de puissance au héros.
 * Plusieurs passes, pour profiter des bonus de panoplie (2, 3 ou 5 pièces). Renvoie { equipped, gain }.
 */
export function bestGear(hero) {
  const power = (eq) => powerScore(snapshot({ ...hero, equipped: eq }));
  const bySlot = {}, seen = new Set();
  for (const it of hero.inventory) {   // un exemplaire par objet et rareté suffit
    const k = it.itemId + ':' + it.rarity;
    if (seen.has(k) || !ITEMS[it.itemId]) continue;
    seen.add(k);
    (bySlot[ITEMS[it.itemId].slot] ||= []).push(it);
  }
  // on n'essaie que les plus rares de chaque emplacement (3 raretés en dessous, un objet ne peut plus gagner) : beaucoup plus rapide
  for (const slot in bySlot) {
    const top = Math.max(...bySlot[slot].map(i => i.rarity));
    bySlot[slot] = bySlot[slot].filter(i => i.rarity >= top - 2).sort((a, b) => b.rarity - a.rarity).slice(0, 16);
  }
  const start = power(hero.equipped);
  let eq = { ...hero.equipped }, best = start;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const slot of SLOT_ORDER) for (const it of bySlot[slot] || []) {
      if (eq[slot] === it.uid) continue;
      const tryEq = { ...eq, [slot]: it.uid }, p = power(tryEq);
      if (p > best) { best = p; eq = tryEq; changed = true; }
    }
    if (!changed) break;
  }
  return { equipped: eq, gain: best - start };
}

export function fuseAll(hero) {
  const created = [];
  for (let r = 0; r < RARITIES.length - 1; r++) {
    const ids = [...new Set(hero.inventory.filter(i => i.rarity === r).map(i => i.itemId))];
    for (const itemId of ids) while (stackOf(hero, itemId, r).length >= fuseNeed(r)) created.push(fuse(hero, itemId, r));
  }
  const left = new Set(hero.inventory.map(i => i.uid));
  return { fusions: created.length, made: created.filter(it => left.has(it.uid)) };
}

// ------------------------------- Bots ----------------------------------
export const BOT_WEIGHTS = {   // aussi utilisé pour conseiller les caractéristiques de chaque classe
  guerrier: { vit: 0.35, atk: 0.4, def: 0.25 },
  mage: { mag: 0.42, vit: 0.33, def: 0.1, spd: 0.15 },
  archer: { atk: 0.4, spd: 0.2, lck: 0.2, vit: 0.2 },
  paladin: { vit: 0.3, def: 0.25, mag: 0.25, atk: 0.2 },
};

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Crée un adversaire « bot » stable pour la journée, proche du niveau du joueur. */
export function buildBot(friend, heroLevel, day) {
  const rng = makeRng(hashStr(friend.id + day));
  const level = Math.max(1, Math.min(MAX_LEVEL, heroLevel + Math.floor(rng() * 4) - 2));
  const hero = newHero(friend.name, friend.classId);
  hero.level = level;
  // Points de stats
  const w = BOT_WEIGHTS[friend.classId];
  const keys = Object.keys(w);
  const weights = keys.map(k => w[k]);
  for (let p = 0; p < totalPoints(level); p++) {
    const k = keys[pickWeighted(rng, weights)];
    hero.alloc[k] = (hero.alloc[k] || 0) + 1;
  }
  // Équipement
  for (const slot of SLOT_ORDER) {
    if (rng() > Math.min(0.9, 0.25 + level * 0.01)) continue;
    const pool = ITEM_LIST.filter(i => i.slot === slot);
    const item = pool[Math.floor(rng() * pool.length)];
    const rarity = Math.min(4, Math.floor(rng() * (1 + level / 25)));
    const it = addItem(hero, item.id, rarity);
    hero.equipped[slot] = it.uid;
  }
  // Sorts : les plus forts débloqués, soins/boucliers en priorité
  const un = unlockedSpells(friend.classId, level).reverse();
  const kindRank = (s) => (s.effects || []).some(e => e.k === 'heal') ? 0 : (s.effects || []).some(e => e.k === 'shield') ? 1 : 2;
  const support = un.filter(isSelfOnly).sort((a, b) => kindRank(a) - kindRank(b)).slice(0, 1);
  const attacks = un.filter(s => !isSelfOnly(s)).slice(0, MAX_ACTIVE_SPELLS - support.length);
  hero.spells = [...support, ...attacks].map(s => s.id);
  return hero;
}

// ------------------------------- Compte & personnages -------------------
// Un compte = un joueur. Il peut avoir plusieurs personnages : chacun a son niveau, ses objets,
// son stock de coffres et ses entrées de donjon. Les combats d'arène du jour, les coffres de
// combat/guerre et la section sont partagés par le compte.
export const MAX_HEROES = 4;

export function newHero(name, classId, id = 'h1') {
  return {
    id,
    name,
    classId,
    level: 1,
    xp: 0,
    alloc: {},
    inventory: [],
    equipped: {},
    nextUid: 1,
    spells: [classSpells(classId)[0].id],
    stats: { wins: 0, losses: 0, dungeons: 0 },
    dungeonClears: {},
    chest: { stored: 5, last: Date.now() },   // un nouveau perso démarre avec 5 coffres
    runs: null,                     // donjons : clefs du jour et charges de chaque donjon (voir dungeonRuns)
    keys: 0,                        // clefs : 1 clef = 1 coffre (propres à ce perso)
    tower: { best: 0 },
    dye: null,
  };
}

// Fuze Arena 2.0 : un compte sans cette marque date de l'ancien jeu (après 19 h, un compte d'essai créé avant aussi)
export const eraStart = () => new Date(...ERA.start).getTime();
export const eraLive = () => Date.now() >= eraStart();
export const isEra = (data) => !!data && data.era === ERA.id && (!eraLive() || (data.born || 0) >= eraStart());
/** Ce qui est enregistré en ligne compte depuis 19 h (avant 19 h, pour l'essai : depuis la mise en ligne) */
export const eraFrom = () => (eraLive() ? eraStart() : new Date(...ERA.open).getTime());
export const eraRow = (createdAt) => new Date(createdAt).getTime() >= eraFrom();

export function newAccount(pseudo, classId) {
  return {
    v: 2,
    era: ERA.id,
    born: Date.now(),
    pseudo,
    active: 0,
    nextHeroId: 2,
    heroes: [newHero(pseudo, classId, 'h1')],
    combatChests: 0,
    chestCount: { normal: 0, combat: 0, war: 0 },
    warChests: 0,
    epicChests: 0, legendaryChests: 0,   // coffres offerts en cadeau
    winProgress: 0,
    fights: { day: '', done: {}, lvl: 1 },
    war: newWarState(),
    titles: { warHero: 0 },
    clat: 0,
    cosmetics: { owned: [], title: null, color: null, victory: null },
    missions: { day: '', progress: {}, claimed: {}, bonus: false },
    raid: { day: '', used: 0, claimed: {}, local: {} },
    paidWagers: [],
    auc: { done: [], back: [] },   // enchères déjà réglées (vente, achat) et mises dépassées déjà rendues
    trainRecord: { dmg: 0, classId: classId },
    resetId: RESET_ID,
    specialReset: SPECIAL_RESET && SPECIAL_RESET.id,   // un compte neuf n'a pas besoin de la remise à zéro spéciale
  };
}

export const activeHero = (acc) => acc.heroes[acc.active] || acc.heroes[0];

// Personnages débloqués par le niveau du perso le plus haut : 1 au départ, puis aux niveaux 15, 30 et 50
export const HERO_UNLOCK = [1, 15, 30, 50];
export const topLevel = (acc) => Math.max(1, ...acc.heroes.map(h => h.level));
export const heroSlots = (acc) => HERO_UNLOCK.filter(l => topLevel(acc) >= l).length;
// niveau à atteindre pour le prochain personnage (null si tout est débloqué)
export const nextHeroLevel = (acc) => HERO_UNLOCK[acc.heroes.length] ?? null;

export function addCharacter(acc, classId) {
  if (acc.heroes.length >= MAX_HEROES || acc.heroes.length >= heroSlots(acc)) return null;
  const h = newHero(acc.pseudo, classId, `h${acc.nextHeroId++}`);
  acc.heroes.push(h);
  acc.active = acc.heroes.length - 1;
  return h;
}

function newWarState() {
  return { section: null, sides: {}, joinedAt: 0, day: '', done: {}, log: [], pending: null, weeks: {}, lastWeek: '' };
}

function cleanItems(hero) {
  hero.inventory = hero.inventory.filter(i => ITEMS[i.itemId]);
  for (const slot in hero.equipped) {
    if (!hero.inventory.some(i => i.uid === hero.equipped[slot])) delete hero.equipped[slot];
  }
}

/** Met à niveau une ancienne sauvegarde (un seul héros) vers un compte */
export function migrate(save) {
  let acc = save;
  if (save.v !== 2) {
    const h = save;
    acc = newAccount(h.name, h.classId);
    acc.heroes = [{
      id: 'h1', name: h.name, classId: h.classId, level: h.level, xp: h.xp, alloc: h.alloc || {},
      inventory: h.inventory || [], equipped: h.equipped || {}, nextUid: h.nextUid || 1, spells: h.spells || [],
      stats: { wins: 0, losses: 0, dungeons: 0, ...(h.stats || {}) }, dungeonClears: h.dungeonClears || {},
    }];
    for (const k of ['combatChests', 'warChests', 'epicChests', 'legendaryChests', 'winProgress', 'fights', 'titles']) if (h[k] !== undefined) acc[k] = h[k];
    if (h.chest) acc.heroes[0].chest = h.chest;
    if (h.dungeon) acc.heroes[0].dungeon = h.dungeon;
    if (h.war) {
      const w = newWarState();
      Object.assign(w, { section: h.war.section, sides: h.war.sides || {}, joinedAt: h.war.joinedAt || 0, day: h.war.day || '', done: h.war.done || {}, log: h.war.log || [], pending: h.war.pending || null });
      if (h.war.week) { w.weeks[h.war.week] = { points: h.war.points || 0, enemyBonus: h.war.enemyBonus || 0, attacks: h.war.attacks || 0 }; w.lastWeek = h.war.week; }
      acc.war = w;
    }
  }
  acc.heroes.forEach(cleanItems);
  // Coffres et donjons passés du compte aux personnages : le 1er perso garde le stock du compte
  acc.heroes.forEach((h, i) => {
    if (!h.chest) h.chest = (i === 0 && acc.chest) ? acc.chest : { stored: 2, last: Date.now() };
  });
  delete acc.chest;
  delete acc.dungeon;
  acc.heroes.forEach(h => {
    if (!h.tower) h.tower = { best: 0 };
    if (h.dye === undefined) h.dye = null;
    if (h.keys === undefined) h.keys = 0;
    delete h.dungeon;
  });
  if (!acc.cosmetics) acc.cosmetics = { owned: [], title: null, color: null, victory: null };
  if (!acc.missions) acc.missions = { day: '', progress: {}, claimed: {}, bonus: false };
  if (!acc.raid) acc.raid = { day: '', used: 0, claimed: {}, local: {} };
  if (!acc.paidWagers) acc.paidWagers = [];
  if (!acc.auc) acc.auc = { done: [], back: [] };
  if (!acc.chestCount) acc.chestCount = { normal: 0, combat: 0, war: 0 };
  acc.epicChests ||= 0; acc.legendaryChests ||= 0;
  if (!acc.war.weeks) acc.war.weeks = {};
  if (!acc.titles) acc.titles = { warHero: 0 };
  if (acc.clat === undefined) acc.clat = 0;
  if (!acc.trainRecord) acc.trainRecord = { dmg: 0, classId: acc.heroes[0].classId };
  // Guerre : la semaine qui a commencé le lundi 12/10 continue dans la guerre qui a démarré le 17/10
  if (acc.war.weeks[LEGACY_WEEK[1]] && !acc.war.weeks[LEGACY_WEEK[0]]) {
    acc.war.weeks[LEGACY_WEEK[0]] = acc.war.weeks[LEGACY_WEEK[1]];
    delete acc.war.weeks[LEGACY_WEEK[1]];
  }
  if (acc.war.lastWeek === LEGACY_WEEK[1]) acc.war.lastWeek = LEGACY_WEEK[0];
  // Remise à zéro générale de tous les compteurs (une seule fois par RESET_ID)
  if (acc.resetId !== RESET_ID) {
    acc.resetId = RESET_ID;
    acc.fights = { day: '', done: {}, lvl: acc.fights.lvl || 1 };
    acc.war.done = {}; acc.war.day = '';
    acc.raid.ch = {};
    acc.missions = { day: '', progress: {}, claimed: {}, bonus: false };
    acc.heroes.forEach(h => { h.chest = { stored: CHEST_MAX, last: Date.now() }; h.runs = null; h.horde = {}; });
  }
  return acc;
}

/** Récompenses après un combat d'arène */
export function fightRewards(acc, hero, foeLevel, won) {
  // l'Arène ne donne plus d'XP (l'XP se gagne en donjon, à la Tour, au raid et dans la Horde)
  const lv = { levels: 0, newSpells: [], xp: 0, lvlKeys: 0 };
  const xp = 0;
  let chest = false;
  if (won) {
    hero.stats.wins++;
    acc.winProgress++;
    if (acc.winProgress >= WINS_PER_COMBAT_CHEST) { acc.winProgress -= WINS_PER_COMBAT_CHEST; acc.combatChests++; chest = true; }
  } else hero.stats.losses++;
  return { xp, chest, ...lv };
}

/** Combat amical (revanche, vengeance) : ni XP ni points. 5 Flouze par adversaire et par jour si on gagne (REMATCH_CLAT). */
export function friendlyRewards(acc, won, foeId) {
  if (!acc.fights.clat) acc.fights.clat = {};
  const give = won && !acc.fights.clat[foeId];
  if (give) { acc.clat += REMATCH_CLAT; acc.fights.clat[foeId] = true; }
  return { clat: give ? REMATCH_CLAT : 0 };
}

// ------------------------------ Donjons --------------------------------
export const DUNGEON_HP_MULT = 1.15;      // les boss ont un peu plus de PV
/** Difficulté : un peu plus dure au début, plus douce à haut niveau (où l'équipement compte beaucoup) */
export const dungeonDifficulty = (lvl) => 1.35 - 0.004 * lvl;
// Vagues de donjon (à partir du donjon niveau 10) : monstres bien plus costauds, il faut quelques niveaux d'avance
// (le premier donjon reste comme avant pour les nouveaux ; la Horde, la Tour et le raid ne changent pas)
export const DUNGEON_HARD = { from: 10, hp: 1.6, diff: (lvl) => 1.7 - 0.002 * lvl };

export function dungeonXp(d) { return 25 + 5 * d.lvl; }

/** Chances de rareté du coffre de donjon : meilleures dans les donjons de haut niveau */
export function dungeonOdds(d) {
  const t = Math.floor(d.lvl / 10);
  return [60 - 4 * t, 28, 9 + 2 * t, 2.5 + 1.2 * t, 0.5 + 0.6 * t];
}

/** Crée le boss d'un donjon à partir de son niveau et de son profil */
export function buildMonster(d, hard = false) {
  const avg = 8 + 1.25 * d.lvl;
  const stats = {};
  hard = hard && d.lvl >= DUNGEON_HARD.from;
  const diff = hard ? DUNGEON_HARD.diff(d.lvl) : dungeonDifficulty(d.lvl);
  for (const k of STAT_KEYS) stats[k] = Math.max(1, Math.round(avg * d.profile[k] * diff));
  return {
    name: d.boss,
    monster: d.sprite,
    classId: null,
    level: d.lvl,
    stats,
    maxHp: Math.round(maxHp(stats, d.lvl) * (hard ? DUNGEON_HARD.hp : DUNGEON_HP_MULT)),
    spells: d.spells.slice(),
    basic: d.basic,
    pet: null,
    hat: null,
  };
}

// ------------------------------ Vagues de donjon ------------------------------
// Chaque entrée en donjon = une vague : 2 monstres différents puis le boss. Les PV du héros ne remontent pas entre les combats
// (juste un petit souffle de WAVE_HEAL entre deux monstres). Si on tombe, la vague s'arrête.
export const WAVE_MINIONS = 2;
export const MINION_POWER = 0.65;   // stats des monstres de la vague par rapport à un boss du même niveau
export const MINION_HP = 0.4;     // et leurs PV
export const WAVE_BOSS_HP = 0.95;  // le boss d'une vague a un peu moins de PV (on arrive déjà blessé)
export const MINION_XP = 0.15;    // chaque monstre battu rapporte 15 % de l'XP du boss en plus
export const WAVE_HEAL = 0.25;     // PV rendus (en part des PV max) avant le monstre suivant

/** Les monstres de la vague (tirés parmi les boss des autres donjons, jamais deux fois le même), puis le boss */
export function dungeonWave(d, rng = Math.random) {
  const pool = DUNGEONS.filter(x => x.id !== d.id).flatMap(dungeonFoes);
  const picks = [];
  while (picks.length < WAVE_MINIONS && pool.length) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  const minions = picks.map(src => {
    const m = buildMonster({ ...src, lvl: d.lvl }, true);
    for (const k in m.stats) m.stats[k] = Math.max(1, Math.round(m.stats[k] * MINION_POWER));
    m.maxHp = Math.round(m.maxHp * MINION_HP);
    m.minion = true;
    return m;
  });
  const boss = buildMonster(pickDungeonFoe(d, rng), true);
  boss.maxHp = Math.round(boss.maxHp * WAVE_BOSS_HP);
  return [...minions, boss];
}
/** XP d'une vague complète (les monstres + le boss) */
export const waveXp = (d) => Math.round(dungeonXp(d) * (1 + MINION_XP * WAVE_MINIONS));
/** PV du héros au début du combat suivant de la vague */
export const waveNextHp = (snap, hpLeft) => Math.min(snap.maxHp, Math.round(hpLeft + snap.maxHp * WAVE_HEAL));
/**
 * Vague de donjon jouée d'une traite, comme la Horde : quand un monstre tombe, le suivant arrive aussitôt
 * (avec le petit souffle de WAVE_HEAL), jusqu'au boss. Événements en plus : { type: 'kill' } puis { type: 'nextFoe', foe, heal, hp }.
 */
export function createWave(A, foes, seed, { manual = false } = {}) {
  let i = 0, done = false, usedManual = false, manualMode = manual;
  const pending = [], log = [];
  let cur = createFight(A, foes[0], seed, { manual: manualMode });
  const pull = () => {
    if (pending.length) return pending.shift();
    if (done) return null;
    const e = cur.next();
    if (!e) return null;
    if (e.type !== 'end') return e;
    const r = cur.result();
    if (r.usedManual) usedManual = true;
    if (e.winner !== 0 || i === foes.length - 1) { done = true; return { ...e, kills: e.winner === 0 ? i + 1 : i }; }
    // monstre vaincu : le suivant arrive tout de suite, le héros reprend un peu son souffle
    const left = Math.max(1, r.hp[0]), hp = waveNextHp(A, left);
    i++;
    const q = cur.queued;
    cur = createFight({ ...A, hp, ...r.carry[0] }, foes[i], seed + i * 101, { manual: manualMode });   // recharges et bouclier gardés
    if (q) cur.queue(q);
    pending.push({ type: 'nextFoe', foe: foes[i], heal: hp - left, hp, boss: i === foes.length - 1 });
    return { type: 'kill', kills: i, label: 'K.O. !', s: e.s };
  };
  const api = {
    next() { const e = pull(); if (e) log.push(e); return e; },
    queue(id) { cur.queue(id); },
    get queued() { return cur.queued; },
    setManual(v) { manualMode = v; cur.setManual(v); },
    get manual() { return manualMode; },
    result() {
      while (api.next());
      const end = log[log.length - 1] || {};
      const hpLeft = Math.max(0, cur.result().hp[0]);
      return { log, winner: end.winner ?? 1, kills: end.kills || 0, usedManual, hpLeft, hpFrac: hpLeft / A.maxHp };
    },
  };
  return api;
}

// ------------------------------ Mode histoire ------------------------------
// Combat global g = mode × 50 + zone × 10 + combat (0 à 149). Chaque perso avance dans l'ordre : hero.story.prog = prochain combat à gagner.
export const STORY_PER_MODE = STORY.zones.length * STORY.fights;
export const STORY_LAST = STORY.modes.length * STORY_PER_MODE - 1;
export const storyStage = (g) => ({ mode: Math.floor(g / STORY_PER_MODE), zone: Math.floor(g / STORY.fights) % STORY.zones.length, fight: g % STORY.fights });
export const storyG = (mode, zone, fight) => mode * STORY_PER_MODE + zone * STORY.fights + fight;
const lerpAnchors = (N, g, geo) => {
  let i = 1;
  while (i < N.length - 1 && g > N[i][0]) i++;
  const [g0, p0] = N[i - 1], [g1, p1] = N[i];
  const t = Math.max(0, Math.min(1, (g - g0) / Math.max(1, g1 - g0)));
  return geo ? p0 * Math.pow(p1 / p0, t) : p0 + (p1 - p0) * t;
};
/** Puissance de héros demandée pour le combat g */
export const storyNeed = (g) => STORY.need[g] ?? 0;
/** Force des monstres du combat g (réglée par simulation, voir STORY.strength) */
export const storyStrength = (g) => STORY.strength[g] ?? STORY.strength[STORY.strength.length - 1];
export const storyLevel = (g) => STORY.levels[g] ?? 100;
export const storyKind = (g) => { const f = storyStage(g).fight + 1; return f === STORY.boss ? 'boss' : f === STORY.mini ? 'mini' : 'mob'; };
export function storyState(hero) {
  hero.story ||= { prog: 0, stars: {}, claimed: {} };
  return hero.story;
}
/** Le profil (stats, sorts) d'un monstre : celui du donjon qui a ce dessin */
function profileOf(sprite) {
  for (const d of DUNGEONS) for (const x of dungeonFoes(d)) if (x.sprite === sprite) return x;
  return DUNGEONS[0];
}
/** Les monstres du combat g, qui arrivent à la suite : 2 à 4 monstres, ou des sbires puis le petit boss / le boss */
export function storyFoes(g) {
  const { zone, fight } = storyStage(g), Z = STORY.zones[zone], kind = storyKind(g);
  const f = storyStrength(g), lvl = storyLevel(g);
  const mk = (sprite, name, power, hp) => {
    const m = buildMonster({ ...profileOf(sprite), lvl: 50 });
    for (const q in m.stats) m.stats[q] = Math.max(1, Math.round(m.stats[q] * f * power));
    m.maxHp = Math.max(10, Math.round(m.maxHp * f * hp));
    m.level = lvl;
    if (name) m.name = name;
    return m;
  };
  const pick = (j) => Z.mobs[(fight * 3 + j * 5 + g) % Z.mobs.length];
  const B = STORY.foes;
  if (kind === 'mini') return [mk(pick(0), null, ...B.miniAdd), { ...mk(Z.mini.sprite, Z.mini.name, ...B.mini), boss: true }];
  if (kind === 'boss') return [mk(pick(0), null, ...B.bossAdd), mk(pick(1), null, ...B.bossAdd), { ...mk(Z.boss.sprite, Z.boss.name, ...B.boss), boss: true }];
  const n = 2 + (fight % 3);                       // 2, 3 ou 4 monstres
  const hp = B.mobHp[n];
  return Array.from({ length: n }, (_, j) => mk(pick(j), null, 1, hp));
}
/** XP du combat g (seulement la première fois qu'on le gagne) */
export const storyXp = (g) => Math.round((25 + 5 * storyLevel(g)) * STORY.xpMult * ({ mini: 1.5, boss: 2 }[storyKind(g)] || 1));
/** Étoiles selon la part de vie restante */
export const storyStarsFor = (frac) => frac >= STORY.stars[1] ? 3 : frac >= STORY.stars[0] ? 2 : 1;
/** Fin d'un combat d'histoire : étoiles (on garde le meilleur), progression, XP à la première victoire */
export function storyResult(hero, g, won, hpFrac) {
  const S = storyState(hero);
  if (!won || g > S.prog) return { won: false, stars: 0, xp: 0 };
  const first = !S.stars[g];
  const stars = storyStarsFor(hpFrac);
  const better = stars > (S.stars[g] || 0);
  if (better) S.stars[g] = stars;
  if (g === S.prog) S.prog = Math.min(STORY_LAST + 1, g + 1);
  let lv = null, xp = 0;
  if (first) { xp = storyXp(g); lv = gainXp(hero, xp); }
  return { won: true, stars, best: S.stars[g], better, first, xp, ...(lv || {}) };
}
/** Étoiles gagnées dans une zone (sur 30) */
export function storyZoneStars(hero, mode, zone) {
  const S = storyState(hero);
  let n = 0;
  for (let f = 0; f < STORY.fights; f++) n += S.stars[storyG(mode, zone, f)] || 0;
  return n;
}
/** Récompense d'une zone : tier 20 (5 coffres) ou 30 (coffre Épique, ou Légendaire en Chaotique). Une seule fois. */
export function storyClaim(acc, hero, mode, zone, tier) {
  const S = storyState(hero), key = `${mode}-${zone}-${tier}`;
  if (S.claimed[key] || storyZoneStars(hero, mode, zone) < tier) return null;
  S.claimed[key] = true;
  if (tier === 20) { refreshChests(hero); hero.chest.stored += STORY.chests20; return { chests: STORY.chests20 }; }
  if (STORY.modes[mode].id === 'chaos') { acc.legendaryChests = (acc.legendaryChests || 0) + 1; return { legendary: 1 }; }
  acc.epicChests = (acc.epicChests || 0) + 1;
  return { epic: 1 };
}
/** Récompenses d'étoiles prêtes à récupérer (pour la pastille) */
export function storyClaimable(hero) {
  const S = storyState(hero);
  let n = 0;
  for (let m = 0; m < STORY.modes.length; m++) for (let z = 0; z < STORY.zones.length; z++) {
    const s = storyZoneStars(hero, m, z);
    for (const tier of [20, 30]) if (s >= tier && !S.claimed[`${m}-${z}-${tier}`]) n++;
  }
  return n;
}

/** Clefs de donjon du jour (remise à zéro à minuit) ; hero.runs.dch = les charges de chaque donjon */
export function dungeonRuns(hero) {
  const k = dayKey();
  if (!hero.runs || hero.runs.day !== k) hero.runs = { day: k, keys: 0, dch: (hero.runs && hero.runs.dch) || {} };
  return hero.runs;
}
/** Charges d'un donjon (par perso) */
const dungeonCharge = (hero, d) => { const r = dungeonRuns(hero); r.dch[d.id] ||= {}; return charge(r.dch[d.id], DUNGEON_RUNS); };
export const dungeonNextIn = (hero, d) => { dungeonCharge(hero, d); return chargeIn(dungeonRuns(hero).dch[d.id], DUNGEON_RUNS); };
/** Clefs encore gagnables en donjon aujourd'hui */
export const keysEarned = (hero) => dungeonRuns(hero).keys || 0;
export const keysLeftToEarn = (hero) => Math.max(0, DUNGEON_KEYS_MAX - keysEarned(hero));
/** Les donjons débloqués, sauf les 2 plus durs, peuvent être passés */
export function canSkipDungeon(hero, d) {
  const open = DUNGEONS.filter(x => hero.level >= x.lvl);
  const i = open.findIndex(x => x.id === d.id);
  return i >= 0 && i < open.length - DUNGEON_SKIP_KEEP;
}
export const runsLeft = (hero, d) => dungeonCharge(hero, d).n;
/** Combats encore possibles dans tous les donjons débloqués */
export const totalRunsLeft = (hero) => DUNGEONS.filter(d => hero.level >= d.lvl).reduce((t, d) => t + runsLeft(hero, d), 0);

/** Les boss possibles d'un donjon (le boss principal et sa variante) */
export const dungeonFoes = (d) => (d.alt ? [d, { ...d, ...d.alt }] : [d]);
/** Tire au hasard le boss qu'on va affronter */
export function pickDungeonFoe(d, rng = Math.random) {
  const list = dungeonFoes(d);
  return list[Math.floor(rng() * list.length)];
}

/** Consomme un combat dans ce donjon. Renvoie false s'il n'y en a plus. */
export function useDungeonRun(hero, d) {
  dungeonCharge(hero, d);
  return useCharge(dungeonRuns(hero).dch[d.id], DUNGEON_RUNS);
}

/** Récompenses de donjon : XP selon le niveau du donjon + 1 clef si victoire */
/** Récompenses d'une vague de donjon : XP (boss + monstres battus) + 1 clef si le boss tombe (DUNGEON_KEYS_MAX clefs par jour) */
export function dungeonRewards(hero, d, won, minionsBeaten = 0) {
  const xp = (won ? dungeonXp(d) : Math.round(dungeonXp(d) * 0.4)) + Math.round(dungeonXp(d) * MINION_XP * minionsBeaten);
  const lv = gainXp(hero, xp);
  const key = won && keysLeftToEarn(hero) > 0;
  if (key) { hero.keys = (hero.keys || 0) + 1; dungeonRuns(hero).keys = keysEarned(hero) + 1; }
  if (won) {
    hero.stats.dungeons++;
    hero.dungeonClears[d.id] = (hero.dungeonClears[d.id] || 0) + 1;
  }
  return { xp, key, keyCapped: won && !key, ...lv };
}

/** Passe tous les combats restants d'un donjon facile : comptés comme gagnés, mais avec la moitié de l'XP */
export function skipDungeon(hero, d) {
  if (!canSkipDungeon(hero, d)) return null;
  const n = runsLeft(hero, d);
  if (n <= 0) return null;
  let keys = 0;
  for (let i = 0; i < n; i++) {
    useDungeonRun(hero, d);
    if (keysLeftToEarn(hero) > 0) { hero.keys = (hero.keys || 0) + 1; dungeonRuns(hero).keys = keysEarned(hero) + 1; keys++; }
  }
  hero.stats.dungeons += n;
  hero.dungeonClears[d.id] = (hero.dungeonClears[d.id] || 0) + n;
  const lv = gainXp(hero, n * Math.round(waveXp(d) / 2));
  return { runs: n, keys, ...lv };
}

// ------------------------------ Guerre des sections --------------------
const otherSide = (sec) => (sec === 'rouge' ? 'bleue' : 'rouge');
export { otherSide };

/** Début de la guerre en cours : les guerres durent 7 jours, à partir de WAR.start */
function warStartOf(d) {
  const s = new Date(WAR.start[0], WAR.start[1], WAR.start[2]);
  if (d < s) { while (d < s) s.setDate(s.getDate() - 7); return s; }
  for (;;) { const n = new Date(s); n.setDate(n.getDate() + 7); if (n > d) return s; s.setDate(s.getDate() + 7); }
}
export const weekKey = (d = new Date()) => dayKey(warStartOf(d));
export function msToWeekEnd(d = new Date()) { const m = warStartOf(d); m.setDate(m.getDate() + 7); return m - d; }
const daysElapsedInWeek = (d = new Date()) => Math.min(7, Math.round((new Date(d).setHours(12) - warStartOf(d).setHours(12)) / 86400000) + 1);
// La 1re guerre a démarré le 17/10 alors que les points étaient rangés sous la semaine du lundi 12/10
const LEGACY_WEEK = ['2026-10-17', '2026-10-12'];
const weekStats = (w, week) => (w.weeks && (w.weeks[week] || (week === LEGACY_WEEK[0] && w.weeks[LEGACY_WEEK[1]]))) || null;

/** Points gagnés en battant un ennemi : plus il est fort, plus ça rapporte */
export function warPoints(myPower, foePower) {
  const r = foePower / Math.max(1, myPower);
  return r >= 1.1 ? 3 : r >= 0.9 ? 2 : 1;
}

/** Stats de guerre du compte pour une semaine */
export function warWeek(acc, week = weekKey()) {
  if (!acc.war.weeks[week]) acc.war.weeks[week] = { points: 0, enemyBonus: 0, attacks: 0 };
  return acc.war.weeks[week];
}

/** Camp d'un compte pour une guerre (chaque semaine, on rechoisit) : celui noté dans la semaine, sinon celui choisi cette semaine-là */
export function warSide(w, week = weekKey()) {
  if (!w) return null;
  const st = w.weeks && w.weeks[week];
  return (st && st.section) || (w.section && w.sectionWeek === week ? w.section : null);
}

/** Membres de chaque section (online : les vrais joueurs ; local : des bots) */
export function sectionCount(acc, section, others) {
  if (others) return others.filter(p => warSide(p.data.war) === section).length;
  return Object.values(acc.war.sides).filter(s => s === section).length;
}

/**
 * Rejoindre une section. Online : refusé si la section a déjà WAR.maxPerSection joueurs.
 * Local : les bots se répartissent pour faire 4 contre 4.
 */
export function joinSection(acc, section, others = null) {
  if (others && sectionCount(acc, section, others) >= WAR.maxPerSection) return false;
  const war = acc.war;
  war.sides = {};
  if (!others) {
    const rng = makeRng(hashStr('sides' + acc.pseudo + Date.now()));
    const ids = FRIENDS.map(f => f.id).sort(() => rng() - 0.5);
    const enemies = Math.min(WAR.maxPerSection, ids.length);
    ids.forEach((id, i) => { war.sides[id] = i < enemies ? otherSide(section) : section; });
  }
  war.section = section;
  war.sectionWeek = weekKey();
  war.joinedAt = Date.now();
  war.lastWeek = weekKey();
  warWeek(acc).section = section;   // le camp de cette semaine (sert au résultat, même après le changement de semaine)
  return true;
}


/** Points des bots sur la semaine (simulés jour par jour, toujours les mêmes) */
function botWarWeek(acc, week, days) {
  const members = [];
  const score = { rouge: 0, bleue: 0 };
  for (const f of FRIENDS) {
    const side = acc.war.sides[f.id];
    if (!side) continue;
    let pts = 0;
    for (let day = 0; day < days; day++) {
      const rng = makeRng(hashStr(`war${week}${f.id}${day}`));
      const n = rng() < 0.15 ? 0 : 1 + Math.floor(rng() * WAR.maxPerSection);   // certains jours, un pote ne joue pas
      for (let a = 0; a < n; a++) {
        if (rng() < 0.55) { const p = 1 + Math.floor(rng() * 3); pts += p; score[side] += p; }
        else score[otherSide(side)] += 1;                     // défense réussie pour l'autre camp
      }
    }
    members.push({ id: f.id, name: f.name, classId: f.classId, section: side, points: pts });
  }
  return { members, score };
}

/**
 * Classement de la guerre pour une semaine.
 * others = liste des autres joueurs en ligne ([{ id, pseudo, data }]) ou null en local.
 */
export function warStandings(acc, week = weekKey(), others = null) {
  const done = week === weekKey() ? daysElapsedInWeek() : 7;
  const res = others ? { members: [], score: { rouge: 0, bleue: 0 } } : botWarWeek(acc, week, done);
  if (others) {
    for (const p of others) {
      const w = p.data.war, side = warSide(w, week);
      if (!side) continue;
      const st = weekStats(w, week) || { points: 0, enemyBonus: 0 };
      res.score[side] += st.points;
      res.score[otherSide(side)] += st.enemyBonus;
      const h = strongestHero(p.data);
      res.members.push({ id: p.id, name: p.pseudo, classId: h.classId, section: side, points: st.points, data: p.data });
    }
  }
  const mySide = warSide(acc.war, week);
  if (mySide) {
    const mine = acc.war.weeks[week] || { points: 0, enemyBonus: 0 };
    res.score[mySide] += mine.points;
    res.score[otherSide(mySide)] += mine.enemyBonus;
  }
  return res;
}

/** Remet à zéro les attaques du jour et clôture la semaine passée si besoin */
export function ensureWar(acc, others = null) {
  const war = acc.war;
  const today = dayKey();
  if (war.day !== today) { war.day = today; war.done = {}; }
  const w = weekKey();
  // un camp choisi une autre semaine (ou avant cette règle) ne compte plus : on rechoisit
  if (war.section && war.lastWeek === w && !warSide(war, w)) war.section = null;
  if (war.lastWeek === w) return;
  const prev = war.lastWeek, prevSide = prev ? warSide(war, prev) : null;
  if (prevSide) {
    const st = warStandings(acc, prev, others);
    const me = war.weeks[prev] || { points: 0, enemyBonus: 0, attacks: 0 };
    const mine = st.score[prevSide], theirs = st.score[otherSide(prevSide)];
    const outcome = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'tie';
    const eligible = me.attacks >= WAR.minAttacks;
    const mvp = me.points > 0 && me.points >= Math.max(0, ...st.members.map(m => m.points));
    war.pending = {
      week: prev, outcome, mine, theirs, points: me.points, attacks: me.attacks, eligible, mvp,
      warChests: (eligible && outcome === 'win' ? 1 : 0) + (mvp ? 1 : 0),
      combatChests: eligible && outcome !== 'win' ? 1 : 0,
    };
  }
  war.lastWeek = w;
  war.log = [];
  war.section = null;          // nouvelle guerre : tout le monde rechoisit son camp
  war.sectionWeek = null;
  // On garde seulement les 4 dernières semaines
  const keep = Object.keys(war.weeks).sort().slice(-4);
  for (const k of Object.keys(war.weeks)) if (!keep.includes(k)) delete war.weeks[k];
}

export function claimWarReward(acc) {
  const p = acc.war.pending;
  if (!p) return null;
  acc.warChests += p.warChests;
  acc.combatChests += p.combatChests;
  if (p.mvp) acc.titles.warHero++;
  acc.war.pending = null;
  return p;
}

/** Enregistre une attaque de guerre et ses récompenses */
export function warAttackResult(acc, hero, foe, won, myPower, foePower) {
  const war = acc.war;
  const wk = warWeek(acc);
  const pts = won ? warPoints(myPower, foePower) : 0;
  if (won) wk.points += pts; else wk.enemyBonus += 1;
  wk.attacks++;
  war.done[foe.id] = won ? 'win' : 'loss';
  war.log.unshift({ name: foe.name, won, pts, at: Date.now() });
  war.log = war.log.slice(0, 20);
  return { pts, xp: 0, levels: 0, newSpells: [], lvlKeys: 0 };   // la Guerre ne donne plus d'XP
}

// ------------------------------ Personnage le plus fort ----------------
/** Le perso qui défend le compte : celui qui a la plus grosse puissance */
export function strongestHero(acc) {
  let best = acc.heroes[0], bp = -1;
  for (const h of acc.heroes) {
    const p = powerScore(snapshot(h));
    if (p > bp) { bp = p; best = h; }
  }
  return best;
}

// ------------------------------ Tour infinie ---------------------------
/** Monstre d'un étage : les boss des donjons reviennent, de plus en plus forts */
export function towerMonster(floor) {
  const pool = DUNGEONS.flatMap(dungeonFoes);   // tous les boss, et leurs variantes
  const d = pool[(floor - 1) % pool.length];
  const lvl = Math.min(MAX_LEVEL, Math.max(1, Math.round(floor * 1.5)));
  const beyond = floor > 66 ? Math.pow(1.035, floor - 66) : 1;   // au-delà : ça ne s'arrête jamais
  const [r0, rStep, rMax] = TOWER.ramp;
  const [eK, eEnd] = TOWER.early || [0, 1];
  // premiers étages plus doux (TOWER.ramp), puis un renfort qui s'efface vers l'étage eEnd (TOWER.early)
  const ramp = Math.min(rMax, r0 + rStep * floor) * (1 + eK * Math.max(0, 1 - floor / eEnd));
  const m = buildMonster({ ...d, lvl });
  for (const k in m.stats) m.stats[k] = Math.max(1, Math.round(m.stats[k] * ramp * beyond));
  m.maxHp = Math.round(m.maxHp * beyond);
  m.level = Math.round(lvl * beyond);
  m.name = d.boss;
  return { snap: m, theme: d.theme, dungeon: d };
}

export const towerState = (hero) => hero.tower;

/** Clefs d'un étage : 5 tous les 10 étages, 10 à partir de l'étage 50 */
export const towerKeys = (floor) => (floor % 10 ? 0 : floor >= 50 ? TOWER.keysFrom50 : TOWER.keysEvery10);
/** Résultat d'une tentative (illimitées) : si victoire, on monte d'un étage et on gagne du Flouze ; sinon on reste bloqué */
export function towerResult(acc, hero, won, foeLevel = hero.level) {
  const t = towerState(hero);
  let keys = 0, xp = 0;
  const base = Math.round((25 + 5 * Math.min(foeLevel, hero.level + 10)) * TOWER.xpMult);
  if (won) {
    t.best++;
    keys = towerKeys(t.best);
    hero.keys = (hero.keys || 0) + keys;
    xp = base;
  }   // défaite : on reste à l'étage, sans XP (impossible de farmer)
  const lv = xp ? gainXp(hero, xp) : { levels: 0, newSpells: [], xp: 0, lvlKeys: 0 };
  return { floor: t.best, keys, ...lv };
}

// ------------------------------ Raid -----------------------------------
/**
 * Le boss d'un raid d'après son nom : « melenchon:v3 » (le premier raid), puis « hollande:c0 », « sarkozy:c0 »…
 * c0, c1… = le tour de rotation (à chaque tour complet, les boss reviennent plus forts).
 */
export function raidDef(tag = RAID.tag) {
  const [id, c] = String(tag || '').split(':');
  const i = Math.max(0, RAID_BOSSES.findIndex(b => b.id === id));
  const cycle = /^c\d+$/.test(c || '') ? +c.slice(1) : 0;
  const boss = RAID_BOSSES[i];
  const C = RAID.cycleBoost;
  return { ...boss, index: i, cycle, tag: tag || RAID.tag, power: boss.power * Math.pow(C.power, cycle), hpMult: boss.hp * Math.pow(C.hp, cycle) };
}
/** Est-ce un raid connu (de la rotation) ? */
export const isRaidTag = (tag) => tag === RAID.tag || RAID_BOSSES.some(b => String(tag || '').startsWith(b.id + ':c'));
/** Le raid qui suit celui-là dans la rotation (après Macron : retour à Mélenchon, un tour plus fort) */
export function nextRaidTag(prevTag) {
  if (!isRaidTag(prevTag)) return RAID.tag;
  const d = raidDef(prevTag);
  const i = (d.index + 1) % RAID_BOSSES.length;
  return `${RAID_BOSSES[i].id}:c${d.cycle + (i === 0 ? 1 : 0)}`;
}

/** Le boss de raid au niveau du groupe ; hp = PV restants au début de l'assaut */
export function raidBoss(level, totalHp, remaining, tag = RAID.tag) {
  const b = raidDef(tag);
  const m = buildMonster({ ...b, lvl: Math.max(1, Math.round(level)), boss: b.name });
  // Gros sac à PV qui tape modérément : on tient tout l'assaut et on lui inflige un max de dégâts
  // (chaque boss de la rotation est un peu plus costaud que le précédent)
  for (const k in m.stats) m.stats[k] = Math.round(m.stats[k] * (k === 'atk' || k === 'mag' ? 0.6 : 1.15) * b.power);
  m.maxHp = totalHp;
  m.hp = Math.max(1, remaining);
  return m;
}

/** Dégâts moyens d'un assaut de 40 actions selon le niveau (barème mesuré par simulation ; relevé le 2026-10-20 après la refonte
 *  de l'équipement : les héros font +13 à +50 % de dégâts au gros boss, ses PV suivent pour qu'il ne tombe pas plus vite ;
 *  points 75 à 97 ajoutés après la règle 3 Légendaires → 1 Mythique : vers le niveau 90, les héros sont encore en Mythique) */
const RAID_DMG = [[1, 279], [5, 443], [10, 804], [20, 888], [30, 936], [50, 955], [70, 1302], [75, 1392], [80, 1646], [85, 1861], [90, 2098], [95, 2156], [97, 2648], [100, 3200]];
export function raidExpectedDamage(lvl) {
  for (let i = 1; i < RAID_DMG.length; i++) {
    const [l1, d1] = RAID_DMG[i - 1], [l2, d2] = RAID_DMG[i];
    if (lvl <= l2) return Math.round(d1 + (d2 - d1) * Math.max(0, lvl - l1) / (l2 - l1));
  }
  return RAID_DMG[RAID_DMG.length - 1][1];
}

/** PV du boss pour la semaine, selon les niveaux de tout le groupe (et le boss : les suivants en ont plus) */
export function raidHp(levels, tag = RAID.tag) {
  const total = levels.reduce((t, l) => t + raidExpectedDamage(l), 0);
  return Math.max(RAID.minHp, Math.round(total * RAID.attemptsPerHalf * 2 * 7 * RAID.participation * raidDef(tag).hpMult));
}

/** Dégâts infligés pendant un assaut (d'après le journal du combat) */
export function damageDealt(result, startHp) {
  const last = result.log[result.log.length - 1];
  const endHp = last && last.s ? last.s[1].hp : startHp;
  return Math.max(0, startHp - endHp);
}

/** Assauts du gros boss : charges du compte (1 toutes les 4 h, 3 au maximum) */
export function raidState(acc) {
  const r = acc.raid;
  r.ch ||= {};
  charge(r.ch, RAID.attemptsPerHalf);
  return r;
}
export const raidLeft = (acc) => raidState(acc).ch.n;
export const useRaidAssault = (acc) => { raidState(acc); return useCharge(acc.raid.ch, RAID.attemptsPerHalf); };
export const raidNextIn = (acc) => { raidState(acc); return chargeIn(acc.raid.ch, RAID.attemptsPerHalf); };

/** Récompense de raid d'une semaine (une seule fois) */
export function raidReward(acc, week, killed, isMvp, participated) {
  if (!participated || acc.raid.claimed[week]) return null;
  acc.raid.claimed[week] = true;
  const R = RAID.rewards;
  const rw = killed
    ? { chests: R.killChests + (isMvp ? R.mvpChests : 0), clat: R.killClat }
    : { chests: 0, clat: R.failClat };
  acc.warChests += rw.chests;
  acc.clat += rw.clat;
  return rw;
}

// ------------------------------ Missions ------------------------------
/** Les 3 missions de la demi-journée (les mêmes pour tout le monde, tirées au hasard) */
export function missionsFor(key) {
  const rng = makeRng(hashStr('missions' + key));
  const pool = MISSION_POOL.slice();
  const out = [];
  while (out.length < MISSIONS_PER_DAY && pool.length) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (out.some(x => x.ev === m.ev)) continue;
    let n = m.n[0] + Math.floor(rng() * (m.n[1] - m.n[0] + 1));
    if (m.n[1] >= 100) n = Math.round(n / 50) * 50;
    out.push({ id: m.id, ev: m.ev, n, reward: m.reward, text: m.text.replace('{n}', n.toLocaleString('fr-FR')) });
  }
  return out;
}

export function ensureMissions(acc) {
  const k = halfKey();
  if (acc.missions.day !== k) acc.missions = { day: k, progress: {}, claimed: {}, bonus: false, seen: {} };
  return missionsFor(k);
}

/** Note une action pour les missions (ex : missionEvent(acc, 'chest')). tag = pour compter des choses différentes. */
export function missionEvent(acc, type, n = 1, tag = null) {
  if (!(n > 0)) return;
  ensureMissions(acc);
  const M = acc.missions;
  if (tag !== null) {
    M.seen ||= {};
    const k = type + ':' + tag;
    if (M.seen[k]) return;
    M.seen[k] = true;
  }
  M.progress[type] = (M.progress[type] || 0) + n;
}

export const missionProgress = (acc, m) => Math.min(m.n, acc.missions.progress[m.ev] || 0);

export function claimMission(acc, id) {
  const list = ensureMissions(acc);
  const m = list.find(x => x.id === id);
  if (!m || acc.missions.claimed[id] || missionProgress(acc, m) < m.n) return 0;
  acc.missions.claimed[id] = true;
  acc.clat += m.reward;
  let bonus = 0;
  if (!acc.missions.bonus && list.every(x => acc.missions.claimed[x.id])) {
    acc.missions.bonus = true;
    acc.clat += MISSIONS_BONUS;
    bonus = MISSIONS_BONUS;
  }
  return m.reward + bonus;
}

// ------------------------------ Boutique -------------------------------
export function buyCosmetic(acc, id) {
  const c = COSMETIC[id];
  if (!c || c.unique || acc.cosmetics.owned.includes(id) || acc.clat < c.price) return false;   // un titre unique ne s'achète pas
  acc.clat -= c.price;
  acc.cosmetics.owned.push(id);
  return true;
}

/** Porter / retirer une apparence (la teinture va sur le perso actif) */
export function equipCosmetic(acc, hero, id) {
  const c = COSMETIC[id];
  if (!c || !acc.cosmetics.owned.includes(id)) return;
  if (c.unique && acc.cosmetics[c.kind] === id) return;   // titre unique : il ne s'enlève qu'en portant un autre titre
  if (c.kind === 'dye' || c.kind === 'skin') {
    if (c.cls && c.cls !== hero.classId) return;   // un skin ne va qu'à sa classe
    hero.dye = hero.dye === id ? null : id;
  }
  else acc.cosmetics[c.kind] = acc.cosmetics[c.kind] === id ? null : id;
}

// ------------------------------ Cadeaux (notes de mise à jour) ------------------------------
/** Récupère un cadeau une seule fois par compte. Renvoie le Flouze gagné (0 si déjà pris). */
export function claimGift(acc, gift, hero = null) {
  if (!gift) return 0;
  acc.gifts ||= {};
  if (acc.gifts[gift.id]) return 0;
  acc.gifts[gift.id] = true;
  return giveReward(acc, gift, hero);
}

/** Donne une récompense (Flouze, coffres, titre) ; les coffres normaux vont au perso actif */
function giveReward(acc, gift, hero = null) {
  acc.clat += gift.amount || 0;
  acc.combatChests += gift.combatChests || 0;   // cadeau en coffres de combat
  acc.warChests = (acc.warChests || 0) + (gift.warChests || 0);   // coffres de guerre
  acc.epicChests = (acc.epicChests || 0) + (gift.epicChests || 0);           // coffres Épiques
  acc.legendaryChests = (acc.legendaryChests || 0) + (gift.legendaryChests || 0);   // coffres Légendaires
  const h = hero || acc.heroes[0];
  if (gift.chests) { refreshChests(h); h.chest.stored += gift.chests; }   // coffres normaux : pour le perso actif
  if (gift.title && COSMETIC[gift.title]) {   // titre offert : porté tout de suite
    if (!acc.cosmetics.owned.includes(gift.title)) acc.cosmetics.owned.push(gift.title);
    acc.cosmetics.title = gift.title;
  }
  return (gift.title ? 1 : 0) + (gift.amount || 0) + (gift.combatChests || 0) + (gift.warChests || 0) + (gift.chests || 0) + (gift.epicChests || 0) + (gift.legendaryChests || 0);
}

// ------------------------------ Récompense de connexion ------------------------------
/** Où en est la série : { claimed (déjà pris aujourd'hui), idx (récompense du jour, 0 à 6), streak (jours de suite déjà pris) } */
export function loginState(acc, now = new Date()) {
  const L = acc.login || { day: '', streak: 0 };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const claimed = L.day === dayKey(now);
  const streak = claimed || L.day === dayKey(y) ? L.streak : 0;   // un jour raté : la série repart de zéro
  return { claimed, streak, idx: (claimed ? streak - 1 : streak) % DAILY_LOGIN.length };
}
/** Prend la récompense du jour (une fois par jour). Renvoie { reward, idx } ou null. */
export function claimLogin(acc, hero = null) {
  const s = loginState(acc);
  if (s.claimed) return null;
  const reward = DAILY_LOGIN[s.idx];
  acc.login = { day: dayKey(), streak: s.streak + 1 };
  giveReward(acc, reward, hero);
  return { reward, idx: s.idx };
}

// ------------------------------ Remise à zéro exceptionnelle ------------------------------
/** Recharge tous les compteurs une seule fois, à l'heure de SPECIAL_RESET. Renvoie true si elle vient d'avoir lieu. */
export function applySpecialReset(acc, now = Date.now()) {
  const R = SPECIAL_RESET;
  if (!R || acc.specialReset === R.id || now < new Date(...R.at).getTime()) return false;
  acc.specialReset = R.id;
  acc.fights = { day: '', done: {}, lvl: acc.fights.lvl || 1 };
  acc.war.done = {}; acc.war.day = '';
  acc.raid.ch = {};
  acc.missions = { day: '', progress: {}, claimed: {}, bonus: false, seen: {} };
  acc.heroes.forEach(h => {
    h.chest = { stored: CHEST_MAX, last: now };
    h.runs = null; h.horde = {};   // toutes les charges reviennent
  });
  return true;
}

/** Corrections de niveau : ramène au niveau prévu les persos de ce compte qui le dépassent (une seule fois). Renvoie les persos corrigés. */
export function applyLevelFixes(acc) {
  const fixed = [];
  const me = (acc.pseudo || '').trim().toLowerCase();
  for (const F of LEVEL_FIXES) {
    if (F.pseudo.toLowerCase() !== me || (acc.levelFixes || []).includes(F.id)) continue;
    acc.levelFixes = [...(acc.levelFixes || []), F.id];
    for (const h of acc.heroes) {
      if (h.level <= F.maxLevel) continue;
      h.level = F.maxLevel;
      h.xp = 0;
      // points de stats en trop : on les retire des stats les plus montées (le reste du build est gardé)
      let extra = spentPoints(h) - totalPoints(h.level);
      while (extra-- > 0) {
        const k = STAT_KEYS.reduce((a, b) => ((h.alloc[b] || 0) > (h.alloc[a] || 0) ? b : a));
        h.alloc[k]--;
      }
      // sorts pas encore débloqués à ce niveau : retirés de la barre
      h.spells = h.spells.filter(id => !SPELLS[id] || SPELLS[id].lvl <= h.level);
      for (const sp of classSpells(h.classId).filter(x => x.lvl <= h.level).reverse()) {   // trous comblés avec les meilleurs sorts débloqués
        if (h.spells.length >= MAX_ACTIVE_SPELLS) break;
        if (!h.spells.includes(sp.id)) h.spells.push(sp.id);
      }
      fixed.push(h);
    }
  }
  return fixed;
}

// ------------------------------ Marchand du jour ------------------------------
/** Les 3 objets gris du jour (les mêmes pour tout le monde), et ce qui a déjà été acheté aujourd'hui */
/** Créneau du marchand (change toutes les 4 h) et temps avant le prochain */
export const shopSlot = (d = new Date()) => `${dayKey(d)}h${Math.floor(d.getHours() / SHOP_DAILY.everyH)}`;
export function msToNextShop(now = Date.now()) {
  const d = new Date(now), next = new Date(now);
  next.setHours((Math.floor(d.getHours() / SHOP_DAILY.everyH) + 1) * SHOP_DAILY.everyH, 0, 0, 0);
  return next - d;
}
export function dailyShop(acc) {
  const day = shopSlot();
  if (!acc.shop || acc.shop.day !== day) acc.shop = { day, bought: {} };
  const rng = makeRng(hashStr('marchand2' + day));
  const pool = ITEM_LIST.slice();
  const out = [];
  while (out.length < SHOP_DAILY.count && pool.length) {
    const itemId = pool.splice(Math.floor(rng() * pool.length), 1)[0].id, rarity = pickWeighted(rng, SHOP_DAILY.odds);
    out.push({ i: out.length, itemId, rarity, price: SHOP_DAILY.prices[rarity], bought: !!acc.shop.bought[out.length] });
  }
  return out;
}
export function buyDaily(acc, hero, i) {
  const it = dailyShop(acc)[i];
  if (!it || it.bought || acc.clat < it.price) return null;
  acc.clat -= it.price;
  acc.shop.bought[i] = true;
  return addItem(hero, it.itemId, it.rarity);
}

// ------------------------------ Paris ----------------------------------
/** Cotes d'un duel selon la puissance des deux combattants */
export function betOdds(powerA, powerB) {
  const a = Math.pow(Math.max(1, powerA), 4), b = Math.pow(Math.max(1, powerB), 4);
  const pA = a / (a + b);
  const odd = (p) => Math.round(Math.min(10, Math.max(1.1, 0.95 / p)) * 100) / 100;
  return [odd(pA), odd(1 - pA)];
}
