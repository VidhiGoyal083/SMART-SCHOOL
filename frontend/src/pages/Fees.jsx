import { useState } from 'react'
import { api, qs } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch } from '../hooks/useFetch'
import { FormModal } from '../components/Modal'
import { Pill, Table, Head, Load, Stat, rupees, feeLabel } from '../components/UI'

function Admin() {
  const { notify } = useApp()
  const [q, setQ] = useState('')
  const [pay, setPay] = useState(null)
  const list = useFetch('/fees' + qs({ q }))
  return (
    <>
      <Head title="Fees" sub="Fee overview and payments." />
      <div className="row"><input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="card"><Load f={list}>{(rows) => (
        <Table head={['Student', 'Class', 'Total', 'Paid', 'Status', '']}
          rows={rows.map((f) => [f.name, f.class_section, rupees(f.total), rupees(f.paid), <Pill key="p" l={f.status} text={feeLabel(f.status)} />,
            f.status !== 'Paid' ? <button key="b" onClick={() => setPay(f)}>Record payment</button> : ''])} />
      )}</Load></div>
      {pay && <FormModal title={`Payment for ${pay.name}`} fields={[['amount', `Amount (due ${rupees(pay.total - pay.paid)})`, 'number']]} onClose={() => setPay(null)}
        onSave={async (v) => { await api('POST', `/fees/${pay.student_id}/payments`, v); notify('Payment recorded'); setPay(null); list.reload() }} />}
    </>
  )
}

function Parent() {
  const { user } = useApp()
  const kids = user.children
  return (
    <>
      <Head title="Fees" sub="Fee status for your child." />
      {kids.length ? kids.map((id) => <Child key={id} id={id} />) : <div className="empty">No child is linked to this account yet.</div>}
    </>
  )
}
function Child({ id }) {
  const s = useFetch(`/students/${id}/summary`)
  return <Load f={s}>{(x) => (
    <div className="grid">
      <Stat n={x.student.name} l="Student" /><Stat n={rupees(x.fees.total)} l="Total fee" /><Stat n={rupees(x.fees.paid)} l="Paid" />
      <Stat n={rupees(x.fees.total - x.fees.paid)} l={`Balance, due ${x.fees.due_date}`} /><Stat n={feeLabel(x.fees.status)} l="Status" />
    </div>
  )}</Load>
}

export default function Fees() {
  const { user } = useApp()
  return user.role === 'admin' ? <Admin /> : <Parent />
}
