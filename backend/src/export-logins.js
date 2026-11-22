// Writes all-logins.csv (role, name, details, email, password) into the backend folder.
// Run after seeding:  npm run logins
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'

const rows = db.prepare(`SELECT u.role, u.name, u.email,
  CASE u.role
    WHEN 'student' THEN (SELECT cl.name || '-' || sec.name || ' roll ' || s.roll_no FROM students s JOIN class_sections cs ON cs.id = s.class_section_id JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id WHERE s.user_id = u.id)
    WHEN 'parent' THEN (SELECT su.name || ' (' || cl.name || '-' || sec.name || ' roll ' || s.roll_no || ')' FROM parents p JOIN students s ON s.parent_id = p.id JOIN users su ON su.id = s.user_id JOIN class_sections cs ON cs.id = s.class_section_id JOIN classes cl ON cl.id = cs.class_id JOIN sections sec ON sec.id = cs.section_id WHERE p.user_id = u.id)
    WHEN 'teacher' THEN (SELECT GROUP_CONCAT(DISTINCT sub.name) || ', ' || MIN(cl.name) FROM teachers t JOIN teacher_assignments ta ON ta.teacher_id = t.id JOIN subjects sub ON sub.id = ta.subject_id JOIN class_sections cs ON cs.id = ta.class_section_id JOIN classes cl ON cl.id = cs.class_id WHERE t.user_id = u.id)
    ELSE 'Admin' END detail
  FROM users u ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 WHEN 'student' THEN 2 ELSE 3 END, u.id`).all()

const password = { admin: 'admin123', teacher: 'teach123', student: 'stud123', parent: 'par123' } // default passwords from the seed
const cell = (x) => '"' + String(x ?? '').replace(/"/g, '""') + '"'
const csv = ['role,name,details,email,password', ...rows.map((r) => [r.role, r.name, r.detail, r.email, password[r.role]].map(cell).join(','))].join('\n')
const out = fileURLToPath(new URL('../all-logins.csv', import.meta.url))
writeFileSync(out, csv)
console.log(`Wrote ${rows.length} logins to ${out}`)
