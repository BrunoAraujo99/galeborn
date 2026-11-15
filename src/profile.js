'use strict';
/* ============================================================
   Profile screen: rating, season, mastery, cosmetics, history.
   ============================================================ */
const Profile = {
  hero: null,
  init() {
    $('profBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); Sfx.ui(); this.open(); });
    $('profile').addEventListener('click', e => {
      const t = e.target.closest('[data-act]'); if (!t) { if (e.target.id === 'profile') this.close(); return; }
      e.stopPropagation(); Sfx.ui();
      const a = t.dataset.act, v = +t.dataset.v;
      if (a === 'close') return this.close();
      if (a === 'hero') { this.hero = t.dataset.v; return this.render(); }
      const h = this.hero, s = Progress.sel(h);
      if (t.classList.contains('locked')) return;
      if (a === 'skin') s.skin = v; if (a === 'title') s.title = v; if (a === 'fin') { s.fin = v; if (v >= 0) FinisherFX.play(FINISHERS[v].id, G.player.chest().add(new V3(0, 0.5, -2))); }
      Progress.save(); if (h === Hero.id) Progress.applyLocal();
      this.render();
    });
  },
  async open() {
    this.hero = this.hero || Hero.id;
    $('profile').classList.add('show');
    this.render();
    try {
      const me = await Api.ensure(); Progress.merge(me.progress);
      this.hist = await Api.rpc('gb_history', { p_token: Api.token, p_limit: 15 });
    } catch (e) { this.err = e.message; }
    this.render();
  },
  close() { $('profile').classList.remove('show'); },
  render() {
    const me = Api.me, P = Progress, d = P.load(), h = this.hero;
    const local = HERO_ORDER.map(id => ({ id, g: d.games[id] || { p: 0, w: 0 } }));
    const online = (this.hist && this.hist.heroes) || {};
    const playedOf = id => (local.find(x => x.id === id).g.p) + ((online[id] || {}).played || 0);
    const fav = HERO_ORDER.slice().sort((a, b) => playedOf(b) - playedOf(a))[0];
    const days = me && me.season ? Math.max(0, Math.ceil((new Date(me.season.ends) - Date.now()) / 864e5)) : null;
    const head = me ? `<div class="phead"><b>${esc(me.name)}</b>${P.titleOf(Hero.id) ? `<em>${P.titleOf(Hero.id)}</em>` : ''}
        <div>${tierTag(me.rating)} · ${me.rating}${me.best && me.best > me.rating ? ` (best ${me.best})` : ''} · #${me.rank} · ${me.wins}W ${me.losses}L${me.wins + me.losses ? ` · ${Math.round(me.wins / (me.wins + me.losses) * 100)}%` : ''}</div>
        ${me.season ? `<small>${me.season.name} · ends in ${days} day${days === 1 ? '' : 's'} · ratings soften halfway back to 1000 at season end</small>` : ''}</div>`
      : `<div class="phead"><b>PROFILE</b><small>${this.err ? 'Offline: showing progress saved on this device.' : 'Connecting…'}</small></div>`;
    const cards = HERO_ORDER.map(id => {
      const lv = P.level(id), x = P.xp(id), lo = LV_XP[lv], hi = LV_XP[Math.min(MAX_LV, lv + 1)], k = lv >= MAX_LV ? 1 : (x - lo) / (hi - lo);
      const g = local.find(q => q.id === id).g, o = online[id] || { played: 0, won: 0 };
      const pl = g.p + (o.played || 0), wn = g.w + (o.won || 0);
      return `<button class="mcard ${id === h ? 'on' : ''}" data-act="hero" data-v="${id}"><svg viewBox="0 0 60 60">${heroGlyph(id)}</svg><b>${HEROES[id].name}</b><span>LV ${lv}${id === fav && pl ? ' · ★' : ''}</span><i style="--k:${(k * 100).toFixed(0)}%"></i><small>${pl ? `${pl} fights · ${Math.round(wn / pl * 100)}% won` : 'not played yet'}</small></button>`;
    }).join('');
    const lv = P.level(h), s = P.sel(h), nx = P.nextUnlock(h);
    const chip = (act, v, label, need, on) => `<button class="chip ${on ? 'on' : ''} ${lv < need ? 'locked' : ''}" data-act="${act}" data-v="${v}">${label}${lv < need ? `<small>LV ${need}</small>` : ''}</button>`;
    const cos = `<div class="cos"><div class="crow"><span>COLOURS</span>${SKINS.map((k, i) => chip('skin', i, `<i class="sw" style="background:#${(k.main || HEROES[h].pal.main).toString(16).padStart(6, '0')}"></i>${k.n}`, k.lv, s.skin === i)).join('')}</div>
      <div class="crow"><span>TITLE</span>${chip('title', -1, HEROES[h].title, 1, s.title < 0)}${TITLES[h].map((t, i) => chip('title', i, t, TITLE_LV[i], s.title === i)).join('')}</div>
      <div class="crow"><span>FINISHER</span>${chip('fin', -1, 'NONE', 1, s.fin < 0)}${FINISHERS.map((f, i) => chip('fin', i, f.n, f.lv, s.fin === i)).join('')}</div>
      <small class="nx">${nx ? `Next at LV ${nx.lv}: ${nx.what}` : 'Mastery complete.'} Earn XP in any fight; perfects, highlights and punishes add a bonus.</small></div>`;
    const H = this.hist && this.hist.history || [];
    const hist = `<h3>RECENT ONLINE DUELS</h3>` + (H.length ? `<table class="hist">${H.map(m => `<tr class="${m.won ? 'w' : 'l'}"><td>${m.won ? 'WIN' : 'LOSS'}</td><td>${HEROES[m.hero] ? HEROES[m.hero].name : '?'} vs ${HEROES[m.opp_hero] ? HEROES[m.opp_hero].name : '?'}</td><td>${esc(m.opp || '?')}</td><td>${m.kind === 'ranked' ? (m.won ? '+' : '−') + (m.delta || 0) : 'friendly'}</td></tr>`).join('')}</table>` : `<p class="dim">No online duels yet.</p>`);
    $('profBody').innerHTML = head + `<div class="mgrid">${cards}</div>` + cos + hist;
  },
};
