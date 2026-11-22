import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'

export const db = new DatabaseSync(config.dbPath)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','teacher','student','parent')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS sections (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE, phone TEXT);
CREATE TABLE IF NOT EXISTS class_sections (
  id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id), section_id INTEGER NOT NULL REFERENCES sections(id),
  class_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL, UNIQUE (class_id, section_id));
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id INTEGER PRIMARY KEY, class_section_id INTEGER NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id), teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  UNIQUE (class_section_id, subject_id));
CREATE TABLE IF NOT EXISTS parents (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, phone TEXT);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  class_section_id INTEGER NOT NULL REFERENCES class_sections(id), roll_no INTEGER NOT NULL,
  parent_id INTEGER REFERENCES parents(id) ON DELETE SET NULL, UNIQUE (class_section_id, roll_no));
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('P','A','L')), marked_by INTEGER REFERENCES users(id), UNIQUE (student_id, date));
CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, held_on TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id), exam_id INTEGER NOT NULL REFERENCES exams(id),
  marks REAL NOT NULL CHECK (marks BETWEEN 0 AND 100), UNIQUE (student_id, subject_id, exam_id));
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY, class_section_id INTEGER NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id), teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  title TEXT NOT NULL, description TEXT, due_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, text TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (assignment_id, student_id));
CREATE TABLE IF NOT EXISTS fees (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  total REAL NOT NULL, paid REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, author_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY, class_section_id INTEGER NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 5), period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 6),
  subject_id INTEGER NOT NULL REFERENCES subjects(id), UNIQUE (class_section_id, day, period));
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_students_cs ON students(class_section_id);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(sender_id, receiver_id);
`)

const cache = new Map()
const st = (sql) => cache.get(sql) || (cache.set(sql, db.prepare(sql)), cache.get(sql))
export const q = {
  all: (sql, ...p) => st(sql).all(...p),
  get: (sql, ...p) => st(sql).get(...p),
  run: (sql, ...p) => { const r = st(sql).run(...p); return { changes: Number(r.changes), id: Number(r.lastInsertRowid) } },
}
export function tx(fn) {
  db.exec('BEGIN')
  try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { db.exec('ROLLBACK'); throw e }
}
