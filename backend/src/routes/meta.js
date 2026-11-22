import { q } from '../db.js'
import { route } from '../lib/http.js'
import { allStats, risk, teacherSections, feeStatus } from '../lib/access.js'

const CS = `SELECT cs.id, cl.name class_name, sec.name section_name, cl.name || '-' || sec.name label, cs.class_teacher_id,
  (SELECT COUNT(*) FROM students s WHERE s.class_section_id = cs.id) student_count
  FROM class_sections cs JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id`

route('GET', '/meta', [], () => ({
  classes: q.all('SELECT * FROM classes'), sections: q.all('SELECT * FROM sections'), subjects: q.all('SELECT * FROM subjects'),
  exams: q.all('SELECT * FROM exams'), class_sections: q.all(CS + ' ORDER BY cl.id, sec.id'),
}))

route('GET', '/dashboard', [], ({ user }) => {
  const stats = allStats()
  if (user.role === 'admin') {
    const rows = q.all('SELECT id, class_section_id FROM students')
    const by = {}
    for (const r of rows) { const s = stats.get(r.id); (by[r.class_section_id] ||= []).push(s) }
    const mean = (a, k) => Math.round(a.reduce((x, y) => x + y[k], 0) / (a.length || 1))
    const labels = Object.fromEntries(q.all(CS).map((c) => [c.id, c.label]))
    const fees = q.all('SELECT * FROM fees')
    return {
      totals: { students: rows.length, teachers: q.get('SELECT COUNT(*) n FROM teachers').n, parents: q.get('SELECT COUNT(*) n FROM parents').n,
        classes: q.get('SELECT COUNT(*) n FROM classes').n, sections: q.get('SELECT COUNT(*) n FROM sections').n, subjects: q.get('SELECT COUNT(*) n FROM subjects').n },
      attendance_by_section: Object.entries(by).map(([id, a]) => ({ class_section: labels[id], attendance: mean(a, 'att'), average_marks: mean(a, 'avg') })),
      fees: { collected: fees.reduce((x, f) => x + f.paid, 0), pending: fees.reduce((x, f) => x + (f.total - f.paid), 0), students_with_dues: fees.filter((f) => feeStatus(f) !== 'Paid').length },
      support_radar: { high: [...stats.values()].filter((s) => risk(s).priority === 'High').length, medium: [...stats.values()].filter((s) => risk(s).priority === 'Medium').length },
    }
  }
  if (user.role === 'teacher') {
    const secs = teacherSections(user.teacher_id), ph = secs.map(() => '?').join(',') || 'NULL'
    const ids = q.all(`SELECT id FROM students WHERE class_section_id IN (${ph})`, ...secs).map((r) => r.id)
    const list = ids.map((i) => stats.get(i))
    return {
      sections: q.all(CS + ` WHERE cs.id IN (${ph})`, ...secs), students: ids.length,
      average_attendance: Math.round(list.reduce((x, s) => x + s.att, 0) / (list.length || 1)),
      need_support: list.filter((s) => risk(s).score >= 2).length,
      unread_messages: q.get('SELECT COUNT(*) n FROM messages WHERE receiver_id = ? AND is_read = 0', user.id).n,
    }
  }
  const kids = user.role === 'student' ? [user.student_id] : user.children
  return { children: kids.map((id) => ({ student_id: id, ...stats.get(id), priority: risk(stats.get(id)).priority })) }
})
