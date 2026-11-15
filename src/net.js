'use strict';
/* ============================================================
   Online services: Supabase RPC API (players, matchmaking, rooms,
   results, leaderboard) and the realtime link used during a duel.
   Identity is a random secret token kept in localStorage; the server
   only stores its hash and all writes go through gb_* functions.
   ============================================================ */
const NET_CFG = {
  url: 'https://yhsfwftdtvtiarvookiy.supabase.co',
  key: 'sb_publishable_gNeQ8vVnW9yxBvys816aNg_V9eQRyEh', // publishable (client-safe) key
  site: 'https://galeborn.vercel.app/',
};
const Api = {
  sb: null, me: null,
  get token() { try { return localStorage.getItem('galeborn.token'); } catch (e) { return null; } },
  set token(v) { try { localStorage.setItem('galeborn.token', v); } catch (e) {} },
  client() {
    if (!this.sb) {
      if (!window.supabase) throw new Error('offline');
      this.sb = window.supabase.createClient(NET_CFG.url, NET_CFG.key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 40 } } });
    }
    return this.sb;
  },
  async rpc(fn, args = {}) {
    const { data, error } = await this.client().rpc(fn, args);
    if (error) throw new Error(error.message || 'network error');
    return data;
  },
  async ensure(name) {
    if (this.token) {
      try { this.me = await this.rpc('gb_me', { p_token: this.token }); return this.me; } catch (e) { if (!/unknown player/.test(e.message)) throw e; }
    }
    const r = await this.rpc('gb_register', { p_name: name || 'Wanderer' });
    this.token = r.token; delete r.token; this.me = r; return r;
  },
  setName(n) { return this.rpc('gb_set_name', { p_token: this.token, p_name: n }).then(r => (this.me = r)); },
  queueJoin(hero) { return this.rpc('gb_queue_join', { p_token: this.token, p_hero: hero }); },
  queuePoll() { return this.rpc('gb_queue_poll', { p_token: this.token }); },
  queueLeave() { return this.rpc('gb_queue_leave', { p_token: this.token }).catch(() => {}); },
  roomCreate(hero) { return this.rpc('gb_room_create', { p_token: this.token, p_hero: hero }); },
  roomJoin(code, hero) { return this.rpc('gb_room_join', { p_token: this.token, p_code: code, p_hero: hero }); },
  matchGet(id) { return this.rpc('gb_match_get', { p_token: this.token, p_match: id }); },
  report(id, winner) { return this.rpc('gb_match_report', { p_token: this.token, p_match: id, p_winner: winner }); },
  leaderboard(n = 50) { return this.rpc('gb_leaderboard', { p_limit: n }); },
};

/* realtime link: one broadcast channel per match */
class SupaLink {
  constructor(matchId, onMsg) {
    this.status = 'connecting';
    this.ch = Api.client().channel('duel:' + matchId, { config: { broadcast: { self: false, ack: false } } });
    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
    this.ch.subscribe(st => { this.status = st === 'SUBSCRIBED' ? 'open' : st.toLowerCase(); });
  }
  send(m) { if (this.status === 'open') this.ch.send({ type: 'broadcast', event: 'm', payload: m }); }
  close() { try { Api.client().removeChannel(this.ch); } catch (e) {} this.status = 'closed'; }
}
/* test link: two pages bridged by the test harness (window.__netOut / window.__netIn) */
class TestLink {
  constructor(matchId, onMsg) { this.status = 'open'; window.__netIn = m => onMsg(m); }
  send(m) { if (window.__netOut) window.__netOut(m); }
  close() { this.status = 'closed'; }
}
