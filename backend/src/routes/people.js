import { q, tx } from '../db.js'
import { route, need, bad, notFound, forbidden, created } from '../lib/http.js'
import { hashPassword } from '../lib/auth.js'
import { teacherSections, getStudent, assertStudent, allStats, risk, feeStatus } from '../lib/access.js'

const dflt = (role) => ({ student: 'stud123', parent: 'par123', teacher: 'teach123' }[role])
const mail = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

// ---------- Students ----------
const SEL = `SELECT s.id, s.roll_no, s.class_section_id, s.parent_id, u.name, u.email, cl.name || '-' || sec.name class_section, pu.name parent_name, pu.email parent_email
  FROM students s JOIN users u ON u.id = s.user_id JOIN class_sections cs ON cs.id = s.class_section_id JOIN classes cl ON cl.id = cs.class_id
  JOIN sections sec ON sec.id = cs.section_id LEFT JOIN parents p ON p.id = s.parent_id LEFT JOIN users pu ON pu.id = p.user_id`

route('GET', '/students', ['admin', 'teacher'], ({ user, query }) => {
  const where = [], args = []
  if (user.role === 'teacher') { const s = teacherSections(user.teacher_id); where.push(`s.class_section_id IN (${s.map(() => '?').join(',') || 'NULL'})`); args.push(...s) }
  if (query.class_section_id) { where.push('s.class_section_id = ?'); args.push(query.class_section_id) }
  if (query.class_id) { where.push('cs.class_id = ?'); args.push(query.class_id) }
  if (query.section_id) { where.push('cs.section_id = ?'); args.push(query.section_id) }
  if (query.q) { where.push('u.name LIKE ?'); args.push(`%${query.q}%`) }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const total = q.get(`SELECT COUNT(*) n FROM students s JOIN users u ON u.id = s.user_id JOIN class_sections cs ON cs.id = s.class_section_id ${w}`, ...args).n
  const rows = q.all(`${SEL} ${w} ORDER BY s.class_section_id, s.roll_no LIMIT ? OFFSET ?`, ...args, Math.min(+query.limit || 50, 200), +query.offset || 0)
  const st = allStats()
  return { total, rows: rows.map((r) => ({ ...r, ...st.get(r.id) })) }
})

route('POST', '/students', ['admin'], ({ body }) => tx(() => {
  need(body, ['name', 'class_section_id', 'roll_no', 'parent_name'])
  const base = mail(body.name)
  const uid = q.run('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', body.name, body.email || `${base}@school.in`, hashPassword(dflt('student')), 'student').id
  let pid = null
  if (body.parent_id) pid = body.parent_id
  else {
    const pu = q.run('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', body.parent_name, body.parent_email || `parent.${base}@school.in`, hashPassword(dflt('parent')), 'parent').id
    pid = q.run('INSERT INTO parents (user_id,phone) VALUES (?,?)', pu, body.parent_phone || null).id
  }
  const id = q.run('INSERT INTO students (user_id,class_section_id,roll_no,parent_id) VALUES (?,?,?,?)', uid, body.class_section_id, body.roll_no, pid).id
  q.run('INSERT INTO fees (student_id,total,paid,due_date) VALUES (?,?,0,?)', id, body.fee_total || 40000, new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10))
  return created(q.get(`${SEL} WHERE s.id = ?`, id))
}))

route('PUT', '/students/:id', ['admin'], ({ params, body }) => tx(() => {
  const s = getStudent(params.id)
  if (body.name) q.run('UPDATE users SET name = ? WHERE id = ?', body.name, s.user_id)
  if (body.class_section_id || body.roll_no) q.run('UPDATE students SET class_section_id = ?, roll_no = ? WHERE id = ?', body.class_section_id || s.class_section_id, body.roll_no || s.roll_no, s.id)
  return q.get(`${SEL} WHERE s.id = ?`, s.id)
}))
route('DELETE', '/students/:id', ['admin'], ({ params }) => { const s = getStudent(params.id); q.run('DELETE FROM users WHERE id = ?', s.user_id); return { deleted: true } })

// One student's full picture (profile, attendance, results, assignments, fees, risk)
route('GET', '/students/:id/summary', [], ({ user, params }) => {
  const s = assertStudent(user, params.id)
  const stats = allStats().get(s.id)
  const marks = q.all(`SELECT sub.name subject, e.name exam, m.marks FROM marks m JOIN subjects sub ON sub.id = m.subject_id JOIN exams e ON e.id = m.exam_id WHERE m.student_id = ? ORDER BY e.id, sub.id`, s.id)
  const att = q.all('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC LIMIT 30', s.id)
  const asg = q.all(`SELECT a.id, a.title, a.due_date, sub.name subject, (SELECT COUNT(*) FROM submissions x WHERE x.assignment_id = a.id AND x.student_id = ?) submitted
    FROM assignments a JOIN subjects sub ON sub.id = a.subject_id WHERE a.class_section_id = ? ORDER BY a.due_date`, s.id, s.class_section_id)
  const fee = q.get('SELECT total, paid, due_date FROM fees WHERE student_id = ?', s.id)
  return { student: s, attendance_percent: stats.att, average_marks: stats.avg, trend: stats.trend, missing_assignments: stats.miss, recent_attendance: att, results: marks, assignments: asg, fees: fee && { ...fee, status: feeStatus(fee) }, support: risk(stats) }
})

// ---------- Teachers ----------
const TSEL = `SELECT t.id, t.employee_code, t.phone, u.name, u.email,
  (SELECT GROUP_CONCAT(DISTINCT sub.name) FROM teacher_assignments ta JOIN subjects sub ON sub.id = ta.subject_id WHERE ta.teacher_id = t.id) subjects,
  (SELECT COUNT(*) FROM teacher_assignments ta WHERE ta.teacher_id = t.id) classes_taught FROM teachers t JOIN users u ON u.id = t.user_id`
route('GET', '/teachers', ['admin', 'teacher'], ({ query }) => q.all(`${TSEL} ${query.q ? 'WHERE u.name LIKE ?' : ''} ORDER BY t.id`, ...(query.q ? [`%${query.q}%`] : [])))
route('POST', '/teachers', ['admin'], ({ body }) => tx(() => {
  need(body, ['name', 'email'])
  const uid = q.run('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', body.name, body.email, hashPassword(dflt('teacher')), 'teacher').id
  const n = q.get('SELECT COUNT(*) n FROM teachers').n + 1
  const id = q.run('INSERT INTO teachers (user_id,employee_code,phone) VALUES (?,?,?)', uid, body.employee_code || `EMP${String(n).padStart(3, '0')}${Date.now() % 1000}`, body.phone || null).id
  return created(q.get(`${TSEL} WHERE t.id = ?`, id))
}))
route('PUT', '/teachers/:id', ['admin'], ({ params, body }) => {
  const t = q.get('SELECT * FROM teachers WHERE id = ?', params.id); if (!t) throw notFound()
  if (body.name) q.run('UPDATE users SET name = ? WHERE id = ?', body.name, t.user_id)
  if (body.phone) q.run('UPDATE teachers SET phone = ? WHERE id = ?', body.phone, t.id)
  return q.get(`${TSEL} WHERE t.id = ?`, t.id)
})
route('DELETE', '/teachers/:id', ['admin'], ({ params }) => {
  const t = q.get('SELECT * FROM teachers WHERE id = ?', params.id); if (!t) throw notFound()
  if (q.get('SELECT COUNT(*) n FROM assignments WHERE teacher_id = ?', t.id).n) throw bad('This teacher has assignments on record. Reassign them first.')
  q.run('DELETE FROM users WHERE id = ?', t.user_id); return { deleted: true }
})
route('GET', '/parents', ['admin'], () => q.all(`SELECT p.id, u.name, u.email, p.phone, (SELECT GROUP_CONCAT(su.name) FROM students s JOIN users su ON su.id = s.user_id WHERE s.parent_id = p.id) children FROM parents p JOIN users u ON u.id = p.user_id ORDER BY p.id`))

// ---------- Class and subject management ----------
route('GET', '/teacher-assignments', ['admin', 'teacher'], ({ query }) => q.all(`SELECT ta.id, ta.class_section_id, cl.name || '-' || sec.name class_section, sub.name subject, ta.teacher_id, u.name teacher
  FROM teacher_assignments ta JOIN class_sections cs ON cs.id = ta.class_section_id JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id
  JOIN subjects sub ON sub.id = ta.subject_id JOIN teachers t ON t.id = ta.teacher_id JOIN users u ON u.id = t.user_id
  ${query.class_section_id ? 'WHERE ta.class_section_id = ?' : ''} ORDER BY ta.class_section_id, sub.id`, ...(query.class_section_id ? [query.class_section_id] : [])))
route('POST', '/teacher-assignments', ['admin'], ({ body }) => {
  need(body, ['class_section_id', 'subject_id', 'teacher_id'])
  q.run('INSERT INTO teacher_assignments (class_section_id,subject_id,teacher_id) VALUES (?,?,?) ON CONFLICT(class_section_id,subject_id) DO UPDATE SET teacher_id = excluded.teacher_id', body.class_section_id, body.subject_id, body.teacher_id)
  return created({ saved: true })
})
route('POST', '/subjects', ['admin'], ({ body }) => { need(body, ['code', 'name']); return created(q.get('SELECT * FROM subjects WHERE id = ?', q.run('INSERT INTO subjects (code,name) VALUES (?,?)', body.code, body.name).id)) })
route('POST', '/class-sections', ['admin'], ({ body }) => { need(body, ['class_id', 'section_id']); return created({ id: q.run('INSERT INTO class_sections (class_id,section_id,class_teacher_id) VALUES (?,?,?)', body.class_id, body.section_id, body.class_teacher_id || null).id }) })

// ---------- Announcements ----------
const ASEL = 'SELECT a.id, a.title, a.body, a.created_at, u.name author FROM announcements a JOIN users u ON u.id = a.author_id'
route('GET', '/announcements', [], () => q.all(`${ASEL} ORDER BY a.id DESC`))
route('POST', '/announcements', ['admin', 'teacher'], ({ user, body }) => { need(body, ['title', 'body']); return created(q.get(`${ASEL} WHERE a.id = ?`, q.run('INSERT INTO announcements (title,body,author_id) VALUES (?,?,?)', body.title, body.body, user.id).id)) })
route('PUT', '/announcements/:id', ['admin'], ({ params, body }) => { need(body, ['title', 'body']); q.run('UPDATE announcements SET title = ?, body = ? WHERE id = ?', body.title, body.body, params.id); return q.get(`${ASEL} WHERE a.id = ?`, params.id) || (() => { throw notFound() })() })
route('DELETE', '/announcements/:id', ['admin'], ({ params }) => { q.run('DELETE FROM announcements WHERE id = ?', params.id); return { deleted: true } })

// ---------- Fees ----------
route('GET', '/fees', ['admin'], ({ query }) => q.all(`SELECT f.student_id, u.name, cl.name || '-' || sec.name class_section, f.total, f.paid, f.due_date FROM fees f JOIN students s ON s.id = f.student_id
  JOIN users u ON u.id = s.user_id JOIN class_sections cs ON cs.id = s.class_section_id JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id
  ${query.q ? 'WHERE u.name LIKE ?' : ''} ORDER BY u.name LIMIT 300`, ...(query.q ? [`%${query.q}%`] : [])).map((f) => ({ ...f, status: feeStatus(f) })))
route('POST', '/fees/:studentId/payments', ['admin'], ({ params, body }) => {
  need(body, ['amount']); const a = Number(body.amount)
  const f = q.get('SELECT * FROM fees WHERE student_id = ?', params.studentId); if (!f) throw notFound()
  if (!(a > 0)) throw bad('Amount must be greater than zero.')
  const paid = Math.min(f.total, f.paid + a); q.run('UPDATE fees SET paid = ? WHERE id = ?', paid, f.id)
  return { ...f, paid, status: feeStatus({ total: f.total, paid }) }
})
