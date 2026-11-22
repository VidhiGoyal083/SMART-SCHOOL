import { useState } from 'react'
import { api, qs } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch } from '../hooks/useFetch'
import { FormModal, Confirm } from '../components/Modal'
import { Table, Head, Load } from '../components/UI'

export default function Teachers() {
  const { notify, act } = useApp()
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const list = useFetch('/teachers' + qs({ q }))
  const save = async (v) => {
    if (form.id) await api('PUT', `/teachers/${form.id}`, v); else await api('POST', '/teachers', v)
    notify(form.id ? 'Teacher updated' : 'Teacher added'); setForm(null); list.reload()
  }
  return (
    <>
      <Head title="Teachers" sub="Manage staff. New teachers get the password teach123." />
      <div className="row"><input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /><button className="p" onClick={() => setForm({})}>Add teacher</button></div>
      <div className="card"><Load f={list}>{(rows) => (
        <Table head={['Name', 'Email', 'Subjects', 'Classes taught', 'Actions']}
          rows={rows.map((t) => [t.name, t.email, t.subjects || '-', t.classes_taught,
            <span key="a"><button onClick={() => setForm(t)}>Edit</button> <button className="d" onClick={() => setDel(t)}>Delete</button></span>])} />
      )}</Load></div>
      {form && <FormModal title={form.id ? 'Edit teacher' : 'Add teacher'} initial={form} onClose={() => setForm(null)} onSave={save}
        fields={form.id ? [['name', 'Name'], ['phone', 'Phone', 'text', null, true]] : [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone', 'text', null, true]]} />}
      {del && <Confirm message={`Delete ${del.name}?`} onClose={() => setDel(null)}
        onYes={async () => { await act(() => api('DELETE', `/teachers/${del.id}`), 'Teacher deleted'); setDel(null); list.reload() }} />}
    </>
  )
}
