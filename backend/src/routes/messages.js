import { q } from '../db.js'
import { route, need, bad, forbidden, created } from '../lib/http.js'
import { teacherSections } from '../lib/access.js'

// Who may message whom: parents/students <-> teachers of the child's class, teachers <-> admin. Admin may message anyone.
function sectionsOf(u) {
  if (u.role === 'teacher') return teacherSections(u.teacher_id)
  if (u.role === 'student') return [q.get('SELECT class_section_id c FROM students WHERE id = ?', u.student_id)?.c]
  if (u.role === 'parent') return u.children.map((id) => q.get('SELECT class_section_id c FROM students WHERE id = ?', id)?.c)
  return []
}
const canMessage = (a, b) => a.role === 'admin' || b.role === 'admin' || (a.role !== b.role && (a.role === 'teacher' || b.role === 'teacher')
  && (() => { const s = sectionsOf(b); return sectionsOf(a).some((x) => s.includes(x)) })())
const userOf = (id) => {
  const u = q.get('SELECT id, name, role FROM users WHERE id = ?', id); if (!u) return null
  if (u.role === 'teacher') u.teacher_id = q.get('SELECT id FROM teachers WHERE user_id = ?', id)?.id
  if (u.role === 'student') u.student_id = q.get('SELECT id FROM students WHERE user_id = ?', id)?.id
  if (u.role === 'parent') u.children = q.all('SELECT s.id FROM students s JOIN parents p ON p.id = s.parent_id WHERE p.user_id = ?', id).map((r) => r.id)
  return u
}

route('GET', '/contacts', [], ({ user, query }) => {
  let rows
  if (user.role === 'teacher') {
    const s = teacherSections(user.teacher_id), ph = s.map(() => '?').join(',') || 'NULL'
    rows = q.all(`SELECT DISTINCT u.id, u.name, u.role FROM students st JOIN parents p ON p.id = st.parent_id JOIN users u ON u.id IN (p.user_id, st.user_id) WHERE st.class_section_id IN (${ph}) ${query.q ? 'AND u.name LIKE ?' : ''} ORDER BY u.name LIMIT 100`, ...s, ...(query.q ? [`%${query.q}%`] : []))
  } else if (user.role === 'admin') rows = q.all(`SELECT id, name, role FROM users WHERE id != ? ${query.q ? 'AND name LIKE ?' : ''} ORDER BY name LIMIT 100`, user.id, ...(query.q ? [`%${query.q}%`] : []))
  else {
    const s = [...new Set(sectionsOf(user))], ph = s.map(() => '?').join(',') || 'NULL'
    rows = q.all(`SELECT DISTINCT u.id, u.name, u.role, 'teacher' kind FROM teacher_assignments ta JOIN teachers t ON t.id = ta.teacher_id JOIN users u ON u.id = t.user_id WHERE ta.class_section_id IN (${ph}) ORDER BY u.name`, ...s)
  }
  return rows
})

route('GET', '/messages/inbox', [], ({ user }) => q.all(`SELECT u.id user_id, u.name, u.role, m.body last_message, m.created_at,
  (SELECT COUNT(*) FROM messages x WHERE x.sender_id = u.id AND x.receiver_id = ? AND x.is_read = 0) unread
  FROM messages m JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
  WHERE m.id IN (SELECT MAX(id) FROM messages WHERE sender_id = ? OR receiver_id = ? GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END)
  ORDER BY m.id DESC`, user.id, user.id, user.id, user.id, user.id))

route('GET', '/messages', [], ({ user, query }) => {
  need(query, ['with'])
  q.run('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', query.with, user.id)
  return q.all('SELECT id, sender_id, receiver_id, body, created_at, sender_id = ? mine FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY id', user.id, user.id, query.with, query.with, user.id)
})

route('POST', '/messages', [], ({ user, body }) => {
  need(body, ['to_user_id', 'body'])
  const to = userOf(body.to_user_id); if (!to) throw bad('Recipient not found')
  if (to.id === user.id) throw bad('You cannot message yourself.')
  if (!canMessage(user, to)) throw forbidden('You can only message teachers of your class (or parents and students you teach).')
  const id = q.run('INSERT INTO messages (sender_id,receiver_id,body) VALUES (?,?,?)', user.id, to.id, String(body.body).trim()).id
  return created(q.get('SELECT * FROM messages WHERE id = ?', id))
})
