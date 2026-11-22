import { useEffect, useState } from 'react'
import { api } from '../api'

// GET a path (pass null to skip). Re-fetches when the path changes or reload() is called.
export function useFetch(path) {
  const [s, setS] = useState({ data: null, loading: !!path, error: '' })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!path) { setS({ data: null, loading: false, error: '' }); return undefined }
    let off = false
    setS((p) => ({ ...p, loading: true, error: '' }))
    api('GET', path).then((d) => !off && setS({ data: d, loading: false, error: '' })).catch((e) => !off && setS({ data: null, loading: false, error: e.message }))
    return () => { off = true }
  }, [path, n])
  return { ...s, reload: () => setN((x) => x + 1) }
}

// Sections the current user can work with: a teacher's own sections, or all for admin.
export function useMySections(role) {
  const dash = useFetch(role === 'teacher' ? '/dashboard' : null)
  const meta = useFetch(role === 'teacher' ? null : '/meta')
  const list = role === 'teacher' ? dash.data?.sections : meta.data?.class_sections
  return { list: list || [], loading: dash.loading || meta.loading }
}
