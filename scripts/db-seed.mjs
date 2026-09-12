import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { developmentPool, safeFailure } from './db-common.mjs'
import { seedFoundation } from './dev-fixtures.mjs'
const pool = developmentPool()
try {
  // A supplied local password avoids shipping shared, publicly known credentials.
  let password = process.env.DEV_SEED_PASSWORD
  if (!password) {
    password = randomBytes(24).toString('base64url')
    appendFileSync('.env.local', `\n# Local development fixture password; never commit.\nDEV_SEED_PASSWORD=${password}\n`)
    console.log('Generated fixture password saved to ignored .env.local as DEV_SEED_PASSWORD')
  }
  if (password.length < 12) throw new Error('DEV_SEED_PASSWORD must contain at least 12 characters')
  const client = await pool.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    await seedFoundation(client, await hashPassword(password))
    await client.query('COMMIT')
    console.log('Seed PASS: one school, 3 staff identities/roles, 1 year, 3 terms, Grade 10 East, 3 subjects/assignments, 4 learners and 12 subject enrolments. Existing credentials unchanged on rerun.')
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
} catch (error) { safeFailure(error) } finally { await pool.end() }
