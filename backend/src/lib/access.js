import { q } from '../db.js'
import { forbidden, notFound } from './http.js'

export const teacherSections = (tid) => q.all(
  'SELECT class_section_id id FROM teacher_assignments WHERE teacher_id = ? UNION SELECT id FROM class_sections WHERE class_teacher_id = ?', tid, tid).map((r) => r.id)

export function getStudent(id) {
  const s = q.get(`SELECT s.id, s.roll_no, s.class_section_id, s.parent_id, u.id user_id, u.name, u.email, cl.name class_name, sec.name section_name
    FROM students s JOIN users u ON u.id = s.user_id JOIN class_sections cs ON cs.id = s.class_section_id
    JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id WHERE s.id = ?`, id)
  if (!s) throw notFound('Student not found')
  return s
}
export function canViewStudent(u, s) {
  if (u.role === 'admin') return true
  if (u.role === 'student') return u.student_id === s.id
  if (u.role === 'parent') return u.children.includes(s.id)
  return teacherSections(u.teacher_id).includes(s.class_section_id)
}
export function assertStudent(u, id) {
  const s = getStudent(id)
  if (!canViewStudent(u, s)) throw forbidden()
  return s
}

// Attendance %, average marks, exam trend and missing assignments for every student (used by dashboards and the Support Radar)
export function allStats() {
  const today = new Date().toISOString().slice(0, 10)
  const out = new Map()
  const get = (id) => out.get(id) || out.set(id, { att: 100, avg: 0, trend: 0, miss: 0 }).get(id)
  for (const r of q.all("SELECT student_id id, COUNT(*) t, SUM(status != 'A') p FROM attendance GROUP BY student_id")) get(r.id).att = Math.round((r.p * 100) / r.t)
  const per = {}
  for (const r of q.all('SELECT m.student_id id, m.exam_id e, AVG(m.marks) a FROM marks m GROUP BY m.student_id, m.exam_id ORDER BY m.exam_id')) (per[r.id] = per[r.id] || []).push(r.a)
  for (const [id, a] of Object.entries(per)) { const s = get(+id); s.avg = Math.round(a.reduce((x, y) => x + y, 0) / a.length); s.trend = a.length > 1 ? Math.round(a[a.length - 1] - a[0]) : 0 }
  for (const r of q.all(`SELECT s.id, COUNT(a.id) n FROM students s JOIN assignments a ON a.class_section_id = s.class_section_id AND a.due_date < ?
    LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = s.id WHERE sub.id IS NULL GROUP BY s.id`, today)) get(r.id).miss = r.n
  return out
}
export function risk(s) {
  let n = 0; const why = []
  if (s.att < 75) { n += 2; why.push(`Attendance is ${s.att}%, well below 75%`) } else if (s.att < 85) { n += 1; why.push(`Attendance is ${s.att}%, below 85%`) }
  if (s.avg < 50) { n += 2; why.push(`Average marks are ${s.avg}%`) } else if (s.avg < 65) { n += 1; why.push(`Average marks are ${s.avg}%`) }
  if (s.miss >= 4) { n += 2; why.push(`${s.miss} assignments missing`) } else if (s.miss >= 2) { n += 1; why.push(`${s.miss} assignments missing`) }
  if (s.trend <= -8) { n += 1; why.push(`Marks fell ${Math.abs(s.trend)} points since the last exam`) }
  return { score: n, reasons: why, priority: n >= 4 ? 'High' : n >= 2 ? 'Medium' : n >= 1 ? 'Low' : 'None' }
}
export const feeStatus = (f) => (f.paid >= f.total ? 'Paid' : f.paid > 0 ? 'Part' : 'Due')
