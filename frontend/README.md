# Smart School frontend (React + Vite)

Talks to the backend API (see ../backend). Set the API address in `.env` if it is not http://localhost:5000/api
(copy `.env.example` to `.env`).

    npm install
    npm run dev
    npm run build

Structure: src/api.js (all fetch calls), src/hooks/useFetch.js, src/context (login, theme, toast),
src/components (layout, modals, tables), src/pages (one file per screen).
