import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Tiny .env loader (no dependencies)
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
} catch { /* no .env file, defaults are used */ }

const defaultDb = fileURLToPath(new URL('../data/school.db', import.meta.url)) // works on Windows paths with spaces too

export const config = {
  port: Number(process.env.PORT || 5000),
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  dbPath: process.env.DB_PATH || defaultDb,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  tokenHours: 12,
}

// make sure the folder for the database file exists
mkdirSync(dirname(config.dbPath), { recursive: true })
