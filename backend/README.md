# Smart School Backend (REST API + SQLite)

Node.js API for the Smart School Parent-Teacher Interaction System.
**Zero npm dependencies**: it uses only Node built-ins (`node:http`, `node:sqlite`, `node:crypto`).
Needs **Node 22.13 or newer** (`node -v`).

## Run

    npm start          # API on http://localhost:5000/api (creates and seeds the database on first run)
    npm run dev        # same, restarts on file changes
    npm run seed       # wipe and re-create the sample data (run this once if you had the older, smaller database)
    npm test           # 35 smoke tests (start the server first, in another terminal)

Copy `.env.example` to `.env` to change PORT, JWT_SECRET, DB_PATH or CORS_ORIGIN
(set CORS_ORIGIN=http://localhost:5173 for the Vite frontend).

## Sample data
A realistic mid-size school: 5 classes (Class 6 to 10), 6 sections (A to F) = 30 class-sections, **40 students per section = 1200 students**
and 1200 parents. 6 subjects (Maths, Science, English, Hindi, Social Studies, Computer) and **30 teachers**: 5 per subject, one for each class.
A teacher teaches all 6 sections of their class for 5 periods a week each (30 periods, a full workload). Each section's class teacher is a different
subject teacher. The timetable is clash-free (no teacher is ever in two sections at the same time).
Also seeded: 30 days of attendance, 2 exams of marks, 180 assignments with submissions, fees, announcements and messages.
About 1 in 11 students is struggling and 1 in 17 is slipping, so the Support Radar has realistic data.

## Logins
| Role | Email | Password |
|---|---|---|
| Admin | admin@school.in | admin123 |
| Teacher | firstname.lastname@school.in (example: anita.kaur@school.in) | teach123 |
| Student | firstname.lastname.class+section+roll@school.in (example: sana.kapoor.6a1@school.in = Class 6-A, roll 1) | stud123 |
| Parent | parent. + the student's id (example: parent.sana.kapoor.6a1@school.in) | par123 |

Send the token from login as `Authorization: Bearer <token>`.

## Endpoints (all under /api)
- **Auth**: POST /auth/login, /auth/register (creates a parent), /auth/forgot, /auth/change-password; GET /me
- **Common**: GET /meta (classes, sections, subjects, exams, class_sections), GET /dashboard (differs per role), GET /announcements, GET /timetable
- **Admin**: GET/POST /students (GET is paginated: ?limit=&offset=&class_id=&section_id=&q=, returns {total, rows}), PUT/DELETE /students/:id, GET/POST /teachers, PUT/DELETE /teachers/:id, GET /parents,
  GET/POST /teacher-assignments, POST /subjects, POST /class-sections, PUT/DELETE /announcements/:id, GET /fees, POST /fees/:studentId/payments
- **Admin + Teacher**: GET /students, GET/POST /attendance, GET/POST /marks, GET /radar (?priority=High&q=name&class_section_id=),
  GET /assignments/:id/submissions, POST /announcements
- **Teacher**: POST /assignments (own subject and class only)
- **Student**: POST /assignments/:id/submit
- **All roles**: GET /students/:id/summary (profile, attendance, results, assignments, fees, support level; each role sees only allowed students), GET /assignments
- **Messages**: GET /contacts, GET /messages/inbox, GET /messages?with=USER_ID, POST /messages {to_user_id, body}

Access rules are enforced on the server: a teacher sees only the sections they teach, a parent only their own
children, and a student only themselves. Passwords are hashed with scrypt; tokens are HMAC-signed and expire in 12 hours.

## Database tables
users, classes, sections, class_sections, subjects, teachers, teacher_assignments, parents, students, attendance,
exams, marks, assignments, submissions, fees, announcements, messages, timetable (see src/db.js).

## Notes
- The timetable is generated per section; it does not guarantee a teacher is free in every period.
- Forgot-password is a mock (no email is sent).
- College-project level security. For real deployment add HTTPS, a strong JWT_SECRET and rate limiting.
