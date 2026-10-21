// =====================================================================
//  ENCHÈRES — en ligne : tables « auctions » et « bids » (serveur/encheres.sql).
//  Hors ligne (jeu de test) : tout est gardé sur le téléphone et les amis
//  bots mettent des objets en vente et enchérissent, pour pouvoir essayer.
// =====================================================================
import * as NET from './net.js?v=20261021235041';
import { ITEM_LIST, FRIENDS, SELL_PRICE } from './data.js?v=20261021235041';
import { aucEnd, aucTop, aucNext, eraRow } from './engine.js?v=20261021235041';

const KEY = 'fuzev2-encheres';
const ME = 'moi';
export const myId = () => (NET.online ? NET.myId() : ME);

// ---------- hors ligne ----------
function loadLocal() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.auctions) return s; } catch (e) { /* stockage indisponible */ }
  return { auctions: [], bids: [], seq: 1, tick: 0 };
}
function saveLocal(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* stockage indisponible */ } }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const botValue = (r) => SELL_PRICE[r] * 5;   // les bots n'enchérissent jamais au-delà

/** Les bots vivent un peu à chaque visite : ils gardent 3 ventes en cours et enchérissent de temps en temps */
function botLife(s, now) {
  if (now - s.tick < 15000) return;
  s.tick = now;
  const live = s.auctions.filter(a => now < aucEnd(a));
  for (let n = live.filter(a => a.seller_id !== ME).length; n < 3; n++) {
    const f = pick(FRIENDS), r = 1 + Math.floor(Math.random() * 4);
    s.auctions.unshift({ id: s.seq++, seller_id: f.id, pseudo: f.name, hero_id: 'h1', item_id: pick(ITEM_LIST).id, rarity: r,
      min_price: Math.max(1, Math.round(SELL_PRICE[r] * (1.5 + Math.random()))), created_at: new Date(now - Math.random() * 20 * 3600e3).toISOString() });
  }
  for (const a of s.auctions) {
    if (now >= aucEnd(a)) continue;
    const top = aucTop(s.bids, a.id);
    const next = aucNext(a, top);
    if (next > botValue(a.rarity)) continue;
    // sur ma vente, un bot finit souvent par enchérir ; sur celles des bots, ils me repassent devant de temps en temps
    const chance = a.seller_id === ME ? 0.55 : top && top.user_id === ME ? 0.3 : 0.12;
    if (Math.random() > chance) continue;
    const f = pick(FRIENDS.filter(x => x.id !== a.seller_id && (!top || x.id !== top.user_id)));
    if (!f) continue;
    s.bids.push({ id: s.seq++, auction_id: a.id, user_id: f.id, pseudo: f.name, amount: Math.min(botValue(a.rarity), next + Math.floor(Math.random() * next * 0.2)), created_at: new Date(now).toISOString() });
  }
  // on oublie ce qui est fini depuis plus de 14 jours
  const old = now - 14 * 864e5;
  s.auctions = s.auctions.filter(a => aucEnd(a) > old);
  const ids = new Set(s.auctions.map(a => a.id));
  s.bids = s.bids.filter(b => ids.has(b.auction_id));
}

// ---------- commun ----------
/** Toutes les ventes récentes (en cours et terminées) et leurs offres */
export async function load() {
  if (NET.online) {   // rien de l'ancien jeu ni des essais d'avant 19 h
    const r = await NET.fetchAuctions();
    const auctions = r.auctions.filter(a => eraRow(a.created_at)), ids = new Set(auctions.map(a => a.id));
    return { auctions, bids: r.bids.filter(b => ids.has(b.auction_id)) };
  }
  const s = loadLocal();
  botLife(s, Date.now());
  saveLocal(s);
  return { auctions: s.auctions.map(a => ({ ...a })), bids: s.bids.map(b => ({ ...b })) };
}

/** Met un objet en vente pour 24 h */
export async function create(row) {
  if (NET.online) return NET.createAuction(row);
  const s = loadLocal(), now = Date.now();
  if (s.auctions.some(a => a.seller_id === ME && now < aucEnd(a))) throw new Error('Tu as déjà un objet en vente.');
  const a = { ...row, id: s.seq++, seller_id: ME, created_at: new Date(now).toISOString() };
  s.auctions.unshift(a);
  s.tick = now;   // les bots attendent un peu avant d'enchérir
  saveLocal(s);
  return a;
}

/** Fait une offre (le Flouze est déjà retiré par le jeu) */
export async function bid(auctionId, pseudo, amount) {
  if (NET.online) return NET.placeBid(auctionId, pseudo, amount);
  const s = loadLocal(), now = Date.now();
  const a = s.auctions.find(x => x.id === auctionId);
  const top = a && aucTop(s.bids, a.id);
  if (!a || now >= aucEnd(a) || amount < aucNext(a, top)) throw new Error('Offre refusée : la vente est finie ou quelqu’un a déjà mis plus.');
  s.bids.push({ id: s.seq++, auction_id: a.id, user_id: ME, pseudo, amount, created_at: new Date(now).toISOString() });
  saveLocal(s);
}

/** Outil de test (hors ligne) : termine toutes les ventes en cours */
export function finishAllLocal() {
  if (NET.online) return;
  const s = loadLocal();
  const past = new Date(Date.now() - 24 * 3600e3 - 1000).toISOString();
  s.auctions.forEach(a => { if (Date.now() < aucEnd(a)) a.created_at = past; });
  saveLocal(s);
}
