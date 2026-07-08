'use client'

import { createAuthClient } from 'better-auth/react'

// Determine baseURL
const baseURL = typeof window !== 'undefined' 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const authClient = createAuthClient({
  baseURL,
  // Enable credentials for cross-origin requests
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signIn, signUp, signOut, useSession } = authClient
