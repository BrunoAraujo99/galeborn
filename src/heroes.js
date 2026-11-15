'use strict';
/* ============================================================
   Heroes: four elemental fighters. Each brings its own model,
   colour palette (every hero effect reads HC), ultimate and
   one signature mechanic. Varukh is the boss for all of them.
   ============================================================ */
const HC = {}; // current hero palette (hex), filled by Hero.apply
const HEROES = {
  wind: {
    id: 'wind', name: 'TAVI', title: 'WIND DANCER', glb: 'wind', cloth: true,
    css: '#2fd6c8', css2: '#9ffcff',
    pal: { pale: 0xbfffff, main: 0x9ffcff, glow: 0xe8ffff, mid: 0x4ad8ff, teal: 0x2fd6c8, aura: 0x5ff0e4, deep: 0x0a4a9a, deep2: 0x062a70, bgA: 0x0b2a3a, beamCore: 0xb0ffff, beamEdge: 0x1080b0, rim: 0x9ffcff },
    C: { wind: [0.55, 1.0, 0.95], windDeep: [0.2, 0.7, 1.0], windFade: [0.05, 0.25, 0.4] },
    ult: { name: 'TEMPEST ASCENSION', sub: 'HOLLOW SKY ARTS · FINAL FORM', tag: 'TEMPEST' },
    lines: { ult: ['Winds, answer me!', 'Ride the storm with me!', 'This is the sky\'s answer!'], intro: ['Then I\'ll be a hurricane.', 'The sky belongs to no one. Least of all you.'], low: 'Not yet... not like this!', awaken: '...I hear it now. The whole sky is with me.', win: 'The sky... is free again.' },
    stats: { hp: 100, speed: 1, dmg: 1 },
    blurb: 'Fast, airborne, relentless. Chains pursuits and pillar vaults.',
    sig: 'SKY STEP · aerial dodges and double air-dash',
  },
  fire: {
    id: 'fire', name: 'SOREN', title: 'SUNFIRE FIST', glb: 'fire',
    css: '#ffb020', css2: '#ffe08a',
    pal: { pale: 0xfff0b0, main: 0xffd060, glow: 0xfff8d8, mid: 0xffa020, teal: 0xff9000, aura: 0xffc040, deep: 0x9a3a00, deep2: 0x5a1800, bgA: 0x3a1806, beamCore: 0xfff2b0, beamEdge: 0xc06000, rim: 0xffd080 },
    C: { wind: [1.0, 0.82, 0.35], windDeep: [1.0, 0.5, 0.08], windFade: [0.35, 0.12, 0.02] },
    ult: { name: 'SOLAR DRAGON', sub: 'SUNFORGE ARTS · NOON ETERNAL', tag: 'SOLAR' },
    lines: { ult: ['Burn brighter than you!', 'Feel the noon sun!', 'This is real fire!'], intro: ['Your flame is ash next to mine.', 'I was born in brighter fire than yours.'], low: 'Still... burning...!', awaken: 'The sun never sets on me.', win: 'Your fire was only smoke.' },
    taunt: ['Another fire-child? I am the pyre itself.', 'Your little sun will gutter out.', 'Burn for me, then.'],
    stats: { hp: 95, speed: 1, dmg: 1.08 },
    blurb: 'Aggressive striker. Every hit stacks HEAT; finishers detonate it.',
    sig: 'HEAT · hits stack burn, finishers IGNITE for burst damage',
  },
  earth: {
    id: 'earth', name: 'BRANNOC', title: 'STONEWALL', glb: 'earth',
    css: '#8ad040', css2: '#e8d098',
    pal: { pale: 0xe8f0b0, main: 0xc0e070, glow: 0xf8ffd8, mid: 0x7ac040, teal: 0x5aa030, aura: 0x9ae060, deep: 0x4a5a10, deep2: 0x283008, bgA: 0x1c2208, beamCore: 0xf0ffb0, beamEdge: 0x507010, rim: 0xd8e890 },
    C: { wind: [0.9, 0.82, 0.55], windDeep: [0.45, 0.78, 0.25], windFade: [0.2, 0.18, 0.08] },
    ult: { name: 'TITAN\'S SPIRES', sub: 'DEEP ROOT ARTS · MOUNTAIN WAKES', tag: 'TITAN' },
    lines: { ult: ['Mountains, rise!', 'The earth remembers!', 'Stand on this, if you can!'], intro: ['Mountains don\'t burn.', 'I have stood longer than your fire has lived.'], low: 'Stone... doesn\'t break...', awaken: 'I am the mountain now.', win: 'Rooted. Unbroken.' },
    taunt: ['Stone melts, little mountain.', 'I will glass this rock.', 'Even mountains bleed magma.'],
    stats: { hp: 115, speed: 0.9, dmg: 1.15 },
    blurb: 'Heavy and unstoppable. Armored big hits, slams raise stone spikes.',
    sig: 'STONESKIN · big attacks have super armor, slams erupt spikes',
  },
  water: {
    id: 'water', name: 'YSRA', title: 'TIDECALLER', glb: 'water',
    css: '#3a90ff', css2: '#a8d8ff',
    pal: { pale: 0xc8ecff, main: 0x88ccff, glow: 0xe8f6ff, mid: 0x3a90ff, teal: 0x2a78e8, aura: 0x58a8ff, deep: 0x0a2a8a, deep2: 0x041660, bgA: 0x081838, beamCore: 0xd0f0ff, beamEdge: 0x1050c0, rim: 0xa0d8ff },
    C: { wind: [0.55, 0.8, 1.0], windDeep: [0.15, 0.45, 1.0], windFade: [0.03, 0.1, 0.35] },
    ult: { name: 'TIDAL CATACLYSM', sub: 'MOONTIDE ARTS · THE DEEP RISES', tag: 'TIDAL' },
    lines: { ult: ['Drown, Warden!', 'The tide answers me!', 'Even fire fears the deep!'], intro: ['Water always wins. Patience.', 'Every fire meets its tide.'], low: 'Flow... keep flowing...', awaken: 'The whole ocean moves with me.', win: 'The tide returns. The fire doesn\'t.' },
    taunt: ['Water boils, little tide.', 'I will steam you from this sky.', 'Your tide breaks on my shore of ash.'],
    stats: { hp: 100, speed: 1.05, dmg: 1 },
    blurb: 'Fluid and sustaining. Hits heal you; dodges leave healing pools.',
    sig: 'UNDERTOW · hits heal you, perfect dodges restore more',
  },
};
const HERO_ORDER = ['wind', 'fire', 'earth', 'water'];
const HERO_B64 = () => ({ wind: typeof HERO_WIND_B64 !== 'undefined' ? HERO_WIND_B64 : '', fire: typeof HERO_FIRE_B64 !== 'undefined' ? HERO_FIRE_B64 : '', earth: typeof HERO_EARTH_B64 !== 'undefined' ? HERO_EARTH_B64 : '', water: typeof HERO_WATER_B64 !== 'undefined' ? HERO_WATER_B64 : '' });

const Hero = {
  id: 'wind', def: HEROES.wind,
  apply(id) {
    const d = HEROES[id] || HEROES.wind;
    this.id = d.id; this.def = d;
    Object.assign(HC, d.pal);
    for (const k in d.C) C[k].setRGB(...d.C[k]);
    document.documentElement.style.setProperty('--wind', d.css);
    document.documentElement.style.setProperty('--hero2', d.css2);
    document.body.dataset.hero = d.id;
  },
  is(id) { return this.id === id; },
};
Hero.apply('wind');

/* element glyphs for the HUD portrait, the opponent's emblem and the select cards (viewBox 0 0 60 60) */
function heroGlyph(id) {
  const d = HEROES[id] || HEROES.wind, a = d.css, b = d.css2;
  const bg = `<circle cx="30" cy="30" r="24" fill="#10141f" stroke="${a}" stroke-opacity=".35" stroke-width="2"/>`;
  switch (id) {
    case 'fire': return bg + `<path d="M30 10 C40 22 43 30 38 40 C36 34 33 33 31 29 C29 35 23 37 25 45 C18 39 19 26 30 10 Z" fill="${a}"/><path d="M30 31 C34 36 34 40 30 47 C26 40 26 36 30 31 Z" fill="${b}"/>`;
    case 'earth': return bg + `<path d="M12 42 L22 22 L29 31 L36 16 L48 42 Z" fill="${a}"/><path d="M22 22 L26 42 M36 16 L33 42" stroke="#10141f" stroke-width="2.5"/><path d="M10 45 H50" stroke="${b}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'water': return bg + `<path d="M30 10 C38 22 42 28 42 34 A12 12 0 0 1 18 34 C18 28 22 22 30 10 Z" fill="${a}"/><path d="M22 36 C26 41 33 41 37 37" fill="none" stroke="${b}" stroke-width="3" stroke-linecap="round"/>`;
    default: return bg + `<path d="M14 34 C14 20 30 14 40 20 C46 24 44 33 36 33 C30 33 29 26 34 25" fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/><path d="M18 42 C26 46 40 44 46 36" fill="none" stroke="${b}" stroke-width="3" stroke-linecap="round"/>`;
  }
}
