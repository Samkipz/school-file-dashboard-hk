import { appendFileSync } from 'node:fs'
import { targetFingerprint } from './db-common.mjs'

// This records owner verification, not a Neon control-plane lookup.
if (process.env.NODE_ENV === 'production' || process.argv[2] !== 'schoolhub-fresh-dev' || !process.env.DATABASE_URL) {
  throw new Error('After verifying DATABASE_URL points to schoolhub-fresh-dev, run: node scripts/db-pin.mjs schoolhub-fresh-dev')
}
if (process.env.DEV_DATABASE_FINGERPRINT) {
  if (process.env.DEV_DATABASE_FINGERPRINT !== targetFingerprint(process.env.DATABASE_URL)) throw new Error('Pinned target changed; review and remove the old local fingerprint before repinning')
} else {
  appendFileSync('.env.local', `\n# Owner-verified schoolhub-fresh-dev endpoint/database fingerprint.\nDEV_DATABASE_FINGERPRINT=${targetFingerprint(process.env.DATABASE_URL)}\n`)
}
console.log('Development endpoint/database fingerprint pinned locally; no credentials printed')
