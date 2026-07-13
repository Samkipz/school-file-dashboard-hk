# Development Guidelines

## Code Quality Standards

### File Directives
- Server Actions files always start with `'use server'`
- Client components always start with `'use client'`
- Files without either directive are React Server Components (RSC) by default

### Naming Conventions
- Components: PascalCase named exports (e.g., `export function AuthForm`)
- Server actions: camelCase named exports (e.g., `export async function getLatestActivities`)
- DB schema tables: camelCase variable names, snake_case SQL table names where multi-word (e.g., `activityLogs` → `'activity_logs'`)
- DB columns: camelCase (matching better-auth defaults — do not rename auth table columns)
- Files: kebab-case (e.g., `auth-form.tsx`, `sidebar-nav.tsx`)

### TypeScript
- Use `!` non-null assertion for env vars (e.g., `process.env.DATABASE_URL!`)
- Prefer inline type annotations over separate interfaces for simple props (e.g., `{ mode }: { mode: 'sign-in' | 'sign-up' }`)
- Use `Readonly<{}>` for layout children props
- Import types with `import type` (e.g., `import type { Metadata, Viewport } from 'next'`)

---

## Architectural Patterns

### Server Actions (app/actions/)
All data fetching and mutations use Server Actions, not API routes.

```ts
'use server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getSomeData(limit = 10) {
  const userId = await getUserId()
  return db.select().from(table).where(eq(table.userId, userId)).limit(limit)
}
```

- Always gate server actions with `getUserId()` — never skip auth checks
- Use `await headers()` (async) when calling `auth.api.getSession`
- Return raw Drizzle query results directly (no manual serialization)

### Authentication
- Server-side: `auth.api.getSession({ headers: await headers() })` from `@/lib/auth`
- Client-side: `authClient.signIn.email()` / `authClient.signUp.email()` from `@/lib/auth-client`
- Auth API route: `app/api/auth/[...all]/route.ts` wraps better-auth handler with CORS headers

### Database (Drizzle ORM)
- All queries use the `db` client from `@/lib/db`
- Import operators from `drizzle-orm` (e.g., `desc`, `eq`, `gte`)
- Schema pattern for app tables:
  - `id: text('id').primaryKey()` — text IDs (not serial/uuid type)
  - `userId: text('userId').notNull()` — always include, no FK constraint by default
  - `createdAt` + `updatedAt` timestamps with `.defaultNow()` on every table
  - Do NOT add `.references(() => user.id)` on app tables unless explicitly required

```ts
// Correct app table pattern
export const myTable = pgTable('my_table', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
```

---

## Component Patterns

### Client Components (forms, interactive UI)
- Use `useState` for form fields and loading/error state
- Pattern: `setError(null)` → `setLoading(true)` → await action → `setLoading(false)` → handle error or redirect
- Use `router.push('/')` + `router.refresh()` after successful auth actions
- Display errors with `role="alert"` for accessibility

```tsx
'use client'
const [error, setError] = useState<string | null>(null)
const [loading, setLoading] = useState(false)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)
  setLoading(true)
  const { error } = await authClient.signIn.email({ email, password })
  setLoading(false)
  if (error) { setError(error.message ?? 'Something went wrong'); return }
  router.push('/'); router.refresh()
}
```

### Styling
- Use Tailwind CSS utility classes exclusively — no inline styles
- CSS variables for theming: `bg-background`, `text-foreground`, `text-muted-foreground`, `text-destructive`
- Layout: `min-h-svh` (not `min-h-screen`), `flex items-center justify-center` for centered pages
- Form fields: `flex flex-col gap-2` for label+input pairs; `flex flex-col gap-4` for form sections
- Use `cn()` from `@/lib/utils` for conditional class merging

### shadcn/ui Usage
- Import from `@/components/ui/` (e.g., `Button`, `Input`, `Label`, `Card`)
- Always pair `<Label htmlFor="...">` with `<Input id="...">` for accessibility
- Use `autoComplete` attributes on all auth inputs

---

## Environment & Config
- Env vars loaded from `.env.local` (use `dotenv` config in non-Next contexts like `drizzle.config.ts`)
- Analytics only rendered in production: `{process.env.NODE_ENV === 'production' && <Analytics />}`
- Fonts: Geist Sans + Geist Mono via `next/font/google`, applied on `<body>`
- Metadata: export `metadata` and `viewport` as named constants from layout/page files
- Light/dark icon variants via `media` query in metadata icons array

---

## Path Aliases
Always use `@/` aliases — never relative paths for cross-directory imports:
- `@/lib/auth`, `@/lib/auth-client`, `@/lib/db`, `@/lib/utils`
- `@/components/ui/...`, `@/components/...`
