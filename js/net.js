// =====================================================================
//  EN LIGNE — comptes et sauvegardes sur Supabase
//  Chaque joueur a une ligne dans la table « accounts » avec toute sa
//  progression (data). Chacun peut lire les autres (pour les combats,
//  la guerre, le classement) mais ne peut modifier que la sienne.
// =====================================================================
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261021235041';

export const online = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const MAX_PLAYERS = 8;

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
let sb = null;
let userId = null;
let pending = null;
let timer = null;
let onSaveError = () => {};

async function client() {
  if (!sb) {
    const { createClient } = await import(SDK);
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return sb;
}

// Supabase demande un e-mail : on en fabrique un à partir du pseudo (aucun mail n'est envoyé).
const slug = (p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const emailOf = (pseudo) => `${slug(pseudo)}@joueurs.fuze-arena.app`;

function frError(e) {
  const m = (e && e.message) || String(e);
  if (/invalid login credentials/i.test(m)) return 'Pseudo ou mot de passe incorrect.';
  if (/already registered|already exists|duplicate key/i.test(m)) return 'Ce pseudo est déjà pris.';
  if (/at least 6 characters/i.test(m)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (/complet/i.test(m)) return `Le jeu est complet (${MAX_PLAYERS} joueurs maximum).`;
  if (/failed to fetch|network/i.test(m)) return 'Pas de connexion internet.';
  if (/email not confirmed/i.test(m)) return 'Compte pas encore activé (confirmation e-mail activée dans Supabase).';
  return 'Erreur : ' + m;
}

export function setSaveErrorHandler(fn) { onSaveError = fn; }

/** Nombre de joueurs déjà inscrits (lisible sans être connecté) */
export async function playerCount() {
  const c = await client();
  const { data, error } = await c.rpc('player_count');
  if (error) return 0;
  return data || 0;
}

export async function signUp(pseudo, password, data) {
  if (!slug(pseudo)) throw new Error('Pseudo invalide : utilise des lettres ou des chiffres.');
  const c = await client();
  if ((await playerCount()) >= MAX_PLAYERS) throw new Error(frError('complet'));
  const { data: au, error } = await c.auth.signUp({ email: emailOf(pseudo), password });
  if (error) throw new Error(frError(error));
  if (!au.session) throw new Error('Compte créé, mais il faut désactiver « Confirm email » dans Supabase.');
  userId = au.user.id;
  const { error: e2 } = await c.from('accounts').insert({ id: userId, pseudo, data });
  if (e2) { await c.auth.signOut(); throw new Error(frError(e2)); }
  return { id: userId, pseudo, data };
}

/** Connexion. Renvoie { id, pseudo, data } ou { id, pseudo, data: null } si le compte n'a pas encore de personnage. */
export async function signIn(pseudo, password) {
  const c = await client();
  const { data: au, error } = await c.auth.signInWithPassword({ email: emailOf(pseudo), password });
  if (error) throw new Error(frError(error));
  userId = au.user.id;
  return fetchMine(pseudo);
}

async function fetchMine(fallbackPseudo = '') {
  const c = await client();
  const { data, error } = await c.from('accounts').select('id, pseudo, data').eq('id', userId).maybeSingle();
  if (error) throw new Error(frError(error));
  return data || { id: userId, pseudo: fallbackPseudo, data: null };
}

/** Crée la ligne du compte si elle manque (inscription interrompue) */
export async function createRow(pseudo, data) {
  const c = await client();
  const { error } = await c.from('accounts').insert({ id: userId, pseudo, data });
  if (error) throw new Error(frError(error));
}

/** Reprend la session enregistrée sur ce téléphone */
export async function restore() {
  const c = await client();
  const { data: { session } } = await c.auth.getSession();
  if (!session) return null;
  userId = session.user.id;
  return fetchMine();
}

/** Les autres joueurs (pour l'arène, la guerre et le classement) */
export async function fetchOthers() {
  const c = await client();
  const { data, error } = await c.from('accounts').select('id, pseudo, data, updated_at').neq('id', userId);
  if (error) throw new Error(frError(error));
  return (data || []).filter(p => p.data && p.data.heroes);
}

/** Sauvegarde (regroupée pour ne pas envoyer à chaque clic) */
export function queueSave(acc) {
  pending = acc;
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
}

export async function flush() {
  if (!pending || !userId) return;
  const data = JSON.parse(JSON.stringify(pending));
  pending = null;
  try {
    const c = await client();
    const { error } = await c.from('accounts').update({ data, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
  } catch (e) {
    onSaveError(frError(e));
    if (!pending) pending = data;
    clearTimeout(timer);
    timer = setTimeout(flush, 5000);
  }
}

export async function signOut() {
  await flush();
  await unsubscribeChat();
  const c = await client();
  if (liveChannel) { await c.removeChannel(liveChannel); liveChannel = null; }
  if (presenceChannel) { await c.removeChannel(presenceChannel); presenceChannel = null; onlineIds = new Set(); }
  await c.auth.signOut();
  userId = null;
}

// ------------------------------ Tchat ------------------------------
export async function fetchMessages(limit = 60) {
  const c = await client();
  const { data, error } = await c.from('messages').select('id, user_id, pseudo, text, created_at').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(frError(error));
  return (data || []).reverse();
}

export async function sendMessage(pseudo, text) {
  const c = await client();
  const { data, error } = await c.from('messages').insert({ user_id: userId, pseudo, text }).select('id, user_id, pseudo, text, created_at').single();
  if (error) throw new Error(frError(error));
  return data;
}

let chatChannel = null;
/** Reçoit les nouveaux messages en direct */
export async function subscribeChat(onMessage) {
  const c = await client();
  if (chatChannel) await c.removeChannel(chatChannel);
  chatChannel = c.channel('tchat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => onMessage(payload.new))
    .subscribe();
}

export async function unsubscribeChat() {
  if (!chatChannel) return;
  const c = await client();
  await c.removeChannel(chatChannel);
  chatChannel = null;
}

export const myId = () => userId;

// ------------------------------ Journal des combats ------------------------------
export async function logFight(row) {
  const c = await client();
  const { data, error } = await c.from('fight_log').insert({ ...row, attacker_id: userId }).select('id, created_at').single();
  if (error) throw new Error(frError(error));
  return data;
}

export async function fetchMyFights(limit = 40) {
  const c = await client();
  const { data, error } = await c.from('fight_log')
    .select('id, attacker_id, defender_id, attacker_name, defender_name, kind, winner, seed, a_snap, d_snap, created_at')
    .or(`attacker_id.eq.${userId},defender_id.eq.${userId}`).not('kind', 'in', '("throne_start","champ_start","champ")')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(frError(error));
  return data || [];
}

/** Le trône : l'ordre de départ de chaque semaine et les défis, depuis une date (rangés dans le journal des combats) */
export async function fetchThrone(sinceIso) {
  const c = await client();
  const { data, error } = await c.from('fight_log')
    .select('id, attacker_id, defender_id, attacker_name, defender_name, kind, winner, seed, a_snap, created_at')
    .in('kind', ['throne_start', 'throne']).gte('created_at', sinceIso)
    .order('id', { ascending: true }).limit(2000);
  if (error) throw new Error(frError(error));
  return data || [];
}

/** Le championnat : le tableau de chaque semaine et les matchs joués (rangés dans le journal des combats) */
export async function fetchChamp(sinceIso) {
  const c = await client();
  const { data, error } = await c.from('fight_log')
    .select('id, attacker_name, kind, winner, seed, a_snap, created_at')
    .in('kind', ['champ_start', 'champ']).gte('created_at', sinceIso)
    .order('id', { ascending: true }).limit(500);
  if (error) throw new Error(frError(error));
  return data || [];
}

export async function fetchFight(id) {
  const c = await client();
  const { data, error } = await c.from('fight_log').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(frError(error));
  return data;
}

// ------------------------------ Défis et paris ------------------------------
export async function fetchChallenges(days = 4) {
  const c = await client();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await c.from('challenges').select('*').gte('created_at', since).order('created_at', { ascending: false });
  if (error) throw new Error(frError(error));
  return data || [];
}

export async function createChallenge(toId, fromName, toName) {
  const c = await client();
  const { error } = await c.from('challenges').insert({ from_id: userId, to_id: toId, from_name: fromName, to_name: toName });
  if (error) throw new Error(frError(error));
}

/** Défi PvP : comme un défi, mais avec l'équipe du lanceur (from_snap.pvp) */
export async function createPvp(toId, fromName, toName, fromSnap, seed) {
  const c = await client();
  const { data, error } = await c.from('challenges').insert({ from_id: userId, to_id: toId, from_name: fromName, to_name: toName, from_snap: fromSnap, seed }).select().single();
  if (error) throw new Error(frError(error));
  return data;
}

export async function answerChallenge(id, patch) {
  const c = await client();
  const { error } = await c.from('challenges').update(patch).eq('id', id);
  if (error) throw new Error(frError(error));
}

export async function fetchWagers(challengeIds) {
  if (!challengeIds.length) return [];
  const c = await client();
  const { data, error } = await c.from('wagers').select('*').in('challenge_id', challengeIds);
  if (error) throw new Error(frError(error));
  return data || [];
}

export async function placeWager(challengeId, pseudo, side, amount, odds) {
  const c = await client();
  const { error } = await c.from('wagers').insert({ challenge_id: challengeId, user_id: userId, pseudo, side, amount, odds });
  if (error) throw new Error(/row-level/i.test(error.message) ? 'Les paris sur ce duel sont fermés.' : frError(error));
}

// ------------------------------ Enchères ------------------------------
/** Ventes aux enchères des derniers jours (en cours et terminées) et leurs offres */
export async function fetchAuctions(days = 14) {
  const c = await client();
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data: auctions, error } = await c.from('auctions').select('*').gte('created_at', since).order('created_at', { ascending: false });
  if (error) throw new Error(frError(error));
  if (!auctions.length) return { auctions, bids: [] };
  const { data: bids, error: e2 } = await c.from('bids').select('*').in('auction_id', auctions.map(a => a.id));
  if (e2) throw new Error(frError(e2));
  return { auctions, bids };
}

/** Met un objet en vente (24 h). La base refuse si on a déjà une vente en cours. */
export async function createAuction(row) {
  const c = await client();
  const { data, error } = await c.from('auctions').insert({ ...row, seller_id: userId }).select().single();
  if (error) throw new Error(/row-level/i.test(error.message) ? 'Tu as déjà un objet en vente.' : frError(error));
  return data;
}

/** Offre sur une vente. La base refuse si la vente est finie ou si quelqu'un a déjà mis autant ou plus. */
export async function placeBid(auctionId, pseudo, amount) {
  const c = await client();
  const { error } = await c.from('bids').insert({ auction_id: auctionId, user_id: userId, pseudo, amount });
  if (error) throw new Error(/row-level/i.test(error.message) ? 'Offre refusée : la vente est finie ou quelqu’un a déjà mis plus.' : frError(error));
}

// ------------------------------ Raid ------------------------------
export async function getRaid(week) {
  const c = await client();
  const { data, error } = await c.from('raids').select('*').eq('week', week).maybeSingle();
  if (error) throw new Error(frError(error));
  return data;
}

/** Les 2 derniers raids (le raid en cours et le précédent) */
export async function fetchLatestRaids() {
  const c = await client();
  const { data, error } = await c.from('raids').select('*').order('created_at', { ascending: false }).limit(2);
  if (error) throw new Error(frError(error));
  return data || [];
}

/** Ouvre le raid de la semaine (si quelqu'un l'a déjà ouvert, on garde le sien) */
export async function openRaid(week, boss, hp, level) {
  const c = await client();
  const { error } = await c.from('raids').insert({ week, boss, hp, level });
  if (error && !/duplicate|23505/i.test(error.message + error.code)) throw new Error(frError(error));
  return getRaid(week);
}

export async function fetchRaidHits(week) {
  const c = await client();
  const { data, error } = await c.from('raid_hits').select('user_id, pseudo, damage, created_at').eq('week', week);
  if (error) throw new Error(frError(error));
  return data || [];
}

export async function addRaidHit(week, pseudo, damage) {
  const c = await client();
  const { error } = await c.from('raid_hits').insert({ week, user_id: userId, pseudo, damage });
  if (error) throw new Error(frError(error));
}

// ------------------------------ En direct ------------------------------
let liveChannel = null;
/** Prévient l'interface quand : on se fait attaquer, un défi ou un pari arrive, Mélenchon prend un coup */
export async function subscribeLive(onEvent) {
  const c = await client();
  if (liveChannel) await c.removeChannel(liveChannel);
  liveChannel = c.channel('direct')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fight_log', filter: `defender_id=eq.${userId}` }, (p) => onEvent('fight', p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, (p) => onEvent('challenge', p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wagers' }, (p) => onEvent('wager', p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raid_hits' }, (p) => onEvent('raid', p.new))
    .subscribe();
}

// ------------------------------ Joueurs en ligne ------------------------------
// Chaque joueur connecté s'annonce sur un canal « présence » : quand il ferme l'appli, il disparaît de la liste.
let presenceChannel = null;
let onlineIds = new Set();
export const onlineSet = () => onlineIds;

export async function joinPresence(pseudo, onChange) {
  const c = await client();
  if (presenceChannel) await c.removeChannel(presenceChannel);
  presenceChannel = c.channel('en-ligne', { config: { presence: { key: userId } } });
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      onlineIds = new Set(Object.keys(presenceChannel.presenceState()));
      onChange(onlineIds);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await presenceChannel.track({ pseudo, since: new Date().toISOString() });
    });
}
