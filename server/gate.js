import crypto from 'node:crypto'
import path from 'node:path'

const COOKIE_NAME = 'stackd_pass'
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 // 24h
const SESSION_TTL_MS = 5 * 60 * 1000
const IP_WINDOW_MS = 15 * 60 * 1000
const FAIL_TO_PUZZLE = 2
const HIT_TO_PUZZLE = 6
const MIN_CHECK_MS = 1200

/** @type {Map<string, { mode: string, nonce: string, issuedAt: number, exp: number, answer?: number, puzzle?: object }>} */
const sessions = new Map()
/** @type {Map<string, { hits: number[], fails: number[], forcePuzzleUntil: number }>} */
const ipState = new Map()

function env(key, fallback = '') {
  return String(process.env[key] || fallback).trim()
}

function gateSecret() {
  return (
    env('GATE_SECRET') ||
    env('ADMIN_PASSWORD') ||
    'stackd-gate-dev-secret'
  )
}

function sign(payload) {
  return crypto.createHmac('sha256', gateSecret()).update(payload).digest('hex')
}

function issueToken(ttlSec = COOKIE_MAX_AGE_SEC) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const nonce = crypto.randomBytes(8).toString('hex')
  const body = `${exp}.${nonce}`
  return `${body}.${sign(body)}`
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expRaw, nonce, sig] = parts
  if (!/^\d+$/.test(expRaw) || !nonce || !sig) return false
  const body = `${expRaw}.${nonce}`
  const expected = sign(body)
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    if (!ok) return false
  } catch {
    return false
  }
  return Number(expRaw) * 1000 > Date.now()
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    out[key] = decodeURIComponent(value)
  }
  return out
}

function setPassCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

function clearPassCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  )
}

function hasValidPass(req) {
  const cookies = parseCookies(req.headers.cookie)
  return verifyToken(cookies[COOKIE_NAME])
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (xf) return String(xf).split(',')[0].trim()
  return String(req.ip || req.socket?.remoteAddress || 'unknown')
}

function pruneMap(map, now = Date.now()) {
  if (map.size < 1500) return
  for (const [key, value] of map) {
    if (value.exp && value.exp < now) map.delete(key)
    if (value.forcePuzzleUntil != null && value.forcePuzzleUntil < now && !(value.hits?.length)) {
      map.delete(key)
    }
  }
}

function getIpBucket(ip) {
  const now = Date.now()
  let row = ipState.get(ip)
  if (!row) {
    row = { hits: [], fails: [], forcePuzzleUntil: 0 }
    ipState.set(ip, row)
  }
  row.hits = row.hits.filter((t) => now - t < IP_WINDOW_MS)
  row.fails = row.fails.filter((t) => now - t < IP_WINDOW_MS)
  if (row.forcePuzzleUntil && row.forcePuzzleUntil < now) row.forcePuzzleUntil = 0
  return row
}

function noteGateHit(ip) {
  const row = getIpBucket(ip)
  row.hits.push(Date.now())
  if (row.hits.length >= HIT_TO_PUZZLE) {
    row.forcePuzzleUntil = Date.now() + IP_WINDOW_MS
  }
  pruneMap(ipState)
  return row
}

function noteFail(ip) {
  const row = getIpBucket(ip)
  row.fails.push(Date.now())
  if (row.fails.length >= FAIL_TO_PUZZLE) {
    row.forcePuzzleUntil = Date.now() + IP_WINDOW_MS
  }
  return row
}

function noteSuccess(ip) {
  const row = getIpBucket(ip)
  row.hits = []
  row.fails = []
  row.forcePuzzleUntil = 0
}

function needsPuzzle(ip) {
  if (env('TURNSTILE_SITE_KEY') && env('TURNSTILE_SECRET_KEY')) return false
  const row = getIpBucket(ip)
  return row.forcePuzzleUntil > Date.now() || row.fails.length >= FAIL_TO_PUZZLE || row.hits.length >= HIT_TO_PUZZLE
}

function createSoftSession() {
  const id = crypto.randomBytes(16).toString('hex')
  const nonce = crypto.randomBytes(12).toString('hex')
  sessions.set(id, {
    mode: 'soft',
    nonce,
    issuedAt: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  })
  pruneMap(sessions)
  return { id, nonce, mode: 'soft', minMs: MIN_CHECK_MS }
}

function createPuzzleSession() {
  // Visual "ordená los números" puzzle: 3x3 grid with one empty, but simpler:
  // click tiles that match a target color / pick the odd one out.
  // Math fallback + tile pick: show 6 tiles with numbers, pick the one that equals a+b
  const a = Math.floor(Math.random() * 7) + 3
  const b = Math.floor(Math.random() * 7) + 3
  const answer = a + b
  const decoys = new Set([answer])
  while (decoys.size < 6) {
    const n = answer + (Math.floor(Math.random() * 11) - 5)
    if (n > 0 && n !== answer) decoys.add(n)
  }
  const tiles = [...decoys]
  for (let i = tiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  const id = crypto.randomBytes(16).toString('hex')
  const nonce = crypto.randomBytes(12).toString('hex')
  sessions.set(id, {
    mode: 'puzzle',
    nonce,
    issuedAt: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    answer,
    puzzle: { a, b, tiles },
  })
  pruneMap(sessions)
  return {
    id,
    nonce,
    mode: 'puzzle',
    question: `Seleccioná el resultado de ${a} + ${b}`,
    tiles,
    minMs: MIN_CHECK_MS,
  }
}

function createSessionForIp(ip) {
  if (needsPuzzle(ip)) return createPuzzleSession()
  return createSoftSession()
}

async function verifyTurnstile(token, ip) {
  const secret = env('TURNSTILE_SECRET_KEY')
  if (!secret) return false
  if (!token) return false
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (ip) body.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  return Boolean(data?.success)
}

function isAllowedWithoutGate(req) {
  const p = req.path || ''
  if (p === '/api/health') return true
  if (p === '/api/telegram/webhook') return true
  if (p.startsWith('/api/gate/')) return true
  if (p === '/favicon.svg' || p === '/favicon.ico') return true
  if (p === '/robots.txt') return true
  return false
}

function wantsHtml(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  const accept = String(req.headers.accept || '')
  if (accept.includes('text/html')) return true
  if (!accept || accept === '*/*') {
    const ext = path.extname(req.path || '')
    return !ext || req.path === '/'
  }
  return false
}

function gatePageHtml() {
  const siteKey = env('TURNSTILE_SITE_KEY')
  const hasTurnstile = Boolean(siteKey)
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>STACKD · Verificación de seguridad</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  ${hasTurnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
  <style>
    :root {
      --bg: #07070c;
      --panel: #111118;
      --ink: #f4f2ff;
      --muted: rgba(244,242,255,.72);
      --purple: #8b5cf6;
      --line: rgba(167,139,250,.22);
      --ok: #22c55e;
      --widget: #16161f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; font-family: Outfit, sans-serif; color: var(--ink);
      background:
        radial-gradient(720px 420px at 50% -8%, rgba(139,92,246,.26), transparent 58%),
        linear-gradient(180deg, #0a0a12, var(--bg));
      display: grid; place-items: center; padding: 1.25rem;
    }
    .wrap { width: min(100%, 440px); }
    .brand {
      font-family: Syne, sans-serif; font-weight: 800; letter-spacing: .08em;
      margin: 0 0 1.1rem; text-align: center;
    }
    .brand span { color: var(--purple); }
    .card {
      background: linear-gradient(180deg, #171722, #0e0e16);
      border: 1px solid var(--line); border-radius: 20px; padding: 1.35rem 1.25rem 1.2rem;
      box-shadow: 0 28px 80px rgba(0,0,0,.5);
    }
    h1 {
      font-family: Syne, sans-serif; font-size: 1.35rem; letter-spacing: -.02em;
      margin: 0 0 .45rem; line-height: 1.2; text-align: center;
    }
    .lead {
      margin: 0 0 1.15rem; color: var(--muted); line-height: 1.55; text-align: center;
      font-size: .95rem;
    }
    .widget {
      background: var(--widget);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 4px;
      padding: .7rem .85rem;
      display: flex; align-items: center; gap: .85rem;
      min-height: 66px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      user-select: none;
    }
    .cb {
      width: 28px; height: 28px; border-radius: 3px;
      border: 2px solid rgba(255,255,255,.45);
      background: #0c0c12;
      display: grid; place-items: center;
      cursor: pointer; flex: 0 0 auto;
      transition: border-color .15s ease, background .15s ease;
    }
    .cb:hover:not(.disabled) { border-color: var(--purple); }
    .cb.checking { border-color: var(--purple); cursor: wait; }
    .cb.ok { border-color: var(--ok); background: rgba(34,197,94,.12); cursor: default; }
    .cb.disabled { opacity: .55; cursor: not-allowed; }
    .spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(139,92,246,.25);
      border-top-color: var(--purple);
      animation: spin .7s linear infinite;
      display: none;
    }
    .cb.checking .spinner { display: block; }
    .check {
      display: none; width: 14px; height: 8px;
      border-left: 2.5px solid var(--ok);
      border-bottom: 2.5px solid var(--ok);
      transform: rotate(-45deg) translate(1px, -1px);
    }
    .cb.ok .check { display: block; }
    .cb.ok .spinner { display: none; }
    .w-label { flex: 1; font-weight: 600; font-size: .98rem; }
    .w-meta { font-size: .72rem; color: rgba(244,242,255,.45); line-height: 1.3; text-align: right; }
    .w-meta strong { display: block; color: rgba(244,242,255,.7); font-weight: 700; letter-spacing: .04em; }
    .status {
      margin: .85rem 0 0; min-height: 1.35em; font-size: .9rem; font-weight: 600;
      color: rgba(244,242,255,.7); text-align: center;
    }
    .status.err { color: #ffb4d4; }
    .status.ok { color: #86efac; }
    .puzzle {
      display: none; margin-top: 1rem; padding-top: 1rem;
      border-top: 1px solid rgba(255,255,255,.08);
    }
    .puzzle.on { display: block; }
    .puzzle h2 {
      margin: 0 0 .35rem; font-size: 1rem; font-family: Syne, sans-serif;
    }
    .puzzle p { margin: 0 0 .85rem; color: var(--muted); font-size: .9rem; line-height: 1.5; }
    .tiles {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: .55rem;
    }
    .tile {
      border: 1px solid rgba(167,139,250,.28);
      background: #0c0c14; color: var(--ink);
      border-radius: 12px; padding: .9rem .4rem;
      font: inherit; font-weight: 700; font-size: 1.1rem;
      cursor: pointer;
    }
    .tile:hover { border-color: var(--purple); background: rgba(139,92,246,.12); }
    .tile:disabled { opacity: .5; cursor: wait; }
    .hint { margin-top: .95rem; font-size: .82rem; color: rgba(244,242,255,.48); text-align: center; }
    .turnstile { margin: .4rem 0 1rem; display: grid; justify-items: center; }
    .btn {
      width: 100%; border: 0; border-radius: 12px; padding: .9rem 1rem; font: inherit; font-weight: 700;
      cursor: pointer; background: var(--purple); color: #fff;
    }
    .btn:disabled { opacity: .55; cursor: wait; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="brand">STACK<span>D</span></p>
    <main class="card">
      <h1>Verificación de seguridad</h1>
      <p class="lead">Antes de entrar, confirmá que no sos un bot. Si entrás muchas veces, te pedimos un puzzle.</p>
      ${
        hasTurnstile
          ? `<form id="ts-form">
              <div class="turnstile"><div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="dark"></div></div>
              <button class="btn" id="ts-submit" type="submit">Continuar</button>
              <p class="status" id="status" aria-live="polite"></p>
            </form>`
          : `<div class="widget" id="widget" role="group" aria-label="Verificación anti-bot">
              <button type="button" class="cb" id="cb" aria-label="No soy un robot" title="No soy un robot">
                <span class="spinner" aria-hidden="true"></span>
                <span class="check" aria-hidden="true"></span>
              </button>
              <div class="w-label" id="w-label">No soy un robot</div>
              <div class="w-meta"><strong>STACKD</strong>Privacy</div>
            </div>
            <p class="status" id="status" aria-live="polite"></p>
            <section class="puzzle" id="puzzle">
              <h2>Puzzle anti-bot</h2>
              <p id="puzzle-q">Seleccioná la respuesta correcta.</p>
              <div class="tiles" id="tiles"></div>
            </section>`
      }
      <p class="hint">Esta verificación dura 24 horas en este navegador.</p>
    </main>
  </div>
  <script>
    const hasTurnstile = ${hasTurnstile ? 'true' : 'false'};
    const statusEl = document.getElementById('status');
    const next = new URLSearchParams(location.search).get('next') || '/';
    let session = null;
    let busy = false;
    let moved = false;
    let keyed = false;

    document.addEventListener('mousemove', () => { moved = true; }, { once: true, passive: true });
    document.addEventListener('keydown', () => { keyed = true; }, { once: true });
    document.addEventListener('touchstart', () => { moved = true; }, { once: true, passive: true });

    function setStatus(msg, kind) {
      statusEl.textContent = msg || '';
      statusEl.className = 'status' + (kind ? ' ' + kind : '');
    }

    async function loadSession() {
      const res = await fetch('/api/gate/challenge');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo iniciar la verificación');
      session = data;
      return data;
    }

    async function verify(payload) {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const err = new Error(data.error || 'Verificación fallida');
        err.escalate = Boolean(data.escalate);
        err.payload = data;
        throw err;
      }
      return data;
    }

    function showPuzzle(data) {
      const box = document.getElementById('puzzle');
      const tiles = document.getElementById('tiles');
      const q = document.getElementById('puzzle-q');
      const cb = document.getElementById('cb');
      const label = document.getElementById('w-label');
      box.classList.add('on');
      q.textContent = data.question || 'Seleccioná la respuesta correcta.';
      tiles.innerHTML = '';
      (data.tiles || []).forEach((n) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tile';
        btn.textContent = String(n);
        btn.addEventListener('click', () => onPuzzlePick(n, btn));
        tiles.appendChild(btn);
      });
      cb.classList.remove('checking', 'ok');
      cb.classList.add('disabled');
      label.textContent = 'Completá el puzzle';
      setStatus('Detectamos mucho tráfico desde tu red. Resolvé el puzzle.', 'err');
    }

    async function onPuzzlePick(value, btn) {
      if (busy || !session) return;
      busy = true;
      [...document.querySelectorAll('.tile')].forEach((el) => { el.disabled = true; });
      setStatus('Comprobando puzzle…');
      try {
        const waited = Date.now() - (session._clientAt || Date.now());
        const data = await verify({
          sessionId: session.id,
          nonce: session.nonce,
          mode: 'puzzle',
          answer: value,
          waitedMs: waited,
          interaction: { moved, keyed },
        });
        setStatus('Listo. Entrando…', 'ok');
        location.replace(data.next || '/');
      } catch (err) {
        setStatus(err.message || 'Puzzle incorrecto', 'err');
        try {
          const fresh = await loadSession();
          fresh._clientAt = Date.now();
          if (fresh.mode === 'puzzle') showPuzzle(fresh);
          else location.reload();
        } catch {
          location.reload();
        }
        busy = false;
      }
    }

    async function onCheckbox() {
      if (busy || !session) return;
      const cb = document.getElementById('cb');
      if (cb.classList.contains('disabled') || cb.classList.contains('ok')) return;
      busy = true;
      cb.classList.add('checking');
      document.getElementById('w-label').textContent = 'Verificando…';
      setStatus('Revisando navegador y comportamiento…');

      const minMs = Math.max(MIN_FROM_SERVER(), 1400);
      const started = Date.now();
      await new Promise((r) => setTimeout(r, minMs));

      try {
        if (session.mode === 'puzzle') {
          showPuzzle(session);
          busy = false;
          return;
        }
        const data = await verify({
          sessionId: session.id,
          nonce: session.nonce,
          mode: 'soft',
          waitedMs: Date.now() - (session._clientAt || started),
          interaction: { moved, keyed },
        });
        cb.classList.remove('checking');
        cb.classList.add('ok');
        document.getElementById('w-label').textContent = 'Éxito';
        setStatus('Verificación completada. Entrando…', 'ok');
        setTimeout(() => location.replace(data.next || '/'), 350);
      } catch (err) {
        cb.classList.remove('checking');
        document.getElementById('w-label').textContent = 'No soy un robot';
        setStatus(err.message || 'Falló la verificación', 'err');
        try {
          const fresh = await loadSession();
          fresh._clientAt = Date.now();
          if (fresh.mode === 'puzzle' || err.escalate) showPuzzle(fresh);
          else session = fresh;
        } catch {
          /* ignore */
        }
        busy = false;
      }
    }

    function MIN_FROM_SERVER() {
      return (session && session.minMs) || ${MIN_CHECK_MS};
    }

    if (hasTurnstile) {
      document.getElementById('ts-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const btn = document.getElementById('ts-submit');
        btn.disabled = true;
        setStatus('Verificando…');
        try {
          const tokenInput = document.querySelector('[name="cf-turnstile-response"]');
          const turnstileToken = tokenInput ? tokenInput.value : '';
          if (!turnstileToken) throw new Error('Completá la casilla de Cloudflare');
          const data = await verify({ turnstileToken, mode: 'turnstile' });
          setStatus('Listo. Entrando…', 'ok');
          location.replace(data.next || '/');
        } catch (err) {
          setStatus(err.message || 'Error', 'err');
          btn.disabled = false;
          if (window.turnstile) window.turnstile.reset();
        }
      });
    } else {
      loadSession()
        .then((data) => {
          data._clientAt = Date.now();
          if (data.mode === 'puzzle') showPuzzle(data);
          document.getElementById('cb').addEventListener('click', onCheckbox);
        })
        .catch((err) => setStatus(err.message || 'Error cargando verificación', 'err'));
    }
  </script>
</body>
</html>`
}

export function createGateMiddleware() {
  const disabled =
    env('GATE_DISABLED', '') === '1' ||
    env('GATE_DISABLED', '').toLowerCase() === 'true'

  return function gateMiddleware(req, res, next) {
    if (disabled) return next()
    if (isAllowedWithoutGate(req)) return next()
    if (hasValidPass(req)) return next()

    if (wantsHtml(req)) {
      const nextPath = req.originalUrl || '/'
      if (req.path === '/gate') {
        noteGateHit(clientIp(req))
        res.status(200).type('html').send(gatePageHtml())
        return
      }
      const target = `/gate?next=${encodeURIComponent(nextPath)}`
      res.redirect(302, target)
      return
    }

    if (req.path.startsWith('/api/')) {
      res.status(403).json({ ok: false, error: 'Verificación anti-bot requerida', gate: '/gate' })
      return
    }

    if (req.path.startsWith('/assets/')) {
      res.status(403).type('text/plain').send('Verification required')
      return
    }

    next()
  }
}

export function registerGateRoutes(app) {
  app.get('/api/gate/challenge', (req, res) => {
    if (env('TURNSTILE_SITE_KEY') && env('TURNSTILE_SECRET_KEY')) {
      res.json({ ok: true, mode: 'turnstile' })
      return
    }
    const ip = clientIp(req)
    getIpBucket(ip)
    const challenge = createSessionForIp(ip)
    res.json({ ok: true, ...challenge })
  })

  app.get('/api/gate/status', (req, res) => {
    const ip = clientIp(req)
    res.json({
      ok: true,
      passed: hasValidPass(req),
      turnstile: Boolean(env('TURNSTILE_SITE_KEY') && env('TURNSTILE_SECRET_KEY')),
      puzzle: needsPuzzle(ip),
    })
  })

  app.post('/api/gate/verify', async (req, res) => {
    try {
      const ip = clientIp(req)
      const body = req.body || {}
      const mode = String(body.mode || '')

      if (env('TURNSTILE_SECRET_KEY') && (mode === 'turnstile' || body.turnstileToken)) {
        const passed = await verifyTurnstile(body.turnstileToken, ip)
        if (!passed) {
          noteFail(ip)
          res.status(400).json({ ok: false, error: 'Turnstile inválido. Probá de nuevo.', escalate: needsPuzzle(ip) })
          return
        }
        noteSuccess(ip)
        const token = issueToken()
        setPassCookie(res, token)
        let nextUrl = String(body.next || '/')
        if (!nextUrl.startsWith('/') || nextUrl.startsWith('//')) nextUrl = '/'
        res.json({ ok: true, next: nextUrl })
        return
      }

      const sessionId = String(body.sessionId || '')
      const session = sessions.get(sessionId)
      if (!session || session.exp < Date.now()) {
        sessions.delete(sessionId)
        noteFail(ip)
        res.status(400).json({
          ok: false,
          error: 'Sesión expirada. Recargá e intentá de nuevo.',
          escalate: needsPuzzle(ip),
        })
        return
      }

      if (String(body.nonce || '') !== session.nonce) {
        noteFail(ip)
        sessions.delete(sessionId)
        res.status(400).json({ ok: false, error: 'Token inválido.', escalate: true })
        return
      }

      const waitedMs = Number(body.waitedMs || 0)
      const age = Date.now() - session.issuedAt
      if (age < MIN_CHECK_MS - 200 || waitedMs < MIN_CHECK_MS - 400) {
        noteFail(ip)
        sessions.delete(sessionId)
        res.status(400).json({
          ok: false,
          error: 'Verificación demasiado rápida. Probá de nuevo.',
          escalate: needsPuzzle(ip),
        })
        return
      }

      if (session.mode === 'puzzle' || needsPuzzle(ip) || mode === 'puzzle') {
        if (session.mode !== 'puzzle') {
          sessions.delete(sessionId)
          noteFail(ip)
          res.status(400).json({
            ok: false,
            error: 'Se requiere puzzle. Recargá la página.',
            escalate: true,
          })
          return
        }
        const answer = Number(body.answer)
        if (answer !== session.answer) {
          noteFail(ip)
          sessions.delete(sessionId)
          res.status(400).json({
            ok: false,
            error: 'Puzzle incorrecto. Probá otro.',
            escalate: true,
          })
          return
        }
      } else if (mode !== 'soft') {
        noteFail(ip)
        sessions.delete(sessionId)
        res.status(400).json({ ok: false, error: 'Modo inválido.', escalate: needsPuzzle(ip) })
        return
      } else {
        // Soft path: require some browser interaction signal when available
        const interaction = body.interaction || {}
        // Don't hard-fail if no move (keyboard-only / a11y), but flag empty payloads
        if (interaction && typeof interaction === 'object') {
          // ok — presence of object means JS ran
        } else {
          noteFail(ip)
          sessions.delete(sessionId)
          res.status(400).json({
            ok: false,
            error: 'No se pudo validar el navegador.',
            escalate: needsPuzzle(ip),
          })
          return
        }
      }

      sessions.delete(sessionId)
      noteSuccess(ip)
      const token = issueToken()
      setPassCookie(res, token)
      let nextUrl = String(body.next || '/')
      if (!nextUrl.startsWith('/') || nextUrl.startsWith('//')) nextUrl = '/'
      res.json({ ok: true, next: nextUrl })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de verificación'
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post('/api/gate/logout', (_req, res) => {
    clearPassCookie(res)
    res.json({ ok: true })
  })
}
