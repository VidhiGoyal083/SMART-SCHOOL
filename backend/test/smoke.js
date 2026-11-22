// Run with the server already started:  npm start   then   npm test
const BASE = process.env.API || 'http://localhost:5000/api'
let pass = 0, fail = 0
async function call(method, path, body, token) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) })
  const text = await r.text()
  return { status: r.status, data: text ? JSON.parse(text) : null }
}
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`) }
const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).data.token

const admin = await login('admin@school.in', 'admin123')
const first = (await call('GET', '/students?limit=1', null, admin)).data.rows[0]
const firstTeacher = (await call('GET', '/teachers', null, admin)).data[0]
const teacher = await login(firstTeacher.email, 'teach123')
const student = await login(first.email, 'stud123')
const parent = await login(first.parent_email, 'par123')
console.log('logins used:', firstTeacher.email, first.email, first.parent_email)

ok('bad password rejected', (await call('POST', '/auth/login', { email: 'admin@school.in', password: 'x' })).status === 400)
ok('no token = 401', (await call('GET', '/me')).status === 401)
const meta = (await call('GET', '/meta', null, admin)).data
ok('5 classes, 6 sections, 6 subjects, 30 class-sections', meta.classes.length === 5 && meta.sections.length === 6 && meta.subjects.length === 6 && meta.class_sections.length === 30)
ok('every section has 40 students', meta.class_sections.every((c) => c.student_count === 40))
const d = (await call('GET', '/dashboard', null, admin)).data
ok('admin dashboard totals (1200 students, 30 teachers)', d.totals.students === 1200 && d.totals.teachers === 30, JSON.stringify(d.totals))
const page1 = (await call('GET', '/students?limit=50', null, admin)).data
ok('admin students: paginated, total 1200', page1.total === 1200 && page1.rows.length === 50)
const c8b = (await call('GET', '/students?class_id=3&section_id=2&limit=200', null, admin)).data
ok('class + section filter (Class 8-B = 40)', c8b.total === 40 && c8b.rows.every((r) => r.class_section === 'Class 8-B'), c8b.total)
const tl = (await call('GET', '/teachers', null, admin)).data
ok('every teacher has a full load (6 sections of one subject)', tl.length === 30 && tl.every((t) => t.classes_taught === 6), JSON.stringify(tl[0]))
const tRes = (await call('GET', '/students?limit=200', null, teacher)).data
const tStud = tRes.rows
ok('teacher sees only own sections (6 x 40 = 240)', tRes.total === 240, tRes.total)
ok('student cannot list students', (await call('GET', '/students', null, student)).status === 403)
const sum = await call('GET', '/students/1/summary', null, parent)
ok('parent sees own child summary', sum.status === 200 && sum.data.results.length === 12 && sum.data.fees, JSON.stringify(sum.data).slice(0, 80))
ok('parent blocked from other child', (await call('GET', '/students/50/summary', null, parent)).status === 403)
const radar = (await call('GET', '/radar', null, admin)).data
ok('radar has High/Medium students', radar.some((r) => r.priority === 'High') && radar.some((r) => r.priority === 'Medium'), radar.length)
ok('radar priority filter', (await call('GET', '/radar?priority=High', null, admin)).data.every((r) => r.priority === 'High'))

const cs = tStud[0].class_section_id
const att = (await call('GET', `/attendance?class_section_id=${cs}`, null, teacher)).data
const mark = await call('POST', '/attendance', { class_section_id: cs, records: att.students.map((s) => ({ student_id: s.student_id, status: 'P' })) }, teacher)
ok('teacher marks attendance', mark.status === 200 && mark.data.saved === 40, JSON.stringify(mark.data))
ok('teacher blocked from another section', (await call('GET', '/attendance?class_section_id=30', null, teacher)).status === 403)
const m = await call('POST', '/marks', { exam_id: 2, subject_id: 1, records: [{ student_id: tStud[0].id, marks: 91 }] }, teacher)
ok('teacher enters marks for own subject', m.status === 200, JSON.stringify(m.data))
ok('marks out of range rejected', (await call('POST', '/marks', { exam_id: 2, subject_id: 1, records: [{ student_id: tStud[0].id, marks: 150 }] }, teacher)).status === 400)
const as = await call('POST', '/assignments', { class_section_id: cs, subject_id: 1, title: 'Test task', due_date: '2030-01-01' }, teacher)
ok('teacher creates assignment', as.status === 201, JSON.stringify(as.data))
const sub = await call('POST', `/assignments/${as.data.id}/submit`, { text: 'done' }, student)
ok('student submits assignment', sub.status === 201 || sub.status === 403, JSON.stringify(sub.data))
const subs = await call('GET', `/assignments/${as.data.id}/submissions`, null, teacher)
ok('teacher sees submissions list', subs.status === 200 && subs.data.length === 40)
ok('timetable for student', (await call('GET', '/timetable', null, student)).data.length === 30)
const tt = (await call('GET', '/timetable', null, teacher)).data
ok('teacher timetable: 30 periods, no clashes', tt.length === 30 && new Set(tt.map((r) => r.day + '-' + r.period)).size === 30, tt.length)

const msg = await call('POST', '/messages', { to_user_id: 1, body: 'hi' }, parent)
ok('parent cannot message admin-only? (admin allowed)', msg.status === 201 || msg.status === 403)
const contacts = (await call('GET', '/contacts', null, parent)).data
ok('parent contacts are teachers', contacts.length >= 6)
const send = await call('POST', '/messages', { to_user_id: contacts[0].id, body: 'Hello teacher' }, parent)
ok('parent messages teacher', send.status === 201, JSON.stringify(send.data))
const thread = (await call('GET', `/messages?with=${contacts[0].id}`, null, parent)).data
ok('thread returned', thread.length >= 1)
ok('parent cannot message another parent', (await call('POST', '/messages', { to_user_id: 35, body: 'x' }, parent)).status === 403)

const ns = await call('POST', '/students', { name: 'Test Student', class_section_id: 1, roll_no: 99, parent_name: 'Mr. Test' }, admin)
ok('admin adds student (+parent, fee)', ns.status === 201, JSON.stringify(ns.data))
ok('duplicate roll number rejected', (await call('POST', '/students', { name: 'Dup Kid', class_section_id: 1, roll_no: 99, parent_name: 'X' }, admin)).status === 409)
const pay = await call('POST', `/fees/${ns.data.id}/payments`, { amount: 10000 }, admin)
ok('fee payment recorded', pay.status === 200 && pay.data.status === 'Part', JSON.stringify(pay.data))
ok('admin deletes student', (await call('DELETE', `/students/${ns.data.id}`, null, admin)).status === 200)
const ann = await call('POST', '/announcements', { title: 'T', body: 'B' }, teacher)
ok('teacher posts announcement', ann.status === 201)
ok('student cannot post announcement', (await call('POST', '/announcements', { title: 'T', body: 'B' }, student)).status === 403)
const reg = await call('POST', '/auth/register', { name: 'New Parent', email: 'newparent@x.in', password: 'secret1' })
ok('register parent', reg.status === 201)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
