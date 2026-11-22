import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { NAV } from './data/seed'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import Announcements from './pages/Announcements'
import Radar from './pages/Radar'
import Fees from './pages/Fees'
import Attendance from './pages/Attendance'
import Marks from './pages/Marks'
import Assignments from './pages/Assignments'
import Messages from './pages/Messages'

const PAGES = { overview: Overview, students: Students, teachers: Teachers, announcements: Announcements, radar: Radar, fees: Fees, attendance: Attendance, marks: Marks, assignments: Assignments, messages: Messages }

function Guard({ children }) {
  const { user, ready } = useApp()
  if (!ready) return <div className="empty">Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

// Role-based access: a page opens only if it is in the role's navigation list.
function Page() {
  const { view } = useParams()
  const { user } = useApp()
  const Comp = PAGES[view]
  if (!Comp || !NAV[user.role].includes(view)) return <Navigate to="/app/overview" replace />
  return <Comp />
}

export default function App() {
  const { user, ready } = useApp()
  if (!ready) return <div className="empty">Loading...</div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/app/overview" replace /> : <Login />} />
      <Route path="/app" element={<Guard><Layout /></Guard>}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path=":view" element={<Page />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
