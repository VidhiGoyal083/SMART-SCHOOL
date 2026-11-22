import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useFetch } from '../hooks/useFetch'
import { Stat, Bars, Head, Load, Timetable, rupees, feeLabel } from '../components/UI'

function Admin() {
  const d = useFetch('/dashboard')
  return (
    <Load f={d}>{({ totals: t, attendance_by_section: secs, fees, support_radar: r }) => {
      const byClass = {}
      secs.forEach((s) => { const c = s.class_section.split('-')[0]; (byClass[c] ||= []).push(s) })
      const mean = (a, k) => Math.round(a.reduce((x, y) => x + y[k], 0) / a.length)
      return (
        <>
          <Head title="Overview" sub="School snapshot for today." />
          <div className="grid">
            <Stat n={t.students} l="Students" /><Stat n={t.teachers} l="Teachers" /><Stat n={t.parents} l="Parents" />
            <Stat n={`${t.classes} classes, ${t.sections} sections`} l="Structure" /><Stat n={t.subjects} l="Subjects" />
            <Stat n={r.high + r.medium} l="Students needing support" />
            <Stat n={rupees(fees.collected)} l="Fees collected" /><Stat n={rupees(fees.pending)} l={`Fees pending (${fees.students_with_dues} students)`} />
          </div>
          <div className="card"><b>Attendance by class</b><Bars rows={Object.entries(byClass).map(([c, a]) => [c, mean(a, 'attendance')])} /></div>
          <div className="card"><b>Average marks by class</b><Bars rows={Object.entries(byClass).map(([c, a]) => [c, mean(a, 'average_marks')])} /></div>
        </>
      )
    }}</Load>
  )
}

function Teacher() {
  const { user } = useApp()
  const d = useFetch('/dashboard')
  const tt = useFetch('/timetable')
  return (
    <Load f={d}>{(x) => (
      <>
        <Head title={`Welcome, ${user.name}`} sub={`You teach in ${x.sections.length} class sections.`} />
        <div className="grid">
          <Stat n={x.students} l="Students in your classes" /><Stat n={x.average_attendance + '%'} l="Average attendance" />
          <Stat n={x.need_support} l="Need support" /><Stat n={x.unread_messages} l="Unread messages" />
        </div>
        <div className="card"><b>Your classes</b><p>{x.sections.map((s) => s.label).join(', ')}</p></div>
        {tt.data && <Timetable rows={tt.data} />}
      </>
    )}</Load>
  )
}

function Family() {
  const { user } = useApp()
  const kids = user.role === 'parent' ? user.children : [user.student_id]
  const [sid, setSid] = useState(kids[0])
  const s = useFetch(sid ? `/students/${sid}/summary` : null)
  const tt = useFetch(sid ? `/timetable?student_id=${sid}` : null)
  if (!sid) return <div className="empty">No student is linked to this account yet. Ask the school office to link your child.</div>
  return (
    <Load f={s}>{(x) => {
      const exams = [...new Set(x.results.map((r) => r.exam))]
      const last = exams[exams.length - 1]
      const notes = [...x.support.reasons, x.fees && x.fees.status !== 'Paid' ? 'Fee payment pending' : null].filter(Boolean)
      return (
        <>
          <Head title={`${user.role === 'parent' ? 'Your child: ' : 'Hello, '}${x.student.name}`} sub={`${x.student.class_name} ${x.student.section_name}, roll no. ${x.student.roll_no}`} />
          {kids.length > 1 && <div className="row"><select value={sid} onChange={(e) => setSid(+e.target.value)}>{kids.map((k) => <option key={k} value={k}>Child {k}</option>)}</select></div>}
          <div className="grid">
            <Stat n={x.attendance_percent + '%'} l="Attendance" /><Stat n={x.average_marks + '%'} l="Average marks" />
            <Stat n={x.missing_assignments} l="Missing assignments" /><Stat n={x.fees ? feeLabel(x.fees.status) : '-'} l="Fee status" />
          </div>
          <div className="card"><b>Examination results: {last}</b><Bars rows={x.results.filter((r) => r.exam === last).map((r) => [r.subject, Math.round(r.marks)])} /></div>
          <div className="card"><b>Notifications</b>{notes.length ? notes.map((n) => <p key={n}>• {n}</p>) : <p className="mu">All caught up.</p>}</div>
          {tt.data && <Timetable rows={tt.data} />}
        </>
      )
    }}</Load>
  )
}

export default function Overview() {
  const { user } = useApp()
  return user.role === 'admin' ? <Admin /> : user.role === 'teacher' ? <Teacher /> : <Family />
}
