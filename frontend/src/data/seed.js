// Navigation per role (all real data now comes from the backend API).
export const NAV = {
  admin: ['overview', 'students', 'teachers', 'announcements', 'radar', 'fees'],
  teacher: ['overview', 'attendance', 'marks', 'assignments', 'announcements', 'messages', 'radar'],
  student: ['overview', 'assignments', 'announcements', 'messages'],
  parent: ['overview', 'announcements', 'messages', 'fees'],
}
export const LABELS = { overview: 'Overview', students: 'Students', teachers: 'Teachers', announcements: 'Announcements', radar: 'Support Radar', fees: 'Fees', attendance: 'Attendance', marks: 'Marks', assignments: 'Assignments', messages: 'Messages' }
