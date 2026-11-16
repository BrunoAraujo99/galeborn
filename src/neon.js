/* ---------------- Neon Sakuga UI: portraits, Japanese names, title key art ---------------- */
const NEON = {
  jp: { wind: 'タビ', fire: 'ソレン', earth: 'ブラノック', water: 'イスラ', boss: 'ヴァルク' },
  kanji: { wind: '風', fire: '炎', earth: '土', water: '水' },
  jpTitle: { wind: '風の舞手', fire: '炎拳', earth: '大地', water: '潮流' },
  grad: { wind: ['#27e0c8', '#7a3dff'], fire: ['#ff5a2a', '#ff3d9a'], earth: ['#8ad040', '#7a3dff'], water: ['#3a90ff', '#3df2ff'], boss: ['#ff5a2a', '#7a0a05'] },
  face(id, flip) { const src = typeof ART !== 'undefined' && ART.face[id]; return src ? `<img src="${src}" alt=""${flip ? ' class="flip"' : ''}>` : ''; },
  init() {
    // player plate: diamond face + jp name; burst + ultimate label move to a bottom-left chip row
    const por = document.querySelector('#pbars .portrait');
    if (por && !$('nfaceMe')) por.insertAdjacentHTML('afterbegin', '<div class="nface" id="nfaceMe"></div>');
    const hud = $('hud');
    if (!$('nbot')) { hud.insertAdjacentHTML('beforeend', '<div id="nbot"></div>'); $('nbot').append($('pburst'), $('flowlabel')); }
    const em = document.querySelector('#bossbar .bb-emblem');
    if (em && !$('nfaceOp')) em.insertAdjacentHTML('afterbegin', '<div class="nface" id="nfaceOp"></div>');
    if (!document.querySelector('#bossbar .bj')) document.querySelector('#bossbar .bn').insertAdjacentHTML('afterend', '<em class="bj">ヴァルク</em>');
    if (!document.querySelector('#combo .cj')) $('combo').insertAdjacentHTML('beforeend', '<div class="cj">連撃</div>');
    // VS card faces
    const vh = $('vsH'), vb = document.querySelector('#vsCard .side.b');
    vh.insertAdjacentHTML('beforebegin', '<div class="vface h" id="vsFh"></div>'); vb.insertAdjacentHTML('afterend', '<div class="vface b" id="vsFb"></div>');
    this.setMe(); this.setOpp(null);
  },
  setMe() {
    const id = (typeof Hero !== 'undefined' && Hero.id) || 'wind', d = HEROES[id], g = this.grad[id];
    const f = $('nfaceMe'); if (f) { f.innerHTML = this.face(id); f.style.setProperty('--g1', g[0]); f.style.setProperty('--g2', g[1]); }
    const pn = $('pname'); if (pn && !pn.querySelector('em')) pn.insertAdjacentHTML('beforeend', `<em>${this.jp[id]}</em>`);
    const th = $('tHero'); if (th && typeof ART !== 'undefined') th.src = ART.body[id];
    if ($('tKanji')) $('tKanji').textContent = this.kanji[id];
    if ($('tEpJ')) { $('tEpJ').textContent = this.jpTitle[id]; $('tEp').textContent = `${d.name} · THE ${d.title}`; }
    const vf = $('vsFh'); if (vf) vf.innerHTML = this.face(id);
    document.body.style.setProperty('--me1', g[0]); document.body.style.setProperty('--me2', g[1]);
  },
  // id = opponent hero id in duels, null for Varukh (solo / training)
  setOpp(id) {
    const g = this.grad[id || 'boss'], f = $('nfaceOp');
    if (f) { f.innerHTML = id ? this.face(id, true) : ''; f.style.setProperty('--g1', g[0]); f.style.setProperty('--g2', g[1]); }
    $('bossbar').classList.toggle('hasface', !!id);
    const bj = document.querySelector('#bossbar .bj'); if (bj) bj.textContent = this.jp[id || 'boss'];
    const vf = $('vsFb'); if (vf) vf.innerHTML = id ? this.face(id, true) : '';
    document.body.style.setProperty('--op1', g[0]); document.body.style.setProperty('--op2', g[1]);
  },
};
