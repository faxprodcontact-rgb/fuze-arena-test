// =====================================================================
//  ÉCRAN DE COMBAT — rejoue le combat calculé avec des animations 2D
// =====================================================================
import { CLASSES, COSMETIC, ELEMENTS } from './data.js?v=20261021235041';
import { heroCanvas, weaponCanvas, weaponPivot, petCanvas, monsterCanvas, whiteOf, shade, lw, lh, HAND, handOf, IDLE_ANGLE, HERO_W, HERO_H } from './sprites.js?v=20261021235041';
import { SFX, SFX as SFX_ON, setQuiet, startMusic, stopMusic } from './sfx.js?v=20261021235041';


const S = 3;                      // taille d'un pixel de sprite
const FONT = '"Lilita One", "Nunito", sans-serif';
const INK = '#1b1530';
// taille de police : l'ancienne police pixel était plus grosse, on garde la même hauteur de lettres
const PXF = (px) => `${Math.round(px * 1.3 * 10) / 10}px ${FONT}`;
// rectangle arrondi
/** Élément du skin porté (feu, glace, lumière, ténèbres) ou null */
const skinAura = (dye) => { const c = dye && COSMETIC[dye]; return c && c.art ? c.art : null; };
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
/**
 * Aura d'un skin élémentaire autour du héros : une lueur et de petites particules (braises qui montent, flocons qui tombent,
 * étincelles, fumée violette). Sans mémoire : tout dépend du temps t. (x, feet) = pieds du héros, w × h = sa taille.
 */
function drawSkinAura(ctx, art, x, feet, w, h, t, alpha = 1) {
  const E = ELEMENTS.find(e => e.id === art);
  if (!E || alpha <= 0) return;
  const [c1, c2, c3] = E.aura;
  ctx.save();
  const cy = feet - h * 0.45, pulse = 0.8 + 0.2 * Math.sin(t * 3);
  const g = ctx.createRadialGradient(x, cy, 0, x, cy, h * 0.75);
  g.addColorStop(0, rgba(c1, (art === 'tenebres' ? 0.3 : 0.22) * alpha * pulse)); g.addColorStop(1, rgba(c1, 0));
  ctx.fillStyle = g; ctx.fillRect(x - h, cy - h * 0.8, h * 2, h * 1.6);
  ctx.globalCompositeOperation = art === 'tenebres' ? 'source-over' : 'lighter';
  for (let k = 0; k < 10; k++) {
    const ph = (t * 0.42 + k * 0.137) % 1;
    const px = x + Math.sin(k * 2.39 + t * (0.6 + (k % 3) * 0.2)) * w * 0.6;
    const py = art === 'glace' ? feet - h * 1.05 + ph * h * 1.05 : feet - ph * h * 1.15;
    const a = Math.sin(ph * Math.PI) * alpha * (art === 'tenebres' ? 0.55 : 0.9);
    const r = Math.max(1, w * 0.035) * (0.6 + (k % 3) * 0.35) * (art === 'tenebres' ? 1.8 : 1);
    ctx.globalAlpha = a; ctx.fillStyle = k % 2 ? c2 : c3;
    if (art === 'lumiere') {   // petite étoile à 4 branches
      ctx.beginPath(); ctx.moveTo(px, py - r * 2.2); ctx.lineTo(px + r * 0.5, py - r * 0.5); ctx.lineTo(px + r * 2.2, py); ctx.lineTo(px + r * 0.5, py + r * 0.5);
      ctx.lineTo(px, py + r * 2.2); ctx.lineTo(px - r * 0.5, py + r * 0.5); ctx.lineTo(px - r * 2.2, py); ctx.lineTo(px - r * 0.5, py - r * 0.5); ctx.closePath(); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
/** Place d'un dessin de héros dans sa case (x, y, w, h) : les héros vectoriels ont une marge autour (canvas.pad), on l'ajoute */
function heroBox(img, x, y, w, h) {
  const p = img && img.pad;
  if (!p) return [x, y, w, h];
  const kx = w / (img.lw - p[0] - p[2]), ky = h / (img.lh - p[1] - p[3]);
  return [x - p[0] * kx, y - p[1] * ky, w + (p[0] + p[2]) * kx, h + (p[1] + p[3]) * ky];
}
function rrect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const HERO_K = 1.15;              // les héros sont affichés 15 % plus grands en combat

const EASE = {
  linear: t => t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inQuad: t => t * t,
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  outBack: t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

// ------------------------------ Décor ------------------------------
// Un thème = palette + éléments de décor. 'arena' est l'arène entre joueurs.
const THEMES = {
  arena: { sky: ['#241f4f', '#2f2a66', '#45367a', '#6a4285', '#94508a', '#c4628a', '#e98078', '#f5a46b'], sun: ['#ffd27a', '#ffe9b0'], cloud: '#f7b8a0',
    r1: '#5a3f78', r2: '#43325f', walls: ['#5d5468', '#6f667c', '#4a4254'], banners: true, grass: ['#4f8f43', '#6fb35a'], ground: ['#c49a6c', '#b88d60', '#9c7650', '#a07a52'] },
  cave: { sky: ['#120e16', '#17121c', '#1d1622', '#231a28', '#2a1f2e', '#2f2433', '#352838', '#3a2d3d'], r1: '#2b2230', r2: '#221a26',
    stalactites: '#3a2f40', crystals: '#4cd964', grass: ['#3d3a45', '#55505e'], ground: ['#4a4452', '#433d4a', '#36313d', '#3d3845'] },
  forest: { sky: ['#1d3b4f', '#24495c', '#2c5a68', '#376b72', '#467c78', '#5a8c7a', '#719b7b', '#8aa97c'], sun: ['#fff3b0', '#ffffff'],
    r1: '#2d5a3a', r2: '#1f4630', trees: ['#163a24', '#1f4a2e'], grass: ['#3f7d3a', '#5aa04a'], ground: ['#6b5236', '#5f4830', '#4f3c28', '#5a4430'] },
  crypt: { sky: ['#14121e', '#191626', '#1f1b2e', '#262137', '#2c2640', '#322b48', '#383050', '#3e3558'], sun: ['#d8d4ff', '#ffffff'],
    r1: '#2a2540', r2: '#201c32', tombs: '#5d5870', grass: ['#3d4a45', '#52605a'], ground: ['#4f4a5c', '#47425a', '#3a3548', '#423d52'] },
  swamp: { sky: ['#1e2a22', '#24332a', '#2b3d31', '#344839', '#3d5342', '#4a5f4a', '#566b52', '#63775a'], sun: ['#d6e8a0', '#eef7c8'],
    r1: '#2f4232', r2: '#243526', trees: ['#1a2a1c', '#223424'], grass: ['#4a6b3a', '#5f8048'], ground: ['#4a5a3a', '#435233', '#36432a', '#3d4a30'] },
  mine: { sky: ['#140f0c', '#1a1310', '#211813', '#281d16', '#2f2219', '#36271c', '#3d2c1f', '#443122'], r1: '#2e221a', r2: '#241a14',
    stalactites: '#3e3026', beams: '#6b4423', crystals: '#7ff0ff', grass: ['#4a3a2e', '#5e4a3a'], ground: ['#5a4636', '#523f30', '#44342a', '#4a3a2e'] },
  volcano: { sky: ['#2a0f0f', '#3d1410', '#521a12', '#6b2212', '#842c12', '#a03a14', '#bf4d18', '#d9651d'], sun: ['#ffb347', '#ffe08a'],
    r1: '#3a1a14', r2: '#2a120e', lava: '#ff7a1a', grass: ['#5a2a1a', '#7a3a1a'], ground: ['#3a2a26', '#33241f', '#2a1d19', '#30221d'] },
  glacier: { sky: ['#7fb3d9', '#8cbde0', '#9ac7e6', '#a8d1ec', '#b6dbf1', '#c4e4f5', '#d2ecf8', '#e0f3fb'], sun: ['#ffffff', '#ffffff'], cloud: '#ffffff',
    r1: '#a8c8e0', r2: '#8fb3d0', grass: ['#d8ecf8', '#ffffff'], ground: ['#e6f2fa', '#d4e6f2', '#b8d0e2', '#c8dcea'] },
  castle: { sky: ['#0f0d1a', '#151226', '#1c1733', '#241c40', '#2c214d', '#35265a', '#3e2b66', '#473073'], sun: ['#f4f0ff', '#ffffff'],
    r1: '#251d3a', r2: '#1b152c', walls: ['#3a3348', '#4a4258', '#2a2436'], banners: true, grass: ['#2e2a3a', '#403a50'], ground: ['#3d3548', '#362f40', '#2c2636', '#322b3d'] },
  training: { sky: ['#5aa0d8', '#68aadd', '#76b4e2', '#84bee7', '#92c8ec', '#a0d2f1', '#aedcf6', '#bce6fb'], sun: ['#fff3b0', '#ffffff'], cloud: '#ffffff',
    r1: '#6fa86a', r2: '#5a9456', trees: ['#2f6b3a', '#3a7d45'], grass: ['#4f8f43', '#6fb35a'], ground: ['#8fbf5a', '#83b352', '#6f9d45', '#7aa94c'] },
  meeting: { sky: ['#2a0a12', '#3a0d18', '#4d1220', '#601628', '#741a30', '#8a2038', '#a02640', '#b82e48'], sun: ['#ffd84a', '#fff3b0'],
    r1: '#3a1020', r2: '#2a0a16', walls: ['#5a1424', '#7a1c30', '#3a0d18'], banners: true, crowd: '#1f0a12',
    grass: ['#5a1424', '#7a1c30'], ground: ['#8a2038', '#7a1c30', '#5a1424', '#6a1828'] },
  abyss: { sky: ['#05030a', '#090612', '#0e091a', '#130c22', '#18102a', '#1d1332', '#22163a', '#271942'], sun: ['#c38bff', '#ffffff'],
    r1: '#1a1030', r2: '#120a24', lava: '#a64dff', grass: ['#2a1a3a', '#3d2650'], ground: ['#24183a', '#1f1532', '#18102a', '#1c132e'] },
};

// Le décor est découpé en 3 plans (lointain, milieu, sol) pour donner de la profondeur
const LAYERS = {};
function sceneLayers(themeId = 'arena') {
  if (LAYERS[themeId]) return LAYERS[themeId];
  const T = THEMES[themeId] || THEMES.arena;
  const w = 160, h = 90;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [far, xf] = mk(), [mid, xm] = mk(), [gnd, xg] = mk();
  const disc = (x, cx, cy, r, col) => { x.fillStyle = col; for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) x.fillRect(cx + xx, cy + yy, 1, 1); };
  // --- plan lointain : soleil / lune, nuages, montagnes au loin
  if (T.sun) { disc(xf, 118, 40, 8, T.sun[0]); disc(xf, 116, 38, 5, T.sun[1]); }
  const ridge = (x, base, a1, f1, a2, f2, ph, col, light) => {
    for (let i = 0; i < w; i++) {
      const top = Math.round(base + a1 * Math.sin(i * f1 + ph) + a2 * Math.sin(i * f2 + ph * 2));
      x.fillStyle = col; x.fillRect(i, top, 1, h - top);
      if (light) { x.fillStyle = light; x.fillRect(i, top, 1, 1); }   // arête éclairée
    }
  };
  ridge(xf, 44, 7, 0.06, 3, 0.17, 2.1, shade(T.r1, 0.18), null);       // montagnes très lointaines (plus claires = brume)
  ridge(xf, 47, 6, 0.07, 3, 0.19, 0, T.r1, shade(T.r1, 0.25));
  // --- plan du milieu
  ridge(xm, 55, 4, 0.05, 2, 0.23, 1.3, T.r2, shade(T.r2, 0.2));
  if (T.trees) {
    for (let i = 0; i < w; i += 11) {
      const th = 14 + ((i * 7) % 9), tx = i + ((i * 3) % 5);
      const col = T.trees[(i / 11) % 2 | 0];
      for (let j = 0; j < th; j++) {
        const half = Math.floor((j * 5) / th) + 1;
        xm.fillStyle = col; xm.fillRect(tx - half, 68 - th + j, half * 2 + 1, 1);
        xm.fillStyle = shade(col, 0.22); xm.fillRect(tx - half, 68 - th + j, 1, 1);   // côté éclairé
      }
      xm.fillStyle = '#3b2a20'; xm.fillRect(tx, 68, 1, 2);
    }
  }
  if (T.stalactites) {
    for (let i = 0; i < w; i += 9) {
      const len = 6 + ((i * 13) % 14);
      for (let j = 0; j < len; j++) { const half = Math.max(0, 2 - Math.floor((j * 3) / len)); xm.fillStyle = T.stalactites; xm.fillRect(i - half, j, half * 2 + 1, 1); xm.fillStyle = shade(T.stalactites, 0.25); xm.fillRect(i - half, j, 1, 1); }
    }
  }
  if (T.crystals) {
    [[20, 62], [70, 64], [128, 61], [150, 65]].forEach(([cx, cy]) => {
      xm.fillStyle = T.crystals; xm.fillRect(cx, cy - 4, 2, 6); xm.fillRect(cx - 2, cy - 1, 2, 3); xm.fillRect(cx + 2, cy - 2, 2, 4);
      xm.fillStyle = '#ffffff'; xm.fillRect(cx, cy - 4, 1, 2);
    });
  }
  if (T.beams) {
    xm.fillStyle = T.beams;
    [[24], [80], [136]].forEach(([bx]) => { xm.fillRect(bx, 30, 3, 38); xm.fillRect(bx + 22, 30, 3, 38); xm.fillRect(bx - 2, 28, 29, 3); });
    xm.fillStyle = shade(T.beams, 0.3); [[24], [80], [136]].forEach(([bx]) => { xm.fillRect(bx, 30, 1, 38); xm.fillRect(bx + 22, 30, 1, 38); xm.fillRect(bx - 2, 28, 29, 1); });
  }
  if (T.walls) {
    const [wl, wh, wd] = T.walls;
    xm.fillStyle = wl; xm.fillRect(0, 60, w, 8);
    xm.fillStyle = wh; xm.fillRect(0, 60, w, 1);
    xm.fillStyle = wd;
    for (let i = 0; i < w; i += 8) { xm.fillRect(i, 57, 5, 3); xm.fillRect(i + 4, 63, 1, 5); }
    for (let i = 0; i < w; i += 8) { xm.fillStyle = wh; xm.fillRect(i, 57, 5, 1); }
    xm.fillStyle = shade(wl, -0.25); for (let i = 0; i < w; i += 4) xm.fillRect(i, 64 + (i % 8 ? 0 : 2), 3, 1);   // briques
  }
  if (T.banners) {
    [[18, '#c0392b'], [52, '#2e5aa8'], [108, '#2e5aa8'], [142, '#c0392b']].forEach(([bx, col]) => {
      xm.fillStyle = '#3a3344'; xm.fillRect(bx + 2, 50, 1, 8);
      xm.fillStyle = col; xm.fillRect(bx, 52, 5, 9); xm.fillRect(bx + 1, 61, 3, 1);
      xm.fillStyle = shade(col, 0.3); xm.fillRect(bx, 52, 1, 9);
      xm.fillStyle = '#e5b33a'; xm.fillRect(bx + 2, 55, 1, 2);
    });
  }
  if (T.crowd) {
    for (let i = 0; i < w; i += 5) { const hgt = 3 + ((i * 7) % 3); xm.fillStyle = T.crowd; xm.fillRect(i, 68 - hgt, 4, hgt); xm.fillRect(i + 1, 68 - hgt - 2, 2, 2); xm.fillStyle = shade(T.crowd, 0.3); xm.fillRect(i + 1, 68 - hgt - 2, 1, 1); }
  }
  if (T.tombs) {
    [[16, 4], [44, 3], [100, 4], [146, 3]].forEach(([tx, tw]) => {
      xm.fillStyle = T.tombs; xm.fillRect(tx, 61, tw * 2, 7); xm.fillRect(tx + 1, 60, tw * 2 - 2, 1);
      xm.fillStyle = shade(T.tombs, 0.25); xm.fillRect(tx, 61, 1, 7);
      xm.fillStyle = '#3a3548'; xm.fillRect(tx + tw - 1, 62, 2, 4); xm.fillRect(tx + tw - 2, 63, 4, 1);
    });
  }
  // --- sol
  const [g1, g2] = T.grass, [d1, d2, d3, d4] = T.ground;
  xg.fillStyle = g1; xg.fillRect(0, 68, w, 3);
  xg.fillStyle = g2; xg.fillRect(0, 68, w, 1);
  for (let i = 0; i < w; i += 3) { xg.fillStyle = (i * 7) % 2 ? g2 : g1; xg.fillRect(i, 67, 1, 1); }   // brins d'herbe
  xg.fillStyle = d1; xg.fillRect(0, 71, w, h - 71);
  for (let yy = 71; yy < h; yy += 4) for (let xx = (yy / 4) % 2 ? 0 : 4; xx < w; xx += 8) { xg.fillStyle = d2; xg.fillRect(xx, yy, 4, 4); }
  xg.fillStyle = d3;
  for (let i = 0; i < 40; i++) { const px = (i * 37) % w, py = 72 + ((i * 53) % 17); xg.fillRect(px, py, 1, 1); }
  xg.fillStyle = shade(d1, 0.18);
  for (let i = 0; i < 18; i++) { const px = (i * 61) % w, py = 73 + ((i * 29) % 15); xg.fillRect(px, py, 2, 1); }   // cailloux éclairés
  xg.fillStyle = d4; xg.fillRect(0, 71, w, 1);
  if (T.lava) {
    xg.fillStyle = T.lava;
    [[10, 78, 14], [52, 84, 10], [96, 76, 18], [140, 86, 12]].forEach(([lx, ly, lw2]) => { xg.fillRect(lx, ly, lw2, 1); xg.fillRect(lx + 3, ly + 1, lw2 - 6, 1); });
  }
  LAYERS[themeId] = { far, mid, gnd, T };
  return LAYERS[themeId];
}

// ------------------------------ Décors vectoriels (refonte) ------------------------------
// art/decors/<thème>.svg : 3 plans (loin, milieu, sol) dans un repère 480 × 660. 3 px = 1 unité de l'ancien décor
// (160 × 90), décalé de 130 unités vers le haut : le décor monte jusqu'en haut d'un écran de téléphone.
// Le fichier donne aussi le ciel, la couleur de la terre sous le décor, les étoiles et le soleil (commentaire THEME).
const DEC_UP = 130;
const DEC_R = { loin: 5, milieu: 7, sol: 7 };     // pixels par unité au moment de dessiner les plans
const DEC_SRC = {};
export async function loadDecorArt() {
  const q = new URL(import.meta.url).search;
  await Promise.all(Object.keys(THEMES).map(async (id) => {
    try {
      const res = await fetch(new URL(`../art/decors/${id}.svg${q}`, import.meta.url));
      if (!res.ok) return;
      const txt = await res.text();
      const defs = (txt.match(/<defs>[\s\S]*?<\/defs>/) || [''])[0];
      const T = JSON.parse(txt.match(/<!-- THEME (\{.*\}) -->/)[1]);
      const out = { T };
      for (const m of txt.matchAll(/<!-- PLAN (\w+) (-?\d+) (\d+) -->([\s\S]*?)<!-- FIN \1 -->/g)) {
        const y0 = +m[2], h = +m[3] - y0;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${y0} 480 ${h}" width="480" height="${h}">${defs}<g stroke-linejoin="round" stroke-linecap="round">${m[4]}</g></svg>`;
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await img.decode();
        out[m[1]] = { img, top: y0 / 3 - DEC_UP, h: h / 3 };
      }
      if (out.loin && out.milieu && out.sol) DEC_SRC[id] = out;
    } catch (e) { console.warn('Décor indisponible :', id, e); }
  }));
}
// les plans ne sont dessinés en image qu'à la première utilisation du thème (4 thèmes gardés en mémoire)
const DEC = new Map();
function decorLayers(id) {
  if (DEC.has(id)) { const v = DEC.get(id); DEC.delete(id); DEC.set(id, v); return v; }
  const src = DEC_SRC[id];
  if (!src) return null;
  const V = { T: src.T };
  for (const plan of ['loin', 'milieu', 'sol']) {
    const { img, top, h } = src[plan], R = DEC_R[plan];
    const c = document.createElement('canvas');
    c.width = 160 * R; c.height = Math.round(h * R);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    V[plan] = { c, top, h };
  }
  DEC.set(id, V);
  if (DEC.size > 4) DEC.delete(DEC.keys().next().value);
  return V;
}
// nuage vectoriel qui dérive (dessiné une fois)
let CLOUD = null;
function cloudSprite(col) {
  if (CLOUD && CLOUD.col === col) return CLOUD;
  const c = document.createElement('canvas'); c.width = 240; c.height = 90;
  const x = c.getContext('2d');
  const bumps = [[46, 58, 28], [86, 40, 36], [134, 34, 40], [176, 48, 30], [204, 62, 20], [120, 64, 34], [62, 68, 22]];
  const shape = (dx, dy) => { x.beginPath(); bumps.forEach(([bx, by, r]) => { x.moveTo(bx + dx + r, by + dy); x.arc(bx + dx, by + dy, r, 0, Math.PI * 2); }); x.fill(); };
  x.fillStyle = shade(col, -0.16); shape(0, 0);
  x.fillStyle = col; shape(-5, -7);
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; shape(0, 0);
  x.globalCompositeOperation = 'destination-out'; x.fillRect(0, 76, 240, 20);
  CLOUD = c; CLOUD.col = col;
  return c;
}

/**
 * Dessine tout le décor d'une scène (ciel, étoiles, soleil, nuages, 3 plans, terre jusqu'en bas).
 * W/H/GROUND en unités de la scène ; moving = léger mouvement de caméra (les plans glissent à des vitesses différentes).
 */
export function paintScene(ctx, theme, W, H, GROUND, time = 0, moving = true) {
  const V = decorLayers(theme);
  const T = V ? V.T : (THEMES[theme] || THEMES.arena);
  const sb = (W + 24) / 160, top = GROUND - 75 * sb;   // 1 unité de décor = sb unités de scène ; la ligne des pieds = unité 75
  const Y = u => top + u * sb;
  const sway = moving ? Math.sin(time * 0.22) * 5 : 0;
  const hz = Y(V ? T.hz : 62);
  const smooth = ctx.imageSmoothingEnabled;
  // ciel en dégradé, du haut de l'écran jusqu'à l'horizon
  const sg = ctx.createLinearGradient(0, V ? Math.min(0, Y(-110)) : top, 0, hz);
  T.sky.forEach((c, i) => sg.addColorStop(i / (T.sky.length - 1), c));
  ctx.fillStyle = sg; ctx.fillRect(-10, -10, W + 20, hz + 12);
  // étoiles qui scintillent
  const stars = V ? T.stars : parseInt(T.sky[0].slice(1, 3), 16) + parseInt(T.sky[0].slice(3, 5), 16) + parseInt(T.sky[0].slice(5, 7), 16) < 200;
  if (stars) {
    ctx.fillStyle = '#ffffff';
    const sh = Math.max(20, V ? hz - 30 * sb : top + 40 * sb);
    for (let j = 0; j < 44; j++) {
      const sx = (j * 97 + sway * 0.1) % W, sy = (j * 53) % sh, r = j % 5 ? 0.8 : 1.5;
      ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(time * 1.3 + j * 1.7));
      if (V) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); if (j % 5 === 0) { ctx.fillRect(sx - 3.5, sy - 0.4, 7, 0.8); ctx.fillRect(sx - 0.4, sy - 3.5, 0.8, 7); } }
      else ctx.fillRect(sx, sy, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
  // soleil ou lune, avec son halo
  if (T.sun) {
    const sx = V ? W * 0.74 + sway * 0.15 : -12 + sway * 0.15 + 117 * sb, sy = V ? Math.max(30, Y(-42)) : top + 39 * sb, r = 46 * sb;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, V ? 70 : r);
    g.addColorStop(0, T.sun[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = V ? 0.45 : 0.35; ctx.fillStyle = g; ctx.fillRect(sx - r * 2, sy - r * 2, r * 4, r * 4);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (V) {
      const rr = T.moon ? 13 : 16;
      ctx.fillStyle = T.sun[0]; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.sun[1]; ctx.beginPath(); ctx.arc(sx - rr * 0.18, sy - rr * 0.18, rr * 0.78, 0, Math.PI * 2); ctx.fill();
      if (T.moon) {
        ctx.fillStyle = T.sun[0];
        [[0.3, 0.25, 0.22], [-0.35, 0.3, 0.14], [0.05, -0.35, 0.12]].forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(sx + dx * rr, sy + dy * rr, k * rr, 0, Math.PI * 2); ctx.fill(); });
      }
    }
  }
  if (V) {
    ctx.imageSmoothingEnabled = true;
    // nuages qui dérivent
    if (T.cloud) {
      const cs = cloudSprite(T.cloud);
      for (let j = 0; j < 3; j++) {
        const cw = (52 + j * 16) * (W / 240), ch = cw * 0.375, cx = ((j * 157 + time * (4 + j * 2)) % (W + cw * 2)) - cw, cy = Math.max(8, hz - (120 - j * 26) * sb) - ch * 0.5;
        ctx.globalAlpha = 0.95 - j * 0.12; ctx.drawImage(cs, cx, cy, cw, ch);
      }
      ctx.globalAlpha = 1;
    }
    const dl = (L, dx) => ctx.drawImage(L.c, -12 + dx, Y(L.top), W + 24, L.h * sb);
    dl(V.loin, sway * 0.25); dl(V.milieu, sway * 0.6); dl(V.sol, 0);
    // la terre continue jusqu'en bas, en s'assombrissant
    const yb = Y(V.sol.top + V.sol.h) - 0.5;
    if (yb < H) {
      ctx.fillStyle = T.deep; ctx.fillRect(-10, yb, W + 20, H - yb + 10);
      const g = ctx.createLinearGradient(0, yb, 0, H);
      g.addColorStop(0, 'rgba(10,8,16,0)'); g.addColorStop(1, 'rgba(10,8,16,0.55)');
      ctx.fillStyle = g; ctx.fillRect(-10, yb, W + 20, H - yb + 10);
    }
    ctx.imageSmoothingEnabled = smooth;
    return;
  }
  // ancien décor pixel (si les dessins n'ont pas pu être chargés)
  const L = sceneLayers(theme);
  ctx.drawImage(L.far, -12 + sway * 0.25, top, W + 24, 90 * sb);
  if (T.cloud) {
    ctx.fillStyle = T.cloud;
    for (let j = 0; j < 4; j++) {
      const cw = (14 + j * 5) * sb, cx = ((j * 137 + time * (5 + j * 2)) % (W + cw * 2)) - cw, cy = top + (6 + j * 6) * sb;
      ctx.globalAlpha = 0.85 - j * 0.12;
      ctx.fillRect(cx, cy, cw, 2 * sb); ctx.fillRect(cx + 3 * sb, cy - 2 * sb, cw - 8 * sb, 2 * sb); ctx.fillRect(cx + 6 * sb, cy - 3 * sb, 5 * sb, sb);
    }
    ctx.globalAlpha = 1;
  }
  const mg = ctx.createLinearGradient(0, top + 40 * sb, 0, top + 62 * sb);
  mg.addColorStop(0, 'rgba(0,0,0,0)'); mg.addColorStop(1, T.sky[T.sky.length - 1]);
  ctx.globalAlpha = 0.45; ctx.fillStyle = mg; ctx.fillRect(-10, top + 40 * sb, W + 20, 22 * sb); ctx.globalAlpha = 1;
  ctx.drawImage(L.mid, -12 + sway * 0.6, top, W + 24, 90 * sb);
  ctx.drawImage(L.gnd, -12, top, W + 24, 90 * sb);
  const band = 19 * sb;
  for (let y = top + 90 * sb; y < H + 10; y += band) ctx.drawImage(L.gnd, 0, 71, 160, 19, -12, y, W + 24, band);
  const g = ctx.createLinearGradient(0, top + 90 * sb, 0, H);
  g.addColorStop(0, 'rgba(10,8,16,0)'); g.addColorStop(1, 'rgba(10,8,16,0.65)');
  ctx.fillStyle = g;
  ctx.fillRect(-10, top + 90 * sb, W + 20, H);
}

// Ambiance animée de chaque décor
const AMBIENT = {
  arena: { kind: 'dust', color: '#ffe0b0', n: 10 }, cave: { kind: 'dust', color: '#9fffb0', n: 14 }, forest: { kind: 'firefly', color: '#e8ff7a', n: 14 },
  crypt: { kind: 'wisp', color: '#c9c4ff', n: 10 }, swamp: { kind: 'firefly', color: '#b8ff7a', n: 16 }, mine: { kind: 'dust', color: '#ffd9a0', n: 14 },
  volcano: { kind: 'ember', color: '#ffb347', n: 26 }, glacier: { kind: 'snow', color: '#ffffff', n: 40 }, castle: { kind: 'wisp', color: '#b9a8ff', n: 10 },
  training: { kind: 'leaf', color: '#7fc96a', n: 8 }, meeting: { kind: 'confetti', color: '#ffd84a', n: 18 }, abyss: { kind: 'ember', color: '#c38bff', n: 26 },
};


// petits projectiles de la guerre et de la mêlée (refonte) : flèche ou orbe cernés, avec un reflet
function miniShot(ctx, e, c0, c1) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.lineJoin = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
  if (e.arrow) {
    ctx.rotate(e.angle);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(-8, 0); ctx.lineTo(-13, 4); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a6234'; rrect(ctx, -11, -1.1, 15, 2.2, 1.1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9dee5'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(3, -3.5); ctx.lineTo(4.5, 0); ctx.lineTo(3, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(-1.2, -1.2, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ------------------------------ Combat ------------------------------
/**
 * Joue un combat dans le canvas. Renvoie { promise, setSpeed, skip, destroy }.
 */
const NO_SFX = new Proxy({}, { get: () => () => {} });

/**
 * Joue un combat dans le canvas.
 * training = entraînement silencieux (pas de musique ni de bruitages) ; onEntry = appelé à chaque étape.
 */
export function playBattle(canvas, A, B, result, { theme = 'arena', victory = null, training = false, onEntry = null, onBegin = null, spellBar = false, hud = null } = {}) {
  // hud = 'corner' : seulement la barre de vie du héros, petite, en bas à gauche (aperçu d'un sort)
  // Taille « logique » de la scène, recalculée selon l'écran (propre à chaque combat).
  // Téléphone en hauteur : scène étroite et haute (persos plus gros), sinon format large.
  let W = 480, H = 270, GROUND = 228, PORTRAIT = false;
  let SAFE_TOP = 0, SAFE_BOT = 0, CTRL_TOP = 0;   // CTRL_TOP : haut des boutons du bas (sorts, vitesse), en unités de la scène
  const sfx = training ? NO_SFX : SFX;
  const ctx = canvas.getContext('2d');
  let k = 1, speed = 1, alive = true, last = performance.now(), time = 0, shake = 0;
  const tweens = [], timers = [], effects = [], texts = [];
  let banner = null;
  let F = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const aspect = Math.max(0.3, r.height / Math.max(1, r.width));
    PORTRAIT = aspect > 1.1;
    W = PORTRAIT ? 240 : 480;
    H = Math.round(W * aspect);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    k = canvas.width / W;
    // zones réservées en haut (encoche) et en bas (boutons), en unités de la scène
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    SAFE_TOP = (parseFloat(cs.paddingTop) || 0) * W / r.width;
    SAFE_BOT = (parseFloat(cs.paddingBottom) || 0) * W / r.width;
    probe.remove();
    // le sol est placé pour qu'il reste la place de la barre de vie du héros entre ses pieds et les boutons du bas
    const ctrl = canvas.closest('.battle')?.querySelector('.battle-ctrl');
    const cr = ctrl && ctrl.getBoundingClientRect();
    CTRL_TOP = cr && cr.height ? (cr.top - r.top) * W / r.width : H - SAFE_BOT;
    GROUND = PORTRAIT ? Math.round(Math.min(H * 0.7, CTRL_TOP - 54)) : H - 42;
    F.forEach(f => { f.baseX = baseXOf(f.i, f.sw); });
  }
  // Position de départ ; un gros boss est décalé pour rester entièrement à l'écran
  const baseXOf = (i, sw = HERO_W) => {
    const x = (PORTRAIT ? (i === 0 ? 0.25 : 0.75) : (i === 0 ? 0.3125 : 0.6875)) * W;
    const half = (sw * S) / 2 + 4;
    return i === 0 ? Math.max(x, half) : Math.min(x, W - half);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const mk = (snap, i) => {
    const weapon = snap.monster ? null : CLASSES[snap.classId].weapon;
    const sprite = snap.monster ? monsterCanvas(snap.monster) : heroCanvas(snap.classId, snap.dye);
    const idle = weapon ? IDLE_ANGLE[weapon] : 0;
    const k = snap.monster ? 1 : HERO_K;     // les héros sont dessinés un peu plus grands
    return {
      k, pose: 'idle', spriteAtk: snap.monster ? null : heroCanvas(snap.classId, snap.dye, 'atk'),
      spriteRun: snap.monster ? null : [heroCanvas(snap.classId, snap.dye, 'run1'), heroCanvas(snap.classId, snap.dye, 'run2')],
      i, snap, weapon, idle, dir: i === 0 ? 1 : -1, baseX: 0,
      offX: 0, offY: 0, rot: 0, flash: 0, alpha: 1, squash: 0,
      wAng: idle, wOff: 0, run: false, spin: 0, phase: i * 1.7, petDX: 0, petDY: 0,
      hp: snap.hp ?? snap.maxHp, max: snap.maxHp, hpShown: snap.hp ?? snap.maxHp, hpLag: snap.hp ?? snap.maxHp, shield: 0, shieldShown: 0,
      tags: [], dead: false, stars: 0, petHop: 0, glow: 0, glowColor: '#fff',
      // les boss sont dessinés plus gros (4 px au lieu de 3)
      sprite, sw: snap.monster ? lw(sprite) * 4 / 3 : HERO_W * k, sh: snap.monster ? lh(sprite) * 4 / 3 : HERO_H * k,
      wSprite: weapon ? weaponCanvas(weapon, snap.dye) : null, pivot: weapon ? weaponPivot(weapon) : [0, 0], aura: snap.monster ? null : skinAura(snap.dye),
      pet: snap.pet ? petCanvas(snap.pet.itemId) : null,
    };
  };
  F = [mk(A, 0), mk(B, 1)];
  F.forEach(f => { f.baseX = baseXOf(f.i, f.sw); });

  // ---------- tweens & timers (suivent la vitesse du combat) ----------
  function tween(obj, to, dur, ease = 'outQuad') {
    return new Promise(res => {
      const from = {};
      for (const key in to) from[key] = obj[key];
      tweens.push({ obj, from, to, dur: Math.max(1, dur), t: 0, ease: EASE[ease], res });
    });
  }
  function wait(ms) { return new Promise(res => timers.push({ t: ms, res })); }

  // ---------- positions ----------
  const fx = (f) => f.baseX + f.offX * f.dir;
  const center = (f) => ({ x: fx(f), y: GROUND - f.sh * S * 0.55 + f.offY });
  // familier : flotte derrière son maître
  const petBox = (f) => {
    const pw = lw(f.pet) * 2, ph = lh(f.pet) * 2;
    const x = fx(f) - (PORTRAIT ? 34 : 52) * f.dir - pw / 2 + f.petDX;
    const y = GROUND - 64 + Math.sin(time * 4 + f.phase) * 4 - f.petHop * 10 + f.petDY;
    return { x, y, pw, ph, cx: x + pw / 2, cy: y + ph / 2 };
  };
  const handPos = (f) => f.weapon ? {
    x: fx(f) + (-f.sw * S / 2 + handOf(f.pose, f.snap.classId).x * S * f.k) * f.dir,
    y: GROUND + f.offY - f.sh * S + handOf(f.pose, f.snap.classId).y * S * f.k,
  } : { x: fx(f) + f.sw * S * 0.3 * f.dir, y: GROUND + f.offY - f.sh * S * 0.6 };

  // ---------- particules & textes ----------
  function burst(x, y, n, colors, { speed: sp = 120, up = 0, grav = 300, life = 600, size = 3, glow = null } = {}) {
    if (glow === null) glow = !colors.some(c => /c49a6c|e0c49a/i.test(c));   // tout brille, sauf la poussière du sol
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2;
      const v = sp * (0.4 + Math.random() * 0.6);
      effects.push({
        kind: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, g: grav,
        life, max: life, color: colors[j % colors.length], size: size * (0.6 + Math.random() * 0.6), glow,
      });
    }
  }
  function float(text, x, y, color, size = 10, opts = {}) {
    texts.push({ text, x, y, vy: opts.vy ?? -40, life: opts.life ?? 1000, max: opts.life ?? 1000, color, size, pop: 0 });
  }

  // ---------- application des résultats ----------
  const STATUS_COLOR = { burn: '#ff9f43', poison: '#7bed6f', stun: '#feca57', buff: '#ffd84a', debuff: '#c38bff' };

  async function hitFx(T, crit) {
    (crit ? sfx.crit : sfx.hit)();
    T.flash = 1;
    shake = Math.max(shake, crit ? 7 : 3);
    const c = center(T);
    effects.push({ kind: 'flare', x: c.x, y: c.y, r: crit ? 46 : 28, color: crit ? '#ffd84a' : '#ffffff', life: crit ? 260 : 160, max: crit ? 260 : 160 });
    effects.push({ kind: 'ring', x: c.x, y: c.y, r0: 6, r1: crit ? 60 : 36, color: crit ? '#ffd84a' : '#ffffff', life: 240, max: 240, thin: true });
    burst(c.x, c.y, crit ? 18 : 10, crit ? ['#fff', '#ffd84a', '#ff6b6b'] : ['#fff', '#ff6b6b', '#ffb3b3'], { speed: crit ? 200 : 140, up: 40 });
    tween(T, { offX: -12, rot: -8 }, 90).then(() => tween(T, { offX: 0, rot: 0 }, 220, 'outBack'));
    tween(T, { flash: 0 }, 220, 'linear');
  }

  function apply(r) {
    const T = F[r.target];
    const c = center(T);
    if (r.type === 'hit') {
      T.hp = r.hp;
      T.shield = Math.max(0, T.shield - r.absorbed);
      hitFx(T, r.crit);
      if (r.crit) float('CRITIQUE !', c.x, c.y - 52, '#ffd84a', 8, { vy: -25 });
      float(String(r.dmg - r.absorbed), c.x + (Math.random() * 20 - 10), c.y - 34, r.crit ? '#ffd84a' : '#ffffff', r.crit ? 16 : 12);
      if (r.absorbed > 0) { float(`(${r.absorbed})`, c.x + 26 * T.dir * -1, c.y - 14, '#7fd6ff', 7); burst(c.x, c.y, 8, ['#7fd6ff', '#e0f7ff'], { speed: 160 }); }
    } else if (r.type === 'dodge') {
      sfx.dodge();
      tween(T, { offX: -26, offY: -14 }, 140).then(() => tween(T, { offX: 0, offY: 0 }, 260, 'outQuad'));
      float('Esquive !', c.x, c.y - 40, '#e0f7ff', 8);
    } else if (r.type === 'heal') {
      sfx.heal();
      T.hp = r.hp;
      float('+' + r.amount, c.x, c.y - 34, '#7bed6f', 12);
      for (let j = 0; j < 14; j++) effects.push({ kind: 'plus', x: c.x + (Math.random() * 50 - 25), y: c.y + 20 - Math.random() * 30, vy: -50 - Math.random() * 40, life: 900, max: 900 });
      T.glow = 1; T.glowColor = '#7bed6f'; tween(T, { glow: 0 }, 600, 'linear');
    } else if (r.type === 'shield') {
      sfx.shield();
      T.shield = r.shield;
      float('Bouclier', c.x, c.y - 40, '#7fd6ff', 8);
      burst(c.x, c.y, 14, ['#7fd6ff', '#e0f7ff', '#ffffff'], { speed: 90, grav: -40 });
    } else if (r.type === 'status') {
      float(r.n, c.x, c.y - 56, STATUS_COLOR[r.k] || '#fff', 7, { vy: -18, life: 1200 });
      if (r.k === 'stun') { T.stars = 1; sfx.stun(); }
    }
  }

  // ---------- effets visuels de sorts ----------
  function projectile(kind, from, to, dur) {
    const p = { kind: 'proj', type: kind, x: from.x, y: from.y, life: 1e9, max: 1e9, angle: Math.atan2(to.y - from.y, to.x - from.x), t: 0 };
    effects.push(p);
    const arc = kind === 'arrow' || kind === 'poisonArrow' ? -30 : 0;
    const o = { t: 0 };
    return new Promise(res => {
      const tw = { obj: o, from: { t: 0 }, to: { t: 1 }, dur, t: 0, ease: EASE.linear, res: () => { p.life = 0; res(); } };
      tw.onStep = () => {
        const t = o.t;
        const nx = from.x + (to.x - from.x) * t;
        const ny = from.y + (to.y - from.y) * t + arc * Math.sin(Math.PI * t);
        p.angle = Math.atan2(ny - p.y, nx - p.x) || p.angle;
        p.x = nx; p.y = ny;
        trail(p);
      };
      tweens.push(tw);
    });
  }
  function trail(p) {
    const T = {
      fireball: ['#ff9f43', '#ffd84a', '#ff5e3a'], bolt: ['#c38bff', '#ffffff'], ice: ['#bff3ff', '#ffffff'],
      drain: ['#8a3bd1', '#c38bff'], poisonArrow: ['#7bed6f', '#3fbf3f'], meteor: ['#ff9f43', '#ffd84a', '#ff3a1a', '#666'],
      spore: ['#7bed6f', '#b8ffb0', '#9b59b6'], rock: ['#8d8a84', '#5f5c57'], spit: ['#7bed6f', '#2f9e3f'],
    }[p.type];
    if (!T || Math.random() > 0.8) return;
    effects.push({ kind: 'p', x: p.x + (Math.random() * 6 - 3), y: p.y + (Math.random() * 6 - 3), vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, g: -20, life: 350, max: 350, color: T[Math.floor(Math.random() * T.length)], size: p.type === 'meteor' ? 5 : 3, glow: true });
  }

  async function skyStrike(kind, T, dur) {
    const c = center(T);
    if (kind === 'lightning') {
      sfx.bolt();
      effects.push({ kind: 'bolt', x: c.x, y: c.y, life: 260, max: 260, seed: Math.random() });
      effects.push({ kind: 'flashScreen', life: 120, max: 120, color: '#e8f4ff' });
      await wait(80);
    } else if (kind === 'holy') {
      sfx.magic();
      effects.push({ kind: 'pillar', x: c.x, life: 520, max: 520 });
      await wait(260);
      burst(c.x, c.y, 16, ['#fff3b0', '#ffd84a', '#ffffff'], { speed: 120, grav: -60 });
    } else if (kind === 'meteor') {
      sfx.fire();
      await projectile('meteor', { x: c.x - 160 * T.dir * -1, y: -30 }, { x: c.x, y: c.y + 10 }, dur);
      sfx.boom();
      burst(c.x, c.y + 10, 30, ['#ff9f43', '#ffd84a', '#ff3a1a', '#555'], { speed: 260, up: 80, size: 4 });
      shake = 12;
    } else if (kind === 'firerain') {
      sfx.fire();
      const ox = Math.random() * 40 - 20;
      await projectile('fireball', { x: c.x + ox - 40, y: -10 }, { x: c.x + ox / 2, y: c.y }, dur);
      burst(c.x, c.y, 10, ['#ff9f43', '#ffd84a'], { speed: 140 });
    } else if (kind === 'rain') {
      sfx.arrow();
      const ox = Math.random() * 40 - 20;
      await projectile('arrow', { x: c.x + ox + 20 * T.dir, y: -10 }, { x: c.x + ox / 3, y: c.y }, dur);
    } else if (kind === 'trap') {
      effects.push({ kind: 'trap', x: c.x, y: GROUND - 4, life: 500, max: 500 });
      await wait(200);
    }
  }

  async function selfFx(f, fxk) {
    const c = center(f);
    if (fxk === 'roar') {
      sfx.roar();
      for (let j = 0; j < 3; j++) { effects.push({ kind: 'ring', x: c.x, y: c.y, r0: 10, r1: 90, color: '#ff6b6b', life: 500, max: 500 }); await wait(110); }
      shake = 5;
    } else if (fxk === 'shield') {
      effects.push({ kind: 'ring', x: c.x, y: c.y, r0: 60, r1: 44, color: '#7fd6ff', life: 400, max: 400 });
    } else if (fxk === 'buff') {
      sfx.buff();
      for (let j = 0; j < 10; j++) effects.push({ kind: 'up', x: c.x + (Math.random() * 50 - 25), y: c.y + 30, vy: -70 - Math.random() * 40, life: 800, max: 800 });
      f.glow = 1; f.glowColor = '#ffd84a'; tween(f, { glow: 0 }, 700, 'linear');
    } else if (fxk === 'heal') {
      effects.push({ kind: 'pillar', x: c.x, life: 520, max: 520, color: '#7bed6f' });
    }
  }

  // ---------- séquences d'action ----------
  const byStep = (results, s) => results.filter(r => r.step === s);

  async function swing(f) {
    sfx.swing();
    if (!f.weapon) {
      await tween(f, { offX: f.offX - 8, squash: 0.15 }, 120);
      await tween(f, { offX: f.offX + 20, squash: -0.1 }, 80, 'inQuad');
      tween(f, { squash: 0 }, 160);
    } else if (f.weapon === 'hammer' || f.weapon === 'sword') {
      await tween(f, { wAng: -80, offX: f.offX - 4 }, 110);
      await tween(f, { wAng: 130, offX: f.offX + 12 }, 80, 'inQuad');
    }
  }

  async function doMelee(f, T, e) {
    f.run = true;
    f.pose = 'atk';
    const dist = Math.abs(T.baseX - f.baseX) - (f.sw + T.sw) * S / 2 - 4;
    await tween(f, { offX: dist }, 320, 'inOutQuad');
    f.run = false;
    for (let s = 0; s < e.hits; s++) {
      if (e.fx === 'whirl') {
        tween(f, { spin: f.spin + 360 }, 220, 'linear');
        await tween(f, { wAng: 130 }, 120);
        effects.push({ kind: 'slash', x: center(T).x, y: center(T).y, dir: f.dir, life: 200, max: 200, big: true });
      } else {
        await swing(f);
        const c = center(T);
        if (e.fx === 'bash') { effects.push({ kind: 'impact', x: c.x - 10 * f.dir, y: c.y, life: 220, max: 220 }); burst(c.x, GROUND - 4, 8, ['#c49a6c', '#e0c49a'], { speed: 90, up: 60 }); }
        else effects.push({ kind: 'slash', x: c.x - 6 * f.dir, y: c.y, dir: f.dir, life: 200, max: 200 });
      }
      byStep(e.results, s).forEach(apply);
      await wait(e.hits > 1 ? 120 : 220);
      tween(f, { wAng: f.idle, offX: dist }, 160);
    }
    f.spin = 0;
    f.run = true;
    f.pose = 'idle';
    await tween(f, { offX: 0, wAng: f.idle }, 300, 'inOutQuad');
    f.run = false;
  }

  async function doRanged(f, T, e) {
    const sky = ['lightning', 'holy', 'meteor', 'firerain', 'rain', 'trap'].includes(e.fx);
    f.pose = 'atk';
    // posture d'attaque
    if (f.weapon === 'bow') await tween(f, { wOff: -6 }, 160);
    else if (!f.weapon) await tween(f, { squash: 0.12, offX: -6 }, 160);
    else await tween(f, { wAng: -30, offY: -6 }, 160);
    for (let s = 0; s < e.hits; s++) {
      if (f.weapon === 'bow' && !sky) { f.wOff = 2; tween(f, { wOff: s < e.hits - 1 ? -6 : 0 }, 160); }
      if (sky) {
        await skyStrike(e.fx, T, e.fx === 'meteor' ? 420 : 240);
      } else {
        const from = handPos(f);
        const to = center(T);
        const type = e.fx;
        if (!f.weapon) tween(f, { squash: -0.08, offX: 4 }, 100);
        ({ arrow: sfx.arrow, poisonArrow: sfx.arrow, fireball: sfx.fire, rock: sfx.swing }[type] || sfx.magic)();
        await projectile(type, { x: from.x, y: from.y - 6 }, to, type === 'arrow' || type === 'poisonArrow' ? 260 : 340);
        if (e.fx === 'fireball') burst(to.x, to.y, 12, ['#ff9f43', '#ffd84a', '#ff5e3a'], { speed: 150 });
        if (e.fx === 'ice') burst(to.x, to.y, 12, ['#bff3ff', '#ffffff', '#6fe3ff'], { speed: 150 });
      }
      const rs = byStep(e.results, s);
      rs.forEach(r => {
        if (r.type === 'heal' && r.target === f.i && e.fx === 'drain') {
          const c = center(T), h = center(f);
          for (let j = 0; j < 8; j++) effects.push({ kind: 'p', x: c.x, y: c.y, vx: (h.x - c.x) * 1.6 + (Math.random() - 0.5) * 60, vy: (h.y - c.y) * 1.6 - 40 + Math.random() * 40, g: 0, life: 600, max: 600, color: '#7bed6f', size: 3 });
        }
        apply(r);
      });
      await wait(e.hits > 2 ? 60 : 160);
    }
    f.pose = 'idle';
    await tween(f, { wAng: f.idle, offY: 0, wOff: 0, squash: 0, offX: 0 }, 220);
  }

  async function doSelf(f, e) {
    await tween(f, { offY: -10, wAng: -20 }, 160);
    await selfFx(f, e.fx);
    e.results.forEach(apply);
    await wait(260);
    await tween(f, { offY: 0, wAng: f.idle }, 200);
  }

  // Attaque du familier : il bondit sur l'ennemi, crache un projectile ou soigne son maître
  async function doPet(f, T, e) {
    if (!f.pet) { e.results.forEach(apply); return; }
    const b = petBox(f);
    float(e.name, b.cx, b.y - 8, '#9fe8ff', 7, { vy: -12, life: 1000 });
    if (e.pet === 'pounce') {
      const to = center(T);
      const dx = to.x - b.cx - 18 * f.dir, dy = to.y - b.cy;
      sfx.swing();
      await tween(f, { petDX: dx * 0.5, petDY: dy * 0.5 - 30 }, 170, 'outQuad');
      await tween(f, { petDX: dx, petDY: dy }, 130, 'inQuad');
      for (let s = 0; s < Math.max(1, e.hits); s++) {
        const c = center(T);
        effects.push({ kind: 'claw', x: c.x - 4 * f.dir, y: c.y, life: 220, max: 220 });
        byStep(e.results, s).forEach(apply);
        await wait(e.hits > 1 ? 150 : 120);
      }
      await tween(f, { petDX: 0, petDY: 0 }, 320, 'inOutQuad');
    } else if (e.pet === 'self') {
      await tween(f, { petDY: -18 }, 150);
      for (let j = 0; j < 8; j++) effects.push({ kind: 'plus', x: b.cx + (Math.random() * 30 - 15), y: b.cy, vy: -40 - Math.random() * 30, life: 700, max: 700 });
      e.results.forEach(apply);
      await tween(f, { petDY: 0 }, 200);
    } else {
      await tween(f, { petDY: -10 }, 120);
      for (let s = 0; s < Math.max(1, e.hits); s++) {
        ({ bark: sfx.roar, spit: sfx.dot }[e.fx] || sfx.magic)();
        await projectile(e.fx, { x: b.cx, y: b.cy }, center(T), 300);
        byStep(e.results, s).forEach(apply);
      }
      await tween(f, { petDY: 0 }, 160);
    }
  }

  function sync(s) {
    if (!s) return;
    s.forEach((st, i) => { F[i].hp = st.hp; F[i].shield = st.shield; F[i].tags = st.tags; if (!st.tags.some(t => t.k === 'stun')) F[i].stars = Math.min(F[i].stars, 0.999); });
  }

  async function playEntry(e) {
    if (e.type === 'action' && e.pet) {
      await doPet(F[e.actor], F[1 - e.actor], e);
      await wait(120);
    } else if (e.type === 'action') {
      const f = F[e.actor], T = F[1 - e.actor];
      if (e.id) { const c = center(f); float(e.name, c.x, GROUND - f.sh * S - 20, '#ffe08a', 7, { vy: -10, life: 1100 }); }
      f.petHop = 1; tween(f, { petHop: 0 }, 400, 'linear');
      if (e.selfOnly) await doSelf(f, e);
      else if (e.melee) await doMelee(f, T, e);
      else await doRanged(f, T, e);
      await wait(180);
    } else if (e.type === 'dot') {
      sfx.dot();
      const T = F[e.target], c = center(T);
      T.hp = e.hp;
      const cols = e.k === 'burn' ? ['#ff9f43', '#ffd84a', '#ff5e3a'] : ['#7bed6f', '#3fbf3f', '#b8ffb0'];
      burst(c.x, c.y, 10, cols, { speed: 60, grav: -80 });
      T.glow = 1; T.glowColor = cols[0]; tween(T, { glow: 0 }, 400, 'linear');
      float(String(e.dmg), c.x, c.y - 30, cols[0], 10);
      await wait(420);
    } else if (e.type === 'stunned') {
      const T = F[e.target], c = center(T);
      T.stars = 1;
      float('Etourdi…', c.x, c.y - 50, '#feca57', 8);
      await wait(700);
      T.stars = 0;
    } else if (e.type === 'rage') {
      sfx.rage();
      banner = { text: 'RAGE DE L’ARENE !', sub: 'Les dégâts augmentent', life: 1600, max: 1600 };
      shake = 6;
      await wait(1200);
    } else if (e.type === 'kill') {
      // La Horde : le monstre tombe… et le suivant arrive aussitôt
      sfx.boom();
      const T = F[e.target ?? 1], c = center(T);
      T.dead = true;
      shake = Math.max(shake, 5);
      tween(T, { rot: -85, alpha: 0, offX: -24 }, 420, 'outQuad');
      burst(c.x, c.y, 22, ['#ffd84a', '#fff3b0', '#ff9f43'], { speed: 190, up: 60, glow: true });
      burst(c.x, GROUND - 6, 12, ['#c49a6c', '#e0c49a'], { speed: 110, up: 30 });
      float(e.label || `K.O. ×${e.kills}`, c.x, c.y - 40, '#ffd84a', 11, { vy: -30, life: 1100 });
      await wait(360);
    } else if (e.type === 'nextFoe') {
      const side = e.side ?? 1;
      const nf = mk(e.foe, side);
      nf.baseX = baseXOf(side, nf.sw);
      nf.offX = -(W * 0.7);          // arrive depuis son bord de l'écran
      F[side] = nf;
      sfx.roar();
      await tween(nf, { offX: 0 }, 380, 'outQuad');
      const c = center(nf);
      float(e.boss ? 'BOSS !' : e.n ? `Monstre ${e.n}` : e.foe.name, c.x, GROUND - nf.sh * S - 22, side === 0 ? '#7fd6ff' : '#ff8a94', 8, { vy: -12, life: 900 });
      if (e.heal > 0) {   // donjon : le héros reprend son souffle entre deux monstres
        const H = F[1 - side], hc = center(H);
        H.hp = e.hp;
        float(`+${e.heal}`, hc.x, hc.y - 30, '#7bf09a', 10);
        burst(hc.x, hc.y, 10, ['#7bf09a', '#b8ffb0'], { speed: 60, grav: -80 });
      }
    } else if (e.type === 'end' && e.winner < 0) {
      // fin d'un assaut de raid : personne ne tombe
      if (!training) { stopMusic(); setQuiet(false); }
      await wait(300);
    } else if (e.type === 'end') {
      if (!training) { stopMusic(); setQuiet(false); }
      (e.winner === 0 ? sfx.win : sfx.lose)();
      const win = F[e.winner], lose = F[1 - e.winner];
      lose.dead = true;
      tween(lose, { rot: -85, alpha: 0.35, offX: -20 }, 600, 'outQuad');
      burst(center(lose).x, GROUND - 6, 16, ['#c49a6c', '#e0c49a'], { speed: 120, up: 40 });
      await wait(500);
      if (victory && e.winner === 0) {
        const c = center(win);
        for (let j = 0; j < 4; j++) setTimeout(() => burst(c.x + (Math.random() - 0.5) * 80, c.y - 40 - Math.random() * 40, 26, victory, { speed: 200, up: 120, grav: 160, life: 1200, size: 4 }), j * 250 / speed);
      }
      for (let j = 0; j < 3; j++) { await tween(win, { offY: -26 }, 180); await tween(win, { offY: 0 }, 180, 'inQuad'); }
      await wait(300);
    }
    sync(e.s);
  }

  // ---------- boucle de rendu ----------
  function update(dt) {
    time += dt / 1000;
    for (let j = tweens.length - 1; j >= 0; j--) {
      const tw = tweens[j];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      const ev = tw.ease(p);
      for (const key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * ev;
      if (tw.onStep) tw.onStep();
      if (p >= 1) { tweens.splice(j, 1); tw.res(); }
    }
    for (let j = timers.length - 1; j >= 0; j--) { timers[j].t -= dt; if (timers[j].t <= 0) { const t = timers.splice(j, 1)[0]; t.res(); } }
    const s = dt / 1000;
    for (let j = effects.length - 1; j >= 0; j--) {
      const e = effects[j];
      e.life -= dt;
      if (e.kind === 'p') { e.vy += e.g * s; e.x += e.vx * s; e.y += e.vy * s; }
      if (e.kind === 'plus' || e.kind === 'up') e.y += e.vy * s;
      if (e.life <= 0) effects.splice(j, 1);
    }
    for (let j = texts.length - 1; j >= 0; j--) {
      const t = texts[j];
      t.life -= dt; t.y += t.vy * s; t.vy *= 0.97; t.pop = Math.min(1, t.pop + s * 8);
      if (t.life <= 0) texts.splice(j, 1);
    }
    if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
    updateAmb(s);
    shake = Math.max(0, shake - s * 30);
    for (const f of F) {
      f.hpShown += (f.hp - f.hpShown) * Math.min(1, s * 12);
      f.hpLag += (f.hpShown - f.hpLag) * Math.min(1, s * 2.5);
      if (f.hpLag < f.hpShown) f.hpLag = f.hpShown;
      f.shieldShown += (f.shield - f.shieldShown) * Math.min(1, s * 10);
    }
  }

  function drawFighter(f) {
    const x = fx(f);
    const run = f.run ? -Math.abs(Math.sin(time * 18)) * 5 : 0;
    const bob = f.dead ? 0 : Math.sin(time * 3 + f.phase) * 1.2;
    const y = GROUND + f.offY + run;
    // ombre
    ctx.globalAlpha = 0.25 * f.alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, GROUND + 2, Math.max(10, f.sw * S * 0.4 - Math.min(10, -f.offY * 0.3)), 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = f.alpha;
    if (f.aura && !f.dead) drawSkinAura(ctx, f.aura, x, y, f.sw * S, f.sh * S, time + f.phase, f.alpha);
    // familier
    if (f.pet) {
      const { x: px, y: py, pw, ph } = petBox(f);
      ctx.save();
      ctx.translate(px + pw / 2, 0); ctx.scale(f.dir, 1); ctx.translate(-(px + pw / 2), 0);
      ctx.imageSmoothingEnabled = !!f.pet.smooth;
      ctx.drawImage(f.pet, px, py, pw, ph);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f.dir, 1);
    const pivotY = -f.sh * S / 2;
    ctx.translate(0, pivotY);
    ctx.rotate(((f.rot + f.spin) * Math.PI) / 180);
    ctx.translate(0, -pivotY);
    const breathe = 1 + Math.sin(time * 3 + f.phase) * (f.weapon ? 0.015 : 0.04);
    ctx.scale(1 + f.squash, breathe - f.squash);
    const SW = f.sw * S, SH = f.sh * S;
    const sx = -SW / 2, sy = -SH + bob;
    // aura (soin / bonus)
    if (f.glow > 0.01) {
      ctx.globalAlpha = f.glow * 0.6 * f.alpha;
      const wsp = whiteOf(f.sprite);
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.drawImage(tint(wsp, f.glowColor), ...heroBox(f.sprite, sx + dx, sy + dy, SW, SH));
      ctx.globalAlpha = f.alpha;
    }
    // en course : 2 images de foulée qui alternent ; au moment du coup : la fente d'attaque
    const runF = f.run && f.spriteRun ? Math.floor(time * 9) % 2 : -1;
    const bodyPose = runF >= 0 ? (runF ? 'run2' : 'run1') : f.pose;
    const body = runF >= 0 ? f.spriteRun[runF] : f.pose === 'atk' && f.spriteAtk ? f.spriteAtk : f.sprite;
    ctx.imageSmoothingEnabled = !!body.smooth;   // héros vectoriels : lissés
    ctx.drawImage(body, ...heroBox(body, sx, sy, SW, SH));
    if (f.flash > 0.01) { ctx.globalAlpha = f.flash * f.alpha; ctx.drawImage(whiteOf(body), ...heroBox(body, sx, sy, SW, SH)); ctx.globalAlpha = f.alpha; }
    if (!f.wSprite) { ctx.restore(); drawAfter(f); return; }
    // arme (dans la main, qui bouge en pose d'attaque)
    const H = handOf(bodyPose, f.snap.classId), WS = S * f.k;
    const hx = sx + H.x * WS + (f.weapon === 'bow' ? f.wOff : 0), hy = sy + H.y * WS;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate((f.wAng * Math.PI) / 180);
    const [px, py] = f.pivot;
    ctx.drawImage(f.wSprite, -px * WS, -py * WS, lw(f.wSprite) * WS, lh(f.wSprite) * WS);
    if (f.flash > 0.01) { ctx.globalAlpha = f.flash * f.alpha; ctx.drawImage(whiteOf(f.wSprite), -px * WS, -py * WS, lw(f.wSprite) * WS, lh(f.wSprite) * WS); }
    ctx.restore();
    ctx.restore();
    drawAfter(f);
  }

  function drawAfter(f) {
    // bouclier
    if (f.shieldShown > 1) {
      const c = center(f);
      ctx.globalAlpha = 0.25 + Math.sin(time * 5) * 0.05;
      ctx.fillStyle = '#7fd6ff';
      ctx.beginPath(); ctx.ellipse(c.x, c.y + 4, Math.max(44, f.sw * S * 0.65), Math.max(52, f.sh * S * 0.65), 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = '#e0f7ff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // étoiles d'étourdissement
    if (f.stars > 0.5) {
      const c = { x: fx(f), y: GROUND - f.sh * S - 4 + f.offY };
      ctx.globalAlpha = 1;
      for (let j = 0; j < 3; j++) {
        const a = time * 5 + (j * Math.PI * 2) / 3;
        star(c.x + Math.cos(a) * 18, c.y + Math.sin(a) * 5, '#feca57');
      }
    }
    ctx.globalAlpha = 1;
  }

  const tintCache = new Map();
  function tint(src, color) {
    const key = color;
    if (!tintCache.has(src)) tintCache.set(src, new Map());
    const m = tintCache.get(src);
    if (!m.has(key)) {
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
      m.set(key, c);
    }
    return m.get(key);
  }

  function star(x, y, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x - 1, y - 4, 2, 8); ctx.fillRect(x - 4, y - 1, 8, 2); ctx.fillRect(x - 2, y - 2, 4, 4);
  }

  // forme cernée (refonte) : aplat, reflet découpé en haut à gauche, contour sombre
  function shape(build, fill, light) {
    ctx.save(); build();
    ctx.fillStyle = fill; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.translate(-1.6, -1.8); ctx.globalAlpha *= 0.7; ctx.strokeStyle = light; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
  const plusPath = (a, b) => { ctx.beginPath(); ctx.moveTo(-b, -a); ctx.lineTo(b, -a); ctx.lineTo(b, -b); ctx.lineTo(a, -b); ctx.lineTo(a, b); ctx.lineTo(b, b); ctx.lineTo(b, a); ctx.lineTo(-b, a); ctx.lineTo(-b, b); ctx.lineTo(-a, b); ctx.lineTo(-a, -b); ctx.lineTo(-b, -b); ctx.closePath(); };

  function drawEffect(e) {
    const p = 1 - e.life / e.max;
    if (e.kind === 'p') {
      const a = Math.max(0, e.life / e.max);
      if (e.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.size * 0.55, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'flare') {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
      g.addColorStop(0, e.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (1 - p) * 0.8; ctx.fillStyle = g;
      ctx.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
      ctx.globalCompositeOperation = 'source-over';
    } else if (e.kind === 'plus') {
      ctx.globalAlpha = Math.max(0, e.life / e.max);
      shape(() => { ctx.translate(e.x, e.y); plusPath(5.5, 1.9); }, '#7bed6f', '#c8ffc0');
    } else if (e.kind === 'up') {
      ctx.globalAlpha = Math.max(0, e.life / e.max);
      shape(() => { ctx.translate(e.x, e.y); ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(5, 4); ctx.lineTo(2, 4); ctx.lineTo(2, 9); ctx.lineTo(-2, 9); ctx.lineTo(-2, 4); ctx.lineTo(-5, 4); ctx.closePath(); }, '#ffd84a', '#fff7c4');
    } else if (e.kind === 'proj') {
      ctx.globalAlpha = 1;
      drawProjectile(e);
    } else if (e.kind === 'slash') {
      const r = (e.big ? 50 : 36) * (0.8 + p * 0.3);
      const a0 = e.dir > 0 ? -1.9 : Math.PI + 1.9, a1 = e.dir > 0 ? 0.9 : Math.PI - 0.9;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - p) * 0.5; ctx.strokeStyle = e.color || '#9fd8ff'; ctx.lineWidth = e.big ? 14 : 10;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e.big ? 5 : 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.globalAlpha = (1 - p) * 0.8;
      ctx.beginPath(); ctx.arc(e.x, e.y, r - 7, Math.min(a0, a1) + 0.3, Math.max(a0, a1) - 0.3); ctx.stroke();
    } else if (e.kind === 'impact') {
      const r = 9 + EASE.outQuad(Math.min(1, p * 1.6)) * 20;
      ctx.globalAlpha = Math.max(0, 1 - p * 1.1);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(p * 0.6);
      const burst = (R, rIn) => { ctx.beginPath(); for (let j = 0; j < 16; j++) { const a = j * Math.PI / 8, rr = j % 2 ? rIn : R * (j % 4 ? 0.8 : 1); ctx[j ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
      burst(r, r * 0.42); ctx.fillStyle = '#ffd45a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      burst(r * 0.62, r * 0.28); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
      ctx.globalAlpha = Math.max(0, 1 - p) * 0.8; ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.35, 0, Math.PI * 2); ctx.stroke();
    } else if (e.kind === 'ring') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - p) * (e.thin ? 0.7 : 1);
      ctx.strokeStyle = e.color; ctx.lineWidth = e.thin ? 2 : 4;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r0 + (e.r1 - e.r0) * p, 0, Math.PI * 2); ctx.stroke();
      if (!e.thin) { ctx.globalAlpha = (1 - p) * 0.35; ctx.lineWidth = 10; ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    } else if (e.kind === 'bolt') {
      ctx.globalAlpha = 1 - p * 0.7;
      let x = e.x + 10, y = -10;
      const pts = [[x, y]];
      let sd = e.seed * 1000;
      while (y < e.y) { sd = (sd * 9301 + 49297) % 233280; x = e.x + ((sd / 233280) - 0.5) * 30; y += 22; pts.push([x, Math.min(y, e.y)]); }
      const path = (list) => { ctx.beginPath(); ctx.moveTo(list[0][0], list[0][1]); list.forEach(q => ctx.lineTo(q[0], q[1])); };
      ctx.globalCompositeOperation = 'lighter';
      path(pts); ctx.strokeStyle = '#4fa8ff'; ctx.lineWidth = 14; ctx.globalAlpha = (1 - p) * 0.35; ctx.stroke();
      // petites branches
      ctx.lineWidth = 2; ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = '#bfe6ff';
      pts.forEach((q, i) => { if (i % 2 && i < pts.length - 1) { ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + (i % 4 ? 16 : -16), q[1] + 12); ctx.stroke(); } });
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1 - p * 0.7;
      path(pts); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 2; ctx.stroke();
    } else if (e.kind === 'pillar') {
      const w = 40 * (1 - p * 0.5);
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createLinearGradient(e.x - w, 0, e.x + w, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, e.color || '#fff3b0'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.7; ctx.fillStyle = lg;
      ctx.fillRect(e.x - w, 0, w * 2, GROUND);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
      ctx.fillStyle = e.color || '#fff3b0';
      ctx.fillRect(e.x - w / 2, 0, w, GROUND);
      ctx.globalAlpha *= 0.8; ctx.fillStyle = '#ffffff';
      ctx.fillRect(e.x - w / 6, 0, w / 3, GROUND);
      // étincelles qui montent dans le rayon
      ctx.fillStyle = '#ffffff';
      for (let j = 0; j < 8; j++) { const sy = GROUND - ((p * 300 + j * 47) % GROUND); ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9; ctx.beginPath(); ctx.arc(e.x - w / 2 + ((j * 13) % w), sy, 1.4, 0, Math.PI * 2); ctx.fill(); }
    } else if (e.kind === 'trap') {
      ctx.globalAlpha = 1;
      const close = Math.min(1, p * 3);
      const jaw = (dir) => shape(() => {
        ctx.translate(e.x, e.y); ctx.beginPath(); ctx.moveTo(-22, 0);
        for (let j = 0; j <= 7; j++) ctx.lineTo(-22 + j * 6.3, dir * ((j % 2 ? 12 : 4) - close * 6));
        ctx.lineTo(22, 0); ctx.closePath();
      }, '#c3cce0', '#ffffff');
      jaw(-1); jaw(1);
      shape(() => { ctx.translate(e.x, e.y); rrect(ctx, -24, -2.5, 48, 5, 2.5); }, '#6f7a9b', '#9ba7c3');
    } else if (e.kind === 'claw') {
      ctx.globalAlpha = 1 - p;
      ctx.lineCap = 'round';
      for (const [col, lw] of [[INK, 5.5], ['#ffffff', 3]]) { ctx.strokeStyle = col; ctx.lineWidth = lw; for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(e.x - 12 + j * 8, e.y - 14 + p * 6); ctx.lineTo(e.x + 4 + j * 8, e.y + 12 + p * 6); ctx.stroke(); } }
      ctx.lineCap = 'butt';
    } else if (e.kind === 'flashScreen') {
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.fillStyle = e.color; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  const HALO = { fireball: '#ff8a2a', meteor: '#ff6a1a', ice: '#7fe7ff', bolt: '#b06bff', drain: '#8a3bd1', spore: '#7bed6f', spit: '#7bed6f', poisonArrow: '#7bed6f' };
  function drawProjectile(e) {
    const hc = HALO[e.type];
    if (hc) {
      const r = e.type === 'meteor' ? 40 : 22;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      g.addColorStop(0, hc); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55 + Math.sin(time * 40) * 0.1; ctx.fillStyle = g;
      ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // traînée (les dernières positions)
    const tr = e.trail || (e.trail = []);
    tr.push([e.x, e.y]); if (tr.length > 7) tr.shift();
    const TRAIL = { fireball: '#ffb02e', meteor: '#ff8a2a', ice: '#bff3ff', bolt: '#c9a0ff', drain: '#b06bff', spore: '#9cf28a', spit: '#7bed6f', arrow: '#ffffff', poisonArrow: '#9cf28a', rock: '#c8c0b8' };
    if (TRAIL[e.type] && tr.length > 1) {
      ctx.globalCompositeOperation = e.type === 'rock' || e.type === 'spit' ? 'source-over' : 'lighter';
      ctx.lineCap = 'round'; ctx.strokeStyle = TRAIL[e.type];
      for (let j = 1; j < tr.length; j++) {
        ctx.globalAlpha = (j / tr.length) * 0.55;
        ctx.lineWidth = (e.type === 'meteor' ? 22 : e.type === 'arrow' || e.type === 'poisonArrow' ? 3 : 10) * (j / tr.length);
        ctx.beginPath(); ctx.moveTo(tr[j - 1][0], tr[j - 1][1]); ctx.lineTo(tr[j][0], tr[j][1]); ctx.stroke();
      }
      ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.lineJoin = 'round';
    if (e.type === 'arrow' || e.type === 'poisonArrow') {
      ctx.rotate(e.angle);
      const tip = e.type === 'poisonArrow' ? '#7bed6f' : '#d9dee5';
      // empennage, hampe, pointe
      shape(() => { ctx.beginPath(); ctx.moveTo(-18, -5); ctx.lineTo(-11, -1); ctx.lineTo(-11, 1); ctx.lineTo(-18, 5); ctx.lineTo(-15, 0); ctx.closePath(); }, '#ffffff', '#ffffff');
      shape(() => rrect(ctx, -15, -1.4, 22, 2.8, 1.4), '#9a6234', '#c98f55');
      shape(() => { ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(5, -4.5); ctx.lineTo(7, 0); ctx.lineTo(5, 4.5); ctx.closePath(); }, tip, '#ffffff');
    } else if (e.type === 'fireball' || e.type === 'meteor') {
      const r = (e.type === 'meteor' ? 15 : 8) * (1 + Math.sin(time * 50) * 0.06);
      // la queue de flamme pointe vers l'arrière (d'où vient la boule)
      if (tr.length > 1) { const [ax, ay] = tr[0]; if (Math.hypot(ax - e.x, ay - e.y) > 1) e.ang = Math.atan2(ay - e.y, ax - e.x); }
      ctx.rotate(e.ang ?? (e.type === 'meteor' ? -Math.PI / 2 : Math.PI));
      // flamme en goutte, la queue vers l'arrière
      const drop = (k) => { ctx.beginPath(); ctx.moveTo(r * 2.2 * k, 0); ctx.quadraticCurveTo(r * 0.6 * k, -r * 1.05 * k, -r * 0.2, -r * k); ctx.arc(-r * 0.2, 0, r * k, -Math.PI / 2, Math.PI / 2, true); ctx.quadraticCurveTo(r * 0.6 * k, r * 1.05 * k, r * 2.2 * k, 0); ctx.closePath(); };
      ctx.translate(r * 0.2, 0);
      shape(() => drop(1), e.type === 'meteor' ? '#e8501a' : '#ff5a1f', '#ff9a6a');
      drop(0.7); ctx.fillStyle = '#ffb02e'; ctx.fill();
      drop(0.4); ctx.fillStyle = '#fff3a0'; ctx.fill();
      if (e.type === 'meteor') { ctx.fillStyle = '#7a3a24'; ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#a85a34'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.fill(); }
    } else if (e.type === 'ice') {
      ctx.rotate(e.angle);
      shape(() => { ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(0, -6.5); ctx.lineTo(-12, 0); ctx.lineTo(0, 6.5); ctx.closePath(); }, '#5cbce0', '#e8ffff');
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(8, -1); ctx.lineTo(0, -4.5); ctx.lineTo(-6, -1); ctx.closePath(); ctx.fill();
    } else if (e.type === 'bolt') {
      ctx.rotate(time * 8);
      shape(() => { ctx.beginPath(); for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, rr = j % 2 ? 3.5 : 8; ctx[j ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }, '#9a5cf0', '#e0c8ff');
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'spore') {
      shape(() => { ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); }, '#3fbf3f', '#b8ffb0');
      ctx.fillStyle = '#9b59b6'; [[-2, -2], [3, 1], [-1, 3]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); });
    } else if (e.type === 'rock') {
      ctx.rotate(e.x * 0.05);
      shape(() => { ctx.beginPath(); [[-9, -2], [-5, -9], [4, -8], [10, -1], [7, 7], [-3, 8], [-9, 4]].forEach(([x, y], j) => ctx[j ? 'lineTo' : 'moveTo'](x, y)); ctx.closePath(); }, '#8d8a84', '#c8c4bc');
      ctx.strokeStyle = '#5f5c57'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(2, 1); ctx.lineTo(1, 5); ctx.stroke();
    } else if (e.type === 'spit') {
      shape(() => { ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.5, 0, 0, Math.PI * 2); }, '#2f9e3f', '#9cf28a');
    } else if (e.type === 'bark') {
      ctx.rotate(e.angle); ctx.lineCap = 'round';
      for (const [col, lw] of [[INK, 4.5], ['#ffffff', 2.2]]) { ctx.strokeStyle = col; ctx.lineWidth = lw; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(-j * 7, 0, 6 + j * 3, -0.9, 0.9); ctx.stroke(); } }
      ctx.lineCap = 'butt';
    } else if (e.type === 'drain') {
      ctx.rotate(time * 5);
      shape(() => { ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); }, '#6a2bb0', '#b06bff');
      ctx.fillStyle = '#ff5d6c'; ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-5, 0, -4, -5, 0, -2.5); ctx.bezierCurveTo(4, -5, 5, 0, 0, 4); ctx.fill();
    }
    ctx.restore();
  }

  function drawText(t) {
    const a = Math.min(1, t.life / 300);
    ctx.globalAlpha = a;
    const sc = 0.6 + 0.4 * EASE.outBack(t.pop);
    ctx.font = PXF(Math.round(t.size * sc));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    F.forEach((f, i) => {
      if (training && i === 1) return;
      const corner = hud === 'corner';
      const left = corner || PORTRAIT || i === 0;
      const bw = corner ? 150 : PORTRAIT ? W - 24 : 190, bh = corner ? 11 : PORTRAIT ? 14 : 12;
      const x = corner ? 14 : PORTRAIT ? 12 : (i === 0 ? 12 : W - 12 - bw);
      // téléphone : l'ennemi en haut, le héros juste sous ses pieds (au-dessus des boutons), jamais sur lui
      const y = corner ? H - bh - 12 : PORTRAIT ? (i === 1 ? SAFE_TOP + 46 : Math.round(Math.max(GROUND + 26, Math.min(GROUND + 44, CTRL_TOP - bh - 12)))) : 18;
      ctx.font = PXF(corner ? 8 : PORTRAIT ? 9 : 8); ctx.textBaseline = 'alphabetic';
      ctx.textAlign = left ? 'left' : 'right';
      ctx.lineWidth = 3; ctx.strokeStyle = INK;
      const label = `${f.snap.name}  Nv.${f.snap.level}`;
      const tx = left ? x : x + bw;
      const nc = f.snap.nameColor === 'rainbow' ? `hsl(${(time * 120) % 360},90%,65%)` : (f.snap.nameColor || '#ffffff');
      ctx.strokeText(label, tx, y - 4); ctx.fillStyle = nc; ctx.fillText(label, tx, y - 4);
      // cadre sombre arrondi, rail creux, remplissage bombé, reflet
      const R = bh / 2 + 2;
      ctx.fillStyle = INK; rrect(ctx, x - 2.5, y - 2.5, bw + 5, bh + 5, R + 1); ctx.fill();
      ctx.fillStyle = '#2e2550'; rrect(ctx, x, y, bw, bh, R - 1); ctx.fill();
      const pct = (v) => Math.max(0, Math.min(1, v / f.max));
      const grad = (cols) => { const g = ctx.createLinearGradient(0, y, 0, y + bh); cols.forEach((c, k) => g.addColorStop(k / (cols.length - 1), c)); return g; };
      const dirFill = (p, fill) => { if (p <= 0) return; const w = Math.max(bh, bw * p); ctx.fillStyle = fill; rrect(ctx, left ? x : x + bw - w, y, w, bh, R - 1); ctx.fill(); };
      ctx.save(); rrect(ctx, x, y, bw, bh, R - 1); ctx.clip();
      dirFill(pct(f.hpLag), grad(['#fff1ec', '#ff9b8a', '#e3343d']));
      const hp = pct(f.hpShown);
      dirFill(hp, grad(hp > 0.5 ? ['#d6ffb0', '#7fe85a', '#45bf3c', '#2f8f35'] : hp > 0.25 ? ['#fff7c4', '#ffdf5e', '#f7bc2a', '#cd7e15'] : ['#ffc8b8', '#ff6d60', '#e3343d', '#a81d35']));
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; rrect(ctx, x + 4, y + 2, Math.max(0, bw * hp - 8), bh * 0.28, 3); ctx.fill();
      if (f.shieldShown > 1) {
        ctx.fillStyle = '#7fd6ff';
        const w = bw * Math.min(1, f.shieldShown / f.max);
        ctx.fillRect(left ? x : x + bw - w, y + bh - 4, w, 4);
      }
      ctx.restore();
      ctx.font = PXF(7.5); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      const hpTxt = `${Math.max(0, Math.round(f.hpShown))} / ${f.max}`;
      ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.strokeText(hpTxt, x + bw / 2, y + bh - 2.5); ctx.fillStyle = '#ffffff'; ctx.fillText(hpTxt, x + bw / 2, y + bh - 2.5);
      // états
      let cx = left ? x : x + bw;
      ctx.font = PXF(6);
      for (const t of f.tags) {
        const w = ctx.measureText(t.n).width + 8;
        const bx = left ? cx : cx - w;
        ctx.fillStyle = 'rgba(20,14,52,0.88)'; rrect(ctx, bx, y + bh + 5, w, 12, 5); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = STATUS_COLOR[t.k] || '#fff'; ctx.textAlign = 'left';
        ctx.fillText(t.n, bx + 4, y + bh + 14.5);
        cx += (left ? 1 : -1) * (w + 3);
      }
    });
    if (banner) {
      const p = 1 - banner.life / banner.max;
      ctx.globalAlpha = Math.min(1, Math.min(p * 6, (1 - p) * 4));
      const bg = ctx.createLinearGradient(0, H / 2 - 30, 0, H / 2 + 22);
      bg.addColorStop(0, 'rgba(40,20,90,0)'); bg.addColorStop(0.2, 'rgba(40,20,90,0.85)'); bg.addColorStop(0.8, 'rgba(26,14,64,0.85)'); bg.addColorStop(1, 'rgba(26,14,64,0)');
      ctx.fillStyle = bg; ctx.fillRect(0, H / 2 - 30, W, 52);
      ctx.fillStyle = 'rgba(255,212,90,.7)'; ctx.fillRect(0, H / 2 - 25, W, 1.5); ctx.fillRect(0, H / 2 + 16, W, 1.5);
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
      ctx.font = PXF(14); ctx.lineWidth = 5; ctx.strokeText(banner.text, W / 2, H / 2 - 4); ctx.fillStyle = '#ff6d60'; ctx.fillText(banner.text, W / 2, H / 2 - 4);
      ctx.font = PXF(7); ctx.lineWidth = 3; ctx.strokeText(banner.sub, W / 2, H / 2 + 12); ctx.fillStyle = '#ffffff'; ctx.fillText(banner.sub, W / 2, H / 2 + 12);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- décor en profondeur + ambiance ----------
  const AMB = AMBIENT[theme] || null;
  const amb = [];
  const spawnAmb = (fresh) => {
    const k = AMB.kind;
    const p = { x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6.3, front: Math.random() < 0.35, s: 0.6 + Math.random() * 0.8 };
    if (!fresh) {
      if (k === 'snow' || k === 'leaf' || k === 'confetti') p.y = -6;
      else if (k === 'ember' || k === 'wisp') p.y = GROUND + Math.random() * 20;
    }
    p.col = k === 'confetti' ? ['#ff5d6c', '#ffd84a', '#3d9bff', '#4cd964', '#ffffff'][Math.floor(Math.random() * 5)] : AMB.color;
    return p;
  };
  if (AMB) for (let j = 0; j < AMB.n; j++) amb.push(spawnAmb(true));
  function updateAmb(s) {
    if (!AMB) return;
    const k = AMB.kind;
    for (let j = 0; j < amb.length; j++) {
      const p = amb[j];
      p.ph += s;
      if (k === 'snow') { p.y += 22 * p.s * s; p.x += Math.sin(p.ph * 1.3) * 10 * s; }
      else if (k === 'leaf' || k === 'confetti') { p.y += 16 * p.s * s; p.x += (Math.sin(p.ph * 2) * 18 + 6) * s; }
      else if (k === 'ember') { p.y -= 26 * p.s * s; p.x += Math.sin(p.ph * 3) * 8 * s; }
      else if (k === 'wisp') { p.y -= 6 * p.s * s; p.x += Math.sin(p.ph) * 5 * s; }
      else { p.x += Math.sin(p.ph * 0.7) * 6 * s; p.y += Math.cos(p.ph * 0.5) * 4 * s; }
      if (p.y > H + 8 || p.y < -10 || p.x < -10 || p.x > W + 10) amb[j] = spawnAmb(false);
    }
  }
  function drawAmb(front) {
    if (!AMB) return;
    const k = AMB.kind;
    for (const p of amb) {
      if (p.front !== front) continue;
      const tw = 0.55 + 0.45 * Math.sin(p.ph * 3);
      if (k === 'firefly' || k === 'wisp' || k === 'ember') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (k === 'firefly' ? tw : 0.8) * 0.3; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = k === 'firefly' ? tw : k === 'ember' ? Math.max(0, Math.min(1, (p.y - 10) / 80)) : 0.7;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (k === 'leaf') {
        ctx.globalAlpha = 0.9; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 3, 2); ctx.fillStyle = shade(p.col, -0.3); ctx.fillRect(p.x + (Math.sin(p.ph * 4) > 0 ? 2 : 0), p.y + 1, 1, 1);
      } else if (k === 'confetti') {
        ctx.globalAlpha = 0.9; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, Math.abs(Math.sin(p.ph * 5)) * 3 + 1, 3);
      } else {
        ctx.globalAlpha = (k === 'snow' ? 0.85 : 0.35 * tw); ctx.fillStyle = p.col;
        const sz = k === 'snow' ? (p.front ? 3 : 2) : 2;
        ctx.beginPath(); ctx.arc(p.x + sz / 2, p.y + sz / 2, sz * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    paintScene(ctx, theme, W, H, GROUND, time, true);
    drawAmb(false);
  }

  function vignette() {
    const r = Math.max(W, H) * 0.75;
    const g = ctx.createRadialGradient(W / 2, H * 0.45, r * 0.45, W / 2, H * 0.45, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,3,10,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function render() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground();
    const order = [...F].sort((a, b) => (a.dead ? -1 : 0) - (b.dead ? -1 : 0));
    order.forEach(drawFighter);
    drawAmb(true);
    effects.forEach(drawEffect);
    texts.forEach(drawText);
    ctx.restore();
    vignette();
    drawHud();
  }
  // accès de test (aperçu des effets à l'arrêt) : canvas.__fx.effects / canvas.__fx.render()
  canvas.__fx = { effects, render: () => render(), W: () => W, GROUND: () => GROUND };

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(50, now - last);
    last = now;
    update(dt * speed);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const promise = (async () => {
    await (document.fonts ? document.fonts.load(`20px ${FONT}`).catch(() => {}) : Promise.resolve());
    if (!training) startMusic();
    await wait(training ? 200 : 600);
    let idx = 0;
    const nextEntry = result.log ? () => result.log[idx++] || null : () => result.next();
    for (let e = nextEntry(); e; e = nextEntry()) {
      if (!alive) return;
      if (onBegin) onBegin(e);
      await playEntry(e);
      if (onEntry && alive) onEntry(e);
    }
    await wait(400);
  })();

  return {
    promise,
    setSpeed(v) { speed = v; if (!training) setQuiet(v > 3); },
    skip() { speed = 40; if (!training) setQuiet(true); },
    destroy() { alive = false; ro.disconnect(); if (!training) { stopMusic(); setQuiet(false); } },
  };
}

/** Petit héros animé pour les écrans de menu */
export function idlePreview(canvas, classId, petItemId = null, dyeId = null) {
  const ctx = canvas.getContext('2d');
  let sprite = heroCanvas(classId, dyeId);
  const weapon = CLASSES[classId].weapon, aura = skinAura(dyeId);
  let wS = weaponCanvas(weapon, dyeId);
  const [px, py] = weaponPivot(weapon);
  const pet = petItemId ? petCanvas(petItemId) : null;
  const sc = sprite.smooth ? 10 : 4;   // héros vectoriels : plus de résolution, lissés
  const Wc = (HERO_W + 26) * sc, Hc = (HERO_H + 4) * sc;
  // familier collé au héros (à sa gauche, posé au sol), quelle que soit sa largeur
  const petX = pet ? Math.max(0, (18 + 5 - lw(pet) * 0.75) * sc) : 0;
  canvas.width = Wc; canvas.height = Hc;
  canvas.style.imageRendering = sprite.smooth ? 'auto' : '';
  const hand = handOf('idle', classId);
  let alive = true;
  const t0 = performance.now();
  function loop(now) {
    if (!alive || !canvas.isConnected) return;
    if (behindModal(canvas)) { requestAnimationFrame(loop); return; }   // en pause derrière une fenêtre
    const t = (now - t0) / 1000;
    sprite = heroCanvas(classId, dyeId); wS = weaponCanvas(weapon, dyeId);   // un skin pas encore prêt apparaît dès qu'il l'est
    ctx.clearRect(0, 0, Wc, Hc);
    if (aura) drawSkinAura(ctx, aura, 18 * sc + HERO_W * sc / 2, (HERO_H + 3) * sc, HERO_W * sc, HERO_H * sc, t);
    ctx.imageSmoothingEnabled = !!sprite.smooth;
    const ox = 18 * sc, oy = 3 * sc + Math.sin(t * 3) * 2;
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(ox + HERO_W * sc / 2, (HERO_H + 2.5) * sc, 9 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (pet) { ctx.imageSmoothingEnabled = !!pet.smooth; ctx.drawImage(pet, petX, (HERO_H + 2.5) * sc - lh(pet) * sc * 0.75 + Math.sin(t * 4) * 6, lw(pet) * sc * 0.75, lh(pet) * sc * 0.75); ctx.imageSmoothingEnabled = !!sprite.smooth; }
    ctx.drawImage(sprite, ...heroBox(sprite, ox, oy, HERO_W * sc, HERO_H * sc));
    ctx.save();
    ctx.translate(ox + hand.x * sc, oy + hand.y * sc);
    ctx.rotate(((IDLE_ANGLE[weapon] + Math.sin(t * 3) * 3) * Math.PI) / 180);
    ctx.drawImage(wS, -px * sc, -py * sc, lw(wS) * sc, lh(wS) * sc);
    ctx.restore();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return () => { alive = false; };
}

/**
 * Entraînement en boucle (écran Héros) : mkFight() fabrique un nouveau combat à chaque manche.
 * Renvoie une fonction pour tout arrêter.
 */
export function playTraining(canvas, mkFight, { onEntry = null, speed = 1.3, hud = null } = {}) {
  let ctl = null, stopped = false;
  const next = () => {
    if (stopped || !canvas.isConnected) return;
    const { me, foe, result } = mkFight();
    ctl = playBattle(canvas, me, foe, result, { theme: 'training', training: true, onEntry, hud });
    ctl.setSpeed(speed);
    ctl.promise.then(() => { if (ctl) ctl.destroy(); next(); });
  };
  next();
  return () => { stopped = true; if (ctl) ctl.destroy(); };
}

/**
 * Guerre des sections : 4 héros bleus contre 4 héros rouges qui se battent en boucle (pour le décor).
 * blue / red = [{ name, classId, dye }]. Renvoie une fonction pour tout arrêter.
 */
export function playSkirmish(canvas, blue, red, { colors = ['#3d9bff', '#ff5d6c'] } = {}) {
  const ctx = canvas.getContext('2d');
  const W = 360;
  let H = 202, GROUND = 176, k = 1, alive = true, last = performance.now(), time = 0, shake = 0;
  const SC = 2.9;
  const tweens = [], effects = [], texts = [];
  const score = [0, 0];
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    k = canvas.width / W;
    H = Math.round(W * (r.height / Math.max(1, r.width)));
    GROUND = H - 16;
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const tween = (obj, to, dur, ease = 'outQuad') => new Promise(res => {
    const from = {};
    for (const key in to) from[key] = obj[key];
    tweens.push({ obj, from, to, dur, t: 0, ease: EASE[ease], res });
  });
  const wait = (ms) => tween({ v: 0 }, { v: 1 }, ms, 'linear');
  const float = (text, x, y, color, size = 9) => texts.push({ text, x, y, vy: -36, life: 900, max: 900, color, size });
  const burst = (x, y, n, cols) => {
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 90;
      effects.push({ kind: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 500, max: 500, color: cols[j % cols.length] });
    }
  };

  // Emplacements : 2 au premier rang, 2 derrière
  const SLOTS = [[0.43, 0], [0.25, 2], [0.345, -22], [0.15, -20]];
  const mk = (m, side, j) => {
    const weapon = CLASSES[m.classId].weapon;
    const [px, dy] = SLOTS[j % SLOTS.length];
    return {
      ...m, side, dir: side === 0 ? 1 : -1, slotX: side === 0 ? px : 1 - px, dy,
      sprite: heroCanvas(m.classId, m.dye || null), spriteAtk: heroCanvas(m.classId, m.dye || null, 'atk'), pose: 'idle',
      spriteRun: [heroCanvas(m.classId, m.dye || null, 'run1'), heroCanvas(m.classId, m.dye || null, 'run2')], running: false,
      weapon, wS: weaponCanvas(weapon, m.dye || null), pivot: weaponPivot(weapon), aura: skinAura(m.dye),
      idle: IDLE_ANGLE[weapon], wAng: IDLE_ANGLE[weapon], offX: 0, offY: 0, rot: 0, alpha: 1, flash: 0,
      hp: 1, shown: 1, dead: false, busy: false, cd: 0.6 + Math.random() * 1.8, phase: Math.random() * 6,
      ranged: weapon === 'staff' || weapon === 'bow',
    };
  };
  const F = [...blue.slice(0, 4).map((m, j) => mk(m, 0, j)), ...red.slice(0, 4).map((m, j) => mk(m, 1, j))];
  const baseX = (f) => f.slotX * W;
  const posX = (f) => baseX(f) + f.offX * f.dir;
  const footY = (f) => GROUND + f.dy + f.offY;
  const mid = (f) => ({ x: posX(f), y: footY(f) - HERO_H * SC * 0.55 });

  function hurt(T, f) {
    if (T.dead) return;
    const crit = Math.random() < 0.15;
    const dmg = (0.14 + Math.random() * 0.16) * (crit ? 1.8 : 1);
    T.hp = Math.max(0, T.hp - dmg);
    T.flash = 1; tween(T, { flash: 0 }, 220, 'linear');
    tween(T, { offX: -8 }, 80).then(() => tween(T, { offX: 0 }, 200, 'outBack'));
    const c = mid(T);
    burst(c.x, c.y, crit ? 12 : 7, crit ? ['#fff', '#ffd84a'] : ['#fff', '#ff6b6b']);
    float(String(Math.round(dmg * 100 + Math.random() * 9)), c.x, c.y - 26, crit ? '#ffd84a' : '#ffffff', crit ? 12 : 9);
    shake = Math.max(shake, crit ? 4 : 2);
    if (T.hp <= 0) {
      T.dead = true;
      score[1 - T.side]++;
      tween(T, { rot: -85, alpha: 0.3 }, 500);
      setTimeout(() => { if (!alive) return; T.dead = false; T.hp = 1; T.rot = 0; tween(T, { alpha: 1 }, 400, 'linear'); }, 3200);
    }
  }

  async function act(f) {
    const foes = F.filter(x => x.side !== f.side && !x.dead);
    if (!foes.length) return;
    const T = foes[Math.floor(Math.random() * foes.length)];
    f.busy = true;
    f.pose = 'atk';
    if (f.ranged) {
      await tween(f, { wAng: f.idle - 25, offY: -4 }, 150);
      const from = { x: posX(f) + 10 * f.dir, y: footY(f) - HERO_H * SC * 0.6 }, to = mid(T);
      const p = { kind: 'shot', x: from.x, y: from.y, arrow: f.weapon === 'bow', angle: Math.atan2(to.y - from.y, to.x - from.x), life: 1e9, max: 1e9 };
      effects.push(p);
      const o = { t: 0 };
      await new Promise(res => tweens.push({ obj: o, from: { t: 0 }, to: { t: 1 }, dur: 320, t: 0, ease: EASE.linear, res,
        onStep: () => { p.x = from.x + (to.x - from.x) * o.t; p.y = from.y + (to.y - from.y) * o.t - (p.arrow ? 20 * Math.sin(Math.PI * o.t) : 0); } }));
      p.life = 0;
      hurt(T, f);
      await tween(f, { wAng: f.idle, offY: 0 }, 200);
    } else {
      const dist = Math.abs(baseX(T) - baseX(f)) - HERO_W * SC * 0.9;
      f.running = true;
      await tween(f, { offX: dist }, 340, 'inOutQuad');
      f.running = false;
      await tween(f, { wAng: -80 }, 110);
      await tween(f, { wAng: 130 }, 80, 'inQuad');
      const c = mid(T);
      effects.push({ kind: 'slash', x: c.x - 4 * f.dir, y: c.y, dir: f.dir, life: 200, max: 200 });
      hurt(T, f);
      await wait(150);
      f.running = true; f.pose = 'idle';
      await tween(f, { offX: 0, wAng: f.idle }, 320, 'inOutQuad');
      f.running = false;
    }
    f.busy = false;
    f.pose = 'idle';
    f.cd = 1.3 + Math.random() * 1.8;
  }

  function update(dt) {
    time += dt / 1000;
    for (let j = tweens.length - 1; j >= 0; j--) {
      const tw = tweens[j];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur), ev = tw.ease(p);
      for (const key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * ev;
      if (tw.onStep) tw.onStep();
      if (p >= 1) { tweens.splice(j, 1); tw.res(); }
    }
    const s = dt / 1000;
    for (let j = effects.length - 1; j >= 0; j--) {
      const e = effects[j];
      e.life -= dt;
      if (e.kind === 'p') { e.vy += 260 * s; e.x += e.vx * s; e.y += e.vy * s; }
      if (e.life <= 0) effects.splice(j, 1);
    }
    for (let j = texts.length - 1; j >= 0; j--) { const t = texts[j]; t.life -= dt; t.y += t.vy * s; if (t.life <= 0) texts.splice(j, 1); }
    shake = Math.max(0, shake - s * 20);
    for (const f of F) {
      f.shown += (f.hp - f.shown) * Math.min(1, s * 8);
      if (f.dead || f.busy) continue;
      f.cd -= s;
      if (f.cd <= 0) act(f);
    }
  }

  function drawOne(f) {
    const x = posX(f), y = footY(f) + Math.sin(time * 3 + f.phase) * 1;
    const SW = HERO_W * SC, SH = HERO_H * SC;
    ctx.globalAlpha = 0.25 * f.alpha; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, footY(f) + 2, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = f.alpha;
    if (f.aura && !f.dead) drawSkinAura(ctx, f.aura, x, y, SW, SH, time + f.phase, f.alpha);
    ctx.save();
    ctx.translate(x, y); ctx.scale(f.dir, 1);
    ctx.translate(0, -SH / 2); ctx.rotate((f.rot * Math.PI) / 180); ctx.translate(0, SH / 2);
    const runF = f.running ? Math.floor(time * 9) % 2 : -1;
    const body = runF >= 0 ? f.spriteRun[runF] : f.pose === 'atk' ? f.spriteAtk : f.sprite;
    ctx.imageSmoothingEnabled = !!body.smooth;
    ctx.drawImage(body, ...heroBox(body, -SW / 2, -SH, SW, SH));
    if (f.flash > 0.01) { ctx.globalAlpha = f.flash * f.alpha; ctx.drawImage(whiteOf(body), ...heroBox(body, -SW / 2, -SH, SW, SH)); ctx.globalAlpha = f.alpha; }
    const H = handOf(runF >= 0 ? (runF ? 'run2' : 'run1') : f.pose, f.classId);
    ctx.translate(-SW / 2 + H.x * SC, -SH + H.y * SC);
    ctx.rotate((f.wAng * Math.PI) / 180);
    ctx.drawImage(f.wS, -f.pivot[0] * SC, -f.pivot[1] * SC, lw(f.wS) * SC, lh(f.wS) * SC);
    ctx.restore();
    // nom + barre de vie
    if (!f.dead) {
      const top = footY(f) - SH - 6;
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK; ctx.fillRect(x - 17, top, 34, 5);
      ctx.fillStyle = colors[f.side]; ctx.fillRect(x - 16, top + 1, 32 * Math.max(0, f.shown), 3);
      ctx.font = PXF(6); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 3; ctx.strokeStyle = INK;
      const name = String(f.name || '').slice(0, 9);
      ctx.strokeText(name, x, top - 3); ctx.fillStyle = '#ffffff'; ctx.fillText(name, x, top - 3);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    paintScene(ctx, 'castle', W, H, GROUND, time, false);
    [...F].sort((a, b) => a.dy - b.dy).forEach(drawOne);
    for (const e of effects) {
      const p = 1 - e.life / e.max;
      if (e.kind === 'p') { ctx.globalAlpha = Math.max(0, e.life / e.max); ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      else if (e.kind === 'slash') {
        const a0 = e.dir > 0 ? -1.9 : Math.PI + 1.9, a1 = e.dir > 0 ? 0.9 : Math.PI - 0.9;
        ctx.globalAlpha = 1 - p; ctx.lineCap = 'round';
        for (const [c, w] of [['rgba(27,21,48,.55)', 6], ['#fff', 3]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(e.x, e.y, 26, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); }
        ctx.lineCap = 'butt';
      } else if (e.kind === 'shot') {
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(e.x, e.y);
        ctx.restore(); miniShot(ctx, e, '#8a3bd1', '#e0c8ff');
      }
    }
    ctx.globalAlpha = 1;
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, t.life / 300);
      ctx.font = PXF(t.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // tableau des K.O.
    ctx.font = PXF(9); ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
    ctx.textAlign = 'left'; ctx.strokeText(`K.O. ${score[0]}`, 10, 16); ctx.fillStyle = colors[0]; ctx.fillText(`K.O. ${score[0]}`, 10, 16);
    ctx.textAlign = 'right'; ctx.strokeText(`K.O. ${score[1]}`, W - 10, 16); ctx.fillStyle = colors[1]; ctx.fillText(`K.O. ${score[1]}`, W - 10, 16);
  }

  function frame(now) {
    if (!alive) return;
    if (!canvas.isConnected) { stop(); return; }
    const dt = Math.min(50, now - last);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  function stop() { alive = false; ro.disconnect(); }
  requestAnimationFrame(frame);
  return stop;
}

/**
 * Le trône : mêlée à 4 contre 4. Les persos sont affichés en petit, chacun avec sa barre de vie ;
 * le combat est joué pas à pas d'après le moteur (fight.next()), comme un duel.
 * teams = [équipe A, équipe B] (snapshots), colors = couleur de chaque équipe.
 * Renvoie { promise, setSpeed, skip, destroy } (comme playBattle).
 */
export function playMelee(canvas, teamA, teamB, fight, { colors = ['#3d9bff', '#ff5d6c'], theme = 'castle', silent = false, skipFirst = 0, onEvent = null, speed: speed0 = 1, ground = null } = {}) {
  const ctx = canvas.getContext('2d');
  const SFX = silent ? NO_SFX : SFX_ON;   // combat auto : sans le son
  const W = 360;
  let H = 240, GROUND = 210, k = 1, alive = true, last = performance.now(), time = 0, shake = 0, speed = speed0, banner = null;
  const SC = 2.5;
  const tweens = [], effects = [], texts = [], timers = [];
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    k = canvas.width / W;
    H = Math.round(W * (r.height / Math.max(1, r.width)));
    GROUND = ground ? Math.round(H * ground) : H > W ? Math.round(H * 0.6) : H - 22;   // téléphone en portrait : la scène au milieu de l'écran (ground = place choisie du sol)
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const tween = (obj, to, dur, ease = 'outQuad') => new Promise(res => {
    const from = {};
    for (const key in to) from[key] = obj[key];
    tweens.push({ obj, from, to, dur, t: 0, ease: EASE[ease], res });
  });
  const wait = (ms) => new Promise(res => timers.push({ t: ms, res }));
  const float = (text, x, y, color, size = 8) => texts.push({ text, x, y, vy: -34, life: 950, max: 950, color, size });
  const burst = (x, y, n, cols) => {
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 80;
      effects.push({ kind: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 450, max: 450, color: cols[j % cols.length] });
    }
  };

  // 4 places par équipe, en losange : 2 devant, 2 derrière (les plus forts devant)
  const SLOTS = [[0.4, -2], [0.3, -42], [0.2, -14], [0.1, -54]];
  const mk = (m, side, j) => {
    const [px, dy0] = SLOTS[j % SLOTS.length];
    const dy = H > W ? dy0 : dy0 * 0.55;   // petit écran (combat auto) : les rangs sont plus serrés
    const base = { s: m, name: m.name, side, dir: side === 0 ? 1 : -1, slotX: side === 0 ? px : 1 - px, dy, pose: 'idle', running: false,
      offX: 0, offY: 0, rot: 0, alpha: 1, flash: 0, glow: 0, hp: m.maxHp, max: m.maxHp, shown: 1, shield: 0, dead: false, phase: Math.random() * 6, stun: false };
    if (m.monster) {   // monstre : pas d'arme, dessiné un peu plus petit qu'en donjon (le boss plus gros)
      const sprite = monsterCanvas(m.monster), sc = SC * (m.boss ? 1 : 0.8);
      return { ...base, sprite, spriteAtk: sprite, spriteRun: null, weapon: null, sw: lw(sprite) * sc, sh: lh(sprite) * sc, idle: 0, wAng: 0 };
    }
    const weapon = CLASSES[m.classId].weapon;
    return {
      ...base, sprite: heroCanvas(m.classId, m.dye || null), spriteAtk: heroCanvas(m.classId, m.dye || null, 'atk'),
      spriteRun: [heroCanvas(m.classId, m.dye || null, 'run1'), heroCanvas(m.classId, m.dye || null, 'run2')],
      weapon, wS: weaponCanvas(weapon, m.dye || null), pivot: weaponPivot(weapon), sw: HERO_W * SC, sh: HERO_H * SC, aura: skinAura(m.dye),
      idle: IDLE_ANGLE[weapon], wAng: IDLE_ANGLE[weapon],
    };
  };
  const F = [...teamA.map((m, j) => mk(m, 0, j)), ...teamB.map((m, j) => mk(m, 1, j))];
  const baseX = (f) => f.slotX * W;
  const posX = (f) => baseX(f) + f.offX * f.dir;
  const footY = (f) => GROUND + f.dy + f.offY;
  const mid = (f) => ({ x: posX(f), y: footY(f) - f.sh * 0.55 });
  const SHOT = { fireball: ['#ff9f43', '#ffd84a'], ice: ['#6fe3ff', '#e0f7ff'], bolt: ['#ffd84a', '#fff3b0'], lightning: ['#ffd84a', '#ffffff'],
    drain: ['#a64dff', '#e0c8ff'], holy: ['#fff3b0', '#ffffff'], spore: ['#7bed6f', '#c8ffb8'], rock: ['#9a8a74', '#d0c4b0'], rain: ['#6fa8dc', '#e0f0ff'] };

  function sync(st) {
    if (!st) return;
    st.forEach((v, i) => { const f = F[i]; if (!f) return; f.hp = v.hp; f.shield = v.shield; f.stun = v.tags.some(t => t.k === 'stun'); });
  }
  function apply(r, src) {
    const T = F[r.target];
    if (!T) return;
    const c = mid(T);
    if (r.type === 'hit') {
      T.hp = r.hp;
      T.flash = 1; tween(T, { flash: 0 }, 200, 'linear');
      tween(T, { offX: -6 }, 70).then(() => tween(T, { offX: 0 }, 160, 'outBack'));
      burst(c.x, c.y, r.crit ? 12 : 6, r.crit ? ['#fff', '#ffd84a'] : ['#fff', '#ff6b6b']);
      float(String(r.dmg), c.x, c.y - 22, r.crit ? '#ffd84a' : '#ffffff', r.crit ? 10 : 8);
      if (r.absorbed > 0) float(`(${r.absorbed})`, c.x, c.y - 8, '#7fd6ff', 6);
      shake = Math.max(shake, r.crit ? 4 : 2);
      (r.crit ? SFX.crit : SFX.hit)();
    } else if (r.type === 'dodge') {
      float('Esquive', c.x, c.y - 22, '#9fd0ff', 7); SFX.dodge();
      tween(T, { offX: -14 }, 90).then(() => tween(T, { offX: 0 }, 200, 'outBack'));
    } else if (r.type === 'heal') {
      T.hp = r.hp; float(`+${r.amount}`, c.x, c.y - 22, '#7bf09a', 8); burst(c.x, c.y, 8, ['#7bf09a', '#b8ffb0']);
    } else if (r.type === 'shield') {
      T.shield = r.shield; float('Bouclier', c.x, c.y - 22, '#7fd6ff', 7); burst(c.x, c.y, 8, ['#7fd6ff', '#e0f7ff']); SFX.shield();
    } else if (r.type === 'status') {
      const col = r.k === 'buff' ? '#ffd84a' : r.k === 'burn' ? '#ff9f43' : r.k === 'poison' ? '#7bed6f' : r.k === 'stun' ? '#feca57' : '#c38bff';
      float(r.n, c.x, c.y - 34, col, 6);
    }
  }

  async function playEntry(e) {
    if (e.type === 'action') {
      const f = F[e.actor], T = F[e.target];
      if (!f || !T) return;
      if (e.id) { const c = mid(f); float(e.name, c.x, c.y - 40, '#ffe08a', 6); }
      const steps = Math.max(1, e.hits || 1);
      const of = (s) => e.results.filter(r => r.step === s);
      f.pose = 'atk';
      if (e.selfOnly) {
        f.glow = 1; tween(f, { glow: 0 }, 500, 'linear');
        (e.fx === 'heal' ? SFX.heal : e.fx === 'shield' ? SFX.shield : SFX.buff)();
        await tween(f, { offY: -6 }, 140);
        e.results.forEach(r => apply(r, f));
        await tween(f, { offY: 0 }, 160);
      } else if (e.melee && !e.pet) {
        const dist = Math.max(0, Math.abs(baseX(T) - baseX(f)) - (f.sw + T.sw) * 0.4);
        const lift = (footY(T) - footY(f));
        f.running = true;
        await tween(f, { offX: dist, offY: lift }, 230, 'inOutQuad');
        f.running = false;
        for (let s = 0; s < steps; s++) {
          await tween(f, { wAng: -80 }, 70);
          SFX.swing();
          await tween(f, { wAng: 130 }, 60, 'inQuad');
          const c = mid(T);
          effects.push({ kind: 'slash', x: c.x - 4 * f.dir, y: c.y, dir: f.dir, life: 180, max: 180 });
          of(s).forEach(r => apply(r, f));
          if (s < steps - 1) await wait(60);
        }
        e.results.filter(r => r.step >= steps).forEach(r => apply(r, f));
        await wait(90);
        f.running = true; f.pose = 'idle';
        await tween(f, { offX: 0, offY: 0, wAng: f.idle }, 230, 'inOutQuad');
        f.running = false;
      } else {
        await tween(f, { wAng: f.idle - 25, offY: -3 }, 100);
        for (let s = 0; s < steps; s++) {
          const from = { x: posX(f) + 10 * f.dir, y: footY(f) - f.sh * 0.6 }, to = mid(T);
          const arrow = !e.pet && f.weapon === 'bow' && !SHOT[e.fx];
          const p = { kind: 'shot', x: from.x, y: from.y, arrow, cols: SHOT[e.fx] || (e.pet ? ['#ffd84a', '#fff3b0'] : ['#8a3bd1', '#e0c8ff']), angle: Math.atan2(to.y - from.y, to.x - from.x), life: 1e9, max: 1e9 };
          effects.push(p);
          (arrow ? SFX.arrow : e.fx === 'fireball' ? SFX.fire : e.fx === 'lightning' || e.fx === 'bolt' ? SFX.bolt : SFX.magic)();
          const o = { t: 0 };
          await new Promise(res => tweens.push({ obj: o, from: { t: 0 }, to: { t: 1 }, dur: 220, t: 0, ease: EASE.linear, res,
            onStep: () => { p.x = from.x + (to.x - from.x) * o.t; p.y = from.y + (to.y - from.y) * o.t - (arrow ? 14 * Math.sin(Math.PI * o.t) : 0); } }));
          p.life = 0;
          burst(to.x, to.y, 6, p.cols);
          of(s).forEach(r => apply(r, f));
        }
        e.results.filter(r => r.step >= steps).forEach(r => apply(r, f));
        await tween(f, { wAng: f.idle, offY: 0 }, 140);
      }
      f.pose = 'idle';
      await wait(90);
    } else if (e.type === 'dot') {
      const T = F[e.target], c = mid(T);
      T.hp = e.hp;
      const cols = e.k === 'burn' ? ['#ff9f43', '#ffd84a'] : ['#7bed6f', '#3fbf3f'];
      burst(c.x, c.y, 6, cols); float(String(e.dmg), c.x, c.y - 22, cols[0], 7); SFX.dot();
      await wait(220);
    } else if (e.type === 'stunned') {
      const T = F[e.target], c = mid(T);
      float('Étourdi…', c.x, c.y - 30, '#feca57', 6); SFX.stun();
      await wait(320);
    } else if (e.type === 'ko') {
      const T = F[e.target], c = mid(T);
      T.dead = true;
      SFX.boom();
      burst(c.x, c.y, 16, ['#ffd84a', '#fff3b0', '#ff9f43']);
      float('K.O. !', c.x, c.y - 30, '#ff5d6c', 9);
      tween(T, { rot: -85, alpha: 0.3, offX: -10 }, 420);
      await wait(380);
    } else if (e.type === 'rage') {
      SFX.rage();
      banner = { text: 'RAGE !', life: 1300, max: 1300 };
      shake = 5;
      await wait(700);
    } else if (e.type === 'end') {
      (e.winner === 0 ? SFX.win : SFX.lose)();
      for (const f of F.filter(x => x.side === e.winner && !x.dead)) {
        tween(f, { offY: -12 }, 180).then(() => tween(f, { offY: 0 }, 260, 'outBack'));
      }
      await wait(900);
    }
    sync(e.s);
  }

  function update(dt) {
    dt *= speed;
    time += dt / 1000;
    for (let j = timers.length - 1; j >= 0; j--) { timers[j].t -= dt; if (timers[j].t <= 0) { const t = timers.splice(j, 1)[0]; t.res(); } }
    for (let j = tweens.length - 1; j >= 0; j--) {
      const tw = tweens[j];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur), ev = tw.ease(p);
      for (const key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * ev;
      if (tw.onStep) tw.onStep();
      if (p >= 1) { tweens.splice(j, 1); tw.res(); }
    }
    const s = dt / 1000;
    for (let j = effects.length - 1; j >= 0; j--) {
      const e = effects[j];
      e.life -= dt;
      if (e.kind === 'p') { e.vy += 260 * s; e.x += e.vx * s; e.y += e.vy * s; }
      if (e.life <= 0) effects.splice(j, 1);
    }
    for (let j = texts.length - 1; j >= 0; j--) { const t = texts[j]; t.life -= dt; t.y += t.vy * s; if (t.life <= 0) texts.splice(j, 1); }
    if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
    shake = Math.max(0, shake - s * 20);
    for (const f of F) f.shown += (Math.max(0, f.hp) / f.max - f.shown) * Math.min(1, s * 8);
  }

  function drawOne(f) {
    const x = posX(f), y = footY(f) + (f.dead ? 0 : Math.sin(time * 3 + f.phase) * 0.8);
    const SW = f.sw, SH = f.sh;
    ctx.globalAlpha = 0.25 * f.alpha; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, footY(f) + 2, Math.max(15, SW * 0.4), 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = f.alpha;
    if (f.aura && !f.dead) drawSkinAura(ctx, f.aura, x, y, SW, SH, time + f.phase, f.alpha);
    ctx.save();
    ctx.translate(x, y); ctx.scale(f.dir, 1);
    ctx.translate(0, -SH / 2); ctx.rotate((f.rot * Math.PI) / 180); ctx.translate(0, SH / 2);
    const runF = f.running && f.spriteRun ? Math.floor(time * 9) % 2 : -1;
    const body = runF >= 0 ? f.spriteRun[runF] : f.pose === 'atk' ? f.spriteAtk : f.sprite;
    if (f.glow > 0.01) { ctx.shadowColor = '#fff3b0'; ctx.shadowBlur = 12 * f.glow; }
    ctx.imageSmoothingEnabled = !!body.smooth;
    ctx.drawImage(body, ...heroBox(body, -SW / 2, -SH, SW, SH));
    ctx.shadowBlur = 0;
    if (f.flash > 0.01) { ctx.globalAlpha = f.flash * f.alpha; ctx.drawImage(whiteOf(body), ...heroBox(body, -SW / 2, -SH, SW, SH)); ctx.globalAlpha = f.alpha; }
    if (f.weapon) {
      const Hd = handOf(runF >= 0 ? (runF ? 'run2' : 'run1') : f.pose, f.s && f.s.classId);
      ctx.translate(-SW / 2 + Hd.x * SC, -SH + Hd.y * SC);
      ctx.rotate((f.wAng * Math.PI) / 180);
      ctx.drawImage(f.wS, -f.pivot[0] * SC, -f.pivot[1] * SC, lw(f.wS) * SC, lh(f.wS) * SC);
    }
    ctx.restore();
    if (!f.dead) {
      const top = footY(f) - SH - 5;
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK; ctx.fillRect(x - 15, top, 30, 5);
      ctx.fillStyle = colors[f.side]; ctx.fillRect(x - 14, top + 1, 28 * Math.max(0, f.shown), 3);
      if (f.shield > 0) { ctx.fillStyle = '#7fd6ff'; ctx.fillRect(x - 14, top - 1, 28 * Math.min(1, f.shield / f.max), 1); }
      ctx.font = PXF(5); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
      const name = String(f.name || '').slice(0, 9);
      ctx.strokeText(name, x, top - 3); ctx.fillStyle = '#ffffff'; ctx.fillText(name, x, top - 3);
      if (f.stun) { ctx.fillStyle = '#feca57'; ctx.fillRect(x - 6 + Math.sin(time * 8) * 4, top - 12, 3, 3); }
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    // décor : le même que pour un duel (ciel en dégradé, plans du fond, sol jusqu'en bas de l'écran)
    paintScene(ctx, theme, W, H, GROUND, time, false);
    [...F].sort((a, b) => a.dy - b.dy).forEach(drawOne);
    for (const e of effects) {
      const p = 1 - e.life / e.max;
      if (e.kind === 'p') { ctx.globalAlpha = Math.max(0, e.life / e.max); ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      else if (e.kind === 'slash') {
        const a0 = e.dir > 0 ? -1.9 : Math.PI + 1.9, a1 = e.dir > 0 ? 0.9 : Math.PI - 0.9;
        ctx.globalAlpha = 1 - p; ctx.lineCap = 'round';
        for (const [c, w] of [['rgba(27,21,48,.55)', 5], ['#fff', 2.5]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(e.x, e.y, 20, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); }
        ctx.lineCap = 'butt';
      } else if (e.kind === 'shot') {
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(e.x, e.y);
        ctx.restore(); miniShot(ctx, e, e.cols[0], e.cols[1]);
      }
    }
    ctx.globalAlpha = 1;
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, t.life / 300);
      ctx.font = PXF(t.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // combattants encore debout de chaque côté
    const up = (side) => F.filter(f => f.side === side && !f.dead).length;
    ctx.font = PXF(9); ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
    const hy = H > W ? Math.max(46, GROUND - 150) : 14;   // sous le titre, au-dessus de la mêlée (en haut si l'écran est petit)
    ctx.textAlign = 'left'; ctx.strokeText(`${up(0)} debout`, 10, hy); ctx.fillStyle = colors[0]; ctx.fillText(`${up(0)} debout`, 10, hy);
    ctx.textAlign = 'right'; ctx.strokeText(`${up(1)} debout`, W - 10, hy); ctx.fillStyle = colors[1]; ctx.fillText(`${up(1)} debout`, W - 10, hy);
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.life / 300);
      ctx.font = PXF(16); ctx.textAlign = 'center'; ctx.lineWidth = 5;
      ctx.strokeText(banner.text, W / 2, H * 0.32); ctx.fillStyle = '#ff5d6c'; ctx.fillText(banner.text, W / 2, H * 0.32);
      ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    if (!alive) return;
    if (!canvas.isConnected) { destroy(); return; }
    const dt = Math.min(50, now - last);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  function destroy() { alive = false; ro.disconnect(); if (!silent) setQuiet(false); }
  requestAnimationFrame(frame);

  const promise = (async () => {
    await (document.fonts ? document.fonts.load(`20px ${FONT}`).catch(() => {}) : Promise.resolve());
    // reprise d'un combat déjà commencé : les premiers événements sont appliqués d'un coup, sans animation
    for (let j = 0; j < skipFirst; j++) {
      const e = fight.next();
      if (!e) break;
      if (e.type === 'ko') { const T = F[e.target]; T.dead = true; T.rot = -85; T.alpha = 0.3; }
      sync(e.s);
      if (onEvent) onEvent(e);
    }
    for (const f of F) f.shown = Math.max(0, f.hp) / f.max;
    if (!skipFirst) await wait(500);
    for (let e = fight.next(); e; e = fight.next()) {
      if (!alive) return;
      await playEntry(e);
      if (onEvent && alive) onEvent(e);
    }
    await wait(300);
  })();
  return {
    promise,
    setSpeed(v) { speed = v; if (!silent) setQuiet(v > 3); },
    skip() { speed = 60; if (!silent) setQuiet(true); },
    destroy,
  };
}

/**
 * Héros au centre de l'écran d'équipement : il respire, son arme bouge,
 * et de temps en temps il prend sa pose d'attaque. Son familier flotte à ses pieds.
 */
/** Une fenêtre est ouverte par-dessus ce dessin (il est caché et flouté derrière) : inutile de l'animer */
function behindModal(canvas) {
  const m = document.getElementById('modal-root');
  return !!(m && m.firstElementChild && !m.contains(canvas));
}

export function dollPreview(canvas, classId, petItemId = null, dyeId = null) {
  const ctx = canvas.getContext('2d');
  let idle = heroCanvas(classId, dyeId), atk = heroCanvas(classId, dyeId, 'atk');
  const LW = 84, LH = 62, K = 1.85;   // zone large : l'arme peut dépasser derrière les cases d'équipement
  // résolution juste nécessaire pour la taille affichée (écran fin compris, plafonné) : moins de pixels à redessiner sur téléphone
  const sc = idle.smooth ? Math.max(4, Math.min(10, Math.round((canvas.clientWidth || 340) * Math.min(2, window.devicePixelRatio || 1) / LW))) : 6;
  canvas.width = LW * sc; canvas.height = LH * sc;
  canvas.style.imageRendering = idle.smooth ? 'auto' : '';
  const weapon = CLASSES[classId].weapon, aura = skinAura(dyeId);
  let wS = weaponCanvas(weapon, dyeId);
  const [px, py] = weaponPivot(weapon);
  const pet = petItemId ? petCanvas(petItemId) : null;
  let alive = true, last = 0;
  const t0 = performance.now();
  function loop(now) {
    if (!alive || !canvas.isConnected) return;
    if (now - last < 32 || behindModal(canvas)) { requestAnimationFrame(loop); return; }   // 30 images par seconde suffisent ; en pause derrière une fenêtre
    last = now;
    const t = (now - t0) / 1000;
    idle = heroCanvas(classId, dyeId); atk = heroCanvas(classId, dyeId, 'atk'); wS = weaponCanvas(weapon, dyeId);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.clearRect(0, 0, LW, LH);
    ctx.imageSmoothingEnabled = !!idle.smooth;
    // pose d'attaque quelques instants toutes les 4 secondes
    const cyc = t % 4, inAtk = cyc > 3.2 && cyc < 3.85;
    const pose = inAtk ? 'atk' : 'idle';
    const W = HERO_W * K, H = HERO_H * K;
    const ox = (LW - W) / 2 - 2, feet = LH - 5;
    const bob = inAtk ? 0 : Math.sin(t * 2.6) * 0.35;
    if (aura) drawSkinAura(ctx, aura, LW / 2, feet, W, H, t);
    // socle lumineux
    const g = ctx.createRadialGradient(LW / 2, feet, 0, LW / 2, feet, 16);
    g.addColorStop(0, 'rgba(255,216,74,0.45)'); g.addColorStop(1, 'rgba(255,216,74,0)');
    ctx.fillStyle = g; ctx.fillRect(0, feet - 16, LW, 20);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(LW / 2, feet, 10, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // héros + arme
    const oy = feet - H + bob;
    ctx.drawImage(pose === 'atk' ? atk : idle, ...heroBox(idle, ox, oy, W, H));
    const hand = handOf(pose, classId);
    const swing = inAtk ? Math.sin(((cyc - 3.2) / 0.65) * Math.PI) : 0;
    const ang = IDLE_ANGLE[weapon] + Math.sin(t * 2.6) * 3 + swing * (weapon === 'bow' ? -20 : 70);
    ctx.save();
    ctx.translate(ox + hand.x * K, oy + hand.y * K);
    ctx.rotate((ang * Math.PI) / 180);
    ctx.drawImage(wS, -px * K, -py * K, lw(wS) * K, lh(wS) * K);
    ctx.restore();
    // familier : devant, dans le coin bas gauche de la zone visible (le dessin est plus large que le cadre, entre les cases)
    if (pet) {
      const k = Math.min(0.9, 18 / lh(pet)), pw = lw(pet) * k, ph = lh(pet) * k;
      ctx.imageSmoothingEnabled = !!pet.smooth;
      ctx.drawImage(pet, LW * 0.3, feet - ph + 1 + Math.sin(t * 3.2) * 0.6, pw, ph);
      ctx.imageSmoothingEnabled = !!idle.smooth;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return () => { alive = false; };
}
