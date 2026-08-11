import crypto from 'node:crypto'
import path from 'node:path'

const COOKIE_NAME = 'stackd_pass'
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 // 24h
const challenges = new Map()

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

function createMathChallenge() {
  const a = Math.floor(Math.random() * 8) + 2
  const b = Math.floor(Math.random() * 8) + 2
  const id = crypto.randomBytes(12).toString('hex')
  const answer = a + b
  challenges.set(id, {
    answer,
    exp: Date.now() + 5 * 60 * 1000,
  })
  // cleanup old
  if (challenges.size > 2000) {
    const now = Date.now()
    for (const [key, value] of challenges) {
      if (value.exp < now) challenges.delete(key)
    }
  }
  return { id, question: `¿Cuánto es ${a} + ${b}?` }
}

function checkMathChallenge(id, answer) {
  const row = challenges.get(String(id || ''))
  if (!row) return false
  challenges.delete(String(id))
  if (row.exp < Date.now()) return false
  return Number(answer) === row.answer
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
  const path = req.path || ''
  if (path === '/api/health') return true
  if (path === '/api/telegram/webhook') return true
  if (path.startsWith('/api/gate/')) return true
  if (path === '/favicon.svg' || path === '/favicon.ico') return true
  if (path === '/robots.txt') return true
  return false
}

function wantsHtml(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  const accept = String(req.headers.accept || '')
  if (accept.includes('text/html')) return true
  // curl / bots often send */* or empty Accept on document URLs
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
  <title>STACKD · Verificación</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  ${hasTurnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
  <style>
    :root {
      --bg: #050508;
      --card: #12121a;
      --ink: #f7f5ff;
      --muted: rgba(247,245,255,.78);
      --purple: #8b5cf6;
      --line: rgba(167,139,250,.22);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; font-family: Outfit, sans-serif; color: var(--ink);
      background:
        radial-gradient(700px 380px at 50% -10%, rgba(139,92,246,.28), transparent 60%),
        var(--bg);
      display: grid; place-items: center; padding: 1.25rem;
    }
    .card {
      width: min(100%, 420px); background: linear-gradient(180deg,#161622,#0d0d14);
      border: 1px solid var(--line); border-radius: 22px; padding: 1.6rem 1.4rem 1.4rem;
      box-shadow: 0 24px 80px rgba(0,0,0,.45);
    }
    .brand {
      font-family: Syne, sans-serif; font-weight: 800; letter-spacing: .08em; margin: 0 0 1rem;
    }
    .brand span { color: var(--purple); }
    h1 {
      font-family: Syne, sans-serif; font-size: 1.55rem; letter-spacing: -.02em;
      margin: 0 0 .55rem; line-height: 1.2;
    }
    p { margin: 0; color: var(--muted); line-height: 1.6; font-weight: 450; }
    .lead { margin-bottom: 1.2rem; }
    label { display: grid; gap: .4rem; margin: 1rem 0 .85rem; font-weight: 600; font-size: .92rem; }
    input {
      border: 1px solid var(--line); border-radius: 12px; background: #0b0b12; color: var(--ink);
      padding: .85rem .95rem; font: inherit;
    }
    input:focus { outline: 2px solid rgba(139,92,246,.5); border-color: var(--purple); }
    .btn {
      width: 100%; border: 0; border-radius: 12px; padding: .9rem 1rem; font: inherit; font-weight: 700;
      cursor: pointer; background: var(--purple); color: #fff;
      box-shadow: 0 10px 30px rgba(139,92,246,.28);
    }
    .btn:disabled { opacity: .55; cursor: wait; }
    .error { color: #ffb4d4; margin: .75rem 0 0; font-weight: 600; min-height: 1.3em; }
    .turnstile { margin: 1rem 0; display: grid; justify-items: center; }
    .hint { margin-top: .9rem; font-size: .88rem; color: rgba(247,245,255,.55); }
  </style>
</head>
<body>
  <main class="card">
    <p class="brand">STACK<span>D</span></p>
    <h1>Verificación anti-bot</h1>
    <p class="lead">Confirmá que sos humano para entrar a la tienda.</p>
    <form id="gate-form">
      ${
        hasTurnstile
          ? `<div class="turnstile"><div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="dark"></div></div>`
          : `<label>Respuesta
              <input id="answer" name="answer" inputmode="numeric" autocomplete="off" required placeholder="Escribí el resultado" />
            </label>
            <p id="question" class="lead" style="margin:0 0 1rem;font-weight:600;color:#d8c4ff"></p>`
      }
      <button class="btn" id="submit" type="submit">Entrar a STACKD</button>
      <p class="error" id="error" aria-live="polite"></p>
      <p class="hint">Esta verificación dura 24 horas en este navegador.</p>
    </form>
  </main>
  <script>
    const hasTurnstile = ${hasTurnstile ? 'true' : 'false'};
    const form = document.getElementById('gate-form');
    const errorEl = document.getElementById('error');
    const submitBtn = document.getElementById('submit');
    let challengeId = '';

    async function loadChallenge() {
      if (hasTurnstile) return;
      const res = await fetch('/api/gate/challenge');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo cargar el desafío');
      challengeId = data.id;
      document.getElementById('question').textContent = data.question;
    }

    loadChallenge().catch((err) => {
      errorEl.textContent = err.message || 'Error cargando verificación';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando…';
      try {
        const payload = {};
        if (hasTurnstile) {
          const tokenInput = document.querySelector('[name="cf-turnstile-response"]');
          payload.turnstileToken = tokenInput ? tokenInput.value : '';
          if (!payload.turnstileToken) throw new Error('Completá la verificación de Cloudflare');
        } else {
          payload.challengeId = challengeId;
          payload.answer = document.getElementById('answer').value.trim();
        }
        const next = new URLSearchParams(location.search).get('next') || '/';
        payload.next = next;
        const res = await fetch('/api/gate/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Verificación fallida');
        location.replace(data.next || '/');
      } catch (err) {
        errorEl.textContent = err.message || 'No se pudo verificar';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar a STACKD';
        if (!hasTurnstile) {
          document.getElementById('answer').value = '';
          loadChallenge().catch(() => {});
        } else if (window.turnstile) {
          window.turnstile.reset();
        }
      }
    });
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
  app.get('/api/gate/challenge', (_req, res) => {
    if (env('TURNSTILE_SITE_KEY') && env('TURNSTILE_SECRET_KEY')) {
      res.json({ ok: true, mode: 'turnstile' })
      return
    }
    const challenge = createMathChallenge()
    res.json({ ok: true, mode: 'math', ...challenge })
  })

  app.get('/api/gate/status', (req, res) => {
    res.json({
      ok: true,
      passed: hasValidPass(req),
      turnstile: Boolean(env('TURNSTILE_SITE_KEY') && env('TURNSTILE_SECRET_KEY')),
    })
  })

  app.post('/api/gate/verify', async (req, res) => {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'] || ''
      let passed = false

      if (env('TURNSTILE_SECRET_KEY')) {
        passed = await verifyTurnstile(req.body?.turnstileToken, String(ip).split(',')[0].trim())
        if (!passed) {
          res.status(400).json({ ok: false, error: 'Turnstile inválido. Probá de nuevo.' })
          return
        }
      } else {
        passed = checkMathChallenge(req.body?.challengeId, req.body?.answer)
        if (!passed) {
          res.status(400).json({ ok: false, error: 'Respuesta incorrecta. Probá de nuevo.' })
          return
        }
      }

      const token = issueToken()
      setPassCookie(res, token)
      let next = String(req.body?.next || '/')
      if (!next.startsWith('/') || next.startsWith('//')) next = '/'
      res.json({ ok: true, next })
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
