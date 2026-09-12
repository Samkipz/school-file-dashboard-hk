import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from './app-layout'

export async function DeferredFeature() {
  if (!(await auth.api.getSession({ headers: await headers() }))?.user) redirect('/sign-in')
  return <AppLayout><div className="p-6 space-y-4"><h1 className="text-2xl font-semibold">This feature is being updated</h1>
    <p>School and academic records are available in Academics. This feature will return as its school integration is completed.</p>
    <Link href="/academics" className="underline">Open Academics</Link></div></AppLayout>
}
