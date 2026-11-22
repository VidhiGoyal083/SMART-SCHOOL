# Smart School Parent-Teacher Interaction System

    smart-school/
      backend/    Node API + SQLite database (no npm packages needed, Node 22.13+)
      frontend/   React + Vite app (connected to the backend)

## Run (two terminals)

Terminal 1, backend:

    cd backend
    npm start           # http://localhost:5000/api, database is created and filled automatically

Terminal 2, frontend:

    cd frontend
    npm install
    npm run dev         # open the link it prints (usually http://localhost:5173)

## Demo logins
- Admin: admin@school.in / admin123
- Teacher: firstname.lastname@school.in (example: anita.kaur@school.in) / teach123
- Student: firstname.lastname.class+section+roll@school.in (example: sana.kapoor.6a1@school.in = Class 6-A, roll 1) / stud123
- Parent: parent. + the student's id (example: parent.sana.kapoor.6a1@school.in) / par123

Sample school: 30 class-sections (Class 6 to 10, sections A to F), 40 students each = 1200 students, 30 teachers.
If you ran an older version, run `cd backend && npm run seed` once to rebuild the bigger database. Tests: `cd backend && npm test` (server running).
