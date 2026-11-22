// All communication with the backend goes through this file.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export const getToken = () => { try { return localStorage.getItem('ssp-token') } catch { return null } }
export const setToken = (t) => { try { t ? localStorage.setItem('ssp-token', t) : localStorage.removeItem('ssp-token') } catch { /* ignore */ } }

export async function api(method, path, body) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() && { Authorization: 'Bearer ' + getToken() }) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(`Cannot reach the server. Is the backend running at ${BASE}?`)
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (res.status === 401 && path !== '/auth/login') { setToken(null); window.dispatchEvent(new Event('ssp-logout')) }
  if (!res.ok) throw new Error(data?.error || 'Request failed')
  return data
}

// Build a query string, skipping empty values
export const qs = (o) => {
  const p = Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  return p.length ? '?' + p.join('&') : ''
}
