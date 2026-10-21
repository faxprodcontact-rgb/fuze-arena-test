// Faux serveur en mémoire : essai de la mise en ligne 2.0 (essai.html sur le site de test, jamais sur le vrai jeu).
// essai.html?pseudo=Fuuuuze#avant=30 : ton ancien compte, et « 19 h » dans 30 s.
import * as E from './js/engine.js?v=20261021235041';
import { ERA } from './js/data.js?v=20261021235041';
const H = 3600e3, t = (ms) => new Date(Date.now() - ms).toISOString(), now = () => new Date().toISOString();
const arr = (ms) => { const d = new Date(ms); return [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]; };
// #avant=40 : « 19 h » dans 40 s (mise en ligne il y a 30 min) ; sinon « 19 h » = il y a 1 h
const pre = /avant=(\d+)/.exec(location.hash);
if (pre) { ERA.open = arr(Date.now() - H / 2); ERA.start = arr(Date.now() + pre[1] * 1000); } else { ERA.open = arr(Date.now() - 2 * H); ERA.start = arr(Date.now() - H); }
const lag = () => new Promise(r => setTimeout(r, 120));
export const online = true;
export const MAX_PLAYERS = 8;
const ME = 'u-moi';
const oldAcc = (pseudo, cls, lvl) => { const a = E.newAccount(pseudo, cls); delete a.era; a.heroes[0].level = lvl; a.clat = 5000; return a; };
const newAcc = (pseudo, cls, lvl) => { const a = E.newAccount(pseudo, cls); a.heroes[0].level = lvl; a.war.section = 'bleue'; return a; };
const others = [
  { id: 'u-loic', pseudo: 'Loic', data: newAcc('Loic', 'guerrier', 3) },
  { id: 'u-tom', pseudo: 'Tom', data: oldAcc('Tom', 'archer', 95) },        // pas encore revenu : ne doit pas apparaître
  { id: 'u-tchomb', pseudo: 'Tchomb', data: newAcc('Tchomb', 'mage', 2) },
];
const PSEUDO = new URLSearchParams(location.search).get('pseudo') || 'Simon';
let mine = { id: ME, pseudo: PSEUDO, data: oldAcc(PSEUDO, 'paladin', 40) };
// ?lourd=1 : comptes déjà bien avancés (3 persos, 90 objets chacun) pour mesurer la fluidité, comme après une soirée de jeu
if (new URLSearchParams(location.search).get('lourd')) {
  const { ITEM_LIST } = await import('./js/data.js?v=20261021235041');
  let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const heavy = (pseudo, cls) => {
    const a = E.newAccount(pseudo, cls[0]); a.born = Date.now(); a.heroes[0].level = 50;
    cls.slice(1).forEach(c => E.addCharacter(a, c));
    a.heroes.forEach(h => { h.level = 25 + Math.floor(rnd() * 6); for (let i = 0; i < 90; i++) E.addItem(h, ITEM_LIST[Math.floor(rnd() * ITEM_LIST.length)].id, Math.floor(rnd() * 5));});
    a.heroes.forEach(h => { h.story = { prog: Math.floor(rnd() * 26), stars: {}, claimed: {} }; });   // avancée dans l'Histoire
    a.active = 0; a.clat = 150; a.war.section = 'bleue'; return a;
  };
  mine = { id: ME, pseudo: PSEUDO, data: heavy(PSEUDO, ['archer', 'mage', 'paladin', 'guerrier']) };
  const myProg = +new URLSearchParams(location.search).get('prog');   // ?prog=30 : mon avancée dans l'Histoire
  if (myProg) mine.data.heroes.forEach(h => { h.story.prog = myProg; });
  others.length = 0;
  ['Fuuuuze', 'AlexDcr', 'Kush', 'Tchomb', 'Didztasoeur', 'Le Stein'].forEach((n, i) => others.push({ id: 'u-' + i, pseudo: n, data: heavy(n, [['archer', 'paladin', 'guerrier'], ['guerrier', 'mage'], ['archer'], ['guerrier', 'archer'], ['paladin', 'archer', 'mage'], ['guerrier']][i]) }));
}
const db = { msgs: [{ id: 1, user_id: 'u-tom', pseudo: 'Tom', text: 'vieux message', created_at: t(5 * H) }], fights: [], challenges: [], wagers: [], auctions: [], bids: [],
  raids: [{ week: 'hollande-c0-2026-10-19', boss: 'hollande:c0', hp: 900000, level: 90, created_at: t(30 * H) }],
  hits: [{ week: 'hollande-c0-2026-10-19', user_id: 'u-tom', pseudo: 'Tom', damage: 400000, created_at: t(20 * H) }] };
let nid = 100;
// ancien trône (lundi) et ancien combat du journal : ne doivent plus compter
db.fights.push({ id: nid++, kind: 'throne_start', attacker_id: 'u-tom', attacker_name: 'Tom', a_snap: { week: E.throneRound(), order: ['u-tom', ME, 'u-loic'] }, winner: 0, created_at: t(20 * H) });
db.fights.push({ id: nid++, kind: 'arena', attacker_id: 'u-tom', defender_id: ME, attacker_name: 'Tom', defender_name: 'Testeur', winner: 0, seed: 1, a_snap: {}, d_snap: {}, created_at: t(3 * H) });
export function setSaveErrorHandler() {}
export async function playerCount() { return 4; }
export async function signUp() { return mine; }
export async function signIn() { return mine; }
export async function createRow() {}
export async function restore() { await lag(); return mine; }
export async function fetchOthers() { await lag(); return others.map(o => ({ ...o, data: JSON.parse(JSON.stringify(o.data)) })); }
let onlineIds = new Set();
export const onlineSet = () => onlineIds;
export async function joinPresence(pseudo, onChange) { setTimeout(() => onChange(onlineIds), 300); }
export function queueSave(acc) { mine.data = JSON.parse(JSON.stringify(acc)); }
export async function flush() {}
export async function signOut() {}
export async function fetchMessages() { return db.msgs.slice(); }
export async function sendMessage(pseudo, text) { const m = { id: nid++, user_id: ME, pseudo, text, created_at: now() }; db.msgs.push(m); return m; }
export async function subscribeChat() {}
export async function unsubscribeChat() {}
export const myId = () => ME;
export async function logFight(row) { await lag(); const r = { ...row, id: nid++, attacker_id: ME, created_at: now() }; db.fights.push(r); return { id: r.id, created_at: r.created_at }; }
export async function fetchMyFights() { await lag(); return db.fights.filter(f => !['throne_start', 'champ_start', 'champ'].includes(f.kind) && (f.attacker_id === ME || f.defender_id === ME)).slice().reverse(); }
export async function fetchThrone(since) { await lag(); return db.fights.filter(f => ['throne_start', 'throne'].includes(f.kind) && f.created_at >= since); }
export async function fetchChamp(since) { await lag(); return db.fights.filter(f => ['champ_start', 'champ'].includes(f.kind) && f.created_at >= since); }
export async function fetchFight(id) { return db.fights.find(f => f.id == id); }
export async function fetchChallenges() { return db.challenges.map(c => ({ ...c })); }
export async function createChallenge() {}
export async function createPvp() { return {}; }
export async function answerChallenge() {}
export async function fetchWagers() { return []; }
export async function placeWager() {}
export async function fetchAuctions() { await lag(); return { auctions: db.auctions.map(a => ({ ...a })), bids: db.bids.map(b => ({ ...b })) }; }
export async function createAuction(row) { await lag(); const a = { ...row, id: nid++, seller_id: ME, created_at: now() }; db.auctions.unshift(a); return a; }
export async function placeBid(auction_id, pseudo, amount) { await lag(); db.bids.push({ id: nid++, auction_id, user_id: ME, pseudo, amount, created_at: now() }); }
export async function getRaid(week) { await lag(); return db.raids.find(r => r.week === week) || null; }
export async function fetchLatestRaids() { await lag(); return db.raids.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2); }
export async function openRaid(week, boss, hp, level) { if (!db.raids.find(r => r.week === week)) db.raids.push({ week, boss, hp, level, created_at: now() }); return getRaid(week); }
export async function fetchRaidHits(week) { return db.hits.filter(h => h.week === week); }
export async function addRaidHit(week, pseudo, damage) { db.hits.push({ week, user_id: ME, pseudo, damage, created_at: now() }); }
export async function subscribeLive() {}
window.__fake = { db, mine, others };
