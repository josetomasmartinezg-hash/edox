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
    { expiresIn: '30d' },
  )
}

export function authOptional(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    req.user = null
    return next()
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const users = readJson('users.json', [])
    const user = users.find((u) => u.id === payload.sub && u.active !== false)
    req.user = user ? publicUser(user) : null
  } catch {
    req.user = null
  }
  next()
}

export function authRequired(req, res, next) {
  authOptional(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión' })
    }
    next()
  })
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión' })
    }
    if (req.user.isPrincipal || roleCan(req.user.role, permission)) {
      return next()
    }
    return res.status(403).json({ error: 'No tienes permiso para esta acción' })
  }
}
