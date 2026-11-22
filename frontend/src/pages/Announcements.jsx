import { useState } from 'react'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch } from '../hooks/useFetch'
import { FormModal, Confirm } from '../components/Modal'
import { Head, Load } from '../components/UI'

export default function Announcements() {
  const { user, notify, act } = useApp()
  const list = useFetch('/announcements')
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const canPost = user.role === 'admin' || user.role === 'teacher'
  const save = async (v) => {
    if (form.id) await api('PUT', `/announcements/${form.id}`, v); else await api('POST', '/announcements', v)
    notify('Announcement saved'); setForm(null); list.reload()
  }
  return (
    <>
      <Head title="Announcements" sub="News from the school." />
      {canPost && <div className="row"><button className="p" onClick={() => setForm({})}>New announcement</button></div>}
      <Load f={list}>{(rows) => rows.length ? rows.map((a) => (
        <div className="card" key={a.id}>
          <b>{a.title}</b><p>{a.body}</p>
          <span className="mu">Posted by {a.author} on {a.created_at.slice(0, 10)}</span>{' '}
          {user.role === 'admin' && <><button onClick={() => setForm(a)}>Edit</button> <button className="d" onClick={() => setDel(a)}>Delete</button></>}
        </div>
      )) : <div className="empty">No announcements yet.</div>}</Load>
      {form && <FormModal title={form.id ? 'Edit announcement' : 'New announcement'} initial={form} fields={[['title', 'Title'], ['body', 'Message']]} onClose={() => setForm(null)} onSave={save} />}
      {del && <Confirm message={`Delete "${del.title}"?`} onClose={() => setDel(null)}
        onYes={async () => { await act(() => api('DELETE', `/announcements/${del.id}`), 'Deleted'); setDel(null); list.reload() }} />}
    </>
  )
}
