import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

const baseUrl =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.V0_RUNTIME_URL ?? 'http://localhost:3000')

const origins = [
  ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    : []),
]

export const auth = betterAuth({
  database: pool,
  baseURL: baseUrl,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: origins,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    // Skip origin check in development for v0 preview iframe compatibility
    skipOriginCheck: process.env.NODE_ENV === 'development',
    // In dev (v0 preview iframe), force cross-site cookies so the
    // session cookie is stored by the browser.
    defaultCookieAttributes:
      process.env.NODE_ENV === 'development'
        ? {
            sameSite: 'none' as const,
            secure: true,
          }
        : {
            sameSite: 'lax' as const,
            secure: true,
          },
  },
})
