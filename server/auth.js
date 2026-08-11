import jwt from 'jsonwebtoken'
import { readJson } from './store.js'
import { publicUser, roleCan } from './constants.js'

const JWT_SECRET = process.env.EDOX_JWT_SECRET || 'edox-dev-secret-change-me'

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      isPrincipal: !!user.isPrincipal,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '365d' },
  )
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    // Tolera desfase de reloj entre servidor y cliente/proxy
    clockTolerance: 60 * 60 * 24,
  })
}

export function authOptional(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  req.authError = null
  if (!token) {
    req.user = null
    return next()
  }
  try {
    const payload = verifyToken(token)
    const users = readJson('users.json', [])
    const user = users.find((u) => u.id === payload.sub && u.active !== false)
    req.user = user ? publicUser(user) : null
    if (!req.user) req.authError = 'invalid_user'
  } catch (err) {
    req.user = null
    req.authError = err?.name === 'TokenExpiredError' ? 'expired' : 'invalid'
  }
  next()
}

export function authRequired(req, res, next) {
  authOptional(req, res, () => {
    if (!req.user) {
      const message =
        req.authError === 'expired'
          ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
          : 'Debes iniciar sesión'
      return res.status(401).json({ error: message, code: req.authError || 'unauthenticated' })
    }
    next()
  })
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Tu sesión expiró. Vuelve a iniciar sesión.',
        code: 'unauthenticated',
      })
    }
    if (req.user.isPrincipal || roleCan(req.user.role, permission)) {
      return next()
    }
    return res.status(403).json({ error: 'No tienes permiso para esta acción' })
  }
}
