import { useEffect, useState } from 'react'
import { api, qs } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch, useMySections } from '../hooks/useFetch'
import { Table, Head, Load } from '../components/UI'

export default function Marks() {
  const { user, act } = useApp()
  const { list: secs } = useMySections(user.role)
  const meta = useFetch('/meta')
  const [f, setF] = useState({ cs: '', subject: '', exam: '' })
  const cs = f.cs || secs[0]?.id || ''
  const subject = f.subject || meta.data?.subjects[0]?.id || ''
  const exam = f.exam || meta.data?.exams.at(-1)?.id || ''
  const rows = useFetch(cs && subject && exam ? '/marks' + qs({ class_section_id: cs, subject_id: subject, exam_id: exam }) : null)
  const [m, setM] = useState({})
  useEffect(() => { if (rows.data) setM(Object.fromEntries(rows.data.map((r) => [r.student_id, r.marks ?? '']))) }, [rows.data])
  const save = async () => {
    const records = rows.data.filter((r) => m[r.student_id] !== '' && Number(m[r.student_id]) !== r.marks).map((r) => ({ student_id: r.student_id, marks: Number(m[r.student_id]) }))
    if (!records.length) return act(async () => { throw new Error('Change at least one mark first') })
    if (await act(() => api('POST', '/marks', { exam_id: +exam, subject_id: +subject, records }), `Marks saved for ${records.length} students`)) rows.reload()
  }
  const sel = (k, opts) => <select value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  return (
    <>
      <Head title="Marks" sub="Enter examination marks out of 100. Teachers can only enter marks for the subjects they teach." />
      <div className="row">
        {sel('cs', secs.map((s) => [s.id, s.label]))}
        {meta.data && sel('subject', meta.data.subjects.map((s) => [s.id, s.name]))}
        {meta.data && sel('exam', meta.data.exams.map((e) => [e.id, e.name]))}
      </div>
      <div className="card"><Load f={rows}>{(d) => (
        <>
          <Table head={['Roll', 'Student', 'Marks (0 to 100)']} rows={d.map((r) => [r.roll_no, r.name,
            <input key="i" type="number" min="0" max="100" style={{ maxWidth: 100 }} value={m[r.student_id] ?? ''} onChange={(e) => setM({ ...m, [r.student_id]: e.target.value })} />])} />
          <div className="acts"><button className="p" onClick={save}>Save marks</button></div>
        </>
      )}</Load></div>
    </>
  )
}
