import { config } from '../config.js'
import { verifyToken } from './auth.js'
import { q } from '../db.js'

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export const bad = (m) => new HttpError(400, m)
export const forbidden = (m = 'You do not have access to this.') => new HttpError(403, m)
export const notFound = (m = 'Not found') => new HttpError(404, m)

const routes = []
// roles: null = public, [] = any logged-in user, ['admin','teacher'] = those roles only
export function route(method, path, roles, handler) {
  const keys = []
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '/?$')
  routes.push({ method, re, keys, roles, handler })
}

export function need(body, fields) {
  for (const f of fields) if (body?.[f] === undefined || body[f] === null || String(body[f]).trim() === '') throw bad(`${f} is required`)
}

function loadUser(id) {
  const u = q.get('SELECT id, name, email, role FROM users WHERE id = ?', id)
  if (!u) return null
  if (u.role === 'teacher') u.teacher_id = q.get('SELECT id FROM teachers WHERE user_id = ?', id)?.id
  if (u.role === 'student') u.student_id = q.get('SELECT id FROM students WHERE user_id = ?', id)?.id
  if (u.role === 'parent') {
    u.parent_id = q.get('SELECT id FROM parents WHERE user_id = ?', id)?.id
    u.children = u.parent_id ? q.all('SELECT id FROM students WHERE parent_id = ?', u.parent_id).map((r) => r.id) : []
  }
  return u
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) { size += c.length; if (size > 1_000_000) throw bad('Request too large'); chunks.push(c) }
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString()) } catch { throw bad('Body must be valid JSON') }
}

export async function handle(req, res) {
  const send = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': config.corsOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    })
    res.end(data === undefined ? '' : JSON.stringify(data))
  }
  try {
    if (req.method === 'OPTIONS') return send(204)
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/' || url.pathname === '/api') return send(200, { name: 'Smart School API', status: 'ok' })
    for (const r of routes) {
      if (r.method !== req.method) continue
      const m = url.pathname.replace(/^\/api/, '').match(r.re)
      if (!m) continue
      const ctx = { params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query: Object.fromEntries(url.searchParams), user: null, body: {} }
      if (r.roles) {
        const t = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''))
        ctx.user = t && loadUser(t.id)
        if (!ctx.user) return send(401, { error: 'Please log in.' })
        if (r.roles.length && !r.roles.includes(ctx.user.role)) return send(403, { error: 'Your role cannot do this.' })
      }
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) ctx.body = await readBody(req)
      const out = await r.handler(ctx)
      return send(out?.__status || 200, out?.__status ? out.data : out)
    }
    send(404, { error: 'Route not found' })
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { error: e.message })
    if (String(e.message).includes('UNIQUE')) return send(409, { error: 'That record already exists.' })
    if (String(e.message).includes('FOREIGN KEY') || String(e.message).includes('CHECK')) return send(400, { error: 'Invalid data: ' + e.message })
    console.error(e)
    send(500, { error: 'Server error' })
  }
}
export const created = (data) => ({ __status: 201, data })
