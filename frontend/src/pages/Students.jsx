import { useState } from 'react'
import { api, qs } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch } from '../hooks/useFetch'
import { FormModal, Confirm } from '../components/Modal'
import { Table, Head, Load } from '../components/UI'

const PAGE = 40

export default function Students() {
  const { notify, act } = useApp()
  const meta = useFetch('/meta')
  const [q, setQ] = useState('')
  const [cls, setCls] = useState('')   // class id
  const [sec, setSec] = useState('')   // section id
  const [page, setPage] = useState(0)
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const list = useFetch('/students' + qs({ q, class_id: cls, section_id: sec, limit: PAGE, offset: page * PAGE }))
  const all = meta.data?.class_sections || []
  const opts = all.map((c) => [c.id, c.label])
  const clsName = meta.data?.classes.find((c) => String(c.id) === cls)?.name
  const secName = meta.data?.sections.find((s) => String(s.id) === sec)?.name
  const title = cls || sec ? `${clsName || 'All classes'}${secName ? ', Section ' + secName : ''}` : 'All classes and sections'
  const filter = (set) => (e) => { set(e.target.value); setPage(0) }

  const save = async (v) => {
    if (form.id) await api('PUT', `/students/${form.id}`, v)
    else await api('POST', '/students', v)
    notify(form.id ? 'Student updated' : 'Student added')
    setForm(null); list.reload()
  }
  return (
    <>
      <Head title="Students" sub="Choose a class and section to see its students. Every student and parent has their own login (default passwords: stud123 and par123)." />
      <div className="row">
        <input placeholder="Search by name" value={q} onChange={filter(setQ)} />
        <select value={cls} onChange={filter(setCls)}>
          <option value="">All classes</option>{(meta.data?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sec} onChange={filter(setSec)}>
          <option value="">All sections</option>{(meta.data?.sections || []).map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
        </select>
        {(cls || sec || q) && <button onClick={() => { setCls(''); setSec(''); setQ(''); setPage(0) }}>Clear filters</button>}
        <button className="p" onClick={() => setForm({})}>Add student</button>
      </div>
      <Load f={list}>{({ total, rows }) => (
        <div className="card">
          <p className="mu"><b>{title}</b>: {total} students{total > PAGE ? `, showing ${page * PAGE + 1} to ${Math.min(total, (page + 1) * PAGE)}` : ''}</p>
          <Table head={['Class', 'Roll', 'Name', 'Student login', 'Parent login', 'Attendance', 'Average', 'Actions']}
            rows={rows.map((r) => [r.class_section, r.roll_no, r.name, r.email, r.parent_email, r.att + '%', r.avg + '%',
              <span key="a"><button onClick={() => setForm(r)}>Edit</button> <button className="d" onClick={() => setDel(r)}>Delete</button></span>])} />
          {total > PAGE && (
            <div className="acts">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="mu" style={{ alignSelf: 'center' }}>Page {page + 1} of {Math.ceil(total / PAGE)}</span>
              <button disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
      )}</Load>
      {form && <FormModal title={form.id ? 'Edit student' : 'Add student'} initial={form} onClose={() => setForm(null)} onSave={save}
        fields={[['name', 'Full name'], ['class_section_id', 'Class and section', 'select', opts], ['roll_no', 'Roll number', 'number'], ...(form.id ? [] : [['parent_name', 'Parent name']])]} />}
      {del && <Confirm message={`Delete ${del.name}? Their attendance, marks and fees are deleted too.`} onClose={() => setDel(null)}
        onYes={async () => { await act(() => api('DELETE', `/students/${del.id}`), 'Student deleted'); setDel(null); list.reload() }} />}
    </>
  )
}
