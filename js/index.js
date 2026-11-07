// LODE landing page script.
// Numbers come from a static snapshot at /api/stats.json (no live backend).
import { copyText, countUp, countdown, escapeHtml, formatHashrate, formatNumber, formatLode, formatRate, timeAgo, prefersReducedMotion } from './common.js?v=lode2';
import { startWater } from './water.js?v=lode2';

const $ = (id) => document.getElementById(id);

async function loadStats() {
  for (const url of ['/api/stats.json']) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* try next */ }
  }
  return null;
}

// ── live-ish numbers ──────────────────────────────────────────────
function renderStats(s) {
  const hr = formatHashrate(s.hashrate || 0);
  $('tb-miners').textContent = formatNumber(s.activeMiners);
  $('tb-hash').textContent = `${hr.value} ${hr.unit}`;
  $('tb-emission').textContent = `${formatRate(s.emissionPerMinute)} LODE/min`;
  $('spec-emission').textContent = `${formatRate(s.emissionPerMinute)} / min`;
  $('spec-supply').textContent = `~${Math.round(s.maxSupply / 1e6)}M LODE`;
  $('spec-halving').textContent = `every ${s.halvingDays} days`;
  $('spec-diff').textContent = `~1 share / ${s.targetShareSeconds} s`;

  countUp($('s-miners'), s.activeMiners);
  countUp($('s-hashrate'), s.hashrate || 0, (v) => { const h = formatHashrate(v); return `${h.value}<small>${h.unit}</small>`; });
  countUp($('s-supply'), s.circulating, (v) => formatNumber(Math.round(v)));
  $('s-users').textContent = `${formatNumber(s.users)} registered · ${((100 * s.circulating) / s.maxSupply).toFixed(2)}% of max`;
  $('s-emission').textContent = `${formatRate(s.emissionPerMinute)} LODE this round`;

  // The snapshot's round has long ended; keep a one-minute round clock ticking from it.
  const len = s.roundSeconds * 1000;
  const base = s.currentRound;
  const tick = () => {
    const now = Date.now();
    const passed = Math.max(0, Math.floor((now - base.endsAt) / len) + 1);
    const endsAt = base.endsAt + passed * len;
    $('s-round').textContent = `#${formatNumber(base.id + passed)}`;
    $('tb-round').textContent = countdown(endsAt - now);
  };
  tick();
  setInterval(tick, 1000);

  const live = document.querySelector('.live');
  live.classList.add('is-archive');
  live.lastChild.textContent = `Archive · ${new Date(s.recentRounds?.[0]?.endsAt || base.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const log = $('log');
  log.innerHTML = (s.recentRounds || []).slice(0, 10).map((r, i) => `
    <tr class="row-in" style="animation-delay:${i * 60}ms">
      <td>#${formatNumber(r.id)}</td>
      <td>${new Date(r.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
      <td class="num">${r.miners}</td>
      <td class="num">${r.shares}</td>
      <td class="num">${formatLode(r.paid)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">No rounds yet</td></tr>';

  const top = s.leaderboard || [];
  const max = Math.max(1, ...top.map((m) => m.earned));
  $('leaderboard').innerHTML = top.map((m, i) => `
    <tr class="row-in ${i === 0 ? 'rank-1' : ''}" style="animation-delay:${i * 80}ms">
      <td>${String(i + 1).padStart(2, '0')}</td>
      <td>${escapeHtml(m.username)}</td>
      <td class="num">${formatNumber(m.totalShares)}</td>
      <td class="num"><span class="bar" style="width:${Math.round((70 * m.earned) / max)}px"></span>${formatLode(m.earned)}</td>
      <td class="num">${timeAgo(m.lastMinedAt)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">No miners yet</td></tr>';
}

// ── LODE wordmark + logo for the terminal ─────────────────────────
const WORDMARK = [
  '██     ██████ █████▄ ██████',
  '██     ██  ██ ██  ██ ██    ',
  '██     ██  ██ ██  ██ ████  ',
  '██     ██  ██ ██  ██ ██    ',
  '██████ ██████ █████▀ ██████',
];

// ── simulated `lode mine` session in the terminal ─────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

// A hash with exactly `bits` leading zero bits; the zero prefix is lit gold.
function digHash(bits) {
  const zeros = Math.floor(bits / 4), rem = bits % 4;
  const next = '0123456789abcdef'[Math.max(1, Math.floor(Math.random() * (16 >> rem)))];
  return `<span class="t-gold">${'0'.repeat(zeros)}</span>${next}${hex(13 - zeros)}`;
}
const digBar = (bits, target) => {
  const cells = 11, full = Math.round((bits / target) * cells);
  return `<span class="t-gold">${'▰'.repeat(full)}</span><span class="t-dim">${'▱'.repeat(cells - full)}</span>`;
};

async function runTerminal(s) {
  const el = $('terminal');
  const reduced = prefersReducedMotion();
  const out = [];
  const paint = (cursor = true) => { el.innerHTML = out.join('\n') + (cursor ? '<span class="cursor"></span>' : ''); };
  const say = async (html, delay = 260) => { out.push(html); paint(); if (!reduced) await sleep(delay); };
  const type = async (cmd) => {
    out.push('<span class="t-p">$</span> ');
    for (const ch of cmd) { out[out.length - 1] += escapeHtml(ch); paint(); if (!reduced) await sleep(38 + Math.random() * 40); }
    if (!reduced) await sleep(320);
  };

  for (;;) {
    out.length = 0;
    await type('lode mine');
    // One mark only: the wordmark, as the CLI prints it.
    await say(`<span class="t-art">${WORDMARK.map(escapeHtml).join('\n')}</span>`, 300);
    await say('<span class="t-dim">connected · rev 1.0 · 8 cores · target 22 bits</span>', 400);

    // Dig meter: candidate hashes fly by, the best run of leading zero bits so far
    // fills the bar, and when it reaches the target a share is struck.
    const TARGET = 22;
    for (let i = 0; i < 3; i += 1) {
      const at = out.length;
      out.push('', '');
      let best = 0, hashes = 0;
      const until = performance.now() + (reduced ? 0 : 1500 + Math.random() * 900);
      while (performance.now() < until && best < TARGET - 1) {
        hashes += 38000 + Math.random() * 12000;
        best = Math.min(TARGET - 1, Math.max(best, Math.floor(Math.random() ** 2.2 * TARGET)));
        out[at] = `<span class="t-dim">nonce</span> ${hex(8)}  <span class="t-dim">hash</span> ${digHash(best)}…`;
        out[at + 1] = `<span class="t-dim">depth</span> ${digBar(best, TARGET)} <span class="t-dim">${best}/${TARGET} bits · ${(hashes / 1e6).toFixed(2)} MH</span>`;
        paint();
        await sleep(70);
      }
      out.splice(at, 2);
      await say(`<span class="t-ok">✔ share</span> ${digHash(TARGET + Math.floor(Math.random() * 3))}…  <span class="t-dim">+1 · round #${formatNumber(s.currentRound.id + i)}</span>`, 380);
    }
    await say(`<span class="t-y">◆ round settled</span> you earned <b>${formatLode(s.emissionPerMinute / 3)}</b> LODE`, 900);
    await say('<span class="t-dim">waiting for next challenge…</span>', reduced ? 0 : 2600);
    if (reduced) { paint(false); return; }
  }
}

// ── small touches ─────────────────────────────────────────────────
function wireCopy() {
  $('copy-install')?.addEventListener('click', () => copyText($('install-cmd').textContent));
}

// ── hero: live node feed + parallax on the render ─────────────────
function heroNode(s) {
  const feed = $('node-feed');
  if (!feed) return;
  let round = s.currentRound.id, last = Date.now();
  const lines = [];
  const push = (html) => {
    lines.push(html);
    if (lines.length > 5) lines.shift();
    feed.innerHTML = lines.map((l, i) => `<div class="nf-line${i === lines.length - 1 ? ' new' : ''}">${l}</div>`).join('');
    last = Date.now();
  };
  const step = () => {
    const r = Math.random();
    if (r < 0.62) push(`<span class="nf-k">share</span> 0000${hex(10)}… <span class="nf-d">+1 · ${(18 + Math.random() * 4).toFixed(1)}s</span>`);
    else if (r < 0.85) { round += 1; push(`<span class="nf-g">round #${formatNumber(round)}</span> <span class="nf-d">settled · ${formatRate(s.emissionPerMinute)} LODE</span>`); }
    else push(`<span class="nf-k">diff</span> retarget → ${20 + Math.floor(Math.random() * 4)} bits`);
  };
  for (let i = 0; i < 4; i += 1) step();
  setInterval(step, 2300);
  setInterval(() => { const sec = Math.round((Date.now() - last) / 1000); $('node-upd').textContent = sec < 2 ? 'now' : `${sec}s ago`; }, 1000);
}

function heroParallax() {
  const img = document.querySelector('.hero-bg img');
  const hero = document.querySelector('.hero');
  if (!img || !hero || prefersReducedMotion()) return;
  let mx = 0, my = 0, sy = 0, raf = 0;
  const apply = () => {
    raf = 0;
    const tf = `translate3d(${mx * -14}px, ${sy * 0.28 + my * -8}px, 0) scale(1.08)`;
    document.querySelectorAll('.hero-bg img, .hero-gl').forEach((el) => { el.style.transform = tf; });
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
  addEventListener('scroll', () => { sy = Math.min(scrollY, innerHeight); queue(); }, { passive: true });
  hero.addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; queue(); });
  apply();
}

function reveal() {
  const targets = document.querySelectorAll('.sec-head, .stats, .split, .steps, .note, .table-wrap, .cta-inner');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px' });
  targets.forEach((t) => { t.classList.add('js-reveal'); io.observe(t); });
}

const favicon = document.querySelector('link[rel=icon]');
if (favicon) favicon.href = '/favicon.svg';

function navOnScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const set = () => nav.classList.toggle('scrolled', scrollY > 40);
  set();
  addEventListener('scroll', set, { passive: true });
}

wireCopy();
reveal();
navOnScroll();
try { startWater(document.querySelector('.hero-bg img'), { video: document.querySelector('.ore-vid'), rect: [0.585, 0.905, 0.10, 0.38] }); } catch (e) { console.warn('water off:', e.message); }
try { startWater(document.querySelector('.cta-bg img'), { horizon: 0.65 }); } catch (e) { console.warn('cta water off:', e.message); }
heroParallax();
const stats = await loadStats();
if (stats) {
  renderStats(stats);
  heroNode(stats);
  runTerminal(stats);
} else {
  $('log').innerHTML = '<tr><td colspan="5" class="empty">Network offline</td></tr>';
}
