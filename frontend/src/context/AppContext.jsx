import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../api'

const Ctx = createContext(null)
// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!getToken())
  const [theme, setTheme] = useState(() => localStorage.getItem('ssp-th') || 'light')
  const [toast, setToast] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('ssp-th', theme) } catch { /* ignore */ }
  }, [theme])
  useEffect(() => {
    if (getToken()) api('GET', '/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
    const off = () => setUser(null)
    window.addEventListener('ssp-logout', off)
    return () => window.removeEventListener('ssp-logout', off)
  }, [])

  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }
  const login = async (email, password, role) => {
    try {
      const r = await api('POST', '/auth/login', { email, password, role: role || undefined })
      setToken(r.token)
      setUser(await api('GET', '/me'))
      notify(`Welcome, ${r.user.name}`)
      return null
    } catch (e) { return e.message }
  }
  const logout = () => { setToken(null); setUser(null); notify('Logged out') }
  // Runs an API call; shows a toast on success or failure. Returns the result, or undefined on failure.
  const act = async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) notify(okMsg); return r ?? true } catch (e) { notify(e.message); return undefined }
  }

  return (
    <Ctx.Provider value={{ user, ready, login, logout, theme, setTheme, notify, act }}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  )
}
