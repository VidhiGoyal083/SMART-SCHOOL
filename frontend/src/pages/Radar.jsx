import { useState } from 'react'
import { qs } from '../api'
import { useFetch } from '../hooks/useFetch'
import { Pill, Table, Head, Load } from '../components/UI'
import { Modal } from '../components/Modal'

// Student Support Radar. Priority is scored on the server (attendance, marks, missing work, trend).
export default function Radar() {
  const [q, setQ] = useState('')
  const [p, setP] = useState('')
  const [sel, setSel] = useState(null)
  const list = useFetch('/radar' + qs({ q, priority: p }))
  return (
    <>
      <Head title="Student Support Radar" sub="Students who may need extra attention, based on attendance, marks, missing work and recent trend." />
      <div className="row">
        <input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={p} onChange={(e) => setP(e.target.value)}>
          <option value="">All priorities</option>{['High', 'Medium', 'Low'].map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="card"><Load f={list}>{(rows) => (
        <Table head={['Student', 'Class', 'Priority', 'Main concern', '']}
          rows={rows.map((r) => [r.name, r.class_section, <Pill key="p" l={r.priority} />, r.reasons[0], <button key="b" onClick={() => setSel(r)}>View details</button>])} />
      )}</Load></div>
      {sel && (
        <Modal onClose={() => setSel(null)}>
          <h3>{sel.name}</h3><p className="mu">{sel.class_section}</p><p><Pill l={sel.priority} /></p>
          <p className="mu">Attendance {sel.att}%, average marks {sel.avg}%, {sel.miss} missing assignments</p>
          {sel.reasons.map((w) => <p key={w}>• {w}</p>)}
          <div className="acts"><button onClick={() => setSel(null)}>Close</button></div>
        </Modal>
      )}
    </>
  )
}
