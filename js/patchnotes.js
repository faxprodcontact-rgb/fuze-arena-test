// =====================================================================
//  NOTES DE MISE À JOUR — la plus récente en premier.
//  Pour une nouvelle mise à jour : ajouter une entrée tout en haut de la liste.
//  gift = cadeau à récupérer une seule fois par compte (amount = Flouze, chests = coffres normaux pour le perso actif, combatChests = coffres de combat).
//  for = liste de pseudos : la note (et son cadeau) n'est visible que par ces comptes.
//  Fuze Arena 2.0 : les anciennes notes ont été retirées, tout le monde repart de zéro.
// =====================================================================
// Classement final de l'ancien Fuze Arena (puissance de toute l'équipe, relevée le 20/10/2026 à 17 h 57) et cadeau de chaque place
const OLD_RANKING = [
  ['Fuuuuze', 2539], ['AlexDcr', 2514], ['Kush', 2182], ['Tchomb', 2181],
  ['Simon', 2117], ['Didztasoeur', 2010], ['Le Stein', 1496], ['guillaumkar', 100],
];
// le podium reçoit un titre unique, porté tout de suite
const RANK_GIFTS = [
  { chests: 20, amount: 150, title: 't_champion_1ed' },
  { chests: 18, amount: 150, title: 't_rival_1ed' },
  { chests: 16, amount: 150, title: 't_bronze_1ed' },
  { chests: 15, amount: 150 }, { chests: 15, amount: 150 }, { chests: 15, amount: 150 }, { chests: 15, amount: 150 }, { chests: 15, amount: 150 },
];

export const PATCH_NOTES = [
  {
    id: '2026-10-21-2355-formation-terrain', date: '21/10/2026', time: '23h55', title: 'Formation sur le terrain',
    sections: [
      { title: 'Amélioration', items: [
        '« Ma formation » se fait maintenant sur un petit terrain : tes persos sont debout comme en combat, la ligne 1 près des ennemis.',
        'Fais glisser un perso sur une autre place, ou touche-en deux pour les échanger.',
      ] },
    ],
  },
  {
    id: '2026-10-21-2350-formation', date: '21/10/2026', time: '23h50', title: 'Ma formation : place tes persos',
    sections: [
      { title: 'Nouveau', items: [
        'Combats à 4 contre 4 (trône et combat auto) : choisis la ligne de chaque perso, de la ligne 1 (devant) à la ligne 4 (derrière). Bouton « Ma formation » sur le trône, « Formation » sur le combat auto.',
        'Le Guerrier et le Paladin (corps à corps) frappent d’abord les lignes 1 et 2 ; les lignes 3 et 4 seulement quand il n’y a plus personne devant.',
        'Le Mage et l’Archer (à distance) frappent toutes les lignes.',
        'Sans formation choisie, ton perso le plus fort est devant.',
      ] },
    ],
  },
  {
    id: '2026-10-21-2250-fusion', date: '21/10/2026', time: '22h50', title: 'Fusion sans lag',
    sections: [
      { title: 'Correctif', items: [
        '« Tout fusionner » : plus de lag au moment d’appuyer sur « Fusionner ». Le résultat s’affiche tout de suite, et le Sac se met à jour quand tu fermes la fenêtre.',
      ] },
    ],
  },
  {
    id: '2026-10-21-2245-x3', date: '21/10/2026', time: '22h45', title: 'Combats en x3 et Sac encore plus fluide',
    sections: [
      { title: 'Nouveau', items: [
        'Tous les combats démarrent en vitesse x3. Touche le bouton de vitesse pour repasser en x1 ou x2.',
      ] },
      { title: 'Correctifs', items: [
        '« Tout fusionner » et le Sac ne rament plus, même avec un très gros sac : le calcul du meilleur équipement est bien plus rapide, et les images des objets se dessinent au fil du défilement.',
      ] },
    ],
  },
  {
    id: '2026-10-21-2235-histoire-potes', date: '21/10/2026', time: '22h35', title: 'Tes potes sur la carte de l’Histoire',
    sections: [
      { title: 'Nouveau', items: [
        'Histoire : tes potes apparaissent sur la carte, à côté du combat où ils en sont, avec leur pseudo et leur niveau.',
        'Sur les boutons des zones, une pastille dorée indique combien de potes s’y trouvent.',
      ] },
    ],
  },
  {
    id: '2026-10-21-2225-confort', date: '21/10/2026', time: '22h25', title: 'Récompense du jour et combats à la suite',
    sections: [
      { title: 'Nouveau', items: [
        'Récompense du jour : connecte-toi chaque jour pour la récupérer. Elle grossit jusqu’au 7ᵉ jour (un coffre Épique !), mais un jour raté et la série repart du jour 1.',
        'Sac : bouton « Équiper le meilleur ». Un seul appui et ton héros porte, sur chaque emplacement, l’objet qui lui donne le plus de puissance (panoplies comprises).',
        'Donjons : après une victoire, la vague suivante part toute seule tant qu’il te reste des charges. Touche « Arrêter » pour garder tes charges.',
        'Histoire : après une victoire, le combat suivant part tout seul.',
      ] },
    ],
  },
  {
    id: '2026-10-21-2155-tour-auto', date: '21/10/2026', time: '21h55', title: 'Tour automatique et Sac plus fluide',
    sections: [
      { title: 'Nouveau', items: [
        'Tour infinie : après une victoire, l’étage suivant se lance tout seul au bout de 3 secondes, jusqu’à ta défaite. Touche « Arrêter » pour sortir quand tu veux.',
      ] },
      { title: 'Correctifs', items: [
        'Le Sac et l’équipement ne rament plus sur téléphone.',
        '« Tout fusionner » est beaucoup plus rapide : le résultat s’affiche tout de suite, avec les 20 meilleurs objets obtenus.',
      ] },
    ],
  },

  {
    id: '2026-10-20-1900-v2', date: '20/10/2026', time: '19h00', title: 'Bienvenue dans Fuze Arena 2.0 !',
    sections: [
      { title: 'Un tout nouveau Fuze Arena', items: [
        'Le jeu a été entièrement redessiné : héros, monstres, boss, décors, objets et tous les écrans.',
        'Plein de nouvelles fonctionnalités sont arrivées partout dans le jeu… on te laisse les découvrir !',
        'Tout le monde repart de zéro, avec les mêmes chances pour tous.',
        'Bonne chance à tous, et que le meilleur gagne !',
      ] },
    ],
  },
  // Récompense de l'ancien Fuze Arena : un message rien qu'à lui pour chaque joueur, selon sa place
  ...OLD_RANKING.map(([pseudo, power], i) => ({
    id: `2026-10-20-1900-classement-${i + 1}`, date: '20/10/2026', time: '19h00', for: [pseudo],
    title: `Ancien Fuze Arena : tu finis ${i + 1}${i ? 'ᵉ' : 'ᵉʳ'} !`,
    gift: { id: `fuze-2-0-classement-${i + 1}`, ...RANK_GIFTS[i], text: `Ta récompense de ${i + 1}${i ? 'ᵉ' : 'ᵉʳ'} de l’ancien Fuze Arena. Les coffres vont à ton perso actif quand tu les récupères.` },
    sections: [
      { title: 'Merci d’avoir joué !', items: [
        `Dans l’ancien Fuze Arena, ton équipe avait ${power.toLocaleString('fr-FR')} de puissance : tu termines ${i + 1}${i ? 'ᵉ' : 'ᵉʳ'} sur ${OLD_RANKING.length}.`,
        'Voici ta récompense pour bien démarrer la 2.0. Bonne chance !',
      ] },
      { title: 'Le classement final', items: OLD_RANKING.map(([p, w], j) => `${j + 1}. ${p} : ${w.toLocaleString('fr-FR')} de puissance`) },
    ],
  })),
];

