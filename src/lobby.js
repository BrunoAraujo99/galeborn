'use strict';
/* ============================================================
   Online lobby: ranked matchmaking, friend rooms (code + link),
   player name, leaderboard.
   ============================================================ */
const Lobby = {
  mode: null, busy: false, pollT: null, pendingRoom: null,
  init() {
    try { const q = new URLSearchParams(location.search).get('room'); if (q) this.pendingRoom = q.toUpperCase().slice(0, 5); } catch (e) {}
    $('lbClose').addEventListener('click', () => this.close());
    $('lbBody').addEventListener('click', e => { const b = e.target.closest('[data-bot]'); if (!b) return; Sfx.ui(); if (this.mode === 'ranked') Api.queueLeave(); this.mode = null; clearTimeout(this.pollT); startBotMatch(b.dataset.bot); });
    $('lbName').addEventListener('change', e => this.saveName(e.target.value));
    $('boardClose').addEventListener('click', () => $('board').classList.remove('show'));
    $('lbBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); this.board(); });
    $('friendBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); Select.open('friend'); });
    $('botBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); Select.open('bot'); });
    $('soloBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); Select.open('solo'); });
    $('trainBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); Select.open('training'); });
    $('ctrlBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.ui(); $('help').classList.toggle('show'); });
    $('dlBtn').addEventListener('click', e => e.stopPropagation());
    try { if (!localStorage.getItem('galeborn.trained')) $('trainBtn').classList.add('new'); } catch (e) {}
    if (typeof ASSET_WEB === 'undefined' || !ASSET_WEB) document.body.classList.add('offline');
  },
  set(html) { $('lbBody').innerHTML = html; },
  status(t, err) { $('lbStatus').textContent = t; $('lbStatus').classList.toggle('err', !!err); },
  async open(mode) {
    this.mode = mode;
    $('lobby').classList.add('show');
    $('lbTitle').textContent = mode === 'ranked' ? 'RANKED DUEL' : mode === 'bot' ? 'DUEL A BOT' : 'DUEL A FRIEND';
    this.set('');
    $('lbName').parentElement.style.display = mode === 'bot' ? 'none' : '';
    if (mode === 'bot') return this.botMenu();
    BotHost.ensure(); // warm the bot up in the background so a fallback match starts instantly
    this.status('Connecting…');
    try {
      const me = await Api.ensure(this.defaultName());
      $('lbName').value = me.name;
      $('lbMe').innerHTML = `${tierTag(me.rating)} · Rating ${me.rating} · #${me.rank} · ${me.wins}W ${me.losses}L`;
    } catch (e) { this.status('Can\'t reach the Galeborn server. You can still fight a bot offline.', true); return this.set(this.botButtons()); }
    if (mode === 'ranked') return this.search();
    if (this.pendingRoom) { const c = this.pendingRoom; this.pendingRoom = null; return this.join(c); }
    this.status('Create a room and send the code or link to a friend, or join theirs.');
    this.set(`<button class="btn" id="lbCreate">CREATE ROOM</button>
      <div class="lbJoin"><input id="lbCode" maxlength="5" placeholder="CODE" autocomplete="off"><button class="btn small" id="lbJoinBtn">JOIN</button></div>
      <p class="lbOr">No one to play? Practice against a bot:</p>${this.botButtons()}`);
    $('lbCreate').onclick = () => this.create();
    $('lbJoinBtn').onclick = () => this.join($('lbCode').value);
    $('lbCode').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') this.join($('lbCode').value); };
  },
  botButtons() {
    return `<div class="lbBots">${['easy', 'normal', 'hard'].map(d => `<button class="btn small" data-bot="${d}">${BOT_DIFF[d].name} BOT</button>`).join('')}</div>`;
  },
  botMenu() {
    BotHost.ensure();
    this.status('A bot plays a random hero with the full moveset. Bot duels are unranked.');
    this.set(this.botButtons());
  },
  defaultName() { return 'Wanderer' + Math.floor(Math.random() * 9000 + 1000); },
  async saveName(n) { try { const me = await Api.setName(n); $('lbName').value = me.name; } catch (e) { this.status('Name must be 2-16 letters or numbers.', true); } },
  // ---- ranked
  async search() {
    const t0 = performance.now();
    const FALLBACK = 25;
    const tickTxt = () => { const s = Math.floor((performance.now() - t0) / 1000); this.status(`Searching for an opponent near your rating… ${s}s` + (s >= 8 ? ` · a bot steps in at ${FALLBACK}s` : '')); };
    this.set('<div class="lbSpin"></div><p class="lbOr">Or fight a bot now (unranked):</p>' + this.botButtons());
    tickTxt();
    try {
      let r = await Api.queueJoin(Hero.id);
      while (!r.found && this.mode === 'ranked' && $('lobby').classList.contains('show')) {
        await new Promise(res => (this.pollT = setTimeout(res, 2000)));
        if (this.mode !== 'ranked' || !$('lobby').classList.contains('show')) return;
        tickTxt();
        if ((performance.now() - t0) / 1000 >= FALLBACK) { Api.queueLeave(); this.mode = null; this.status('No duelists online right now. Here\'s a bot.'); return startBotMatch('normal'); }
        r = await Api.queuePoll();
      }
      if (r.found) this.start(r.match);
    } catch (e) { this.status('Matchmaking failed: ' + e.message, true); }
  },
  // ---- friends
  async create() {
    try {
      const m = await Api.roomCreate(Hero.id);
      const base = location.protocol.startsWith('http') ? location.origin + location.pathname : NET_CFG.site;
      const link = base + '?room=' + m.code;
      this.set(`<div class="lbCode">${m.code}</div><div class="lbLink"><input readonly value="${link}"><button class="btn small" id="lbCopy">COPY LINK</button></div><div class="lbSpin"></div>`);
      $('lbCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(link); $('lbCopy').textContent = 'COPIED'; };
      this.status('Waiting for your friend to join…');
      this.mode = 'friend-wait';
      while (this.mode === 'friend-wait' && $('lobby').classList.contains('show')) {
        await new Promise(res => (this.pollT = setTimeout(res, 1500)));
        const s = await Api.matchGet(m.id);
        if (s.status === 'ready' && s.opp) return this.start(s);
      }
    } catch (e) { this.status('Could not create a room: ' + e.message, true); }
  },
  async join(code) {
    code = (code || '').trim().toUpperCase();
    if (code.length !== 5) return this.status('Room codes have 5 characters.', true);
    this.status('Joining ' + code + '…');
    try { this.start(await Api.roomJoin(code, Hero.id)); }
    catch (e) { this.status(/not found/.test(e.message) ? 'No open room with that code.' : 'Could not join: ' + e.message, true); }
  },
  start(match) {
    this.mode = null; clearTimeout(this.pollT);
    $('lobby').classList.remove('show');
    this.lastKind = match.kind;
    Duel.begin(match);
  },
  close() {
    if (this.mode === 'ranked') Api.queueLeave();
    this.mode = null; clearTimeout(this.pollT);
    $('lobby').classList.remove('show');
    G.state = 'title'; $('title').classList.remove('hide'); $('select').classList.remove('show');
  },
  // after a duel: queue again (ranked) or reopen the friend menu
  again() {
    const k = this.lastKind; Duel.leave(); G.reset();
    if (k === 'bot') return startBotMatch(this.lastDiff || 'normal');
    G.state = 'select'; this.open(k === 'ranked' ? 'ranked' : 'friend');
  },
  async board() {
    $('board').classList.add('show');
    $('boardBody').innerHTML = '<div class="lbSpin"></div>';
    try {
      const rows = await Api.leaderboard(50);
      let me = null; if (Api.token) me = await Api.ensure().catch(() => null);
      $('boardBody').innerHTML = (rows.length ? `<table><tr><th>#</th><th>Name</th><th>Tier</th><th>Rating</th><th>W</th><th>L</th></tr>${rows.map((r, i) => `<tr class="${me && r.name === me.name && r.rating === me.rating ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${tierTag(r.rating)}</td><td>${r.rating}</td><td>${r.wins}</td><td>${r.losses}</td></tr>`).join('')}</table>` : '<p>No ranked duels yet. Be the first.</p>')
        + (me ? `<p class="boardMe">You: ${esc(me.name)} · ${tierTag(me.rating)} ${me.rating} · #${me.rank}</p>` : '');
    } catch (e) { $('boardBody').innerHTML = '<p>Can\'t reach the Galeborn server.</p>'; }
  },
};
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
