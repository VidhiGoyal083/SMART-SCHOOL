import { useEffect, useState } from 'react'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch, useMySections } from '../hooks/useFetch'
import { Table, Head, Load } from '../components/UI'

export default function Attendance() {
  const { user, act } = useApp()
  const { list: secs } = useMySections(user.role)
  const [cs, setCs] = useState('')
  const sel = cs || secs[0]?.id || ''
  const att = useFetch(sel ? `/attendance?class_section_id=${sel}` : null)
  const [st, setSt] = useState({})
  useEffect(() => {
    if (att.data) setSt(Object.fromEntries(att.data.students.map((s) => [s.student_id, s.status || 'P'])))
  }, [att.data])
  const save = () => act(() => api('POST', '/attendance', { class_section_id: +sel, date: att.data.date, records: Object.entries(st).map(([id, status]) => ({ student_id: +id, status })) }), 'Attendance saved')
  return (
    <>
      <Head title="Attendance" sub={att.data ? `Mark attendance for ${att.data.date}.` : 'Choose a class.'} />
      <div className="row"><select value={sel} onChange={(e) => setCs(e.target.value)}>{secs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <div className="card"><Load f={att}>{(d) => (
        <>
          <Table head={['Roll', 'Student', 'Status']} rows={d.students.map((s) => [s.roll_no, s.name,
            <select key="s" style={{ maxWidth: 130 }} value={st[s.student_id] || 'P'} onChange={(e) => setSt({ ...st, [s.student_id]: e.target.value })}>
              <option value="P">Present</option><option value="A">Absent</option><option value="L">Late</option></select>])} />
          <div className="acts"><button className="p" onClick={save}>Save attendance</button></div>
        </>
      )}</Load></div>
    </>
  )
}
