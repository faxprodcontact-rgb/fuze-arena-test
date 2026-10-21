// =====================================================================
//  DONNÉES DU JEU — c'est ici qu'on change les noms, stats, sorts, objets
// =====================================================================

export const MAX_LEVEL = 100;
export const POINTS_PER_LEVEL = 3;
export const CHEST_INTERVAL_MS = 30 * 60 * 1000;     // un coffre toutes les 30 min
export const CHEST_MAX = 5;                          // cumulables jusqu'à 5
export const WINS_PER_COMBAT_CHEST = 3;              // 3 victoires = 1 coffre de combat
export const MAX_ACTIVE_SPELLS = 4;
// Recharges : chaque donjon (par perso), la Horde (par perso) et le gros boss (par compte) ont des charges qui reviennent
// une par une : 1 toutes les 4 h, 3 au maximum. Le chrono démarre quand on utilise une charge. Même total qu'avant (6 par jour).
export const RECHARGE = { ms: 4 * 3600 * 1000, max: 3 };
export const DUNGEON_RUNS = 3;      // charges d'un donjon (le maximum en réserve)
export const DUNGEON_KEYS_MAX = 10; // clefs gagnées au maximum en donjon par jour (remise à minuit), par personnage (ensuite : XP seulement)
export const DUNGEON_SKIP_KEEP = 2; // les 2 donjons débloqués les plus durs se font en vrai ; les autres peuvent être passés (XP divisée par 2)
export const KEY_PRICE = 70;       // une clef coûte 70 Flouze à la boutique (1 clef = 1 coffre)
export const SELL_PRICE = [1, 3, 7, 16, 40, 100, 250];   // revente d'un objet selon sa rareté (en Flouze)
// Enchères (boutique) : 1 objet en vente à la fois par joueur, pendant 24 h, vendu au plus offrant.
// Chaque offre doit dépasser la meilleure d'au moins 5 % (1 Flouze minimum). Le Flouze misé est bloqué, et rendu si quelqu'un met plus.
export const AUCTION = { hours: 24, step: 0.05, maxPrice: 100000 };
export const REMATCH_CLAT = 5;     // 1ʳᵉ revanche gagnée contre chaque pote, par jour : 5 Flouze
export const STAT_RESET_COST = 20;  // replacer ses points coûte 20 Flouze
// Remise à zéro générale (tous les compteurs) : changer ce code la relance pour tout le monde
export const RESET_ID = '2026-10-18-maj';
// Fuze Arena 2.0 : chaque compte en ligne repart de zéro une seule fois (il choisit un nouveau héros).
// open : mise en ligne, l'appli affiche le compte à rebours jusqu'à start (personne n'entre avant).
// start : ouverture à tous. Ce qui a été joué en ligne avant (trône, raid, journal, enchères, comptes d'essai) ne compte plus.
// Récompense de connexion : une par jour. La série monte du jour 1 au jour 7 (puis recommence au jour 1) ;
// un jour raté et elle repart du jour 1.
export const DAILY_LOGIN = [{ chests: 2 }, { amount: 30 }, { chests: 3 }, { combatChests: 1 }, { amount: 50 }, { warChests: 1 }, { epicChests: 1 }];
export const ERA = { id: '2.0', open: [2026, 9, 20, 17, 30], start: [2026, 9, 20, 19, 0] };   // 20/10/2026 à 19 h

export const STAT_KEYS = ['vit', 'atk', 'mag', 'def', 'spd', 'lck'];

export const STATS = {
  vit: { name: 'Vitalité', short: 'VIE', color: '#ff5d6c', desc: 'Plus de points de vie : +8 PV par point' },
  atk: { name: 'Attaque', short: 'ATQ', color: '#ff9f43', desc: 'Tes coups d’arme font plus mal' },
  mag: { name: 'Magie', short: 'MAG', color: '#a77bff', desc: 'Tes sorts magiques et tes soins sont plus forts' },
  def: { name: 'Défense', short: 'DÉF', color: '#54a0ff', desc: 'Tu prends moins de dégâts' },
  spd: { name: 'Vitesse', short: 'VIT', color: '#1dd1a1', desc: 'Tu joues plus souvent que l’adversaire' },
  lck: { name: 'Chance', short: 'CHA', color: '#feca57', desc: 'Plus de coups critiques et d’esquives' },
};

export const RARITIES = [
  { id: 0, name: 'Commun', color: '#a4a9b3', mult: 1 },
  { id: 1, name: 'Peu commun', color: '#4cd964', mult: 1.8 },
  { id: 2, name: 'Rare', color: '#3d9bff', mult: 3.2 },
  { id: 3, name: 'Épique', color: '#b05cff', mult: 5.5 },
  { id: 4, name: 'Légendaire', color: '#ff9f1a', mult: 9 },
  // ces deux-là ne sortent jamais des coffres : seulement par fusion (2 Légendaires → Mythique, 2 Mythiques → Chaotique)
  { id: 5, name: 'Mythique', color: '#ff3d6e', mult: 12 },
  { id: 6, name: 'Chaotique', color: '#ff2bd6', mult: 16 },
];

// Bonus de chance : tous les `step` coffres ouverts (depuis le début), Peu commun, Rare et Épique gagnent
// chacun `gain` points, pris au Commun (au Peu commun pour le coffre de guerre), qui ne descend pas sous `floor`.
export const CHEST_LUCK = { step: { normal: 100, combat: 50, war: 25 }, gain: 2, floor: 10 };
export const OPEN_MAX = 10;                       // coffres ouverts au maximum d'un coup

// Objets identiques (même objet, même rareté) qu'il faut fusionner pour monter d'un rang, depuis Commun … jusqu'à Mythique.
// 3 Mythiques pour 1 Chaotique : un joueur à fond finit tout en Chaotique vers le jour 40, niveau ~96 (voir refonte/simulations/equipement.mjs ;
// c'était le jour 34 avant les 4 panoplies élémentaires : plus d'objets différents = moins de doublons à fusionner).
export const FUSE_NEED = [2, 2, 2, 2, 3, 3];   // objets identiques pour monter d'une rareté : 3 Légendaires → 1 Mythique, 3 Mythiques → 1 Chaotique (tout Chaotique vers le jour 47)

// Probabilités de rareté dans les coffres (en %)
export const CHEST_ODDS = {
  normal: [72, 22, 5, 1, 0],
  combat: [40, 38, 16, 5, 1],
  war: [0, 50, 32, 14, 4],     // coffre de guerre : jamais de Commun
  epic: [0, 0, 0, 99, 1],       // coffre Épique (offert en cadeau) : 99 % Épique, 1 % Légendaire
  legendary: [0, 0, 0, 0, 99, 1],   // coffre Légendaire (offert en cadeau) : 99 % Légendaire, 1 % Mythique
};

// ---------------------------------------------------------------------
//  GUERRE DES SECTIONS — une guerre dure 7 jours complets (à partir du samedi 17/10/2026 à 00:00)
// ---------------------------------------------------------------------
export const WAR = {
  sections: {
    rouge: { name: 'Assassins', the: 'les Assassins', color: '#ff5d6c', motto: 'Frapper vite, frapper fort, disparaître.' },
    bleue: { name: 'Templiers', the: 'les Templiers', color: '#3d9bff', motto: 'L’honneur, le bouclier, et pas un pas en arrière.' },
  },
  start: [2026, 9, 17],    // début de la 1re guerre (année, mois - 1, jour) : ensuite une toutes les 7 jours
  minAttacks: 5,           // attaques minimum dans la semaine pour toucher la récompense
  // chaque guerre dure 1 semaine ; à la suivante, tout le monde rechoisit son camp (on ne change pas en cours de semaine)
  maxPerSection: 4,        // 8 joueurs max dans le jeu = 4 par section
  warChestItems: 3,        // objets dans un coffre de guerre
};

export const SLOTS = {
  hat: { name: 'Chapeau' },
  weapon: { name: 'Arme' },
  armor: { name: 'Armure' },
  boots: { name: 'Bottes' },
  amulet: { name: 'Amulette' },
  pet: { name: 'Familier' },
};
export const SLOT_ORDER = ['hat', 'weapon', 'armor', 'boots', 'amulet', 'pet'];

// ---------------------------------------------------------------------
//  CLASSES
//  base = stats au niveau 1, growth = stats gagnées automatiquement par niveau
// ---------------------------------------------------------------------
export const CLASSES = {
  guerrier: {
    name: 'Guerrier',
    desc: 'Solide et brutal. Encaisse les coups et frappe fort au corps à corps.',
    weapon: 'sword',
    base: { vit: 14, atk: 12, mag: 2, def: 10, spd: 8, lck: 4 },
    growth: { vit: 1.2, atk: 1.0, mag: 0.1, def: 0.8, spd: 0.4, lck: 0.3 },
    basic: { name: "Coup d'épée", scale: 'atk', mult: 1, melee: true, fx: 'slash' },
  },
  mage: {
    name: 'Mage',
    desc: 'Fragile mais dévastateur. Brûle, gèle et foudroie à distance.',
    weapon: 'staff',
    base: { vit: 9, atk: 3, mag: 15, def: 5, spd: 9, lck: 6 },
    growth: { vit: 0.9, atk: 0.1, mag: 1.2, def: 0.4, spd: 0.4, lck: 0.4 },
    basic: { name: 'Trait magique', scale: 'mag', mult: 0.95, fx: 'bolt' },
  },
  archer: {
    name: 'Archer',
    desc: 'Rapide et précis. Critiques, poison et pluies de flèches.',
    weapon: 'bow',
    base: { vit: 11, atk: 12, mag: 2, def: 7, spd: 13, lck: 10 },
    growth: { vit: 1.1, atk: 1.0, mag: 0.1, def: 0.4, spd: 0.8, lck: 0.6 },
    basic: { name: 'Tir', scale: 'atk', mult: 1, fx: 'arrow' },
  },
  paladin: {
    name: 'Paladin',
    desc: 'Chevalier sacré. Se soigne, se protège et use son adversaire.',
    weapon: 'hammer',
    base: { vit: 12, atk: 8, mag: 8, def: 10, spd: 7, lck: 4 },
    growth: { vit: 1.1, atk: 0.6, mag: 0.7, def: 0.8, spd: 0.4, lck: 0.2 },
    basic: { name: 'Coup de marteau', scale: 'mix', mult: 1, melee: true, fx: 'bash' },
  },
};

// ---------------------------------------------------------------------
//  SORTS — un nouveau sort tous les 10 niveaux (1, 10, 20 … 100)
//  scale : stat utilisée (atk, mag, def, ou mix = moyenne attaque/magie)
//  mult : puissance (1.5 = 150 %), hits : nombre de coups, cd : recharge en tours
// ---------------------------------------------------------------------
const S = (cls, list) => list.map(s => ({ ...s, cls }));

export const SPELL_LIST = [
  ...S('guerrier', [
    { id: 'g1', lvl: 1, name: 'Coup puissant', cd: 2, scale: 'atk', mult: 1.6, melee: true, fx: 'slash', desc: 'Gros coup d’épée (160 % Attaque).' },
    { id: 'g10', lvl: 10, name: 'Cri de guerre', cd: 5, fx: 'roar', effects: [{ k: 'buff', stat: 'atk', pct: 0.45, turns: 3 }], desc: '+45 % Attaque pendant 3 tours.' },
    { id: 'g20', lvl: 20, name: 'Brise-armure', cd: 4, scale: 'atk', mult: 1.1, melee: true, fx: 'bash', effects: [{ k: 'debuff', stat: 'def', pct: 0.3, turns: 3 }], desc: '110 % Attaque et −30 % Défense ennemie (3 tours).' },
    { id: 'g30', lvl: 30, name: 'Bouclier levé', cd: 5, fx: 'shield', effects: [{ k: 'shield', scale: 'def', mult: 2.5 }], desc: 'Bouclier qui absorbe 250 % de ta Défense.' },
    { id: 'g40', lvl: 40, name: 'Tourbillon', cd: 4, scale: 'atk', mult: 0.65, hits: 3, melee: true, fx: 'whirl', desc: '3 coups de 65 % Attaque.' },
    { id: 'g50', lvl: 50, name: 'Coup de bouclier', cd: 5, scale: 'atk', mult: 0.9, melee: true, fx: 'bash', effects: [{ k: 'stun', chance: 0.45 }], desc: '90 % Attaque, 45 % de chance d’étourdir.' },
    { id: 'g60', lvl: 60, name: 'Second souffle', cd: 6, fx: 'heal', effects: [{ k: 'heal', pctMax: 0.2 }], desc: 'Rend 20 % des PV max.' },
    { id: 'g70', lvl: 70, name: 'Charge', cd: 4, scale: 'atk', mult: 2.1, melee: true, fx: 'slash', desc: 'Fonce sur l’ennemi (210 % Attaque).' },
    { id: 'g80', lvl: 80, name: 'Rage sanguinaire', cd: 5, scale: 'atk', mult: 1.5, lifesteal: 0.5, melee: true, fx: 'slash', desc: '150 % Attaque, vole 50 % des dégâts.' },
    { id: 'g90', lvl: 90, name: 'Exécution', cd: 5, scale: 'atk', mult: 1.7, execute: 1, melee: true, fx: 'slash', desc: '170 % Attaque, double si l’ennemi a moins de 35 % PV.' },
    { id: 'g100', lvl: 100, name: 'Colère du Titan', cd: 8, scale: 'atk', mult: 3.2, melee: true, fx: 'bash', effects: [{ k: 'stun', chance: 1 }], desc: '320 % Attaque et étourdit à coup sûr.' },
    { id: 'g15', lvl: 15, name: 'Provocation', cd: 4, scale: 'atk', mult: 0.8, melee: true, fx: 'bash', effects: [{ k: 'debuff', stat: 'atk', pct: 0.2, turns: 3 }], desc: '80 % Attaque et −20 % Attaque ennemie (3 tours).' },
    { id: 'g35', lvl: 35, name: 'Saignée', cd: 4, scale: 'atk', mult: 0.9, melee: true, fx: 'slash', effects: [{ k: 'dot', kind: 'poison', name: 'Saignement', mult: 0.3, turns: 3 }], desc: '90 % Attaque + saignement 3 tours.' },
    { id: 'g45', lvl: 45, name: 'Peau de fer', cd: 6, fx: 'buff', effects: [{ k: 'buff', stat: 'def', pct: 0.5, turns: 3 }], desc: '+50 % Défense pendant 3 tours.' },
    { id: 'g65', lvl: 65, name: 'Double tranchant', cd: 4, scale: 'atk', mult: 0.95, hits: 2, crit: 0.15, melee: true, fx: 'slash', desc: '2 coups de 95 % Attaque, +15 % de critique.' },
    { id: 'g85', lvl: 85, name: 'Cri de ralliement', cd: 6, fx: 'roar', effects: [{ k: 'heal', pctMax: 0.15 }, { k: 'buff', stat: 'atk', pct: 0.25, turns: 3 }], desc: 'Rend 15 % des PV et +25 % Attaque (3 tours).' },
  ]),
  ...S('mage', [
    { id: 'm1', lvl: 1, name: 'Boule de feu', cd: 2, scale: 'mag', mult: 1.15, fx: 'fireball', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.2, turns: 3 }], desc: '115 % Magie + brûlure 3 tours.' },
    { id: 'm10', lvl: 10, name: 'Éclair', cd: 3, scale: 'mag', mult: 1.6, fx: 'lightning', desc: 'La foudre tombe (160 % Magie).' },
    { id: 'm20', lvl: 20, name: 'Armure de givre', cd: 5, fx: 'shield', effects: [{ k: 'shield', scale: 'mag', mult: 1.2 }], desc: 'Bouclier de glace (120 % Magie).' },
    { id: 'm30', lvl: 30, name: 'Gel', cd: 4, scale: 'mag', mult: 0.9, fx: 'ice', effects: [{ k: 'debuff', stat: 'spd', pct: 0.25, turns: 3 }], desc: '90 % Magie et −25 % Vitesse ennemie.' },
    { id: 'm40', lvl: 40, name: 'Pluie de feu', cd: 5, scale: 'mag', mult: 0.5, hits: 4, fx: 'firerain', desc: '4 boules de 50 % Magie.' },
    { id: 'm50', lvl: 50, name: 'Siphon', cd: 4, scale: 'mag', mult: 1.2, lifesteal: 0.35, fx: 'drain', desc: '120 % Magie, vole 35 % des dégâts.' },
    { id: 'm60', lvl: 60, name: 'Concentration', cd: 5, fx: 'buff', effects: [{ k: 'buff', stat: 'mag', pct: 0.3, turns: 3 }], desc: '+30 % Magie pendant 3 tours.' },
    { id: 'm70', lvl: 70, name: 'Prison de glace', cd: 6, scale: 'mag', mult: 1, fx: 'ice', effects: [{ k: 'stun', chance: 0.6 }], desc: '100 % Magie, 60 % de chance d’étourdir.' },
    { id: 'm80', lvl: 80, name: 'Combustion', cd: 5, scale: 'mag', mult: 0.8, fx: 'fireball', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.45, turns: 4 }], desc: '80 % Magie + grosse brûlure 4 tours.' },
    { id: 'm90', lvl: 90, name: 'Météore', cd: 7, scale: 'mag', mult: 3, fx: 'meteor', desc: 'Un météore s’écrase (300 % Magie).' },
    { id: 'm100', lvl: 100, name: 'Apocalypse', cd: 8, scale: 'mag', mult: 1.6, hits: 3, fx: 'meteor', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.5, turns: 3 }], desc: '3 météores de 160 % Magie + brûlure.' },
    { id: 'm15', lvl: 15, name: 'Missiles arcaniques', cd: 2, scale: 'mag', mult: 0.6, hits: 2, fx: 'bolt', desc: '2 missiles de 60 % Magie.' },
    { id: 'm35', lvl: 35, name: 'Nova de givre', cd: 5, scale: 'mag', mult: 0.8, fx: 'ice', effects: [{ k: 'stun', chance: 0.35 }], desc: '80 % Magie, 35 % de chance de geler l’ennemi.' },
    { id: 'm45', lvl: 45, name: 'Bouclier de mana', cd: 5, fx: 'shield', effects: [{ k: 'shield', scale: 'mag', mult: 1.6 }], desc: 'Bouclier qui absorbe 160 % de ta Magie.' },
    { id: 'm65', lvl: 65, name: 'Chaîne d’éclairs', cd: 5, scale: 'mag', mult: 0.7, hits: 3, fx: 'lightning', desc: '3 éclairs de 70 % Magie.' },
    { id: 'm85', lvl: 85, name: 'Embrasement', cd: 6, scale: 'mag', mult: 1.9, fx: 'fireball', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.4, turns: 3 }], desc: 'Énorme boule de feu (190 % Magie) + brûlure.' },
  ]),
  ...S('archer', [
    { id: 'a1', lvl: 1, name: 'Tir précis', cd: 2, scale: 'atk', mult: 1.5, crit: 0.2, fx: 'arrow', desc: '150 % Attaque, +20 % de critique.' },
    { id: 'a10', lvl: 10, name: 'Flèche empoisonnée', cd: 3, scale: 'atk', mult: 0.8, fx: 'poisonArrow', effects: [{ k: 'dot', kind: 'poison', name: 'Poison', mult: 0.3, turns: 4 }], desc: '80 % Attaque + poison 4 tours.' },
    { id: 'a20', lvl: 20, name: 'Double tir', cd: 3, scale: 'atk', mult: 0.8, hits: 2, fx: 'arrow', desc: '2 flèches de 80 % Attaque.' },
    { id: 'a30', lvl: 30, name: 'Pas de côté', cd: 5, fx: 'buff', effects: [{ k: 'buff', stat: 'lck', pct: 0.8, turns: 3 }], desc: '+80 % Chance pendant 3 tours.' },
    { id: 'a40', lvl: 40, name: 'Flèche perçante', cd: 4, scale: 'atk', mult: 1.5, pierce: 0.6, fx: 'arrow', desc: '150 % Attaque, ignore 60 % de la Défense.' },
    { id: 'a50', lvl: 50, name: 'Piège à loup', cd: 5, scale: 'atk', mult: 0.7, fx: 'trap', effects: [{ k: 'stun', chance: 0.5 }], desc: '70 % Attaque, 50 % de chance d’étourdir.' },
    { id: 'a60', lvl: 60, name: 'Œil de faucon', cd: 5, fx: 'buff', effects: [{ k: 'buff', stat: 'atk', pct: 0.35, turns: 3 }], desc: '+35 % Attaque pendant 3 tours.' },
    { id: 'a70', lvl: 70, name: 'Volée', cd: 5, scale: 'atk', mult: 0.45, hits: 5, fx: 'rain', desc: '5 flèches de 45 % Attaque.' },
    { id: 'a80', lvl: 80, name: 'Flèche vampirique', cd: 4, scale: 'atk', mult: 1.3, lifesteal: 0.4, fx: 'drain', desc: '130 % Attaque, vole 40 % des dégâts.' },
    { id: 'a90', lvl: 90, name: 'Tir mortel', cd: 6, scale: 'atk', mult: 2.4, crit: 0.4, fx: 'arrow', desc: '240 % Attaque, +40 % de critique.' },
    { id: 'a100', lvl: 100, name: 'Tempête de flèches', cd: 8, scale: 'atk', mult: 0.5, hits: 8, fx: 'rain', desc: '8 flèches de 50 % Attaque.' },
    { id: 'a15', lvl: 15, name: 'Flèche enflammée', cd: 3, scale: 'atk', mult: 1, fx: 'arrow', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.25, turns: 3 }], desc: '100 % Attaque + brûlure 3 tours.' },
    { id: 'a35', lvl: 35, name: 'Tir entravant', cd: 4, scale: 'atk', mult: 1.2, fx: 'arrow', effects: [{ k: 'debuff', stat: 'spd', pct: 0.3, turns: 3 }], desc: '120 % Attaque et −30 % Vitesse ennemie.' },
    { id: 'a45', lvl: 45, name: 'Camouflage', cd: 6, fx: 'buff', effects: [{ k: 'buff', stat: 'lck', pct: 1, turns: 2 }], desc: '+100 % Chance pendant 2 tours (esquives et critiques).' },
    { id: 'a65', lvl: 65, name: 'Flèche lourde', cd: 5, scale: 'atk', mult: 1.8, pierce: 0.3, fx: 'arrow', desc: '180 % Attaque, ignore 30 % de la Défense.' },
    { id: 'a85', lvl: 85, name: 'Pluie empoisonnée', cd: 6, scale: 'atk', mult: 0.45, hits: 4, fx: 'rain', effects: [{ k: 'dot', kind: 'poison', name: 'Poison', mult: 0.3, turns: 3 }], desc: '4 flèches de 45 % Attaque + poison.' },
  ]),
  ...S('paladin', [
    { id: 'p1', lvl: 1, name: 'Frappe sacrée', cd: 2, scale: 'mix', mult: 1.4, melee: true, fx: 'bash', desc: '140 % Attaque/Magie au marteau.' },
    { id: 'p10', lvl: 10, name: 'Lumière apaisante', cd: 4, fx: 'heal', effects: [{ k: 'heal', scale: 'mag', mult: 2.2 }], desc: 'Soigne 220 % de ta Magie.' },
    { id: 'p20', lvl: 20, name: 'Bouclier divin', cd: 5, fx: 'shield', effects: [{ k: 'shield', scale: 'def', mult: 2.2 }], desc: 'Bouclier qui absorbe 220 % de ta Défense.' },
    { id: 'p30', lvl: 30, name: 'Jugement', cd: 4, scale: 'mix', mult: 1.1, fx: 'holy', effects: [{ k: 'debuff', stat: 'atk', pct: 0.25, turns: 3 }], desc: '110 % et −25 % Attaque ennemie.' },
    { id: 'p40', lvl: 40, name: 'Marteau de justice', cd: 5, scale: 'mix', mult: 1, melee: true, fx: 'bash', effects: [{ k: 'stun', chance: 0.5 }], desc: '100 %, 50 % de chance d’étourdir.' },
    { id: 'p50', lvl: 50, name: 'Aura de vaillance', cd: 5, fx: 'buff', effects: [{ k: 'buff', stat: 'def', pct: 0.4, turns: 3 }], desc: '+40 % Défense pendant 3 tours.' },
    { id: 'p60', lvl: 60, name: 'Consécration', cd: 5, scale: 'mix', mult: 0.5, hits: 3, fx: 'holy', effects: [{ k: 'heal', scale: 'mag', mult: 1 }], desc: '3 frappes de lumière et petit soin.' },
    { id: 'p70', lvl: 70, name: 'Châtiment', cd: 4, scale: 'mix', mult: 1.8, pierce: 0.3, fx: 'holy', desc: '180 %, ignore 30 % de la Défense.' },
    { id: 'p80', lvl: 80, name: 'Renouveau', cd: 6, fx: 'heal', effects: [{ k: 'heal', pctMax: 0.3 }], desc: 'Rend 30 % des PV max.' },
    { id: 'p90', lvl: 90, name: 'Colère céleste', cd: 6, scale: 'mix', mult: 2.2, fx: 'holy', desc: 'Pilier de lumière (220 %).' },
    { id: 'p100', lvl: 100, name: 'Intervention divine', cd: 9, fx: 'heal', effects: [{ k: 'heal', pctMax: 0.3 }, { k: 'shield', scale: 'mag', mult: 1.2 }], desc: 'Rend 30 % des PV et donne un bouclier.' },
    { id: 'p15', lvl: 15, name: 'Bénédiction', cd: 5, fx: 'heal', effects: [{ k: 'heal', scale: 'mag', mult: 1.2 }, { k: 'buff', stat: 'def', pct: 0.25, turns: 3 }], desc: 'Soigne 120 % de ta Magie et +25 % Défense.' },
    { id: 'p35', lvl: 35, name: 'Bouclier lancé', cd: 4, scale: 'mix', mult: 1.2, fx: 'holy', effects: [{ k: 'stun', chance: 0.25 }], desc: '120 %, 25 % de chance d’étourdir.' },
    { id: 'p45', lvl: 45, name: 'Lumière purificatrice', cd: 5, scale: 'mix', mult: 0.9, fx: 'holy', effects: [{ k: 'heal', scale: 'mag', mult: 1.2 }], desc: '90 % et te soigne de 120 % de ta Magie.' },
    { id: 'p65', lvl: 65, name: 'Égide', cd: 6, fx: 'shield', effects: [{ k: 'shield', scale: 'def', mult: 3 }], desc: 'Bouclier qui absorbe 300 % de ta Défense.' },
    { id: 'p85', lvl: 85, name: 'Marteau du jugement', cd: 6, scale: 'mix', mult: 2.4, melee: true, fx: 'bash', effects: [{ k: 'debuff', stat: 'def', pct: 0.3, turns: 3 }], desc: '240 % et −30 % Défense ennemie.' },
  ]),
];

// Sorts des monstres de donjon (pas jouables par les héros)
SPELL_LIST.push(...S('monster', [
  { id: 'x_slam', lvl: 0, name: 'Écrasement', cd: 3, scale: 'atk', mult: 1.5, melee: true, fx: 'bash' },
  { id: 'x_club', lvl: 0, name: 'Coup de massue', cd: 4, scale: 'atk', mult: 1.1, melee: true, fx: 'bash', effects: [{ k: 'stun', chance: 0.35 }] },
  { id: 'x_roar', lvl: 0, name: 'Cri sauvage', cd: 5, fx: 'roar', effects: [{ k: 'buff', stat: 'atk', pct: 0.3, turns: 3 }] },
  { id: 'x_bones', lvl: 0, name: 'Lancer d’os', cd: 2, scale: 'atk', mult: 1.2, fx: 'rock' },
  { id: 'x_harden', lvl: 0, name: 'Carapace', cd: 5, fx: 'shield', effects: [{ k: 'shield', scale: 'def', mult: 2 }] },
  { id: 'x_spores', lvl: 0, name: 'Spores toxiques', cd: 3, scale: 'mag', mult: 0.7, fx: 'spore', effects: [{ k: 'dot', kind: 'poison', name: 'Poison', mult: 0.3, turns: 4 }] },
  { id: 'x_regen', lvl: 0, name: 'Régénération', cd: 5, fx: 'heal', effects: [{ k: 'heal', pctMax: 0.15 }] },
  { id: 'x_rock', lvl: 0, name: 'Jet de rocher', cd: 3, scale: 'atk', mult: 1.6, fx: 'rock' },
  { id: 'x_stomp', lvl: 0, name: 'Séisme', cd: 5, scale: 'atk', mult: 0.9, melee: true, fx: 'bash', effects: [{ k: 'stun', chance: 0.4 }] },
  { id: 'x_curse', lvl: 0, name: 'Malédiction', cd: 4, scale: 'mag', mult: 1, fx: 'drain', effects: [{ k: 'debuff', stat: 'atk', pct: 0.25, turns: 3 }] },
  { id: 'x_drain', lvl: 0, name: 'Drain d’âme', cd: 4, scale: 'mag', mult: 1.2, lifesteal: 0.4, fx: 'drain' },
  { id: 'x_wail', lvl: 0, name: 'Hurlement glaçant', cd: 4, scale: 'mag', mult: 0.8, fx: 'ice', effects: [{ k: 'debuff', stat: 'def', pct: 0.3, turns: 3 }] },
  { id: 'x_firewave', lvl: 0, name: 'Vague de flammes', cd: 4, scale: 'mag', mult: 0.5, hits: 3, fx: 'firerain' },
  { id: 'x_burn', lvl: 0, name: 'Embrasement', cd: 5, scale: 'mag', mult: 0.8, fx: 'fireball', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.4, turns: 4 }] },
  { id: 'x_frost', lvl: 0, name: 'Souffle gelé', cd: 4, scale: 'mag', mult: 1.1, fx: 'ice', effects: [{ k: 'debuff', stat: 'spd', pct: 0.3, turns: 3 }] },
  { id: 'x_bite', lvl: 0, name: 'Morsure', cd: 3, scale: 'atk', mult: 1.4, lifesteal: 0.5, melee: true, fx: 'slash' },
  { id: 'x_bats', lvl: 0, name: 'Nuée de chauves-souris', cd: 5, scale: 'mag', mult: 0.4, hits: 4, fx: 'drain' },
  { id: 'x_hellfire', lvl: 0, name: 'Feu infernal', cd: 5, scale: 'mag', mult: 2, fx: 'meteor' },
  { id: 'x_breath', lvl: 0, name: 'Souffle de feu', cd: 3, scale: 'mag', mult: 1.5, fx: 'fireball', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.4, turns: 3 }] },
  { id: 'x_meteors', lvl: 0, name: 'Pluie de météores', cd: 6, scale: 'mag', mult: 0.7, hits: 3, fx: 'meteor' },
  { id: 'x_gnaw', lvl: 0, name: 'Grignotage', cd: 3, scale: 'atk', mult: 0.5, hits: 3, melee: true, fx: 'slash' },
  { id: 'x_howl', lvl: 0, name: 'Hurlement de meute', cd: 5, fx: 'roar', effects: [{ k: 'buff', stat: 'spd', pct: 0.35, turns: 3 }] },
  { id: 'x_rot', lvl: 0, name: 'Morsure putride', cd: 4, scale: 'atk', mult: 0.9, melee: true, fx: 'slash', effects: [{ k: 'dot', kind: 'poison', name: 'Poison', mult: 0.3, turns: 4 }] },
  { id: 'x_tongue', lvl: 0, name: 'Coup de langue', cd: 3, scale: 'atk', mult: 1.2, lifesteal: 0.4, fx: 'spore' },
  { id: 'x_web', lvl: 0, name: 'Toile collante', cd: 4, scale: 'mag', mult: 0.6, fx: 'spore', effects: [{ k: 'debuff', stat: 'spd', pct: 0.35, turns: 3 }] },
  { id: 'x_wrap', lvl: 0, name: 'Bandelettes', cd: 5, scale: 'mag', mult: 0.8, fx: 'drain', effects: [{ k: 'stun', chance: 0.4 }] },
  { id: 'x_lava', lvl: 0, name: 'Crachat de lave', cd: 3, scale: 'mag', mult: 1.2, fx: 'fireball', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.35, turns: 3 }] },
  { id: 'x_maul', lvl: 0, name: 'Coup de patte', cd: 3, scale: 'atk', mult: 1.6, melee: true, fx: 'bash' },
  { id: 'x_shadow', lvl: 0, name: 'Lame des ténèbres', cd: 4, scale: 'atk', mult: 1.6, pierce: 0.4, melee: true, fx: 'slash' },
  { id: 'x_gaze', lvl: 0, name: 'Regard pétrifiant', cd: 5, scale: 'mag', mult: 1, fx: 'bolt', effects: [{ k: 'stun', chance: 0.45 }] },
  { id: 'x_heads', lvl: 0, name: 'Triple morsure', cd: 4, scale: 'atk', mult: 0.6, hits: 3, melee: true, fx: 'slash' },
]));

export const SPELLS = Object.fromEntries(SPELL_LIST.map(s => [s.id, s]));

// ---------------------------------------------------------------------
//  DONJONS — un tous les 10 niveaux. Le boss est calibré pour être
//  battable même par les joueurs les moins forts.
//  profile : répartition des stats du boss (1 = moyenne d'un joueur)
// ---------------------------------------------------------------------
export const DUNGEONS = [
  { id: 'd1', lvl: 1, name: 'Appartement 33', boss: 'Roi Gluant', sprite: 'slimeKing', theme: 'cave',
    profile: { vit: 1.4, atk: 0.9, mag: 0.4, def: 0.9, spd: 0.6, lck: 0.4 },
    basic: { name: 'Rebond', scale: 'atk', mult: 1, melee: true, fx: 'bash' }, spells: ['x_slam'],
    alt: { boss: 'Rat géant', sprite: 'rat', profile: { vit: 1.1, atk: 1, mag: 0.3, def: 0.7, spd: 0.9, lck: 0.6 }, basic: { name: 'Morsure', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_gnaw'] } },
  { id: 'd10', lvl: 10, name: 'C3 Blanche', boss: 'Chef Gobelin', sprite: 'goblin', theme: 'forest',
    profile: { vit: 1.1, atk: 0.85, mag: 0.3, def: 0.8, spd: 0.8, lck: 0.6 },
    basic: { name: 'Coup de gourdin', scale: 'atk', mult: 1, melee: true, fx: 'bash' }, spells: ['x_club', 'x_roar'],
    alt: { boss: 'Loup des bois', sprite: 'wolf', profile: { vit: 1, atk: 0.86, mag: 0.3, def: 0.72, spd: 0.88, lck: 0.6 }, basic: { name: 'Crocs', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_howl', 'x_bite'] } },
  { id: 'd20', lvl: 20, name: 'Université de Lorraine', boss: 'Seigneur Squelette', sprite: 'skeleton', theme: 'crypt',
    profile: { vit: 1, atk: 0.9, mag: 0.3, def: 0.85, spd: 0.8, lck: 0.6 },
    basic: { name: 'Coup d’os', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_harden', 'x_bones'],
    alt: { boss: 'Zombie affamé', sprite: 'zombie', profile: { vit: 1.25, atk: 0.86, mag: 0.3, def: 0.75, spd: 0.6, lck: 0.4 }, basic: { name: 'Griffure', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_rot'] } },
  { id: 'd30', lvl: 30, name: 'Bayonne', boss: 'Champignon Toxique', sprite: 'mushroom', theme: 'swamp',
    profile: { vit: 1.3, atk: 0.5, mag: 0.9, def: 0.9, spd: 0.6, lck: 0.5 },
    basic: { name: 'Coup de chapeau', scale: 'mag', mult: 0.9, melee: true, fx: 'bash' }, spells: ['x_regen', 'x_spores'],
    alt: { boss: 'Crapaud géant', sprite: 'frog', profile: { vit: 1.3, atk: 0.92, mag: 0.8, def: 0.8, spd: 0.7, lck: 0.5 }, basic: { name: 'Coup de langue', scale: 'atk', mult: 1, fx: 'spore' }, spells: ['x_tongue', 'x_spores'] } },
  { id: 'd40', lvl: 40, name: 'Maison Mervans', boss: 'Golem de pierre', sprite: 'golem', theme: 'mine',
    profile: { vit: 1.25, atk: 1, mag: 0.2, def: 1.05, spd: 0.4, lck: 0.3 },
    basic: { name: 'Poing de pierre', scale: 'atk', mult: 1, melee: true, fx: 'bash' }, spells: ['x_harden', 'x_stomp', 'x_rock'],
    alt: { boss: 'Araignée des mines', sprite: 'spider', profile: { vit: 1.05, atk: 0.95, mag: 0.7, def: 0.8, spd: 0.9, lck: 0.7 }, basic: { name: 'Crochets', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_web', 'x_rot'] } },
  { id: 'd50', lvl: 50, name: 'Double B', boss: 'Spectre maudit', sprite: 'ghost', theme: 'crypt',
    profile: { vit: 1, atk: 0.3, mag: 1.05, def: 0.6, spd: 0.9, lck: 0.8 },
    basic: { name: 'Toucher spectral', scale: 'mag', mult: 0.95, fx: 'bolt' }, spells: ['x_curse', 'x_drain', 'x_wail'],
    alt: { boss: 'Momie', sprite: 'mummy', profile: { vit: 1.25, atk: 0.6, mag: 1.05, def: 0.8, spd: 0.6, lck: 0.5 }, basic: { name: 'Malédiction', scale: 'mag', mult: 0.95, fx: 'drain' }, spells: ['x_wrap', 'x_curse', 'x_regen'] } },
  { id: 'd60', lvl: 60, name: 'Luxembourg Place', boss: 'Élémentaire de feu', sprite: 'fireElem', theme: 'volcano',
    profile: { vit: 1.1, atk: 0.3, mag: 1.05, def: 0.7, spd: 0.85, lck: 0.6 },
    basic: { name: 'Flammèche', scale: 'mag', mult: 0.95, fx: 'fireball' }, spells: ['x_burn', 'x_firewave'],
    alt: { boss: 'Salamandre de lave', sprite: 'salamander', profile: { vit: 1, atk: 0.6, mag: 0.92, def: 0.7, spd: 1, lck: 0.6 }, basic: { name: 'Morsure brûlante', scale: 'mag', mult: 0.95, melee: true, fx: 'slash' }, spells: ['x_lava', 'x_firewave'] } },
  { id: 'd70', lvl: 70, name: 'Chalet des Vosges', boss: 'Yéti', sprite: 'yeti', theme: 'glacier',
    profile: { vit: 1.4, atk: 1.1, mag: 0.7, def: 0.9, spd: 0.8, lck: 0.5 },
    basic: { name: 'Griffes', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_frost', 'x_roar', 'x_slam'],
    alt: { boss: 'Ours polaire', sprite: 'polarBear', profile: { vit: 1.5, atk: 1.15, mag: 0.3, def: 1, spd: 0.6, lck: 0.4 }, basic: { name: 'Coup de griffe', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_maul', 'x_frost', 'x_roar'] } },
  { id: 'd80', lvl: 80, name: 'Commissariat', boss: 'Comte Vampire', sprite: 'vampire', theme: 'castle',
    profile: { vit: 1.05, atk: 0.9, mag: 0.8, def: 0.75, spd: 1, lck: 0.7 },
    basic: { name: 'Griffes', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_bite', 'x_bats', 'x_curse'],
    alt: { boss: 'Chevalier noir', sprite: 'blackKnight', profile: { vit: 1.1, atk: 1.05, mag: 0.4, def: 1.05, spd: 0.8, lck: 0.6 }, basic: { name: 'Coup d’épée', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_shadow', 'x_harden', 'x_curse'] } },
  { id: 'd90', lvl: 90, name: 'Mélusine', boss: 'Démon des abysses', sprite: 'demon', theme: 'abyss',
    profile: { vit: 1.2, atk: 0.6, mag: 1, def: 0.8, spd: 0.8, lck: 0.6 },
    basic: { name: 'Griffe infernale', scale: 'mag', mult: 0.95, fx: 'bolt' }, spells: ['x_regen', 'x_hellfire', 'x_drain', 'x_curse'],
    alt: { boss: 'Œil des abysses', sprite: 'abyssEye', profile: { vit: 1.1, atk: 0.4, mag: 1.1, def: 0.7, spd: 0.9, lck: 0.8 }, basic: { name: 'Rayon', scale: 'mag', mult: 0.95, fx: 'bolt' }, spells: ['x_gaze', 'x_drain', 'x_curse'] } },
  { id: 'd100', lvl: 100, name: 'Maison de Salva', boss: 'Dragon ancien', sprite: 'dragon', theme: 'volcano',
    profile: { vit: 1.5, atk: 0.8, mag: 1, def: 1, spd: 0.6, lck: 0.5 },
    basic: { name: 'Coup de queue', scale: 'atk', mult: 1, melee: true, fx: 'bash' }, spells: ['x_harden', 'x_meteors', 'x_breath', 'x_roar'],
    alt: { boss: 'Hydre', sprite: 'hydra', profile: { vit: 1.5, atk: 0.95, mag: 0.8, def: 0.95, spd: 0.7, lck: 0.5 }, basic: { name: 'Morsure', scale: 'atk', mult: 1, melee: true, fx: 'slash' }, spells: ['x_heads', 'x_regen', 'x_rot', 'x_roar'] } },
];

// ---------------------------------------------------------------------
//  PANOPLIES — bonus en % quand on porte 3 ou 5 pièces de la même panoplie
// ---------------------------------------------------------------------
// Chaque panoplie a 2 spécialités (spec) et une voie (voie) : l'arme et les bottes donnent de l'Attaque ou de la Magie.
// 17 panoplies, 15 paires de spécialités différentes (les 2 paires en double n'ont pas la même voie).
export const SETS = {
  thomas: { name: 'Panoplie de Thomas', spec: ['spd', 'lck'], voie: 'atk' },
  loic: { name: 'Panoplie de Loïc', spec: ['atk', 'vit'], voie: 'atk' },
  tchomb: { name: 'Panoplie de Tchomb', spec: ['mag', 'def'], voie: 'mag' },
  tom: { name: 'Panoplie de Tom', spec: ['lck', 'atk'], voie: 'atk' },
  guillaume: { name: 'Panoplie de Guillaume', spec: ['def', 'vit'], voie: 'mag' },
  simon: { name: 'Panoplie de Simon', spec: ['vit', 'spd'], voie: 'atk' },
  alexis: { name: 'Panoplie d’Alexis', spec: ['atk', 'def'], voie: 'atk' },
  appart33: { name: 'Panoplie Appartement 33', spec: ['vit', 'lck'], voie: 'mag' },
  fax: { name: 'Panoplie Fax', spec: ['mag', 'spd'], voie: 'mag' },
  deuxb: { name: 'Panoplie 2B', spec: ['def', 'spd'], voie: 'atk' },
  romain: { name: 'Panoplie de Romain', spec: ['def', 'lck'], voie: 'mag' },
  mcdo: { name: 'Panoplie McDo', spec: ['mag', 'atk'], voie: 'mag' },
  foot: { name: 'Panoplie du Footballeur', spec: ['mag', 'lck'], voie: 'mag' },
  // Panoplies élémentaires (assorties aux skins feu, glace, lumière, ténèbres)
  brasier: { name: 'Panoplie du Brasier', spec: ['atk', 'spd'], voie: 'atk', el: 'feu' },
  givre: { name: 'Panoplie du Givre', spec: ['def', 'mag'], voie: 'mag', el: 'glace' },
  aube: { name: 'Panoplie de l’Aube', spec: ['mag', 'vit'], voie: 'mag', el: 'lumiere' },
  neant: { name: 'Panoplie du Néant', spec: ['spd', 'lck'], voie: 'mag', el: 'tenebres' },
};

// ---------------------------------------------------------------------
//  OBJETS — stats au rang Commun (multipliées selon la rareté)
//  Chaque pièce donne toujours la stat de son emplacement (BASE_PART), puis les 2 spécialités de sa panoplie (SPEC_PART chacune) :
//   - chapeau, armure, amulette : Vie ;
//   - arme, bottes : Attaque ou Magie, selon la voie de la panoplie ;
//   - familier : Attaque ou Magie, puis ses 2 spécialités à lui.
//  icon : forme dessinée, colors : [couleur principale, couleur secondaire]
// ---------------------------------------------------------------------
const BASE_PART = 2.25, SPEC_PART = 1.75;
// Réglage fin : la Magie des objets un peu plus forte, l'Attaque un peu plus faible (Magie +6 à +10 % par rapport à l'ancien équipement)
export const ITEM_STAT_K = { mag: 1.3, atk: 0.92 };
// Critique et esquive : seulement à partir de Légendaire, sur chaque pièce d'équipement (pas les familiers), en % selon la rareté.
// Plafonds : jamais plus de 40 % de critique ni de 25 % d'esquive au total.
export const ITEM_CRIT = [0, 0, 0, 0, 0.01, 0.015, 0.02];
export const ITEM_DODGE = [0, 0, 0, 0, 0.006, 0.009, 0.012];
export const CRIT_CAP = 0.40, DODGE_CAP = 0.25;
const SLOT_BASE = { hat: 'vit', armor: 'vit', amulet: 'vit' };
const itemStatsOf = (base, spec) => {
  const stats = Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
  stats[base] += BASE_PART;
  for (const k of spec) stats[k] += SPEC_PART;
  for (const k in ITEM_STAT_K) stats[k] *= ITEM_STAT_K[k];
  for (const k of STAT_KEYS) if (!stats[k]) delete stats[k];
  return stats;
};
function setItems(set, _old, list) {
  const S = SETS[set];
  return list.map(([slot, name, icon, colors, extra = {}]) => ({
    id: `${set}_${slot}`, name, slot, set, icon, colors, stats: itemStatsOf(SLOT_BASE[slot] || S.voie, S.spec), crit: true, dodge: true, ...extra,
  }));
}
// familier : voie (Attaque ou Magie) + 2 spécialités
const pet = (id, name, icon, colors, voie, spec, extra = {}) => ({ id, name, slot: 'pet', icon, colors, voie, spec, stats: itemStatsOf(voie, spec), ...extra });

export const ITEM_LIST = [
  ...setItems('thomas', 'atk', [
    ['hat', 'Queue de cheval', 'ponytail', ['#6b4423', '#d63031']],
    ['weapon', 'Stick', 'stick', ['#f4f4f8', '#e02020']],
    ['armor', 'Pull', 'sweater', ['#2d5fbf', '#f4f4f8']],
    ['boots', 'Balenciaga', 'chunky', ['#e8e8ee', '#2a2238']],
    ['amulet', 'Clef du sac', 'key', ['#d4a437', '#5c6670']],
  ]),
  ...setItems('loic', 'atk', [
    ['hat', 'Crâne', 'bald', ['#f1c08f', '#f1c08f']],
    ['weapon', 'Couteau', 'knife', ['#c9d1da', '#2a2238']],
    ['armor', 'Torse', 'torso', ['#f1c08f', '#f1c08f']],
    ['boots', 'Bottes', 'boots', ['#3b2a20', '#8a5a2b']],
    ['amulet', 'Collier en or', 'chain', ['#e5b33a', '#e5b33a']],
  ]),
  ...setItems('tchomb', 'mag', [
    ['hat', 'Toque', 'toque', ['#f4f4f8', '#d63031']],
    ['weapon', 'Couteau japonais', 'jknife', ['#dfe6ee', '#6b4423']],
    ['armor', 'Blason en cuir', 'leather', ['#8a5a2b', '#e5b33a']],
    ['boots', 'New Balance', 'nb', ['#9aa3ad', '#1e3a8a']],
    ['amulet', 'Talisman', 'talisman', ['#a64dff', '#e5b33a']],
  ]),
  ...setItems('tom', 'atk', [
    ['hat', 'Lunettes rondes', 'glasses', ['#c9a227', '#c9a227']],
    ['weapon', 'Bouteille de rouge', 'bottle', ['#5a1020', '#c0392b']],
    ['armor', 'Pull', 'sweater', ['#2e7d4f', '#f4f4f8']],
    ['boots', 'Birk', 'birk', ['#c49a6c', '#5a3a22']],
    ['amulet', 'Le gramme', 'gram', ['#e8eef5', '#9aa3ad']],
  ]),
  ...setItems('guillaume', 'atk', [
    ['hat', 'Auréole', 'halo', ['#ffd84a', '#ffd84a']],
    ['weapon', 'Poing', 'fist', ['#f1c08f', '#d63031']],
    ['armor', 'Toge', 'toga', ['#f4f4f8', '#e5b33a']],
    ['boots', 'Baskets', 'sneaker', ['#f4f4f8', '#d63031']],
    ['amulet', 'Croix', 'rosary', ['#6b4423', '#e5b33a']],
  ]),
  ...setItems('simon', 'atk', [
    ['hat', 'Casquette', 'cap', ['#3a3a46', '#f4f4f8']],
    ['weapon', 'Ongle', 'karambit', ['#c9d1da', '#2a2238']],
    ['armor', 'Veste', 'jacket', ['#55663f', '#f4f4f8']],
    ['boots', 'Bottes', 'boots', ['#6b4a2b', '#3b2a20']],
    ['amulet', 'Pendentif', 'amulet', ['#3d9bff', '#c9d1da']],
  ]),
  ...setItems('alexis', 'atk', [
    ['hat', 'Gel', 'gel', ['#2a1a10', '#2a1a10']],
    ['weapon', 'Gros bras', 'bigarm', ['#e8b58a', '#e8b58a'], { skin: '#e8b58a' }],
    ['armor', 'T-shirt au corps', 'tshirt', ['#f4f4f8', '#f4f4f8']],
    ['boots', 'Chaussures italiennes', 'italian', ['#6b2e14', '#6b2e14']],
    ['amulet', 'Collier en chaîne', 'chain', ['#c9d1da', '#c9d1da']],
  ]),
  ...setItems('appart33', 'mag', [
    ['hat', 'Chapeau de Noël', 'santa', ['#d63031', '#f4f4f8']],
    ['weapon', 'Aqua', 'hookah', ['#2d98da', '#c9a227']],
    ['armor', 'Sac de sport', 'sportbag', ['#d63031', '#2a2238']],
    ['boots', 'Tapis', 'rug', ['#8e2b2b', '#e5b33a']],
    ['amulet', 'Judas', 'judas', ['#c9a227', '#5c6670']],
  ]),
  ...setItems('fax', 'mag', [
    ['hat', 'Casquette', 'cap', ['#1e1e24', '#ff9f1a']],
    ['weapon', 'GH5', 'camera', ['#3a3a46', '#9aa3ad']],
    ['armor', 'Stabilisateur', 'gimbal', ['#2a2a32', '#3d9bff']],
    ['boots', 'Bottes', 'boots', ['#26262e', '#5c6670']],
    ['amulet', 'Collier spot lumineux', 'spot', ['#3a3a46', '#9aa3ad']],
  ]),
  ...setItems('deuxb', 'atk', [
    ['hat', 'Toque du chef', 'toque', ['#f4f4f8', '#2a2238']],
    ['weapon', 'Spatule en bois', 'spatula', ['#c49a6c', '#8a5a2b']],
    ['armor', 'Tablier de cuisine', 'apron', ['#e8e1cf', '#8e2b2b']],
    ['boots', 'Crocs', 'crocs', ['#4cd964', '#2a9a45']],
    ['amulet', 'Collier burger', 'burger', ['#d4a437', '#5c6670']],
  ]),
  ...setItems('romain', 'atk', [
    ['hat', 'Casque de chantier', 'hardhat', ['#ffc61a', '#e8e8e8']],
    ['weapon', 'Truelle', 'trowel', ['#c9d1da', '#c0392b']],
    ['armor', 'Plastron', 'armor', ['#ff8c1a', '#e8f0f8']],
    ['boots', 'Bottes de chantier', 'boots', ['#c98a2b', '#2a2238']],
    ['amulet', 'Cache-cou', 'gaiter', ['#3a3a46', '#ff8c1a']],
  ]),
  ...setItems('mcdo', 'mag', [
    ['hat', 'Casquette d’équipier', 'cap', ['#d62a1e', '#ffc72c']],
    ['weapon', 'Cornet de frites', 'fries', ['#d62a1e', '#ffc72c']],
    ['armor', 'Tenue d’équipier', 'mcshirt', ['#d62a1e', '#ffc72c']],
    ['boots', 'Baskets antidérapantes', 'sneaker', ['#2a2238', '#ffc72c']],
    ['amulet', 'Médaillon Big Mac', 'burger', ['#ffc72c', '#d62a1e']],
  ]),
  ...setItems('foot', 'mag', [
    ['hat', 'Bandeau de capitaine', 'headband', ['#f4f4f8', '#2d5fbf']],
    ['weapon', 'Ballon d’or', 'ball', ['#ffd84a', '#c9a227']],
    ['armor', 'Maillot n°10', 'jersey', ['#2d5fbf', '#f4f4f8']],
    ['boots', 'Crampons', 'cleats', ['#ff5d6c', '#f4f4f8']],
    ['amulet', 'Médaille de champion', 'medal', ['#ffd84a', '#2d5fbf']],
  ]),

  // Panoplies élémentaires
  ...setItems('brasier', 'atk', [
    ['hat', 'Heaume ardent', 'firehelm', ['#3a2a2e', '#ff9a1a']],
    ['weapon', 'Lame de braise', 'flameblade', ['#e8460e', '#ffd23a']],
    ['armor', 'Cuirasse de lave', 'lavaplate', ['#3a2a2e', '#ff7a1a']],
    ['boots', 'Bottes de cendre', 'emberboots', ['#3a2a2e', '#ff9a1a']],
    ['amulet', 'Cœur de flamme', 'flameheart', ['#e3343d', '#ffb02e']],
  ]),
  ...setItems('givre', 'atk', [
    ['hat', 'Couronne de givre', 'icecrown', ['#7cc4ff', '#e8f8ff']],
    ['weapon', 'Lance de glace', 'icespear', ['#7cc4ff', '#9aa3ad']],
    ['armor', 'Armure de cristal', 'crystalplate', ['#7cc4ff', '#e8f8ff']],
    ['boots', 'Bottes du blizzard', 'frostboots', ['#3773d8', '#bfeaff']],
    ['amulet', 'Flocon éternel', 'snowflake', ['#bfeaff', '#c9d1da']],
  ]),
  ...setItems('aube', 'mag', [
    ['hat', 'Diadème solaire', 'sundiadem', ['#ffd23a', '#fff6c8']],
    ['weapon', 'Sceptre de lumière', 'sunscepter', ['#ffd23a', '#fff6c8']],
    ['armor', 'Robe céleste', 'celestrobe', ['#fffaf0', '#ffd23a']],
    ['boots', 'Sandales ailées', 'wingsandals', ['#fffaf0', '#ffd23a']],
    ['amulet', 'Soleil sacré', 'sunamulet', ['#ffd23a', '#e5b33a']],
  ]),
  ...setItems('neant', 'atk', [
    ['hat', 'Capuche de l’ombre', 'shadowhood', ['#2a1e3a', '#c070ff']],
    ['weapon', 'Faux du néant', 'scythe', ['#4a3a5e', '#c070ff']],
    ['armor', 'Manteau d’ombre', 'shadowcloak', ['#2a1e3a', '#8a40c8']],
    ['boots', 'Bottes fantômes', 'phantomboots', ['#3c2a5a', '#c070ff']],
    ['amulet', 'Œil du néant', 'voideye', ['#7a30b0', '#c9d1da']],
  ]),

  // Familiers — chats
  pet('woody', 'Woody', 'catFat', ['#9b8f80', '#c9bfb2'], 'atk', ['vit', 'def']),
  pet('kuzco', 'Kuzco', 'catTiger', ['#e58e2b', '#ffd59a'], 'atk', ['atk', 'spd']),
  pet('shiva', 'Shiva', 'catThin', ['#c9b79c', '#efe2c4'], 'atk', ['spd', 'lck']),
  pet('malo', 'Malo', 'catBig', ['#6b6b78', '#9aa3ad'], 'mag', ['def', 'vit']),
  pet('fidji', 'Fidji', 'cat', ['#f4f4f8', '#ffffff'], 'mag', ['mag', 'lck'], { eye: '#3d9bff' }),
  pet('nala', 'Nala', 'cat', ['#2d2a33', '#4a4652'], 'mag', ['lck', 'spd'], { eye: '#ffd84a' }),
  pet('gaia', 'Gaia', 'cat', ['#8d8f99', '#b8bac4'], 'mag', ['def', 'spd'], { eye: '#7bed6f' }),
  pet('wiz', 'Wiz', 'catFat', ['#6e707a', '#9a9ca6'], 'mag', ['vit', 'def'], { eye: '#ffd84a' }),
  // Familiers — chiens
  pet('isco', 'Isco', 'greyhound', ['#c9b79c', '#efe2c4'], 'atk', ['spd', 'atk']),
  pet('buck', 'Buck', 'dog', ['#e3c58f', '#f5e2b8'], 'mag', ['vit', 'lck']),
  pet('ivory', 'Ivory', 'canecorso', ['#4a4652', '#6b6b78'], 'atk', ['atk', 'def'], { eye: '#c49a6c' }),
  pet('salto', 'Salto', 'dog', ['#2d2a33', '#4a4652'], 'mag', ['vit', 'atk'], { eye: '#c49a6c' }),
  pet('uby', 'Uby', 'shepherd', ['#2d2a33', '#4a4652'], 'mag', ['def', 'spd'], { eye: '#c49a6c' }),
  // Familiers — serpents
  pet('idan', 'Idan', 'snake', ['#d63031', '#ff7675'], 'atk', ['atk', 'lck']),
  pet('mitsuki', 'Mitsuki', 'snake', ['#ff8fc7', '#ffc2e2'], 'mag', ['mag', 'spd']),
];

export const ITEMS = Object.fromEntries(ITEM_LIST.map(i => [i.id, i]));

// Bonus de panoplie, dans chacune des 2 spécialités : +5 % à 2 pièces, +10 % à 3 pièces, +15 % à 5 pièces (le meilleur palier compte).
// On peut donc mélanger 2 panoplies (3 + 2 pièces) pour booster 4 stats.
export const SET_TIERS = [[2, 0.05], [3, 0.10], [5, 0.15]];
for (const set of Object.values(SETS)) {
  set.bonus = Object.fromEntries(SET_TIERS.map(([n, p]) => [n, Object.fromEntries(set.spec.map(k => [k, p]))]));
}

// ---------------------------------------------------------------------
//  FAMILIERS — affinité (+5 % dans une stat si ton héros est de la bonne classe)
//  et attaque : le familier frappe toutes les 3 actions de son maître, avec les stats du héros.
//  kind : 'pounce' = il bondit sur l'ennemi, sinon c'est un projectile (fx).
// ---------------------------------------------------------------------
export const PET_EVERY = 3;
export const PET_AFFINITY = 0.05;
export const PETS = {
  woody: { aff: ['guerrier', 'vit'], atk: { name: 'Plat ventre', kind: 'pounce', scale: 'atk', mult: 0.55, effects: [{ k: 'stun', chance: 0.15 }], desc: 'Il s’écrase sur l’ennemi (55 % Attaque), peut l’étourdir.' } },
  kuzco: { aff: ['archer', 'atk'], atk: { name: 'Griffes de tigre', kind: 'pounce', scale: 'atk', mult: 0.32, hits: 2, desc: '2 coups de griffes (32 % Attaque).' } },
  shiva: { aff: ['archer', 'spd'], atk: { name: 'Patte éclair', kind: 'pounce', scale: 'atk', mult: 0.5, crit: 0.25, desc: 'Coup de patte vif (50 % Attaque), +25 % de critique.' } },
  malo: { aff: ['guerrier', 'def'], atk: { name: 'Morsure lourde', kind: 'pounce', scale: 'atk', mult: 0.6, desc: 'Grosse morsure (60 % Attaque).' } },
  fidji: { aff: ['mage', 'mag'], atk: { name: 'Regard glacé', fx: 'ice', scale: 'mag', mult: 0.5, effects: [{ k: 'debuff', stat: 'spd', pct: 0.15, turns: 2 }], desc: 'Rayon de glace (50 % Magie), ralentit l’ennemi.' } },
  nala: { aff: ['mage', 'atk'], atk: { name: 'Chat noir', fx: 'bolt', scale: 'mag', mult: 0.5, effects: [{ k: 'debuff', stat: 'lck', pct: 0.3, turns: 2 }], desc: 'Porte malheur (50 % Magie), −30 % Chance ennemie.' } },
  gaia: { aff: ['paladin', 'def'], atk: { name: 'Ronron', kind: 'self', fx: 'heal', effects: [{ k: 'heal', pctMax: 0.04 }], desc: 'Ronronne et soigne son maître (4 % des PV max).' } },
  wiz: { aff: ['paladin', 'vit'], atk: { name: 'Coup de boule', kind: 'pounce', scale: 'mix', mult: 0.5, desc: 'Coup de tête (50 % Attaque/Magie).' } },
  isco: { aff: ['archer', 'spd'], atk: { name: 'Sprint', kind: 'pounce', scale: 'atk', mult: 0.3, hits: 2, desc: 'Fonce 2 fois sur l’ennemi (30 % Attaque).' } },
  buck: { aff: ['paladin', 'spd'], atk: { name: 'Aboiement', fx: 'bark', scale: 'mix', mult: 0.45, effects: [{ k: 'debuff', stat: 'atk', pct: 0.1, turns: 2 }], desc: 'Aboie fort (45 %), −10 % Attaque ennemie.' } },
  ivory: { aff: ['guerrier', 'atk'], atk: { name: 'Mâchoire de fer', kind: 'pounce', scale: 'atk', mult: 0.65, desc: 'Mord très fort (65 % Attaque).' } },
  salto: { aff: ['guerrier', 'vit'], atk: { name: 'Salto', kind: 'pounce', scale: 'atk', mult: 0.5, effects: [{ k: 'stun', chance: 0.1 }], desc: 'Saute sur l’ennemi (50 % Attaque), peut l’étourdir.' } },
  uby: { aff: ['paladin', 'atk'], atk: { name: 'Gardien', kind: 'pounce', scale: 'mix', mult: 0.5, lifesteal: 0.3, desc: 'Mord (50 %) et soigne son maître de 30 % des dégâts.' } },
  idan: { aff: ['archer', 'lck'], atk: { name: 'Venin', fx: 'spit', scale: 'atk', mult: 0.3, effects: [{ k: 'dot', kind: 'poison', name: 'Poison', mult: 0.2, turns: 3 }], desc: 'Crache du venin (30 % Attaque) + poison.' } },
  mitsuki: { aff: ['mage', 'spd'], atk: { name: 'Hypnose', fx: 'spore', scale: 'mag', mult: 0.45, effects: [{ k: 'stun', chance: 0.15 }], desc: 'Hypnotise (45 % Magie), peut étourdir.' } },
};

// ---------------------------------------------------------------------
//  AMIS (bots du mode hors ligne : 7 + toi = 8 joueurs)
// ---------------------------------------------------------------------
export const FRIENDS = [
  { id: 'b1', name: 'Gégé', classId: 'guerrier' },
  { id: 'b2', name: 'Momo', classId: 'mage' },
  { id: 'b3', name: 'Lulu', classId: 'archer' },
  { id: 'b4', name: 'Nono', classId: 'paladin' },
  { id: 'b5', name: 'Titi', classId: 'guerrier' },
  { id: 'b6', name: 'Zaza', classId: 'mage' },
  { id: 'b7', name: 'Kiki', classId: 'archer' },
];

// =====================================================================
//  AIDE AUX RETARDATAIRES — bonus d'XP selon le retard sur le perso le plus haut du jeu
// =====================================================================
// XP pour passer un niveau : round((base + per × niveau) × growth^niveau × mult)
export const XP_CURVE = { base: 50, per: 15, growth: 1.04, mult: 0.65 };   // rapide au début, lent à la fin : niveau 100 en ~45 jours pour un joueur à fond
export const XP_CATCHUP = { perLevel: 0.05, max: 0.5 };   // +5 % par niveau de retard sur le perso le plus haut du jeu, max +50 %
export const ALT_XP_MULT = 1;      // persos secondaires : plus de bonus (avant ×2) ; seule l'aide aux retardataires reste
// clefs gagnées à chaque niveau : 1, puis 2 dès le niveau 30, 3 dès le 50, 4 dès le 70, 5 dès le 90 (et toujours 5 aux niveaux 10, 20, 30…)
export const LEVEL_KEYS = { each: 1, tiers: [[90, 5], [70, 4], [50, 3], [30, 2]], every10: 5 };
// Remise à zéro exceptionnelle de tous les compteurs (une seule fois, à cette heure-là)
export const SPECIAL_RESET = { id: '2026-10-18-20h', at: [2026, 9, 18, 20, 0] };
// Corrections de niveau (une seule fois par compte) : persos montés trop vite pendant les changements d'XP
export const LEVEL_FIXES = [
  { id: 'fix-2026-10-18-alexdcr', pseudo: 'AlexDcr', maxLevel: 33 },
  { id: 'fix-2026-10-18-didztasoeur', pseudo: 'Didztasoeur', maxLevel: 33 },
];

// =====================================================================
//  TOUR INFINIE
// =====================================================================
// =====================================================================
//  LA HORDE — des monstres à la chaîne, de plus en plus forts, sans soin. Plus tu vas loin, plus tu gagnes de Flouze.
//  3 essais par compte toutes les 12 h (minuit et midi).
// =====================================================================
export const HORDE = {
  runsPerHalf: 3,                 // charges de la Horde (le maximum en réserve, voir RECHARGE)
  step: 4,        // niveau du monstre n = 1 + step × (n − 1)
  power: 1,       // stats des monstres par rapport à un boss de donjon du même niveau
  hp: 0.6,        // et leurs PV
  // PVM = des clefs (pour le perso qui a joué) : [monstres battus, clefs], du plus haut au plus bas.
  keys: [[30, 5], [20, 3], [10, 2], [3, 1]],
};
export const TOWER = { keysEvery10: 5, keysFrom50: 10,   // PVM = des clefs : tous les 10 étages, 5 clefs (10 à partir de l'étage 50) pour le perso qui monte
  xpMult: 0.3, ramp: [0.6, 0.02, 1.1], early: [0.4, 50] };   // ramp : force des monstres = départ + pas × étage, plafonnée ; early : +40 % au départ, effacé à l'étage 50 (réglé après la refonte de l'équipement)   // tentatives illimitées : on reste bloqué à l'étage tant qu'on ne l'a pas gagné ; XP par étage = 30 % de l'XP d'un boss du même niveau

// =====================================================================
//  RAID DE LA SEMAINE — un boss commun à tout le groupe
// =====================================================================
SPELL_LIST.push(...S('monster', [
  { id: 'r_discours', lvl: 0, name: 'Discours de 3 heures', cd: 5, scale: 'mag', mult: 0.6, fx: 'bolt', effects: [{ k: 'stun', chance: 0.5 }] },
  { id: 'r_republique', lvl: 0, name: 'La République, c’est moi !', cd: 5, scale: 'atk', mult: 2, melee: true, fx: 'bash' },
  { id: 'r_insoumis', lvl: 0, name: 'Insoumission', cd: 6, fx: 'shield', effects: [{ k: 'shield', scale: 'def', mult: 2 }] },
  { id: 'r_gueule', lvl: 0, name: 'Coup de gueule', cd: 5, fx: 'roar', effects: [{ k: 'buff', stat: 'atk', pct: 0.3, turns: 3 }] },
  // François Hollande
  { id: 'r_scooter', lvl: 0, name: 'Fuite en scooter', cd: 4, scale: 'atk', mult: 1.7, crit: 0.2, melee: true, fx: 'bash' },
  { id: 'r_pluie', lvl: 0, name: 'Pluie de Brest', cd: 5, scale: 'mag', mult: 0.7, fx: 'rain', effects: [{ k: 'debuff', stat: 'spd', pct: 0.3, turns: 3 }] },
  { id: 'r_moipresident', lvl: 0, name: 'Moi président', cd: 6, fx: 'shield', effects: [{ k: 'shield', scale: 'def', mult: 2 }] },
  { id: 'r_changement', lvl: 0, name: 'Le changement, c’est maintenant', cd: 5, fx: 'buff', effects: [{ k: 'buff', stat: 'atk', pct: 0.3, turns: 3 }] },
  // Nicolas Sarkozy
  { id: 'r_karcher', lvl: 0, name: 'Coup de Kärcher', cd: 5, scale: 'mag', mult: 1.7, fx: 'ice' },
  { id: 'r_cassetoi', lvl: 0, name: 'Casse-toi !', cd: 6, scale: 'atk', mult: 0.8, melee: true, fx: 'bash', effects: [{ k: 'stun', chance: 0.4 }] },
  { id: 'r_travailler', lvl: 0, name: 'Travailler plus', cd: 6, fx: 'buff', effects: [{ k: 'buff', stat: 'spd', pct: 0.25, turns: 3 }] },
  { id: 'r_talonnettes', lvl: 0, name: 'Talonnettes', cd: 6, fx: 'shield', effects: [{ k: 'shield', scale: 'def', mult: 2.2 }] },
  // Marine Le Pen
  { id: 'r_flamme', lvl: 0, name: 'Flamme tricolore', cd: 4, scale: 'mag', mult: 1.3, fx: 'fireball', effects: [{ k: 'dot', kind: 'burn', name: 'Brûlure', mult: 0.4, turns: 3 }] },
  { id: 'r_debat', lvl: 0, name: 'Débat d’entre-deux-tours', cd: 5, scale: 'mag', mult: 0.8, fx: 'bolt', effects: [{ k: 'debuff', stat: 'atk', pct: 0.3, turns: 3 }] },
  { id: 'r_dediab', lvl: 0, name: 'Dédiabolisation', cd: 6, fx: 'heal', effects: [{ k: 'heal', pctMax: 0.12 }] },
  { id: 'r_rassemblement', lvl: 0, name: 'Rassemblement', cd: 5, fx: 'roar', effects: [{ k: 'buff', stat: 'atk', pct: 0.35, turns: 3 }] },
  // Emmanuel Macron
  { id: 'r_enmemetemps', lvl: 0, name: 'En même temps', cd: 4, scale: 'atk', mult: 1, hits: 2, melee: true, fx: 'slash' },
  { id: 'r_jupiter', lvl: 0, name: 'Foudre de Jupiter', cd: 5, scale: 'mag', mult: 2.2, fx: 'lightning' },
  { id: 'r_493', lvl: 0, name: '49.3', cd: 6, scale: 'mag', mult: 0.6, fx: 'bolt', effects: [{ k: 'stun', chance: 0.6 }] },
  { id: 'r_traverser', lvl: 0, name: 'Traverser la rue', cd: 6, fx: 'heal', effects: [{ k: 'heal', pctMax: 0.12 }] },
]));
SPELL_LIST.forEach(s => { SPELLS[s.id] = s; });

export const RAID = {
  tag: 'melenchon:v3',            // nom du raid Mélenchon en cours (les suivants s'appellent « hollande:c0 », « sarkozy:c0 »…)
  attemptsPerHalf: 3,             // 3 charges d'assaut par compte, 1 de plus toutes les 4 h (voir RECHARGE)
  maxActions: 40,                 // un assaut dure au plus 40 actions (on ne peut pas le tuer d'un coup)
  minHp: 20000,                   // le boss a toujours au moins 20 000 PV
  participation: 0.5,             // PV calculés pour qu'il tombe si chacun fait ~3 assauts par jour
  rewards: { killChests: 1, killClat: 25, mvpChests: 1, failClat: 3 },   // COOP = coffre + Flouze
  cycleBoost: { power: 1.08, hp: 1.3 },   // après Macron, la rotation recommence : à chaque tour, stats ×1,08 et PV ×1,3
};
// Les boss du raid, un par raid de 7 jours, dans cet ordre et de plus en plus forts
// power : stats du boss, hp : PV du raid (par rapport à Mélenchon)
export const RAID_BOSSES = [
  { id: 'melenchon', name: 'Mélenchon', sprite: 'melenchon', theme: 'meeting', power: 1, hp: 1,
    profile: { vit: 1, atk: 1.1, mag: 1, def: 0.9, spd: 0.8, lck: 0.6 },
    basic: { name: 'Coup de micro', scale: 'atk', mult: 1, melee: true, fx: 'bash' },
    spells: ['r_insoumis', 'r_republique', 'r_discours', 'r_gueule'] },
  { id: 'hollande', name: 'François Hollande', sprite: 'hollande', theme: 'meeting', power: 1.04, hp: 1.15,
    profile: { vit: 1.1, atk: 1, mag: 0.9, def: 1, spd: 0.7, lck: 0.7 },
    basic: { name: 'Coup de parapluie', scale: 'atk', mult: 1, melee: true, fx: 'bash' },
    spells: ['r_moipresident', 'r_scooter', 'r_pluie', 'r_changement'] },
  { id: 'sarkozy', name: 'Nicolas Sarkozy', sprite: 'sarkozy', theme: 'meeting', power: 1.08, hp: 1.25,
    profile: { vit: 0.95, atk: 1.1, mag: 0.9, def: 0.85, spd: 0.9, lck: 0.7 },
    basic: { name: 'Coup de talonnette', scale: 'atk', mult: 1, melee: true, fx: 'bash' },
    spells: ['r_talonnettes', 'r_karcher', 'r_cassetoi', 'r_travailler'] },
  { id: 'lepen', name: 'Marine Le Pen', f: true, sprite: 'lepen', theme: 'meeting', power: 1.12, hp: 2.2,
    profile: { vit: 1.05, atk: 0.9, mag: 1.15, def: 0.95, spd: 0.8, lck: 0.6 },
    basic: { name: 'Coup de sac à main', scale: 'atk', mult: 1, melee: true, fx: 'bash' },
    spells: ['r_dediab', 'r_flamme', 'r_debat', 'r_rassemblement'] },
  { id: 'macron', name: 'Emmanuel Macron', sprite: 'macron', theme: 'meeting', power: 1.16, hp: 2.3,
    profile: { vit: 1.05, atk: 1.05, mag: 1.1, def: 0.95, spd: 0.85, lck: 0.7 },
    basic: { name: 'Poignée de main', scale: 'atk', mult: 1, melee: true, fx: 'bash' },
    spells: ['r_traverser', 'r_enmemetemps', 'r_jupiter', 'r_493'] },
];

// =====================================================================
//  MISSIONS — 3 missions toutes les 12 h (minuit et midi), tirées au hasard, les mêmes pour tout le monde
//  ev = l'action qui fait avancer la mission
// =====================================================================
// reward = Flouze : 5 pour une mission simple, 10 pour une mission compliquée (+5 de bonus si les 3 sont faites)
const M = (id, ev, text, n, reward) => ({ id, ev, text, n, reward });
export const MISSION_POOL = [
  M('arena_win', 'arena_win', 'Gagne {n} combats d’Arène', [2, 3], 10),
  M('arena_fight', 'arena_fight', 'Fais {n} combats d’Arène', [3, 5], 5),
  M('rematch', 'rematch', 'Fais {n} revanches', [2, 4], 5),
  M('rematch_win', 'rematch_win', 'Gagne {n} revanche(s)', [1, 2], 5),
  M('chest', 'chest', 'Ouvre {n} coffres', [2, 5], 5),
  M('key_use', 'key_use', 'Ouvre {n} coffre(s) avec une clef', [1, 3], 5),
  M('dungeon_win', 'dungeon_win', 'Bats {n} boss de donjon', [2, 4], 10),
  M('dungeon', 'dungeon', 'Lance {n} combats de donjon', [3, 6], 5),
  M('dungeon_diff', 'dungeon_kinds', 'Bats {n} donjons différents', [2, 3], 10),
  M('tower', 'tower', 'Monte {n} étage(s) de la Tour', [1, 3], 10),
  M('tower_try', 'tower_try', 'Tente {n} fois la Tour infinie', [2, 4], 5),
  M('raid', 'raid', 'Attaque le boss du raid {n} fois', [1, 3], 10),
  M('raid_dmg', 'raid_dmg', 'Inflige {n} dégâts au boss du raid', [300, 900], 10),
  M('war', 'war', 'Fais {n} attaques de guerre', [1, 3], 10),
  M('war_win', 'war_win', 'Gagne {n} attaque(s) de guerre', [1, 2], 10),
  M('fuse', 'fuse', 'Fusionne {n} objet(s)', [1, 2], 10),
  M('sell', 'sell', 'Vends {n} objets', [2, 6], 5),
  M('equip', 'equip', 'Équipe {n} objet(s)', [1, 3], 5),
  M('stat', 'stat', 'Place {n} points de caractéristique', [3, 6], 5),
  M('level', 'level', 'Gagne {n} niveau(x)', [1, 2], 10),
  M('fight', 'fight', 'Fais {n} combats (tous modes)', [5, 10], 5),
  M('win', 'win', 'Gagne {n} combats (tous modes)', [4, 8], 10),
  M('spell', 'spell', 'Lance {n} sorts en combat', [8, 16], 5),
  M('crit', 'crit', 'Place {n} coups critiques', [5, 12], 5),
  M('dodge', 'dodge', 'Esquive {n} attaques', [3, 8], 5),
  M('pet', 'pet', 'Ton familier attaque {n} fois', [5, 12], 5),
  M('manual_win', 'manual_win', 'Gagne {n} combat(s) en mode manuel', [1, 2], 10),
  M('chat', 'chat', 'Envoie {n} message(s) dans le tchat', [1, 3], 5),
  M('share', 'share', 'Partage {n} combat dans le tchat', [1, 1], 5),
  M('bet', 'bet', 'Mise sur {n} duel(s)', [1, 1], 5),
  M('revenge', 'revenge', 'Venge-toi {n} fois', [1, 1], 5),
  M('train', 'train_rec', 'Bats ton record d’entraînement', [1, 1], 5),
];
export const MISSIONS_PER_DAY = 3;
export const MISSIONS_BONUS = 5;   // Flouze en plus si les 3 sont faites

// =====================================================================
//  BOUTIQUE D'APPARENCE — payée en Flouze, aucun effet sur les stats
// =====================================================================
const T = (id, name, price) => ({ id: 't_' + id, kind: 'title', name, price });
const C = (id, name, price, color) => ({ id: 'c_' + id, kind: 'color', name, price, color });
const D = (id, name, price, dye) => ({ id: 'd_' + id, kind: 'dye', name, price, dye });
const V = (id, name, price, colors) => ({ id: 'v_' + id, kind: 'victory', name, price, colors });
// Éléments des skins élémentaires : prix, nom et couleurs de l'aura en combat
export const ELEMENTS = [
  { id: 'feu', name: 'Feu', price: 200, aura: ['#ff5a1a', '#ffb02e', '#ffe46a'] },
  { id: 'glace', name: 'Glace', price: 200, aura: ['#4aa6ff', '#bfeaff', '#ffffff'] },
  { id: 'lumiere', name: 'Lumière', price: 280, aura: ['#ffd23a', '#fff2a8', '#ffffff'] },
  { id: 'tenebres', name: 'Ténèbres', price: 280, aura: ['#8a20ff', '#c070ff', '#3a0060'] },
];
// Skin : une tenue propre à une classe (remplace les anciennes teintures, qui restent portables par ceux qui les ont)
const SKIN_EXTRA = 20;   // tous les skins coûtent 20 Flouze de plus que le prix écrit ci-dessous
const K = (cls, id, name, price, look) => ({ id: 'k_' + cls + '_' + id, kind: 'skin', cls, name, price: price + SKIN_EXTRA, look });
// PvP en direct : défi entre joueurs en ligne, tous les persos de chacun à la suite (relais)
export const PVP = { reward: 10, rewardsPerDay: 5, expireMs: 3 * 60 * 1000 };
// Le trône : classement de la semaine (lundi 0 h), défis illimités contre ceux au-dessus de soi (échange de places)
// clefs de fin de semaine pour CHAQUE perso du compte : roi 5, 2e 3, 3e 2, tous les autres 1
// Le trône (PVP = du Flouze) : une manche tous les 3 jours, à 0 h ; 100 Flouze au roi, 50 au 2ᵉ, 25 à tous les autres
export const THRONE = { flouze: [100, 50], flouzeRest: 25, days: 3, start: [2026, 9, 19], team: 4 };
// Combat auto : 10 difficultés de 100 paliers, joués à la suite par tes 4 persos, tout seuls (même jeu fermé, 8 h max)
// À l'écran, les combats s'enchaînent sans pause ; ailleurs (autre écran, jeu fermé) : un palier toutes les 10 s (la durée d'un combat). Tous les 10 paliers : 1 coffre normal (en réserve, pour le perso actif), pas de clef. Défaite : retour au palier x1.
export const AUTO = {
  palierMs: 10000, offlineMaxMs: 8 * 3600 * 1000, diffs: 10, paliers: 100,
  // Puissance d'équipe (les 4 persos additionnés) qu'il faut pour passer un palier, entre ces repères (palier global 1 à 1000) :
  // la difficulté suit la progression d'un joueur qui joue à fond (refonte/simulations/courbe-auto.mjs) :
  // D1 = le 1er jour (1 perso), D2 ≈ jour 2, D3 ≈ jour 4, D4 ≈ jour 7, D5 ≈ jour 10, D6 ≈ jour 14, D7 ≈ jour 21, D8 ≈ jour 28, D9 ≈ jour 34,
  // D10 palier 100 = l'équipe parfaite (4 persos niv 100, tout Chaotique, panoplie : ~7 225 depuis la refonte de l'équipement)
  // (repères 850 / 900 redescendus après la règle 3 Légendaires → 1 Mythique : l'équipe des jours 30 à 40 est plus faible)
  need: [[1, 75], [50, 160], [100, 380], [200, 930], [300, 1660], [400, 2540], [500, 3550], [600, 4640], [700, 5320], [800, 5700], [850, 5880], [900, 6000], [1000, 6450]],
  monsterK: 5.4e-4,         // force des monstres (base niveau 50) = puissance demandée × ce nombre (mesuré : équipe gagne ~4 fois sur 5)
  boss: { power: 1.15, hp: 2.2 },   // tous les 10 paliers : un boss et 2 sbires
  // XP : chaque victoire met 0,2 % d'un niveau en réserve (pour le perso actif quand on récupère),
  // au plus 10 % d'un niveau par jour : un petit coup de pouce, sans remplacer les donjons.
  xpPerWin: 0.002, xpDayCap: 0.1,
};
// Championnat : chaque semaine (à partir du lundi), un tableau de 8 joueurs tiré au hasard.
// Quarts le lundi, demi-finales le mardi, finale le mercredi, à 19 h 30. Chaque match se joue en 3 manches
// (2 manches gagnées suffisent), équipe de 4 contre équipe de 4 en relais, sans soin entre deux duels.
// Mode histoire (PVM) : 5 zones de 10 combats, chacune dans son biome. Un petit boss au 5e combat, un boss au 10e.
// Les 5 zones finies en Normal débloquent l'Enfer (zone 1), puis le Chaotique : 3 × 5 = 15 zones en tout.
// Chaque perso a sa propre histoire et se bat seul ; les monstres d'un combat arrivent à la suite (comme une vague de donjon).
// Étoiles selon la vie restante à la fin (1 = gagné, 2 = 40 %, 3 = 70 %). 20 étoiles d'une zone : 5 coffres ;
// 30 étoiles : 1 coffre Épique (Légendaire en Chaotique). XP seulement à la première victoire d'un combat.
export const STORY = {
  fights: 10, mini: 5, boss: 10,
  modes: [
    { id: 'normal', name: 'Normal', color: '#4cd964' },
    { id: 'enfer', name: 'Enfer', color: '#ff5d3d' },
    { id: 'chaos', name: 'Chaotique', color: '#ff2bd6' },
  ],
  zones: [
    { id: 'foret', name: 'Forêt des Murmures', theme: 'forest', mobs: ['rat', 'wolf', 'goblin', 'frog'], mini: { sprite: 'goblin', name: 'Chef Gobelin' }, boss: { sprite: 'slimeKing', name: 'Roi Gluant' } },
    { id: 'marais', name: 'Marais Maudits', theme: 'swamp', mobs: ['frog', 'mushroom', 'zombie', 'spider'], mini: { sprite: 'mushroom', name: 'Champignon Ancestral' }, boss: { sprite: 'hydra', name: 'Hydre des Marais' } },
    { id: 'glace', name: 'Pics Gelés', theme: 'glacier', mobs: ['wolf', 'polarBear', 'golem', 'skeleton'], mini: { sprite: 'polarBear', name: 'Ours Colosse' }, boss: { sprite: 'yeti', name: 'Yéti Ancestral' } },
    { id: 'feu', name: 'Terres de Feu', theme: 'volcano', mobs: ['salamander', 'fireElem', 'golem', 'spider'], mini: { sprite: 'salamander', name: 'Salamandre Reine' }, boss: { sprite: 'dragon', name: 'Dragon Ancien' } },
    { id: 'abysses', name: 'Abysses', theme: 'abyss', mobs: ['ghost', 'abyssEye', 'blackKnight', 'mummy'], mini: { sprite: 'vampire', name: 'Comte Vampire' }, boss: { sprite: 'demon', name: 'Seigneur des Abysses' } },
  ],
  stars: [0.4, 0.7],          // part de vie à garder pour 2 et 3 étoiles
  chests20: 5,                // 20 étoiles : 5 coffres normaux (pour ce perso)
  // Réglés combat par combat par refonte/simulations/histoire.mjs (relancer et recopier histoire.json après un changement) :
  // strength = force des monstres (× un monstre de niveau 50) ; need = puissance conseillée ; levels = niveau affiché des monstres.
  // Chaque combat est fait pour le héros attendu d'un joueur à fond à ce moment-là ; le dernier boss du Chaotique
  // demande un héros niveau 100 tout Chaotique avec sa panoplie pour les 3 étoiles.
  strength: [0.164, 0.302, 0.326, 0.415, 0.433, 0.457, 0.521, 0.531, 0.687, 0.659, 0.766, 0.733, 0.746, 0.808, 0.675, 0.801, 0.851, 0.806, 0.842, 0.63, 0.92, 0.867, 0.908, 1.063, 0.986, 1.034, 1.095, 1.055, 1.112, 0.965, 1.147, 1.335, 1.1, 1.413, 1.314, 1.371, 1.453, 1.394, 1.417, 1.141, 1.39, 1.328, 1.377, 1.429, 1.355, 1.7, 1.732, 1.392, 1.476, 1.405, 1.688, 1.613, 2.131, 2.166, 2.12, 2.093, 2.13, 2.033, 2.13, 1.999, 2.096, 2.081, 2.173, 2.145, 1.953, 2.173, 2.133, 2.205, 2.225, 1.6, 2.1, 2.115, 2.206, 2.1, 2.055, 2.223, 2.157, 2.192, 2.24, 1.949, 2.311, 2.278, 2.384, 2.057, 2.046, 2.149, 2.129, 2.164, 2.206, 1.827, 2.069, 2.102, 2.1, 2.084, 2.067, 2.173, 2.145, 2.145, 2.227, 1.839, 2.433, 2.474, 2.458, 2.514, 2.595, 2.54, 3.076, 3.116, 3.225, 2.841, 3.143, 3.1, 3.173, 3.181, 2.633, 3.225, 3.214, 3.163, 3.269, 2.171, 3.147, 3.095, 3.016, 3.162, 2.805, 3.007, 3.133, 3.109, 3.007, 2.635, 3.071, 3.053, 3.141, 3.109, 2.905, 3.139, 3.129, 3.1, 3.202, 2.334, 2.883, 2.561, 2.576, 2.907, 2.733, 2.8, 3.006, 2.733, 2.829, 1.89],
  need: [84, 162, 172, 226, 235, 243, 263, 272, 368, 378, 387, 398, 398, 407, 415, 426, 434, 434, 443, 566, 574, 584, 594, 602, 613, 613, 622, 632, 640, 650, 661, 669, 678, 688, 688, 697, 707, 716, 716, 898, 907, 916, 916, 926, 934, 943, 943, 952, 952, 962, 972, 972, 980, 980, 990, 1000, 1000, 1008, 1008, 1018, 1028, 1028, 1038, 1038, 1049, 1059, 1059, 1069, 1069, 1078, 1089, 1089, 1098, 1098, 1107, 1116, 1116, 1126, 1126, 1136, 1147, 1147, 1155, 1300, 1309, 1317, 1317, 1327, 1327, 1337, 1337, 1346, 1346, 1355, 1364, 1374, 1383, 1383, 1392, 1392, 1392, 1402, 1402, 1411, 1421, 1421, 1430, 1430, 1439, 1439, 1439, 1450, 1450, 1458, 1458, 1469, 1478, 1478, 1486, 1486, 1486, 1497, 1497, 1506, 1506, 1506, 1506, 1506, 1516, 1516, 1525, 1525, 1534, 1534, 1544, 1544, 1553, 1553, 1563, 1563, 1572, 1572, 1572, 1582, 1789, 1789, 1799, 1799, 1799, 1809],
  levels: [2, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 17, 17, 18, 19, 20, 21, 21, 22, 23, 24, 25, 26, 27, 28, 28, 29, 30, 31, 32, 33, 34, 35, 36, 36, 37, 38, 39, 39, 40, 41, 42, 42, 43, 44, 45, 45, 46, 46, 47, 48, 48, 49, 49, 50, 51, 51, 52, 52, 53, 54, 54, 55, 55, 56, 57, 57, 58, 58, 59, 60, 60, 61, 61, 62, 63, 63, 64, 64, 65, 66, 66, 67, 67, 68, 69, 69, 70, 70, 71, 71, 72, 72, 73, 74, 75, 76, 76, 77, 77, 77, 78, 78, 79, 80, 80, 81, 81, 82, 82, 82, 83, 83, 84, 84, 85, 86, 86, 87, 87, 87, 88, 88, 89, 89, 89, 89, 89, 90, 90, 91, 91, 92, 92, 93, 93, 94, 94, 95, 95, 96, 96, 96, 97, 98, 98, 99, 99, 99, 100],
  // [force, PV] de chaque monstre selon le combat : PV par monstre quand ils sont 2, 3 ou 4 ; sbires puis petit boss ; sbires puis boss
  foes: { mobHp: { 2: 0.85, 3: 0.75, 4: 0.6 }, miniAdd: [0.85, 0.7], mini: [1.05, 1.4], bossAdd: [0.85, 0.55], boss: [1.1, 1.6] },
  xpMult: 1.3,                // XP d'un combat = (25 + 5 × niveau) × ce nombre (× 1,5 petit boss, × 2 boss) : remplace l'XP du raid (niveau 100 vers le 46e jour)
};

export const CHAMP = { flouze: { win: 100, second: 50, other: 25 }, size: 8, days: [0, 1, 2], hour: 19, minute: 30, bestOf: 3, roundNames: ['Quarts de finale', 'Demi-finales', 'Finale'] };

// odds = chances de chaque rareté (en %), prices = prix en Flouze selon la rareté.
// Le marchand : 3 objets au hasard, renouvelés toutes les 4 h (0 h, 4 h, 8 h, 12 h, 16 h, 20 h)
export const SHOP_DAILY = { count: 3, odds: [50, 30, 15, 5], prices: [10, 50, 150, 300], everyH: 4 };

export const COSMETICS = [
  // Titres (affichés sous ton pseudo)
  T('rookie', 'Le Rookie', 5), T('touriste', 'Touriste', 5), T('mauvais', 'Mauvais perdant', 8),
  T('fetard', 'Fêtard', 10), T('cuistot', 'Chef cuistot', 12), T('gros_bras', 'Gros bras', 12),
  T('pilier', 'Pilier de bar', 15), T('sage', 'Le Sage', 18), T('revanche', 'Roi de la revanche', 20),
  T('sniper', 'Sniper', 22), T('pyro', 'Pyromane', 22), T('increvable', 'Increvable', 25),
  T('chanceux', 'Chanceux', 25), T('insoumis', 'Insoumis', 30), T('banquier', 'Le Banquier', 40),
  T('parieur', 'Parieur fou', 40), T('loot', 'Seigneur du loot', 50), T('collection', 'Collectionneur', 55),
  T('dragon', 'Tueur de dragons', 60), T('appart', 'Légende de l’Appart 33', 80), T('empereur', 'Empereur', 100),
  T('intouchable', 'Intouchable', 120), T('boss', 'Le Boss', 150), T('dieu', 'Dieu de l’Arène', 200),
  T('president', 'Président', 250),
  T('naine', 'Destructeur de naine', 500),
  T('dormeur', 'Gros dormeur', 8), T('tchatteur', 'Roi du tchat', 12), T('philo', 'Philosophe', 15), T('flambeur', 'Flambeur', 20),
  T('tacticien', 'Tacticien', 25), T('clefs', 'Maître des clefs', 30), T('donjon', 'Roi du donjon', 35), T('fantome', 'Le Fantôme', 35),
  T('horde', 'Survivant de la Horde', 45), T('mecene', 'Mécène', 60), T('melenchon', 'Chasseur de Mélenchon', 70),
  T('seigneur', 'Seigneur de guerre', 90), T('legende', 'Légende vivante', 180), T('immortel', 'Immortel', 300),
  // Titres uniques : offerts (podium de l'ancien Fuze Arena), jamais en vente
  { ...T('champion_1ed', 'Champion - 1ère Édition', 0), unique: true },
  { ...T('rival_1ed', 'Rival - 1ère Édition', 0), unique: true },
  { ...T('bronze_1ed', 'Bronze - 1ère Édition', 0), unique: true },
  // Couleurs de pseudo
  C('vert', 'Pseudo vert', 15, '#4cd964'), C('bleu', 'Pseudo bleu', 15, '#3d9bff'), C('rouge', 'Pseudo rouge', 15, '#ff5d6c'),
  C('cyan', 'Pseudo cyan', 20, '#48dbfb'), C('rose', 'Pseudo rose', 25, '#ff8fc7'), C('violet', 'Pseudo violet', 30, '#b05cff'),
  C('orange', 'Pseudo orange', 30, '#ff9f1a'), C('or', 'Pseudo doré', 60, '#ffd84a'), C('arcenciel', 'Pseudo arc-en-ciel', 150, 'rainbow'),
  C('menthe', 'Pseudo menthe', 20, '#7bf09a'), C('glace', 'Pseudo glace', 25, '#9fd0ff'), C('corail', 'Pseudo corail', 25, '#ff7f6b'),
  C('lavande', 'Pseudo lavande', 30, '#c9a7ff'), C('argent', 'Pseudo argent', 45, '#d8dee6'), C('rubis', 'Pseudo rubis', 50, '#ff2e63'),
  C('emeraude', 'Pseudo émeraude', 50, '#2ee59d'), C('feu', 'Pseudo de feu', 120, 'fire'), C('galaxie', 'Pseudo galaxie', 180, 'galaxy'),
  // Teintures de tenue (pour le personnage actif)
  D('noir', 'Noir corbeau', 20, { body: '#34303d', sleeve: '#2b2733', accent: '#8e2b2b', headC: '#3d3947', legs: '#26232c' }),
  D('blanc', 'Blanc neige', 20, { body: '#eef2f6', sleeve: '#d9e0e8', accent: '#3d9bff', headC: '#f4f8fc', legs: '#c9d1da' }),
  D('rouge', 'Rouge sang', 25, { body: '#a82424', sleeve: '#8e1f1f', accent: '#ffd84a', headC: '#c0392b', legs: '#5a1414' }),
  D('bleu', 'Bleu royal', 25, { body: '#2e5aa8', sleeve: '#244a8c', accent: '#ffd84a', headC: '#3d6fd1', legs: '#1c3566' }),
  D('vert', 'Vert forêt', 25, { body: '#2f7d3a', sleeve: '#276a31', accent: '#e5b33a', headC: '#3f9a4a', legs: '#1f4d26' }),
  D('rose', 'Rose bonbon', 30, { body: '#ff8fc7', sleeve: '#f27bb6', accent: '#ffffff', headC: '#ffa6d4', legs: '#c25d92' }),
  D('violet', 'Violet mystique', 35, { body: '#6c3fb5', sleeve: '#5a339a', accent: '#48dbfb', headC: '#7d4fd1', legs: '#3d2670' }),
  D('orange', 'Orange fluo', 35, { body: '#ff8c1a', sleeve: '#e67a10', accent: '#2a2238', headC: '#ffa040', legs: '#7a3d08' }),
  D('turquoise', 'Turquoise', 40, { body: '#1abc9c', sleeve: '#16a085', accent: '#ffffff', headC: '#26d0ad', legs: '#0e6655' }),
  D('camo', 'Camouflage', 50, { body: '#55663f', sleeve: '#4a5a36', accent: '#3b2a20', headC: '#6b7a4f', legs: '#3d4a2c' }),
  D('argent', 'Argent', 70, { body: '#c3cad3', sleeve: '#aab4c0', accent: '#3d9bff', headC: '#e0e6ee', legs: '#8f96a0' }),
  D('bronze', 'Bronze', 70, { body: '#b07a3a', sleeve: '#9a6830', accent: '#5a3a22', headC: '#c98a4a', legs: '#6b4423' }),
  D('or', 'Or massif', 120, { body: '#ffd84a', sleeve: '#e5b33a', accent: '#c0392b', headC: '#ffe680', legs: '#b8860b' }),
  D('ombre', 'Ombre', 150, { body: '#16121f', sleeve: '#1f1a2e', accent: '#b05cff', headC: '#262038', legs: '#0e0b16' }),
  // Effets de victoire
  V('confettis', 'Confettis', 30, ['#ff5d6c', '#ffd84a', '#4cd964', '#3d9bff', '#b05cff']),
  V('coeurs', 'Pluie de cœurs', 40, ['#ff5d6c', '#ff8fc7', '#ffffff']),
  V('eclairs', 'Éclairs', 50, ['#e8f4ff', '#8fd3ff', '#ffd84a']),
  V('feu', 'Feu d’artifice', 60, ['#ff9f1a', '#ffd84a', '#ff3a1a', '#ffffff']),
  V('or', 'Pluie d’or', 80, ['#ffd84a', '#e5b33a', '#fff3b0']),
  V('clat', 'Pluie de Flouze', 100, ['#2ecc71', '#a8f0c0', '#1e8449']),
  V('neige', 'Neige', 35, ['#ffffff', '#e0f7ff', '#9fd0ff']), V('petales', 'Pétales', 40, ['#ff8fc7', '#ffd1e8', '#ffffff']),
  V('etoiles', 'Étoiles filantes', 45, ['#fff3b0', '#ffd84a', '#ffffff']), V('poison', 'Nuage toxique', 50, ['#7bed6f', '#3fbf3f', '#b05cff']),
  V('dragon', 'Sang du dragon', 70, ['#e8364a', '#a8182c', '#ff9f1a']), V('galaxie', 'Galaxie', 120, ['#b05cff', '#3d9bff', '#ff8fc7', '#ffffff']),
  // Skins : 4 par classe
  K('guerrier', 'noir', 'Chevalier noir', 60, { body: '#34303d', sleeve: '#2b2733', accent: '#e8364a', headC: '#3d3947', headA: '#e8364a', legs: '#26232c', boots: '#1b1530', glove: '#2b2733' }),
  K('guerrier', 'samourai', 'Samouraï', 80, { body: '#d63031', sleeve: '#b02525', accent: '#ffd84a', headC: '#1b1530', headA: '#ffd84a', legs: '#2b2733', boots: '#1b1530', glove: '#1b1530', hair: '#1b1530' }),
  K('guerrier', 'viking', 'Viking', 90, { hair: '#e07b24', body: '#8a5a2b', sleeve: '#6b4423', accent: '#3d9bff', headC: '#c9d1dc', headA: '#f3dfb0', legs: '#3b2a20', boots: '#2a1d10', glove: '#6b4423', skin: '#f6caa0' }),
  K('guerrier', 'templier', 'Templier doré', 150, { body: '#ffd84a', sleeve: '#e5b33a', accent: '#f4f8fc', headC: '#ffe680', headA: '#e8364a', legs: '#b8860b', boots: '#7a4e2a', glove: '#e5b33a' }),
  K('mage', 'necro', 'Nécromancien', 70, { body: '#1f1a2e', sleeve: '#16121f', accent: '#4cd964', headC: '#16121f', headA: '#4cd964', legs: '#1f1a2e', boots: '#0e0b16', beard: '#9aa3ad', skin: '#d6cdb8' }),
  K('mage', 'glace', 'Mage de glace', 80, { body: '#3d9bff', sleeve: '#2e7fd6', accent: '#e0f7ff', headC: '#2e7fd6', headA: '#e0f7ff', legs: '#3d9bff', boots: '#1c3566', beard: '#f4f8fc', hair: '#f4f8fc' }),
  K('mage', 'feu', 'Mage de feu', 90, { body: '#c0392b', sleeve: '#a82424', accent: '#ff9f1a', headC: '#a82424', headA: '#ffd84a', legs: '#c0392b', boots: '#3b1a10', beard: '#d9822b', hair: '#d9822b' }),
  K('mage', 'archimage', 'Archimage', 150, { body: '#eef2f6', sleeve: '#d9e0e8', accent: '#ffd84a', headC: '#f4f8fc', headA: '#ffd84a', legs: '#eef2f6', boots: '#8a6a3a' }),
  K('archer', 'assassin', 'Assassin', 70, { body: '#2b2733', sleeve: '#1f1a2e', headC: '#1f1a2e', accent: '#e8364a', legs: '#1b1530', boots: '#16121f', glove: '#2b2733' }),
  K('archer', 'automne', 'Chasseur d’automne', 60, { body: '#c0662b', sleeve: '#a8541f', headC: '#8a3d1a', accent: '#ffd84a', legs: '#5a3a22', glove: '#7a4e2a' }),
  K('archer', 'elfe', 'Elfe des neiges', 90, { body: '#eef2f6', sleeve: '#d9e0e8', headC: '#c9d1da', accent: '#3d9bff', legs: '#9aa3ad', boots: '#6b7684', hair: '#f4f8fc', skin: '#f6d6b8' }),
  K('archer', 'royal', 'Ranger royal', 150, { body: '#5b3fa8', sleeve: '#4e3594', headC: '#4a2f91', accent: '#ffd84a', legs: '#2b2140', boots: '#ffd84a', glove: '#ffd84a' }),
  K('paladin', 'croise', 'Croisé', 70, { body: '#f4f8fc', sleeve: '#d9e0e8', accent: '#e8364a', cape: '#e8364a', headC: '#ffd84a', legs: '#9aa3ad' }),
  K('paladin', 'jade', 'Chevalier de jade', 80, { body: '#1abc9c', sleeve: '#16a085', accent: '#ffd84a', cape: '#0e6655', headC: '#ffd84a', legs: '#0e6655', glove: '#16a085' }),
  K('paladin', 'tenebres', 'Paladin des ténèbres', 90, { body: '#34303d', sleeve: '#2b2733', accent: '#b05cff', cape: '#4a2f91', headC: '#8a93a3', legs: '#26232c', boots: '#16121f', glove: '#2b2733', hair: '#1b1530' }),
  K('paladin', 'solaire', 'Gardien solaire', 150, { body: '#ffd84a', sleeve: '#e5b33a', accent: '#ff9f1a', cape: '#c0392b', headC: '#fff3b0', legs: '#b8860b', glove: '#e5b33a' }),
  // Skins élémentaires : un dessin complet à part (art/heros/skins/), avec arme et aura en combat. Feu et glace 200, lumière et ténèbres 280.
  ...Object.entries({
    guerrier: ['Chevalier des braises', 'Chevalier du givre', 'Champion de l’aube', 'Chevalier du néant'],
    mage: ['Pyromancien', 'Cryomancien', 'Mage céleste', 'Sorcier du néant'],
    archer: ['Archer ardent', 'Archer du blizzard', 'Archer de l’aube', 'Archer de l’ombre'],
    paladin: ['Paladin de flammes', 'Paladin de givre', 'Paladin séraphique', 'Paladin déchu'],
  }).flatMap(([cls, names]) => ELEMENTS.map((el, i) => ({ id: `k_${cls}_el_${el.id}`, kind: 'skin', cls, name: names[i], price: el.price, art: el.id }))),
];
export const COSMETIC = Object.fromEntries(COSMETICS.map(c => [c.id, c]));
