export const Pill = ({ l, text }) => <span className={`pill ${l}`}>{text || l}</span>
export const Stat = ({ n, l }) => <div className="card"><div className="big">{n}</div><div className="mu">{l}</div></div>
export const Bars = ({ rows }) => rows.map(([l, v]) => (
  <div className="bar" key={l}><span>{l}</span><i><u style={{ width: Math.min(100, v) + '%' }} /></i><em>{v}%</em></div>
))
export function Table({ head, rows }) {
  if (!rows.length) return <div className="empty">Nothing here yet. Try clearing the search or add a record.</div>
  return (
    <div className="tw"><table>
      <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  )
}
export const Head = ({ title, sub }) => <><h1>{title}</h1><p className="sub">{sub}</p></>
// Shows loading / error states for a useFetch result, then renders children(data)
export function Load({ f, children }) {
  if (f.error) return <div className="card"><div className="err">{f.error}</div></div>
  if (!f.data) return <div className="empty">Loading...</div>
  return children(f.data)
}
export const rupees = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
export const feeLabel = (s) => (s === 'Part' ? 'Part paid' : s)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export function Timetable({ rows }) {
  const cell = (d, p) => { const r = rows.find((x) => x.day === d && x.period === p); return r ? (r.class_section ? `${r.subject} (${r.class_section})` : r.subject) : '-' }
  return (
    <div className="card"><b>Timetable</b>
      <Table head={['Day', ...[1, 2, 3, 4, 5, 6].map((p) => 'P' + p)]} rows={DAYS.map((d, i) => [d, ...[1, 2, 3, 4, 5, 6].map((p) => cell(i + 1, p))])} />
    </div>
  )
}
