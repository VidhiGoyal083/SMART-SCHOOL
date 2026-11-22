import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, GraduationCap, Megaphone, Wallet, CalendarCheck, PenLine, ClipboardList, MessageSquare, Activity, Sun, Moon, LogOut } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { NAV, LABELS } from '../data/seed'

const ICONS = { overview: LayoutDashboard, students: Users, teachers: GraduationCap, announcements: Megaphone, fees: Wallet, attendance: CalendarCheck, marks: PenLine, assignments: ClipboardList, messages: MessageSquare, radar: Activity }

export default function Layout() {
  const { user, logout, theme, setTheme } = useApp()
  const go = useNavigate()
  return (
    <div className="app">
      <nav className="side">
        <h2>Smart School<br /><span className="mu">{user.role[0].toUpperCase() + user.role.slice(1)} portal</span></h2>
        {NAV[user.role].map((k) => {
          const Icon = ICONS[k]
          return <NavLink key={k} to={`/app/${k}`}><Icon size={17} />{LABELS[k]}</NavLink>
        })}
      </nav>
      <div className="main">
        <div className="top">
          <b>{user.name}</b>
          <div>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Theme</button>
            <button onClick={() => { logout(); go('/login') }}><LogOut size={16} /> Log out</button>
          </div>
        </div>
        <div className="page"><Outlet /></div>
      </div>
    </div>
  )
}
