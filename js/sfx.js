// =====================================================================
//  SONS — bruitages et musique 8-bit fabriqués à la volée (aucun fichier)
// =====================================================================
const PREF = 'fuzev2-sound';
let ac = null, master = null, sfxOut = null, musicOut = null, noiseBuf = null;
let quiet = false;
const prefs = { sfx: true, music: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch (e) { /* stockage indisponible */ }

export const getPref = (k) => prefs[k];
export function setPref(k, v) {
  prefs[k] = v;
  try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch (e) { /* stockage indisponible */ }
  if (k === 'music' && !v) stopMusic();
}

/** Le son ne peut démarrer qu'après un premier toucher de l'écran (règle des téléphones) */
export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    sfxOut = ac.createGain(); sfxOut.connect(master);
    musicOut = ac.createGain(); musicOut.gain.value = 0.22; musicOut.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
}

/** Coupe les bruitages pendant l'avance rapide d'un combat */
export function setQuiet(v) { quiet = v; }

const can = () => ac && prefs.sfx && !quiet;

function tone(freq, { type = 'square', dur = 0.12, vol = 0.15, slide = 0, delay = 0, at = null, out = sfxOut } = {}) {
  if (!ac) return;
  const t = at ?? ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise({ dur = 0.15, vol = 0.2, freq = 1200, q = 1, type = 'bandpass', delay = 0, slide = 0, at = null, out = sfxOut } = {}) {
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = at ?? ac.currentTime + delay;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t); s.stop(t + dur + 0.03);
}

const arp = (notes, { type = 'square', step = 0.07, dur = 0.12, vol = 0.08 } = {}) =>
  notes.forEach((f, i) => tone(f, { type, dur, vol, delay: i * step }));

export const SFX = {
  click: () => can() && tone(660, { dur: 0.05, vol: 0.05 }),
  swing: () => can() && noise({ dur: 0.14, vol: 0.18, freq: 2600, slide: 0.3, q: 0.8 }),
  hit: () => { if (!can()) return; noise({ dur: 0.12, vol: 0.35, freq: 900, q: 0.7 }); tone(150, { dur: 0.1, vol: 0.12, slide: 0.5 }); },
  crit: () => { if (!can()) return; noise({ dur: 0.18, vol: 0.45, freq: 700, q: 0.6 }); tone(180, { type: 'sawtooth', dur: 0.16, vol: 0.15, slide: 0.4 }); tone(1320, { dur: 0.12, vol: 0.06, delay: 0.04 }); },
  dodge: () => can() && noise({ dur: 0.22, vol: 0.12, freq: 3200, slide: 0.45 }),
  arrow: () => { if (!can()) return; noise({ dur: 0.12, vol: 0.12, freq: 5000, slide: 0.4, type: 'highpass' }); tone(900, { type: 'triangle', dur: 0.08, vol: 0.05, slide: 1.6 }); },
  fire: () => can() && noise({ dur: 0.45, vol: 0.28, freq: 700, slide: 0.35, type: 'lowpass' }),
  magic: () => { if (!can()) return; tone(500, { type: 'sine', dur: 0.25, vol: 0.12, slide: 2 }); tone(750, { type: 'sine', dur: 0.25, vol: 0.08, slide: 2, delay: 0.05 }); },
  bolt: () => { if (!can()) return; noise({ dur: 0.35, vol: 0.4, freq: 4000, slide: 0.15, type: 'highpass' }); tone(60, { type: 'sawtooth', dur: 0.3, vol: 0.15, slide: 0.5 }); },
  boom: () => { if (!can()) return; noise({ dur: 0.6, vol: 0.45, freq: 320, slide: 0.3, type: 'lowpass' }); tone(80, { type: 'sine', dur: 0.5, vol: 0.3, slide: 0.4 }); },
  heal: () => can() && arp([523, 659, 784, 1047], { type: 'sine', step: 0.06, dur: 0.18, vol: 0.09 }),
  shield: () => { if (!can()) return; tone(300, { type: 'triangle', dur: 0.3, vol: 0.12, slide: 2.5 }); tone(600, { type: 'sine', dur: 0.25, vol: 0.06, delay: 0.05 }); },
  roar: () => { if (!can()) return; tone(110, { type: 'sawtooth', dur: 0.45, vol: 0.15, slide: 0.6 }); noise({ dur: 0.45, vol: 0.15, freq: 400, type: 'lowpass' }); },
  buff: () => can() && arp([392, 523, 659], { step: 0.07, dur: 0.1, vol: 0.06 }),
  stun: () => can() && arp([1200, 900, 1200, 900], { type: 'sine', step: 0.07, dur: 0.07, vol: 0.05 }),
  dot: () => can() && noise({ dur: 0.15, vol: 0.1, freq: 700, type: 'lowpass' }),
  rage: () => can() && arp([220, 277, 220, 277], { type: 'sawtooth', step: 0.16, dur: 0.15, vol: 0.1 }),
  win: () => can() && arp([523, 659, 784, 1047, 784, 1047, 1319], { step: 0.11, dur: 0.18, vol: 0.1 }),
  lose: () => can() && arp([392, 349, 311, 262], { type: 'triangle', step: 0.22, dur: 0.3, vol: 0.12 }),
  chest: () => { if (!can()) return; noise({ dur: 0.7, vol: 0.12, freq: 300, type: 'lowpass' }); arp([196, 220, 247, 262], { type: 'triangle', step: 0.18, dur: 0.16, vol: 0.1 }); },
  loot: (rarity = 0) => {
    if (!can()) return;
    const notes = [[784, 988], [784, 988, 1175], [659, 784, 988, 1319], [523, 659, 784, 1047, 1319], [523, 659, 784, 1047, 1319, 1568, 2093], [392, 523, 659, 784, 1047, 1319, 1568, 2093], [262, 392, 523, 659, 784, 1047, 1319, 1568, 2093, 2637]][rarity] || [784];
    arp(notes, { step: 0.07, dur: 0.16, vol: 0.09 });
    if (rarity >= 3) noise({ dur: 0.6, vol: 0.08, freq: 6000, type: 'highpass', delay: 0.2 });
  },
  level: () => can() && arp([523, 523, 523, 698, 880, 1047], { step: 0.09, dur: 0.14, vol: 0.09 }),
  fuse: () => { if (!can()) return; tone(200, { type: 'sawtooth', dur: 0.5, vol: 0.1, slide: 4 }); arp([1047, 1319, 1568], { type: 'sine', step: 0.06, dur: 0.2, vol: 0.08 }); },
  message: () => can() && arp([880, 1175], { type: 'sine', step: 0.08, dur: 0.12, vol: 0.06 }),
};

// ------------------------------ Musiques de combat ------------------------------
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);   // numéro de note MIDI -> fréquence
const _ = null;
// Chaque musique : tempo, 4 accords (8 croches chacun), mélodie (une note par croche, _ = silence),
// basse (x = note grave, o = octave au-dessus) et batterie (k = grosse caisse, s = caisse claire, h = charleston), en boucle.
const TRACKS = [
  { name: 'Arène', bpm: 150, arp: 'square', bass: 'x.x.x.x.', drums: '....h...h.......',
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    lead: [76, 74, 72, 74, 76, 76, 76, _, 74, 74, 74, _, 76, 79, 79, _, 76, 74, 72, 74, 76, 76, 76, 76, 74, 74, 76, 74, 72, _, _, _] },
  { name: 'Charge héroïque', bpm: 140, arp: 'triangle', bass: 'x.x.x.xo', drums: 'k.h.s.hkk.h.s.hs',
    chords: [[50, 54, 57], [57, 61, 64], [59, 62, 66], [55, 59, 62]],
    lead: [78, _, 78, 79, 81, _, 78, _, 76, _, 76, 78, 73, _, _, _, 74, _, 74, 76, 78, _, 83, _, 81, _, 79, _, 78, _, _, _,
      78, _, 78, 79, 81, _, 86, _, 85, _, 83, _, 81, _, 76, _, 79, _, 78, _, 76, _, 74, _, 74, _, _, _, _, _, _, _] },
  { name: 'Donjon', bpm: 112, arp: 'sine', bass: 'x...x.x.', drums: 'k...s...k.k.s..h',
    chords: [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]],
    lead: [76, _, _, 79, 78, _, 76, _, 72, _, _, _, 71, _, _, _, 69, _, 72, _, 76, _, 74, 72, 71, _, _, _, 75, _, _, _,
      76, _, 79, _, 83, _, 81, 79, 79, _, 76, _, 72, _, _, _, 72, _, 69, _, 72, _, 76, 74, 75, _, _, _, 71, _, _, _] },
  { name: 'Boss', bpm: 172, arp: 'square', bass: 'xoxoxoxo', drums: 'k.hsk.hsk.hsk.ss',
    chords: [[48, 51, 55], [44, 48, 51], [46, 50, 53], [43, 47, 50]],
    lead: [72, 75, 79, 75, 72, 75, 79, 84, 80, 79, 77, 75, 77, _, _, _, 70, 74, 77, 74, 70, 74, 77, 82, 79, _, 78, _, 79, _, _, _] },
  { name: 'Course', bpm: 160, arp: 'square', bass: 'x.xox.xo', drums: 'k.h.skh.k.h.s.hh',
    chords: [[55, 58, 62], [51, 55, 58], [53, 57, 60], [50, 54, 57]],
    lead: [79, _, 77, _, 74, _, 77, 79, 82, _, 79, _, 75, _, _, _, 77, _, 74, _, 72, _, 74, 77, 81, _, 78, _, 74, _, _, _] },
];
export const MUSIC_COUNT = TRACKS.length;
let musicTimer = null, lastTrack = -1;

function drum(c, at) {
  if (c === 'k') tone(150, { type: 'sine', dur: 0.14, vol: 0.55, slide: 0.3, at, out: musicOut });
  else if (c === 's') noise({ dur: 0.11, vol: 0.3, freq: 1800, q: 0.7, at, out: musicOut });
  else if (c === 'h') noise({ dur: 0.035, vol: 0.12, freq: 7500, type: 'highpass', at, out: musicOut });
}

/** Lance une musique de combat (au hasard, jamais deux fois de suite la même, sauf si on en choisit une) */
export function startMusic(which = null) {
  if (!ac || !prefs.music || musicTimer) return;
  let i = which;
  if (i === null) { i = Math.floor(Math.random() * (TRACKS.length - 1)); if (i >= lastTrack && lastTrack >= 0) i++; }
  lastTrack = i;
  const T = TRACKS[i % TRACKS.length];
  const spb = 60 / T.bpm / 2;          // une croche
  let next = ac.currentTime + 0.05, step = 0;
  musicTimer = setInterval(() => {
    while (next < ac.currentTime + 0.25) {
      const chord = T.chords[Math.floor(step / 8) % T.chords.length];
      const b = T.bass[step % T.bass.length];
      if (b === 'x') tone(N(chord[0] - 12), { type: 'triangle', dur: spb * 1.8, vol: 0.35, at: next, out: musicOut });
      else if (b === 'o') tone(N(chord[0]), { type: 'triangle', dur: spb * 0.9, vol: 0.28, at: next, out: musicOut });
      tone(N(chord[step % 3] + 12), { type: T.arp, dur: spb * 0.6, vol: T.arp === 'square' ? 0.06 : 0.1, at: next, out: musicOut });
      const lead = T.lead[step % T.lead.length];
      if (lead) tone(N(lead), { type: 'square', dur: spb * 0.9, vol: 0.1, at: next, out: musicOut });
      drum(T.drums[step % T.drums.length], next);
      next += spb;
      step = (step + 1) % (T.lead.length * T.chords.length * 8);
    }
  }, 60);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}
