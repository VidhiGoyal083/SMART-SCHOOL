import { q } from '../db.js'
import { route, need, bad, created } from '../lib/http.js'
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js'

const email = (e) => /^\S+@\S+\.\S+$/.test(e)

route('POST', '/auth/login', null, ({ body }) => {
  need(body, ['email', 'password'])
  const u = q.get('SELECT * FROM users WHERE email = ?', body.email.trim())
  if (!u || !verifyPassword(body.password, u.password_hash)) throw bad('Email or password is incorrect.')
  if (body.role && body.role !== u.role) throw bad(`This account is not a ${body.role} account.`)
  return { token: signToken({ id: u.id, role: u.role }), user: { id: u.id, name: u.name, email: u.email, role: u.role } }
})

// Self-registration creates a parent account. An admin links the child (see POST /students).
route('POST', '/auth/register', null, ({ body }) => {
  need(body, ['name', 'email', 'password'])
  if (!email(body.email)) throw bad('Enter a valid email address.')
  if (body.password.length < 6) throw bad('Password must be at least 6 characters.')
  const id = q.run('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', body.name.trim(), body.email.trim(), hashPassword(body.password), 'parent').id
  q.run('INSERT INTO parents (user_id) VALUES (?)', id)
  return created({ message: 'Account created. You can now log in.' })
})

// Mock: a real system would email a reset link. The reply is the same whether or not the email exists.
route('POST', '/auth/forgot', null, ({ body }) => {
  need(body, ['email'])
  return { message: 'If this email is registered, a reset link has been sent.' }
})

route('POST', '/auth/change-password', [], ({ user, body }) => {
  need(body, ['current_password', 'new_password'])
  const u = q.get('SELECT password_hash FROM users WHERE id = ?', user.id)
  if (!verifyPassword(body.current_password, u.password_hash)) throw bad('Current password is incorrect.')
  if (body.new_password.length < 6) throw bad('Password must be at least 6 characters.')
  q.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(body.new_password), user.id)
  return { message: 'Password updated.' }
})

route('GET', '/me', [], ({ user }) => user)
