import { useState } from 'react'

export function Modal({ children, onClose }) {
  return (
    <div className="ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="md" role="dialog">{children}</div>
    </div>
  )
}

// fields: [key, label, type ('text' | 'number' | 'select'), options for select [[value,label]], optional?]
export function FormModal({ title, fields, initial = {}, onSave, onClose }) {
  const first = (f) => (f[2] === 'select' ? f[3][0]?.[0] ?? '' : '')
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f[0], initial[f[0]] ?? first(f)])))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const out = {}
    for (const [k, label, type, , optional] of fields) {
      const raw = String(v[k]).trim()
      if (!raw) { if (optional) continue; return setErr(`${label} is required.`) }
      if (type === 'number') {
        const n = Number(raw)
        if (Number.isNaN(n) || n < 0) return setErr(`${label} needs a valid number.`)
        out[k] = n
      } else out[k] = raw
    }
    setBusy(true)
    try { await onSave(out) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose}>
      <h3>{title}</h3>
      {fields.map(([k, label, type, opts]) => (
        <label key={k}>{label}
          {type === 'select'
            ? <select value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}>{opts.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>
            : <input type={type === 'number' ? 'number' : 'text'} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
        </label>
      ))}
      <div className="err">{err}</div>
      <div className="acts"><button onClick={onClose}>Cancel</button><button className="p" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button></div>
    </Modal>
  )
}

export function Confirm({ message, onYes, onClose }) {
  return (
    <Modal onClose={onClose}>
      <h3>Are you sure?</h3><p>{message}</p>
      <div className="acts"><button onClick={onClose}>Keep it</button><button className="p d" onClick={onYes}>Delete</button></div>
    </Modal>
  )
}
