import { useState } from 'react'
import { api, qs } from '../api'
import { useApp } from '../context/AppContext'
import { useFetch } from '../hooks/useFetch'
import { Head, Load } from '../components/UI'

export default function Messages() {
  const { act } = useApp()
  const inbox = useFetch('/messages/inbox')
  const [cq, setCq] = useState('')
  const contacts = useFetch('/contacts' + qs({ q: cq }))
  const [who, setWho] = useState(null)
  const [t, setT] = useState('')
  const thread = useFetch(who ? `/messages?with=${who.id}` : null)
  const open = (id, name) => setWho({ id: +id, name })
  const send = async () => {
    if (!t.trim()) return act(async () => { throw new Error('Write a message first') })
    if (await act(() => api('POST', '/messages', { to_user_id: who.id, body: t }), 'Message sent')) { setT(''); thread.reload(); inbox.reload() }
  }
  return (
    <>
      <Head title="Messages" sub="Talk with teachers and parents." />
      <div className="split">
        <div className="li card">
          <input placeholder="Search people by name" value={cq} onChange={(e) => setCq(e.target.value)} style={{ marginBottom: 8 }} />
          <select value="" onChange={(e) => { const c = contacts.data.find((x) => x.id === +e.target.value); if (c) open(c.id, c.name) }}>
            <option value="">New message to...</option>{(contacts.data || []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
          </select>
          <div style={{ marginTop: 10 }}>
            {(inbox.data || []).map((c) => <button key={c.user_id} className={who?.id === c.user_id ? 'on' : ''} onClick={() => open(c.user_id, c.name)}>{c.name}{c.unread ? ` (${c.unread})` : ''}<br /><span className="mu">{c.last_message.slice(0, 30)}</span></button>)}
            {inbox.data?.length === 0 && <div className="empty">No conversations yet.</div>}
          </div>
        </div>
        <div className="card">
          {!who ? <div className="empty">Choose a conversation or start a new one.</div> : (
            <>
              <b>{who.name}</b>
              <Load f={thread}>{(msgs) => <div className="chat" style={{ marginTop: 10 }}>{msgs.map((m) => <div key={m.id} className={`m ${m.mine ? 'me' : ''}`}>{m.body}</div>)}{!msgs.length && <div className="empty">No messages yet. Say hello below.</div>}</div>}</Load>
              <div className="row"><input style={{ maxWidth: 'none', flex: 1 }} placeholder="Write a message" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} /><button className="p" onClick={send}>Send</button></div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
