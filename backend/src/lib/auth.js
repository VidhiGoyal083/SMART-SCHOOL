import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`
}
export function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':')
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pw, salt, 32)
  return a.length === b.length && timingSafeEqual(a, b)
}
const b64 = (s) => Buffer.from(s).toString('base64url')
const sig = (data) => createHmac('sha256', config.secret).update(data).digest('base64url')

export function signToken(payload) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + config.tokenHours * 3600_000 }))
  return `${body}.${sig(body)}`
}
export function verifyToken(token) {
  const [body, s] = String(token || '').split('.')
  if (!body || !s) return null
  const good = sig(body)
  if (s.length !== good.length || !timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null
  const p = JSON.parse(Buffer.from(body, 'base64url').toString())
  return p.exp > Date.now() ? p : null
}
