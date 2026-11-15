/* ---------------- Highlight clips: rolling capture of the canvas, keeps the best moments of a fight ----------------
   One MediaRecorder runs in short segments that are thrown away unless a highlight lands in them. When Moment.fire
   or a K.O. marks a highlight, the current segment keeps recording ~2.5 s more, then is kept as a clip with a score.
   The end screen shows the best clip with SAVE and SHARE. */
const Clips = {
  ok: false, rec: null, stream: null, chunks: [], segT0: 0, pend: null, kept: [], shown: 0, mime: '', waiters: [],
  SEG: 8, TAIL: 2.5, MAXSEG: 18,
  enabled() { return this.ok && Settings.v.clips !== false && !Training.active; },
  init() {
    if (typeof IS_BOT !== 'undefined' && IS_BOT) return;
    const c = Render.r.domElement;
    if (!window.MediaRecorder || !c.captureStream) return;
    this.mime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    if (!this.mime) return;
    this.ok = true;
    $('clipSave').addEventListener('click', () => this.save());
    $('clipShare').addEventListener('click', () => this.share());
    $('clipNext').addEventListener('click', () => { if (this.kept.length > 1) { this.shown = (this.shown + 1) % this.kept.length; this.paint(); } });
  },
  // the clip is drawn from the game canvas into a small 2D canvas right after each render (cheap to encode)
  grab() {
    if (!this.rec || !this.cv) return;
    const now = performance.now(); if (now - (this.lastGrab || 0) < 30) return; this.lastGrab = now;
    const src = Render.r.domElement, W = this.cv.width, H = this.cv.height;
    const sa = src.width / src.height, da = W / H;
    let sw = src.width, sh = src.height, sx = 0, sy = 0;
    if (sa > da) { sw = sh * da; sx = (src.width - sw) / 2; } else { sh = sw / da; sy = (src.height - sh) / 2; }
    try { this.cx.drawImage(src, sx, sy, sw, sh, 0, 0, W, H); } catch (e) {}
    this.cx.font = 'italic 900 15px sans-serif'; this.cx.fillStyle = 'rgba(255,255,255,.55)'; this.cx.fillText('GALEBORN', 14, H - 14);
  },
  ensureStream() {
    if (this.stream) return this.stream;
    const hi = (Settings.v.quality === 'ultra' || Settings.v.quality === 'high');
    this.cv = document.createElement('canvas'); this.cv.width = hi ? 1280 : 960; this.cv.height = hi ? 720 : 540;
    this.cx = this.cv.getContext('2d');
    this.stream = this.cv.captureStream(30);
    try {
      if (Sfx.ctx && Sfx.comp) {
        const dest = Sfx.ctx.createMediaStreamDestination();
        Sfx.comp.connect(dest);
        for (const t of dest.stream.getAudioTracks()) this.stream.addTrack(t);
      }
    } catch (e) {}
    return this.stream;
  },
  startSeg() {
    let rec;
    try { rec = new MediaRecorder(this.ensureStream(), { mimeType: this.mime, videoBitsPerSecond: 5e6 }); } catch (e) { this.ok = false; return; }
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const p = rec._keep;
      if (p && chunks.length) this.keep(new Blob(chunks, { type: this.mime.split(';')[0] }), p);
      if (rec._done) rec._done();
    };
    rec.start(500);
    this.rec = rec; this.segT0 = performance.now();
  },
  stopSeg(keep) {
    const rec = this.rec; if (!rec) return Promise.resolve();
    this.rec = null; rec._keep = keep || null;
    return new Promise(res => { rec._done = res; try { rec.stop(); } catch (e) { res(); } });
  },
  keep(blob, p) {
    this.kept.push({ blob, url: URL.createObjectURL(blob), name: p.name, score: p.score, dur: p.dur });
    this.kept.sort((a, b) => b.score - a.score);
    while (this.kept.length > 3) URL.revokeObjectURL(this.kept.pop().url);
  },
  // called by Moment.fire, round K.O.s and finishers
  mark(name, score, tail = this.TAIL) {
    if (!this.rec) return;
    const now = performance.now();
    if (!this.pend) this.pend = { name, score, at: now };
    else if (score >= this.pend.score) { this.pend.name = name; this.pend.score = score + this.pend.score * 0.3; }
    else this.pend.score += score * 0.3;
    this.pend.stopAt = Math.max(this.pend.stopAt || 0, now + tail * 1000);
  },
  active() { return this.enabled() && (G.state === 'fight' || G.state === 'ending' || G.state === 'intro') && !G.menuOpen; },
  update() {
    if (!this.ok) return;
    const now = performance.now();
    if (!this.active()) {
      if (this.rec && !this.pend) this.stopSeg(null);
      else if (this.rec && this.pend && now >= this.pend.stopAt) this.flush();
      return;
    }
    if (!this.rec) { this.startSeg(); return; }
    const age = (now - this.segT0) / 1000;
    if (this.pend) { if (now >= this.pend.stopAt || age > this.MAXSEG) this.flush(); }
    else if (age > this.SEG) { this.stopSeg(null); this.startSeg(); }
  },
  flush() {
    const p = this.pend; this.pend = null;
    p.dur = (performance.now() - this.segT0) / 1000;
    const done = this.stopSeg(p);
    if (this.active()) this.startSeg();
    return done;
  },
  // new fight: forget the last fight's clips
  reset() {
    this.pend = null; if (this.rec) this.stopSeg(null);
    for (const k of this.kept) URL.revokeObjectURL(k.url);
    this.kept = []; this.shown = 0; $('clipBox').classList.remove('show');
  },
  async showEnd() {
    if (!this.ok) return;
    if (this.pend) await this.flush();
    else if (this.rec) await this.stopSeg(null);
    await new Promise(r => setTimeout(r, 60));
    this.shown = 0; this.paint();
  },
  paint() {
    const box = $('clipBox'), k = this.kept[this.shown];
    if (!k) { box.classList.remove('show'); return; }
    box.classList.add('show');
    const v = $('clipVid'); if (v.src !== k.url) { v.src = k.url; v.play().catch(() => {}); }
    $('clipName').textContent = k.name + (this.kept.length > 1 ? `  ·  ${this.shown + 1}/${this.kept.length}` : '');
    $('clipNext').style.display = this.kept.length > 1 ? '' : 'none';
    $('clipShare').style.display = navigator.canShare ? '' : 'none';
  },
  fileOf(k) {
    const ext = k.blob.type.includes('mp4') ? 'mp4' : 'webm';
    const nm = k.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'highlight';
    return new File([k.blob], `galeborn-${nm}-${new Date().toISOString().slice(0, 10)}.${ext}`, { type: k.blob.type });
  },
  save() {
    const k = this.kept[this.shown]; if (!k) return; Sfx.ui();
    const f = this.fileOf(k), a = document.createElement('a');
    a.href = k.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  },
  async share() {
    const k = this.kept[this.shown]; if (!k) return; Sfx.ui();
    const f = this.fileOf(k);
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Galeborn · ' + k.name, text: 'Galeborn highlight: ' + k.name });
      else this.save();
    } catch (e) { if (e.name !== 'AbortError') this.save(); }
  },
};
