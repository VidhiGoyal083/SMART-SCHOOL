import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { api } from '../api'

export default function Login() {
  const { login, notify } = useApp()
  const go = useNavigate()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '', role: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      if (mode === 'login') {
        const e = await login(f.email, f.password, f.role)
        if (e) setErr(e); else go('/app/overview')
      } else if (mode === 'register') {
        const r = await api('POST', '/auth/register', { name: f.name, email: f.email, password: f.password })
        notify(r.message); setMode('login')
      } else {
        const r = await api('POST', '/auth/forgot', { email: f.email })
        notify(r.message); setMode('login')
      }
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  return (
    <div className="auth">
      <h1>Smart School Portal</h1>
      <p className="sub">{mode === 'login' ? 'Sign in to continue' : mode === 'register' ? 'Create a parent account' : 'Reset your password'}</p>
      <div className="card">
        {mode === 'register' && <label>Full name<input value={f.name} onChange={set('name')} /></label>}
        {mode === 'login' && (
          <label>Role
            <select value={f.role} onChange={set('role')}>
              <option value="">Choose role</option>
              {['admin', 'teacher', 'student', 'parent'].map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
            </select>
          </label>
        )}
        <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
        {mode !== 'forgot' && <label>Password<input type="password" value={f.password} onChange={set('password')} onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>}
        <div className="err">{err}</div>
        <div className="acts">
          {mode === 'login' ? <><button onClick={() => setMode('register')}>Register</button><button onClick={() => setMode('forgot')}>Forgot password</button></> : <button onClick={() => setMode('login')}>Back</button>}
          <button className="p" disabled={busy} onClick={submit}>{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}</button>
        </div>
      </div>
      {mode === 'login' && (
        <div className="card mu"><b>Demo logins</b><br />admin@school.in / admin123<br />anita.kaur@school.in / teach123 (teacher)<br />sana.kapoor.6a1@school.in / stud123 (student)<br />parent.sana.kapoor.6a1@school.in / par123 (parent)<br />All other logins: see Students and Teachers pages, or all-logins.csv</div>
      )}
    </div>
  )
}
