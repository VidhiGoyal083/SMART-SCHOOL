import { useState } from 'react'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch, useMySections } from '../hooks/useFetch'
import { FormModal, Modal } from '../components/Modal'
import { Pill, Table, Head, Load } from '../components/UI'

function Teacher() {
  const { user, notify } = useApp()
  const { list: secs } = useMySections(user.role)
  const meta = useFetch('/meta')
  const list = useFetch('/assignments')
  const [form, setForm] = useState(false)
  const [view, setView] = useState(null)
  const subs = useFetch(view ? `/assignments/${view.id}/submissions` : null)
  return (
    <>
      <Head title="Assignments" sub="Create assignments and track submissions." />
      <div className="row"><button className="p" onClick={() => setForm(true)}>Create assignment</button></div>
      <div className="card"><Load f={list}>{(rows) => (
        <Table head={['Title', 'Class', 'Subject', 'Due', 'Submitted', '']}
          rows={rows.map((a) => [a.title, a.class_section, a.subject, a.due_date, `${a.submissions} of ${a.class_size}`, <button key="b" onClick={() => setView(a)}>View</button>])} />
      )}</Load></div>
      {form && meta.data && <FormModal title="Create assignment" onClose={() => setForm(false)}
        fields={[['title', 'Title'], ['class_section_id', 'Class and section', 'select', secs.map((s) => [s.id, s.label])], ['subject_id', 'Subject', 'select', meta.data.subjects.map((s) => [s.id, s.name])], ['due_date', 'Due date (YYYY-MM-DD)'], ['description', 'Instructions', 'text', null, true]]}
        onSave={async (v) => { await api('POST', '/assignments', v); notify('Assignment created'); setForm(false); list.reload() }} />}
      {view && (
        <Modal onClose={() => setView(null)}>
          <h3>{view.title}</h3><p className="mu">{view.class_section}, due {view.due_date}</p>
          <Load f={subs}>{(rows) => <Table head={['Roll', 'Student', 'Status']} rows={rows.map((r) => [r.roll_no, r.name, <Pill key="p" l={r.submitted ? 'Paid' : 'Medium'} text={r.submitted ? 'Submitted' : 'Pending'} />])} />}</Load>
          <div className="acts"><button onClick={() => setView(null)}>Close</button></div>
        </Modal>
      )}
    </>
  )
}

function Family() {
  const { user, act } = useApp()
  const sid = user.role === 'parent' ? user.children[0] : user.student_id
  const list = useFetch(sid ? `/assignments?student_id=${sid}` : null)
  const submit = async (a) => { if (await act(() => api('POST', `/assignments/${a.id}/submit`, { text: 'Submitted online.' }), 'Assignment submitted')) list.reload() }
  return (
    <>
      <Head title="Assignments" sub={user.role === 'parent' ? 'Assignment progress for your child.' : 'Your assignments.'} />
      <div className="card">{sid ? <Load f={list}>{(rows) => (
        <Table head={['Title', 'Subject', 'Due', 'Status', '']}
          rows={rows.map((a) => [a.title, a.subject, a.due_date, <Pill key="p" l={a.submitted ? 'Paid' : 'Medium'} text={a.submitted ? 'Submitted' : 'Pending'} />,
            !a.submitted && user.role === 'student' ? <button key="b" className="p" onClick={() => submit(a)}>Submit</button> : ''])} />
      )}</Load> : <div className="empty">No student is linked to this account yet.</div>}</div>
    </>
  )
}

export default function Assignments() {
  const { user } = useApp()
  return user.role === 'teacher' ? <Teacher /> : <Family />
}
