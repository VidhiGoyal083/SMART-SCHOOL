import { createServer } from 'node:http'
import { config } from './config.js'
import { seedIfEmpty } from './seed.js'
import { handle } from './lib/http.js'
import './routes/auth.js'
import './routes/meta.js'
import './routes/people.js'
import './routes/academics.js'
import './routes/messages.js'

if (seedIfEmpty()) console.log('Empty database found, sample school data created.')
createServer(handle).listen(config.port, () => console.log(`Smart School API running on http://localhost:${config.port}/api`))
