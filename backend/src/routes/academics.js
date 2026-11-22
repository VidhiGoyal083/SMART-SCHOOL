import { q, tx } from '../db.js'
import { route, need, bad, forbidden, notFound, created } from '../lib/http.js'
import { teacherSections, assertStudent, allStats, risk } from '../lib/access.js'

const today = () => new Date().toISOString().slice(0, 10)
const mySection = (u) => (u.role === 'student' ? q.get('SELECT class_section_id c FROM students WHERE id = ?', u.student_id)?.c : null)
function assertSection(u, csId) {
  if (u.role === 'admin') return
  if (u.role === 'teacher' && teacherSections(u.teacher_id).includes(+csId)) return
  throw forbidden('You do not teach this class.')
}

// ---------- Attendance ----------
route('GET', '/attendance', ['admin', 'teacher'], ({ user, query }) => {
  need(query, ['class_section_id']); assertSection(user, query.class_section_id)
  const date = query.date || today()
  return { date, students: q.all(`SELECT s.id student_id, s.roll_no, u.name, a.status FROM students s JOIN users u ON u.id = s.user_id
    LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ? WHERE s.class_section_id = ? ORDER BY s.roll_no`, date, query.class_section_id) }
})
route('POST', '/attendance', ['admin', 'teacher'], ({ user, body }) => tx(() => {
  need(body, ['class_section_id', 'records']); assertSection(user, body.class_section_id)
  const date = body.date || today()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('date must be YYYY-MM-DD')
  for (const r of body.records) {
    if (!['P', 'A', 'L'].includes(r.status)) throw bad('status must be P, A or L')
    if (!q.get('SELECT 1 x FROM students WHERE id = ? AND class_section_id = ?', r.student_id, body.class_section_id)) throw bad(`Student ${r.student_id} is not in this class`)
    q.run('INSERT INTO attendance (student_id,date,status,marked_by) VALUES (?,?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by', r.student_id, date, r.status, user.id)
  }
  return { saved: body.records.length, date }
}))

// ---------- Marks ----------
route('POST', '/marks', ['admin', 'teacher'], ({ user, body }) => tx(() => {
  need(body, ['exam_id', 'subject_id', 'records'])
  for (const r of body.records) {
    const s = q.get('SELECT class_section_id c FROM students WHERE id = ?', r.student_id); if (!s) throw bad(`Student ${r.student_id} not found`)
    if (user.role === 'teacher' && !q.get('SELECT 1 x FROM teacher_assignments WHERE teacher_id = ? AND class_section_id = ? AND subject_id = ?', user.teacher_id, s.c, body.subject_id)) throw forbidden('You do not teach this subject to that class.')
    const m = Number(r.marks); if (Number.isNaN(m) || m < 0 || m > 100) throw bad('marks must be between 0 and 100')
    q.run('INSERT INTO marks (student_id,subject_id,exam_id,marks) VALUES (?,?,?,?) ON CONFLICT(student_id,subject_id,exam_id) DO UPDATE SET marks = excluded.marks', r.student_id, body.subject_id, body.exam_id, m)
  }
  return { saved: body.records.length }
}))
route('GET', '/marks', ['admin', 'teacher'], ({ user, query }) => {
  need(query, ['class_section_id', 'subject_id', 'exam_id']); assertSection(user, query.class_section_id)
  return q.all(`SELECT s.id student_id, s.roll_no, u.name, m.marks FROM students s JOIN users u ON u.id = s.user_id
    LEFT JOIN marks m ON m.student_id = s.id AND m.subject_id = ? AND m.exam_id = ? WHERE s.class_section_id = ? ORDER BY s.roll_no`, query.subject_id, query.exam_id, query.class_section_id)
})

// ---------- Assignments ----------
const ASG = `SELECT a.id, a.title, a.description, a.due_date, a.class_section_id, sub.name subject, u.name teacher, cl.name || '-' || sec.name class_section,
  (SELECT COUNT(*) FROM submissions x WHERE x.assignment_id = a.id) submissions,
  (SELECT COUNT(*) FROM students s WHERE s.class_section_id = a.class_section_id) class_size
  FROM assignments a JOIN subjects sub ON sub.id = a.subject_id JOIN teachers t ON t.id = a.teacher_id JOIN users u ON u.id = t.user_id
  JOIN class_sections cs ON cs.id = a.class_section_id JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id`
route('GET', '/assignments', [], ({ user, query }) => {
  if (user.role === 'teacher') return q.all(`${ASG} WHERE a.teacher_id = ? ${query.class_section_id ? 'AND a.class_section_id = ?' : ''} ORDER BY a.due_date DESC`, user.teacher_id, ...(query.class_section_id ? [query.class_section_id] : []))
  if (user.role === 'admin') return q.all(`${ASG} ${query.class_section_id ? 'WHERE a.class_section_id = ?' : ''} ORDER BY a.due_date DESC LIMIT 200`, ...(query.class_section_id ? [query.class_section_id] : []))
  const sid = user.role === 'student' ? user.student_id : +query.student_id
  if (!sid) throw bad('student_id is required for parents')
  const s = assertStudent(user, sid)
  return q.all(`${ASG} WHERE a.class_section_id = ? ORDER BY a.due_date`, s.class_section_id).map((a) => ({ ...a, submitted: !!q.get('SELECT 1 x FROM submissions WHERE assignment_id = ? AND student_id = ?', a.id, sid) }))
})
route('POST', '/assignments', ['teacher'], ({ user, body }) => {
  need(body, ['class_section_id', 'subject_id', 'title', 'due_date'])
  if (!q.get('SELECT 1 x FROM teacher_assignments WHERE teacher_id = ? AND class_section_id = ? AND subject_id = ?', user.teacher_id, body.class_section_id, body.subject_id)) throw forbidden('You do not teach this subject to that class.')
  const id = q.run('INSERT INTO assignments (class_section_id,subject_id,teacher_id,title,description,due_date) VALUES (?,?,?,?,?,?)', body.class_section_id, body.subject_id, user.teacher_id, body.title, body.description || '', body.due_date).id
  return created(q.get(`${ASG} WHERE a.id = ?`, id))
})
route('GET', '/assignments/:id/submissions', ['admin', 'teacher'], ({ user, params }) => {
  const a = q.get('SELECT * FROM assignments WHERE id = ?', params.id); if (!a) throw notFound()
  assertSection(user, a.class_section_id)
  return q.all(`SELECT s.id student_id, s.roll_no, u.name, x.submitted_at, x.text, x.id IS NOT NULL submitted FROM students s JOIN users u ON u.id = s.user_id
    LEFT JOIN submissions x ON x.student_id = s.id AND x.assignment_id = ? WHERE s.class_section_id = ? ORDER BY s.roll_no`, a.id, a.class_section_id)
})
route('POST', '/assignments/:id/submit', ['student'], ({ user, params, body }) => {
  const a = q.get('SELECT * FROM assignments WHERE id = ?', params.id); if (!a) throw notFound()
  if (a.class_section_id !== mySection(user)) throw forbidden('This assignment is for another class.')
  q.run('INSERT INTO submissions (assignment_id,student_id,text) VALUES (?,?,?)', a.id, user.student_id, body.text || '')
  return created({ submitted: true })
})

// ---------- Timetable ----------
route('GET', '/timetable', [], ({ user, query }) => {
  let cs = query.class_section_id
  if (user.role === 'student') cs = mySection(user)
  else if (user.role === 'parent') cs = assertStudent(user, query.student_id || user.children[0]).class_section_id
  else if (user.role === 'teacher') return q.all(`SELECT tt.day, tt.period, cl.name || '-' || sec.name class_section, sub.name subject FROM timetable tt
    JOIN teacher_assignments ta ON ta.class_section_id = tt.class_section_id AND ta.subject_id = tt.subject_id AND ta.teacher_id = ?
    JOIN class_sections cs ON cs.id = tt.class_section_id JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id JOIN subjects sub ON sub.id = tt.subject_id
    ORDER BY tt.day, tt.period`, user.teacher_id)
  if (!cs) throw bad('class_section_id is required')
  return q.all('SELECT tt.day, tt.period, sub.name subject FROM timetable tt JOIN subjects sub ON sub.id = tt.subject_id WHERE tt.class_section_id = ? ORDER BY tt.day, tt.period', cs)
})

// ---------- Student Support Radar ----------
route('GET', '/radar', ['admin', 'teacher'], ({ user, query }) => {
  const where = [], args = []
  if (user.role === 'teacher') { const s = teacherSections(user.teacher_id); where.push(`s.class_section_id IN (${s.map(() => '?').join(',') || 'NULL'})`); args.push(...s) }
  if (query.class_section_id) { where.push('s.class_section_id = ?'); args.push(query.class_section_id) }
  if (query.q) { where.push('u.name LIKE ?'); args.push(`%${query.q}%`) }
  const rows = q.all(`SELECT s.id student_id, u.name, cl.name || '-' || sec.name class_section FROM students s JOIN users u ON u.id = s.user_id
    JOIN class_sections cs ON cs.id = s.class_section_id JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, ...args)
  const st = allStats(), order = { High: 0, Medium: 1, Low: 2 }
  return rows.map((r) => ({ ...r, ...st.get(r.student_id), ...risk(st.get(r.student_id)) }))
    .filter((r) => r.score > 0 && (!query.priority || r.priority === query.priority))
    .sort((a, b) => order[a.priority] - order[b.priority] || b.score - a.score)
    .slice(0, Math.min(+query.limit || 300, 1000))
})
