'use client'

import Link from 'next/link'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-2xl font-semibold">This page could not be loaded</h1><p role="alert">Your school data is temporarily unavailable. Please try again.</p><button type="button" onClick={reset} className="min-h-11 rounded-lg border px-4 focus-visible:outline-2 focus-visible:outline-primary">Try again</button><Link href="/" className="ml-4 underline">Return Home</Link></main>
}
