'use strict';
/* ============================================================
   Per-hero movesets, block / parry / guard break.
   Each hero has its own light string, air string, heavy and a
   movement option. Move fields (see player.js):
     w/s pose names, dur, a0..a1 active window, cancel, dmg, post,
     reach, r, lunge, big, finisher, knock (>=9 launches),
     pull (drags the target toward you), spinY / flip / dive (body motion),
     armor (super armor), aoe (radius hit around you), proj (projectile on strike)
   ============================================================ */
Object.assign(HERO_POSES, {
  // fire: boxing
  jabW: { hipsY: -0.12, hips: [0, 0.3, 0], torso: [0.1, 0.35, 0], shR: [-0.3, 0, -0.4], elR: [-2.2, 0, 0], shL: [-0.9, 0, 0.3], elL: [-1.8, 0, 0], hipL: [-0.5, 0, 0], knL: [0.6, 0, 0], hipR: [0.4, 0, 0], knR: [0.5, 0, 0] },
  jabR: { hipsY: -0.14, hips: [0, -0.35, 0], torso: [0.2, -0.55, 0], shR: [-1.62, 0, 0.05], elR: [-0.05, 0, 0], shL: [-0.8, 0, 0.35], elL: [-1.9, 0, 0], hipL: [-0.7, 0, 0], knL: [0.6, 0, 0], hipR: [0.6, 0, 0], knR: [0.2, 0, 0] },
  jabL: { hipsY: -0.14, hips: [0, 0.4, 0], torso: [0.2, 0.6, 0], shL: [-1.62, 0, -0.05], elL: [-0.05, 0, 0], shR: [-0.8, 0, -0.35], elR: [-1.9, 0, 0], hipL: [-0.7, 0, 0], knL: [0.5, 0, 0], hipR: [0.6, 0, 0], knR: [0.3, 0, 0] },
  hookW: { hipsY: -0.16, hips: [0, 0.7, 0], torso: [0.15, 0.8, 0], shR: [-0.4, 0, -1.3], elR: [-1.6, 0, 0], shL: [-0.9, 0, 0.3], elL: [-1.8, 0, 0], hipL: [-0.6, 0, 0], knL: [0.8, 0, 0], hipR: [0.5, 0, 0], knR: [0.7, 0, 0] },
  hookR: { hipsY: -0.14, hips: [0, -0.7, 0], torso: [0.2, -0.9, 0], shR: [-1.3, 0.9, -1.2], elR: [-1.3, 0, 0], shL: [-0.7, 0, 0.4], elL: [-1.9, 0, 0], hipL: [-0.7, 0, 0], knL: [0.6, 0, 0], hipR: [0.7, 0, 0], knR: [0.2, 0, 0] },
  kneeW: { hipsY: -0.1, torso: [-0.15, 0, 0], shL: [-1.4, 0, 0.5], elL: [-1.4, 0, 0], shR: [-1.4, 0, -0.5], elR: [-1.4, 0, 0], hipL: [-0.2, 0, 0], knL: [0.3, 0, 0], hipR: [0.5, 0, 0], knR: [0.9, 0, 0] },
  knee: { hipsY: 0.05, torso: [0.35, 0, 0], head: [-0.2, 0, 0], shL: [-1.9, 0, 0.4], elL: [-1.0, 0, 0], shR: [-1.9, 0, -0.4], elR: [-1.0, 0, 0], hipL: [0.2, 0, 0.05], knL: [0.2, 0, 0], hipR: [-2.0, 0, 0], knR: [2.3, 0, 0] },
  upperW: { hipsY: -0.38, hips: [0, 0.5, 0], torso: [0.45, 0.5, 0], head: [-0.3, 0, 0], shR: [0.6, 0, -0.3], elR: [-2.0, 0, 0], shL: [-0.8, 0, 0.4], elL: [-1.8, 0, 0], hipL: [-1.2, 0, 0], knL: [1.6, 0, 0], hipR: [0.5, 0, 0], knR: [1.4, 0, 0] },
  upperF: { hipsY: 0.25, hips: [0, -0.3, 0], torso: [-0.35, -0.3, 0], head: [0.2, 0, 0], shR: [-2.9, 0, -0.1], elR: [-0.3, 0, 0], shL: [-0.4, 0, 0.6], elL: [-1.5, 0, 0], hipL: [0.3, 0, 0], knL: [0.2, 0, 0], hipR: [-1.4, 0, 0], knR: [1.8, 0, 0] },
  axeW: { torso: [-0.5, 0, 0], shL: [-2.4, 0, 0.6], elL: [-0.3, 0, 0], shR: [-2.4, 0, -0.6], elR: [-0.3, 0, 0], hipL: [-0.4, 0, 0], knL: [1.2, 0, 0], hipR: [-2.8, 0, 0], knR: [0.1, 0, 0] },
  axe: { torso: [0.6, 0, 0], head: [-0.4, 0, 0], shL: [-0.8, 0, 1.0], elL: [-0.6, 0, 0], shR: [-0.8, 0, -1.0], elR: [-0.6, 0, 0], hipL: [-0.6, 0, 0], knL: [1.4, 0, 0], hipR: [-0.6, 0, 0], knR: [0.0, 0, 0] },
  // earth: heavy brawler
  hammerW: { hipsY: -0.05, torso: [-0.45, 0, 0], head: [0.15, 0, 0], shL: [-2.9, 0, 0.25], elL: [-0.9, 0, 0], shR: [-2.9, 0, -0.25], elR: [-0.9, 0, 0], hipL: [-0.4, 0, 0.1], knL: [0.4, 0, 0], hipR: [0.3, 0, -0.1], knR: [0.4, 0, 0] },
  hammer: { hipsY: -0.4, torso: [0.85, 0, 0], head: [-0.5, 0, 0], shL: [-1.2, 0, 0.1], elL: [-0.2, 0, 0], shR: [-1.2, 0, -0.1], elR: [-0.2, 0, 0], hipL: [-1.2, 0, 0.2], knL: [1.5, 0, 0], hipR: [0.6, 0, -0.2], knR: [1.0, 0, 0] },
  shoulderW: { hipsY: -0.25, hips: [0, 1.1, 0], torso: [0.3, 0.9, 0], shL: [-0.2, 0, 0.6], elL: [-1.8, 0, 0], shR: [0.4, 0, -0.4], elR: [-1.8, 0, 0], hipL: [-0.8, 0, 0], knL: [1.1, 0, 0], hipR: [0.5, 0, 0], knR: [0.9, 0, 0] },
  shoulder: { hipsY: -0.22, hips: [0, 1.5, 0], torso: [0.45, 0.4, 0], head: [-0.2, -0.8, 0], shL: [0.3, 0, 0.25], elL: [-1.9, 0, 0], shR: [0.3, 0, -0.5], elR: [-1.6, 0, 0], hipL: [-1.1, 0, 0], knL: [0.7, 0, 0], hipR: [0.8, 0, 0], knR: [0.2, 0, 0] },
  quakeW: { hipsY: 0.12, torso: [-0.6, 0, 0], head: [0.3, 0, 0], shL: [-3.0, 0, 0.5], elL: [-0.4, 0, 0], shR: [-3.0, 0, -0.5], elR: [-0.4, 0, 0], hipL: [-0.3, 0, 0.2], knL: [0.2, 0, 0], hipR: [-0.3, 0, -0.2], knR: [0.2, 0, 0] },
  quake: { hipsY: -0.62, torso: [1.05, 0, 0], head: [-0.6, 0, 0], shL: [-0.9, 0, 0.3], elL: [0, 0, 0], shR: [-0.9, 0, -0.3], elR: [0, 0, 0], hipL: [-1.6, 0, 0.35], knL: [2.2, 0, 0], hipR: [-0.6, 0, -0.35], knR: [1.9, 0, 0] },
  // water: whips and flowing spins
  whipW: { hipsY: -0.1, hips: [0, 0.8, 0], torso: [0, 0.7, 0], shR: [-0.6, 0, -1.6], elR: [-0.3, 0, 0], shL: [-0.5, 0, 0.6], elL: [-1.0, 0, 0], hipL: [-0.5, 0, 0], knL: [0.6, 0, 0], hipR: [0.4, 0, 0], knR: [0.4, 0, 0] },
  whipR: { hipsY: -0.14, hips: [0, -0.6, 0], torso: [0.1, -0.7, 0], shR: [-1.5, -0.3, -0.4], elR: [0, 0, 0], shL: [-0.2, 0, 1.2], elL: [-0.2, 0, 0], hipL: [-0.8, 0, 0], knL: [0.5, 0, 0], hipR: [0.7, 0, 0], knR: [0.1, 0, 0] },
  whipL: { hipsY: -0.14, hips: [0, 0.6, 0], torso: [0.1, 0.7, 0], shL: [-1.5, 0.3, 0.4], elL: [0, 0, 0], shR: [-0.2, 0, -1.2], elR: [-0.2, 0, 0], hipL: [-0.7, 0, 0], knL: [0.2, 0, 0], hipR: [0.8, 0, 0], knR: [0.5, 0, 0] },
  wheel: { hipsY: -0.05, torso: [0.1, 0, 0], shL: [-0.1, 0, 1.55], elL: [0, 0, 0], shR: [-0.1, 0, -1.55], elR: [0, 0, 0], hipL: [-0.3, 0, 0.25], knL: [0.4, 0, 0], hipR: [-0.3, 0, -0.25], knR: [0.4, 0, 0] },
  pullW: { hipsY: -0.2, torso: [0.3, 0, 0], shL: [-1.6, 0.2, 0.2], elL: [0, 0, 0], shR: [-1.6, -0.2, -0.2], elR: [0, 0, 0], hipL: [-0.9, 0, 0], knL: [0.8, 0, 0], hipR: [0.6, 0, 0], knR: [0.3, 0, 0] },
  pull: { hipsY: -0.24, torso: [-0.3, 0, 0], head: [0.2, 0, 0], shL: [0.4, 0, 0.5], elL: [-1.9, 0, 0], shR: [0.4, 0, -0.5], elR: [-1.9, 0, 0], hipL: [-0.4, 0, 0], knL: [0.9, 0, 0], hipR: [0.9, 0, 0], knR: [0.2, 0, 0] },
  // block
  guard: { hipsY: -0.2, hips: [0, 0.3, 0], torso: [0.25, 0.2, 0], head: [0.25, 0, 0], shL: [-1.3, 0.4, -0.35], elL: [-2.2, 0, 0], shR: [-1.3, -0.4, 0.35], elR: [-2.2, 0, 0], hipL: [-0.7, 0, 0.1], knL: [0.9, 0, 0], hipR: [0.5, 0, -0.1], knR: [0.7, 0, 0] },
  parry: { hipsY: -0.24, hips: [0, -0.5, 0], torso: [0.2, -0.6, 0], head: [0.1, 0, 0], shR: [-2.2, 0.3, -0.9], elR: [-0.2, 0, 0], shL: [-0.6, 0, 0.6], elL: [-1.4, 0, 0], hipL: [-0.9, 0, 0], knL: [0.9, 0, 0], hipR: [0.7, 0, 0], knR: [0.4, 0, 0] },
  guardBroken: { hipsY: -0.1, torso: [-0.7, 0, 0.15], head: [-0.6, 0, 0], shL: [-0.2, 0, 1.6], elL: [-0.1, 0, 0], shR: [-0.2, 0, -1.6], elR: [-0.1, 0, 0], hipL: [-0.1, 0, 0], knL: [0.5, 0, 0], hipR: [0.4, 0, 0], knR: [0.4, 0, 0] },
});

const WIND_LIGHT = [
  { w: 'L1w', s: 'L1', dur: 0.34, a0: 0.07, a1: 0.15, dmg: 10, post: 4, reach: 1.3, r: 1.15, lunge: 8, cancel: 0.18, slash: { tilt: 0.35, y: 1.25 }, trail: 'R', pitch: 1.1 },
  { w: 'L2w', s: 'L2', dur: 0.4, a0: 0.09, a1: 0.19, dmg: 12, post: 5, reach: 1.2, r: 1.45, lunge: 7, cancel: 0.21, slash: { tilt: -0.15, y: 0.95, flip: true }, trail: 'F', pitch: 0.95, spinY: true },
  { w: 'L3w', s: 'L3', dur: 0.44, a0: 0.11, a1: 0.19, dmg: 13, post: 6, reach: 1.5, r: 1.25, lunge: 8, cancel: 0.25, gust: true, trail: 'B', pitch: 1.2 },
  { w: 'L4w', s: 'L4', dur: 0.66, a0: 0.15, a1: 0.25, dmg: 24, post: 16, reach: 1.5, r: 1.6, lunge: 9, cancel: 0.44, big: true, slash: { tilt: 1.45, y: 1.4 }, trail: 'F', pitch: 0.8, finisher: true, clip: 'kick' },
];
const WIND_AIR = [
  { w: 'jump', s: 'A1', dur: 0.3, a0: 0.06, a1: 0.14, dmg: 10, post: 4, reach: 1.3, r: 1.35, lunge: 5, cancel: 0.17, slash: { tilt: 0.6, y: 1.0 }, trail: 'R', pitch: 1.15 },
  { w: 'jump', s: 'A2', dur: 0.32, a0: 0.07, a1: 0.15, dmg: 11, post: 4, reach: 1.3, r: 1.35, lunge: 5, cancel: 0.18, slash: { tilt: -0.6, y: 1.0, flip: true }, trail: 'L', pitch: 1.05 },
  { w: 'flip', s: 'A3', dur: 0.42, a0: 0.12, a1: 0.2, dmg: 16, post: 9, reach: 1.4, r: 1.55, lunge: 5, cancel: 0.3, big: true, slash: { tilt: 1.55, y: 1.0 }, trail: 'B', pitch: 0.85, flip: true, dive: true },
];

const MOVESETS = {
  wind: {
    light: WIND_LIGHT, air: WIND_AIR, heavy: 'lance', dash: 'sky', airDashes: 2,
    names: { heavy: 'GALE LANCE', dash: 'SKY STEP · two air dashes' },
  },
  // Soren: fast boxing strings that build HEAT, flame uppercut launcher
  fire: {
    light: [
      { w: 'jabW', s: 'jabL', dur: 0.24, a0: 0.05, a1: 0.11, dmg: 7, post: 3, reach: 1.25, r: 1.05, lunge: 8, cancel: 0.13, trail: 'L', pitch: 1.25, elem: 'spark' },
      { w: 'jabW', s: 'jabR', dur: 0.25, a0: 0.05, a1: 0.11, dmg: 7, post: 3, reach: 1.3, r: 1.05, lunge: 8, cancel: 0.13, trail: 'R', pitch: 1.2, elem: 'spark' },
      { w: 'hookW', s: 'hookR', dur: 0.3, a0: 0.07, a1: 0.14, dmg: 9, post: 4, reach: 1.3, r: 1.3, lunge: 7, cancel: 0.17, slash: { tilt: 0.2, y: 1.3 }, trail: 'R', pitch: 1.05, elem: 'flame' },
      { w: 'kneeW', s: 'knee', dur: 0.32, a0: 0.07, a1: 0.14, dmg: 10, post: 5, reach: 1.1, r: 1.2, lunge: 9, cancel: 0.18, trail: 'F', pitch: 1.0, elem: 'flame' },
      { w: 'upperW', s: 'upperF', dur: 0.6, a0: 0.13, a1: 0.22, dmg: 19, post: 14, reach: 1.3, r: 1.5, lunge: 8, cancel: 0.42, big: true, finisher: true, knock: 13, slash: { tilt: 1.5, y: 1.3 }, trail: 'R', pitch: 0.8, elem: 'pillar', rise: 6 },
    ],
    air: [
      { w: 'jump', s: 'A1', dur: 0.26, a0: 0.05, a1: 0.12, dmg: 8, post: 3, reach: 1.3, r: 1.3, lunge: 5, cancel: 0.14, trail: 'R', pitch: 1.2, elem: 'spark' },
      { w: 'jump', s: 'A2', dur: 0.26, a0: 0.05, a1: 0.12, dmg: 8, post: 3, reach: 1.3, r: 1.3, lunge: 5, cancel: 0.14, trail: 'L', pitch: 1.15, elem: 'spark' },
      { w: 'axeW', s: 'axe', dur: 0.46, a0: 0.13, a1: 0.22, dmg: 17, post: 10, reach: 1.3, r: 1.6, lunge: 5, cancel: 0.32, big: true, knock: 4, spike: true, slash: { tilt: 1.57, y: 0.9 }, trail: 'F', pitch: 0.85, elem: 'flame', dive: true },
    ],
    heavy: 'flare', dash: 'flame', airDashes: 1,
    names: { heavy: 'FLARE BURST · three fire bolts', dash: 'FLAME STEP · dashes leave burning ground' },
  },
  // Brannoc: three slow, armored, crushing blows
  earth: {
    light: [
      { w: 'hammerW', s: 'hammer', dur: 0.5, a0: 0.16, a1: 0.24, dmg: 14, post: 9, reach: 1.45, r: 1.4, lunge: 6, cancel: 0.3, armor: true, trail: 'B', pitch: 0.75, elem: 'rock', big: true },
      { w: 'shoulderW', s: 'shoulder', dur: 0.52, a0: 0.14, a1: 0.26, dmg: 15, post: 10, reach: 1.2, r: 1.5, lunge: 13, cancel: 0.32, armor: true, knock: 7, trail: 'B', pitch: 0.7, elem: 'rock', big: true },
      { w: 'quakeW', s: 'quake', dur: 0.82, a0: 0.24, a1: 0.32, dmg: 25, post: 22, reach: 1.4, r: 1.6, lunge: 5, cancel: 0.56, armor: true, big: true, finisher: true, knock: 12, aoe: 3.6, trail: 'B', pitch: 0.6, elem: 'quake' },
    ],
    air: [
      { w: 'hammerW', s: 'hammer', dur: 0.5, a0: 0.15, a1: 0.24, dmg: 18, post: 12, reach: 1.4, r: 1.6, lunge: 5, cancel: 0.34, armor: true, big: true, knock: 4, spike: true, trail: 'B', pitch: 0.7, elem: 'rock', dive: true },
    ],
    heavy: 'boulder', dash: 'charge', airDashes: 1,
    names: { heavy: 'BOULDER TOSS', dash: 'STONE RUSH · armored shoulder charge' },
  },
  // Ysra: long-reach water whips, a spinning wheel, and an undertow that drags them in
  water: {
    light: [
      { w: 'whipW', s: 'whipR', dur: 0.34, a0: 0.08, a1: 0.16, dmg: 10, post: 4, reach: 2.3, r: 1.2, lunge: 5, cancel: 0.19, slash: { tilt: 0.1, y: 1.25 }, trail: 'R', pitch: 1.1, elem: 'splash' },
      { w: 'whipR', s: 'whipL', dur: 0.36, a0: 0.08, a1: 0.17, dmg: 11, post: 4, reach: 2.3, r: 1.2, lunge: 5, cancel: 0.2, slash: { tilt: -0.1, y: 1.15, flip: true }, trail: 'L', pitch: 1.05, elem: 'splash' },
      { w: 'wheel', s: 'wheel', dur: 0.46, a0: 0.1, a1: 0.26, dmg: 12, post: 5, reach: 0.2, r: 0.4, lunge: 4, cancel: 0.28, aoe: 2.6, spinY: true, spinTurns: 1, trail: 'B', pitch: 1.0, elem: 'ring' },
      { w: 'pullW', s: 'pull', dur: 0.62, a0: 0.14, a1: 0.24, dmg: 18, post: 12, reach: 2.6, r: 1.5, lunge: 3, cancel: 0.42, big: true, finisher: true, pull: 7, slash: { tilt: 1.4, y: 1.2 }, trail: 'B', pitch: 0.85, elem: 'surge' },
    ],
    air: [
      { w: 'jump', s: 'whipR', dur: 0.32, a0: 0.07, a1: 0.15, dmg: 9, post: 4, reach: 2.1, r: 1.3, lunge: 4, cancel: 0.17, trail: 'R', pitch: 1.1, elem: 'splash' },
      { w: 'jump', s: 'wheel', dur: 0.44, a0: 0.09, a1: 0.24, dmg: 13, post: 7, reach: 0.2, r: 0.4, lunge: 4, cancel: 0.28, aoe: 2.4, spinY: true, spinTurns: 1.5, big: true, trail: 'B', pitch: 0.95, elem: 'ring' },
    ],
    heavy: 'jet', dash: 'glide', airDashes: 1,
    names: { heavy: 'TIDE JET · piercing water beam', dash: 'TIDE GLIDE · long slide with longer dodge' },
  },
};
const moveset = id => MOVESETS[id] || MOVESETS.wind;

/* element flavour on each strike */
function elemStrike(p, m, c, fwd) {
  const id = Hero.id;
  switch (m.elem) {
    case 'spark': FX.burst(c, 10, { speed: 8, dir: fwd, spread: 0.6, life: 0.25, s0: 0.22, c0: C.white, c1: C.wind }); break;
    case 'flame': FX.burst(c, 18, { speed: 9, dir: fwd, spread: 0.7, life: 0.35, s0: 0.35, c0: C.white, c1: C.wind, up: 2 }); FX.burst(c, 6, { speed: 2, life: 0.6, s0: 0.5, s1: 1.2, c0: C.windDeep, c1: C.windFade, add: false, alpha: 0.35, up: 2 }); break;
    case 'pillar': {
      const g = p.pos.clone().addScaledVector(fwd, 1.2).setY(0.05);
      FX.groundRing(g, 3, HC.aura, 0.35); FX.burst(g.clone().setY(0.4), 40, { speed: 4, life: 0.6, s0: 0.5, c0: C.white, c1: C.wind, up: 14 });
      FX.shockwave(c, 0.5, 1.2); break;
    }
    case 'rock': FX.burst(c, 14, { speed: 7, dir: fwd, spread: 0.8, life: 0.45, s0: 0.35, s1: 0.8, c0: C.dust, c1: C.dust, add: false, alpha: 0.6, grav: 14 }); break;
    case 'quake': {
      const g = p.pos.clone().addScaledVector(fwd, 1.0).setY(0.05);
      World.crater(g, 4.5, false); World.spawnDebris(g, 5, 1.4, 'floor');
      FX.groundRing(g, 7, HC.aura, 0.5); FX.shockwave(g.clone().setY(0.6), 0.7, 1.8, 0.5); FX.shake(0.6); Sfx.boom(0.9);
      Sfx.P('sfx_stone_spike', 0.8); break;
    }
    case 'splash': FX.burst(c, 16, { speed: 9, dir: fwd, spread: 0.9, life: 0.4, s0: 0.3, c0: C.white, c1: C.windDeep, grav: 16 }); break;
    case 'ring': FX.groundRing(p.pos.clone().setY(0.1), (m.aoe || 2.5) + 0.6, HC.main, 0.35); FX.burst(p.chest(), 30, { speed: 10, flat: true, life: 0.4, s0: 0.3, c0: C.white, c1: C.windDeep }); break;
    case 'surge': FX.burst(c, 30, { speed: 12, dir: fwd.clone().negate(), spread: 0.5, life: 0.45, s0: 0.4, c0: C.white, c1: C.windDeep }); FX.ringBill(c, 3, HC.main, 0.3); break;
  }
}

/* ---------------- heavy releases ---------------- */
function heavyRelease(p, pw) {
  const fwd = p.fwd(), kind = moveset(Hero.id).heavy;
  const sp = p.pos.clone().addScaledVector(fwd, 1.1); sp.y += 1.15;
  const aim = speed => {
    let v = fwd.clone().multiplyScalar(speed);
    if (G.boss.alive && (G.lockOn || horizDist(p.pos, G.boss.pos) < 14)) { const bc = G.boss.chest(new V3()); bc.y = Math.min(bc.y, 1.6); v = bc.sub(sp).normalize().multiplyScalar(speed); }
    return v;
  };
  if (kind === 'flare') {
    const base = aim(24 + pw * 6), n = pw > 0.6 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 0.16;
      const v = base.clone().applyAxisAngle(new V3(0, 1, 0), a);
      G.proj.push(new Projectile({ pos: sp.clone(), vel: v, r: 0.55 + pw * 0.2, owner: 'player', dmg: Math.round(7 + pw * 5), post: 4, life: 0.9, kind: 'firebolt' }));
    }
    FX.burst(sp, 30, { speed: 12, dir: fwd, spread: 0.6, life: 0.4, s0: 0.4, c0: C.white, c1: C.wind });
    Sfx.el('projectile', 0.9) || Sfx.fireball();
    return 4 + pw * 3;
  }
  if (kind === 'boulder') {
    const v = aim(15 + pw * 6);
    G.proj.push(new Projectile({ pos: sp.clone().add(new V3(0, 0.6, 0)), vel: v, r: 1.0 + pw * 0.5, owner: 'player', dmg: Math.round(16 + pw * 14), post: 14 + pw * 10, life: 1.4, kind: 'boulder', knock: 10, big: true }));
    World.spawnDebris(p.pos.clone().addScaledVector(fwd, 0.8), 4, 0.6, 'floor');
    FX.shake(0.4 + pw * 0.3); Sfx.el('projectile', 1) || Sfx.boom(0.6);
    return 2 + pw * 2;
  }
  if (kind === 'jet') {
    const v = aim(34 + pw * 8);
    G.proj.push(new Projectile({ pos: sp, vel: v, r: 0.6 + pw * 0.5, owner: 'player', dmg: Math.round(4 + pw * 3), post: 3, life: 0.7 + pw * 0.2, kind: 'jet', hits: 4 + Math.round(pw * 4), tick: 0.06 }));
    FX.burst(sp, 26, { speed: 14, dir: fwd, spread: 0.4, life: 0.4, s0: 0.35, c0: C.white, c1: C.windDeep });
    Sfx.el('projectile', 0.9);
    return 6 + pw * 6;
  }
  // wind: gale lance
  const v = aim(19 + pw * 6);
  G.proj.push(new Projectile({ pos: sp, vel: v, r: 0.9 + pw * 0.9, owner: 'player', dmg: Math.round(5 + pw * 4), post: 3 + pw * 3, life: 0.9 + pw * 0.3, kind: 'lance', hits: 4 + Math.round(pw * 5), tick: 0.08 }));
  FX.burst(sp, 30, { speed: 14, dir: fwd, spread: 0.5, life: 0.4, s0: 0.4, c0: C.white, c1: C.wind });
  return 5 + pw * 6;
}

/* ---------------- movement options ---------------- */
// fire: burning footprints from a dash that scorch whoever crosses them
const FlameTrail = {
  spots: [],
  drop(pos) {
    const s = { pos: pos.clone().setY(0.05), t: 1.6, tick: 0 };
    this.spots.push(s);
    if (Math.random() < 0.35) FX.groundRing(s.pos, 1.3, 0xff7a20, 0.5, 0.6);
    FX.burst(s.pos.clone().setY(0.3), 6, { speed: 2, life: 0.6, s0: 0.4, c0: C.white, c1: C.wind, up: 4 });
    if (this.spots.length > 24) this.spots.shift();
  },
  update(dt) {
    const b = G.boss;
    for (let i = this.spots.length - 1; i >= 0; i--) {
      const s = this.spots[i]; s.t -= dt; s.tick -= dt;
      if (s.t <= 0) { this.spots.splice(i, 1); continue; }
      if (Math.random() < dt * 10) FX.add_.spawn(s.pos.x + rand(-0.4, 0.4), 0.2, s.pos.z + rand(-0.4, 0.4), rand(-0.3, 0.3), rand(2, 4), rand(-0.3, 0.3), 0.5, 0.35, 0.05, C.wind, C.windDeep, 1, 0, 1);
      if (s.tick <= 0 && b.alive && horizDist(b.pos, s.pos) < b.radius + 0.9 && b.pos.y < 1.5) {
        s.tick = 0.4;
        const res = b.takeDamage(3, 1, b.chest(new V3()), new V3(0, 1, 0), { noFlinch: true, src: 'burn' });
        if (res) FX.dmgNumber(b.chest(new V3()).add(new V3(0, 0.8, 0)), res.dmg, 'burn');
      }
    }
  },
  reset() { this.spots.length = 0; },
};

/* ---------------- block / parry / guard break ---------------- */
const GUARD_MAX = 100, PARRY_WIN = 0.2;
const Guard = {
  // returns '' when the hit should go through normally
  check(p, dmg, dir, kind, src) {
    if (p.state !== 'block') return '';
    // only blocks what comes from the front
    const f = p.fwd();
    if (f.x * -dir.x + f.z * -dir.z < -0.2) return '';
    if (p.st < PARRY_WIN && !p.parryUsed) return this.parry(p, dir, src);
    const heavy = kind === 'heavy' || kind === 'launch';
    p.guard -= dmg * (heavy ? 2.2 : 1.3) * (src === 'pvp' ? 3 : 1);
    p.guardRegenT = 1.2;
    const chip = Math.max(1, Math.round(dmg * 0.15));
    p.hp -= chip; FX.dmgNumber(p.chest(), chip, 'hurt', 'BLOCK');
    const c = p.chest().addScaledVector(f, 0.6);
    FX.star(c, 2.2, 0xffffff, 0.12); FX.burst(c, 12, { speed: 7, dir: f, spread: 0.8, life: 0.25, s0: 0.25, c0: C.white, c1: C.wind });
    Sfx.P('sfx_deflect', 0.7) || Sfx.hit(0.8); FX.shake(0.15); hitstop(0.04);
    p.vel.x = dir.x * (heavy ? 7 : 4); p.vel.z = dir.z * (heavy ? 7 : 4);
    p.st = Math.max(p.st, PARRY_WIN); p.blockStunT = heavy ? 0.28 : 0.16;
    if (p.hp <= 0) { p.hp = 1; }
    if (p.guard <= 0) this.breakGuard(p);
    return 'blocked';
  },
  parry(p, dir, src) {
    p.parryUsed = true;
    p.state = 'parry'; p.st = 0;
    p.counterT = 0.9; p.gainFlow(14);
    p.guard = Math.min(GUARD_MAX, p.guard + 20);
    const c = p.chest().addScaledVector(p.fwd(), 0.7);
    Sfx.P('sfx_counter', 1) || Sfx.ting(2400); Sfx.clash && Sfx.P('sfx_clash', 0.5);
    FX.star(c, 4.5, 0xffffff, 0.25); FX.impactLines(c, 20, 0xffffff, 4.5, 0.25); FX.shockwave(c, 0.4, 1.1); FX.ringBill(c, 3.5, HC.pale, 0.25);
    FX.popup(c.clone().add(new V3(0, 0.8, 0)), 'PARRY!', 'break', Render.camera);
    Render.post.flash = 0.25; Render.post.aberr = 1.2; FX.shake(0.4); hitstop(0.1); slowmo(0.3, 0.35);
    G.stats.parries = (G.stats.parries || 0) + 1;
    // the attacker is thrown off balance
    if (src !== 'pvp') {
      const b = G.boss;
      if (b.alive && b.cancelAttack && b.state === 'attack' && b.atk && !['nova', 'beam'].includes(b.atk.name)) { b.cancelAttack(); b.state = 'flinch'; b.st = -0.55; }
      if (b.alive) { b.posture = Math.min(b.maxPosture - 1, b.posture + 22); b.postureDelay = 2; }
    }
    return 'parried';
  },
  breakGuard(p) {
    p.guard = 0; p.state = 'guardbreak'; p.st = 0; p.vel.set(0, p.vel.y, 0);
    const c = p.chest();
    FX.popup(c.clone().add(new V3(0, 1, 0)), 'GUARD BREAK', 'break', Render.camera);
    FX.burst(c, 40, { speed: 14, life: 0.5, s0: 0.4, c0: C.white, c1: C.wind }); FX.shockwave(c, 0.5, 1.4);
    Sfx.P('sfx_posture_break', 1) || Sfx.boom(0.8); FX.shake(0.5); Render.post.aberr = 1.5;
    if (Duel.active) Duel.send({ t: 'gb' });
  },
  update(p, dt) {
    if (p.state !== 'block') { p.guardRegenT = Math.max(0, (p.guardRegenT || 0) - dt); if (p.guardRegenT <= 0) p.guard = Math.min(GUARD_MAX, p.guard + dt * 22); }
    p.blockCd = Math.max(0, (p.blockCd || 0) - dt);
  },
};
