import { fileURLToPath } from 'node:url'
import { unlinkSync, existsSync } from 'node:fs'
import { config } from './config.js'

if (process.argv.includes('--reset')) {
  for (const s of ['', '-wal', '-shm']) if (existsSync(config.dbPath + s)) unlinkSync(config.dbPath + s)
}
const { db, q, tx } = await import('./db.js')
const { hashPassword } = await import('./lib/auth.js')

export const STUDENTS_PER_SECTION = 40

export function seedIfEmpty() {
  if (q.get('SELECT COUNT(*) n FROM users').n > 0) return false
  let seedNo = 7
  const rnd = () => { seedNo = (seedNo * 1664525 + 1013904223) % 4294967296; return seedNo / 4294967296 }
  const between = (a, b) => a + rnd() * (b - a)
  const iso = (d) => d.toISOString().slice(0, 10)
  const today = new Date()
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d }
  const pw = { admin: hashPassword('admin123'), teacher: hashPassword('teach123'), student: hashPassword('stud123'), parent: hashPassword('par123') }
  const slug = (t) => t.toLowerCase().replace(/[^a-z]/g, '')
  const user = (name, email, role) => q.run('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', name, email, pw[role], role).id

  tx(() => {
    user('Principal Rao', 'admin@school.in', 'admin')
    const classes = ['6', '7', '8', '9', '10'].map((n) => q.run('INSERT INTO classes (name) VALUES (?)', 'Class ' + n).id)
    const sections = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => q.run('INSERT INTO sections (name) VALUES (?)', n).id)
    const subjects = [['MATH', 'Maths'], ['SCI', 'Science'], ['ENG', 'English'], ['HIN', 'Hindi'], ['SST', 'Social Studies'], ['CS', 'Computer']]
      .map(([c, n]) => q.run('INSERT INTO subjects (code,name) VALUES (?,?)', c, n).id)

    // 30 teachers: 5 per subject, one for each class (6 to 10). A teacher teaches all 6 sections of that class
    // for 5 periods a week each = 30 periods a week, which is a full realistic workload.
    const TF = ['Anita', 'Rajesh', 'Sunita', 'Vikram', 'Neha', 'Suresh', 'Pooja', 'Amit', 'Kavita', 'Manoj', 'Rekha', 'Sanjay', 'Deepa', 'Arun', 'Meena', 'Rahul', 'Shweta', 'Prakash', 'Geeta', 'Naveen', 'Lata', 'Vivek', 'Anjali', 'Harish', 'Usha', 'Dinesh', 'Seema', 'Mukesh', 'Priti', 'Ashok'] // even index female, odd male
    const TL = ['Kaur', 'Reddy', 'Iyer', 'Mehta', 'Bose', 'Fernandes', 'Joshi', 'Chauhan', 'Pillai', 'Khanna', 'Sharma', 'Verma', 'Nair', 'Gupta', 'Das', 'Malik', 'Patel', 'Rao', 'Saxena', 'Bhatt', 'Menon', 'Kapoor', 'Chopra', 'Singh', 'Mishra', 'Pandey', 'Tiwari', 'Agarwal', 'Banerjee', 'Desai']
    const teachers = []
    for (let k = 0; k < 6; k++) for (let c = 0; c < 5; c++) {
      const i = k * 5 + c
      const name = `${i % 2 ? 'Mr.' : 'Mrs.'} ${TF[i]} ${TL[i]}`
      const id = q.run('INSERT INTO teachers (user_id,employee_code,phone) VALUES (?,?,?)', user(name, `${slug(TF[i])}.${slug(TL[i])}@school.in`, 'teacher'), `EMP${String(i + 1).padStart(3, '0')}`, `981000${String(i).padStart(4, '0')}`).id
      teachers.push({ id, k, c })
    }
    const tFor = (k, c) => teachers[k * 5 + c].id

    // 5 classes x 6 sections = 30 class-sections. Class teacher of section si is the teacher of subject si for that class.
    const cs = []
    classes.forEach((cl, ci) => sections.forEach((s, si) => {
      cs.push({ id: q.run('INSERT INTO class_sections (class_id,section_id,class_teacher_id) VALUES (?,?,?)', cl, s, tFor(si, ci)).id, ci, si })
    }))
    for (const c of cs) {
      c.assign = {}
      subjects.forEach((subId, k) => { q.run('INSERT INTO teacher_assignments (class_section_id,subject_id,teacher_id) VALUES (?,?,?)', c.id, subId, tFor(k, c.ci)); c.assign[subId] = tFor(k, c.ci) })
      // Clash-free timetable: in any slot, the 6 sections of a class study 6 different subjects, so a teacher is never in two rooms.
      for (let d = 1; d <= 5; d++) for (let p = 1; p <= 6; p++)
        q.run('INSERT INTO timetable (class_section_id,day,period,subject_id) VALUES (?,?,?,?)', c.id, d, p, subjects[(p + c.si + d) % 6])
    }

    const exams = [['Unit Test 1', iso(addDays(-60))], ['Mid Term', iso(addDays(-20))]].map(([n, d]) => q.run('INSERT INTO exams (name,held_on) VALUES (?,?)', n, d).id)

    const F = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Ananya', 'Ishaan', 'Sana', 'Vihaan', 'Aditi', 'Arjun', 'Kavya', 'Reyansh', 'Nisha', 'Dev', 'Priya', 'Yash', 'Riya', 'Krish', 'Tara', 'Neel', 'Zoya', 'Om', 'Pooja', 'Samar', 'Ira', 'Atharv', 'Mira', 'Rudra', 'Sia', 'Aryan', 'Navya', 'Shaurya', 'Anvi', 'Advait', 'Myra', 'Pranav', 'Kiara', 'Laksh', 'Saanvi', 'Dhruv', 'Ishita', 'Parth', 'Aarohi', 'Tanay', 'Prisha', 'Veer', 'Disha', 'Kunal', 'Trisha', 'Harsh', 'Simran', 'Mohit', 'Bhavya', 'Rishi', 'Palak', 'Ayaan', 'Jiya', 'Nikhil', 'Charvi']
    const L = ['Sharma', 'Verma', 'Singh', 'Nair', 'Gupta', 'Das', 'Malik', 'Khan', 'Patel', 'Reddy', 'Joshi', 'Mehta', 'Iyer', 'Kapoor', 'Bose', 'Chopra', 'Rao', 'Saxena', 'Bhatt', 'Menon', 'Yadav', 'Jain', 'Thakur', 'Mishra', 'Pandey', 'Tiwari', 'Agarwal', 'Banerjee', 'Desai', 'Shetty', 'Kulkarni', 'Pillai', 'Chauhan', 'Bansal', 'Arora', 'Sinha', 'Ghosh', 'Dubey', 'Rathore', 'Soni']
    const PF = ['Rajesh', 'Sunita', 'Vikram', 'Neha', 'Suresh', 'Pooja', 'Amit', 'Kavita', 'Manoj', 'Rekha', 'Sanjay', 'Deepa', 'Arun', 'Meena', 'Rahul', 'Shweta', 'Prakash', 'Geeta', 'Naveen', 'Lata']
    const days = []; for (let i = 45; i >= 1; i--) { const d = addDays(-i); if (d.getDay() % 6) days.push(iso(d)) }
    const att30 = days.slice(-30)
    let n = 0
    const studs = []
    for (const c of cs) for (let r = 1; r <= STUDENTS_PER_SECTION; r++) {
      n++
      const last = L[(n * 13) % L.length], first = F[(n * 7) % F.length]
      // login id = firstname.lastname.<class><section><roll>, e.g. aarav.sharma.6a12@school.in (unique even if two students share a name)
      const code = `${slug(first)}.${slug(last)}.${6 + c.ci}${'abcdef'[c.si]}${r}`
      const uid = user(`${first} ${last}`, `${code}@school.in`, 'student')
      const puid = user(`${n % 2 ? 'Mr.' : 'Mrs.'} ${PF[(n * 3) % PF.length]} ${last}`, `parent.${code}@school.in`, 'parent')
      const pid = q.run('INSERT INTO parents (user_id,phone) VALUES (?,?)', puid, `97000${String(n).padStart(5, '0')}`).id
      const sid = q.run('INSERT INTO students (user_id,class_section_id,roll_no,parent_id) VALUES (?,?,?,?)', uid, c.id, r, pid).id
      // behaviour profile: roughly 1 in 11 struggles badly and 1 in 17 is slipping, so the Support Radar has realistic data
      const weak = n % 11 === 0, slide = n % 17 === 0 || n === 1
      const ability = weak ? between(38, 52) : between(52, 95)
      const attP = weak ? between(0.62, 0.76) : slide ? between(0.74, 0.86) : between(0.86, 0.99)
      const subP = weak ? 0.35 : slide ? 0.55 : between(0.8, 1)
      const trend = weak || slide ? -between(8, 16) : between(-3, 6)
      studs.push({ sid, c, subP })
      for (const d of att30) q.run('INSERT INTO attendance (student_id,date,status,marked_by) VALUES (?,?,?,?)', sid, d, rnd() < attP ? (rnd() < 0.05 ? 'L' : 'P') : 'A', 1)
      subjects.forEach((subId, k) => exams.forEach((ex, ei) => {
        const m = Math.max(5, Math.min(99, ability + (k - 2) * 2 + between(-6, 6) + (ei ? trend : 0)))
        q.run('INSERT INTO marks (student_id,subject_id,exam_id,marks) VALUES (?,?,?,?)', sid, subId, ex, Math.round(m))
      }))
      const total = 30000 + c.ci * 5000
      const paid = weak ? 0 : slide ? total / 2 : rnd() < 0.8 ? total : total / 2
      q.run('INSERT INTO fees (student_id,total,paid,due_date) VALUES (?,?,?,?)', sid, total, paid, iso(addDays(rnd() < 0.5 ? -10 : 15)))
    }
    const titles = ['Worksheet', 'Chapter exercise', 'Practice set', 'Project work', 'Reading task', 'Lab record']
    for (const c of cs) subjects.forEach((subId, k) => {
      const due = iso(addDays(k < 4 ? -(k + 2) : 5 + k))
      const aid = q.run('INSERT INTO assignments (class_section_id,subject_id,teacher_id,title,description,due_date) VALUES (?,?,?,?,?,?)',
        c.id, subId, c.assign[subId], `${titles[k]}: unit ${k + 1}`, 'Complete and submit before the due date.', due).id
      for (const s of studs) if (s.c.id === c.id && rnd() < s.subP) q.run('INSERT INTO submissions (assignment_id,student_id,text) VALUES (?,?,?)', aid, s.sid, 'Submitted online.')
    })
    q.run('INSERT INTO announcements (title,body,author_id) VALUES (?,?,1)', 'Parent-teacher meeting', 'Saturday 10:00 to 13:00 in classrooms. Please attend.')
    q.run('INSERT INTO announcements (title,body,author_id) VALUES (?,?,1)', 'Winter uniform', 'Winter uniform starts from 1 December.')
    q.run('INSERT INTO announcements (title,body,author_id) VALUES (?,?,1)', 'Annual day rehearsals', 'Rehearsals begin next week after school hours.')
    const t1 = q.get('SELECT user_id FROM teachers WHERE id = ?', cs[0].assign[subjects[0]]).user_id
    const p1 = q.get('SELECT p.user_id FROM students s JOIN parents p ON p.id = s.parent_id WHERE s.id = 1').user_id
    q.run('INSERT INTO messages (sender_id,receiver_id,body) VALUES (?,?,?)', t1, p1, 'Your child missed a few classes recently. Could we talk?')
    q.run('INSERT INTO messages (sender_id,receiver_id,body) VALUES (?,?,?)', p1, t1, 'Yes, he was unwell. I will send a note tomorrow.')
  })
  return true
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0 = Date.now()
  console.log(seedIfEmpty() ? 'Database seeded.' : 'Database already has data. Use: npm run seed')
  const c = (t) => q.get(`SELECT COUNT(*) n FROM ${t}`).n
  console.log({ classes: c('classes'), sections: c('sections'), class_sections: c('class_sections'), subjects: c('subjects'), teachers: c('teachers'), students: c('students'), parents: c('parents'), seconds: (Date.now() - t0) / 1000 })
  db.close()
}
