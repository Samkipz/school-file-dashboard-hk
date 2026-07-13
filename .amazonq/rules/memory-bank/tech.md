# Technology Stack

## Core
- **Next.js 16.2.6** — App Router, RSC, Server Actions
- **React 19** — UI framework
- **TypeScript 5.7.3** — Strict typing throughout

## Styling
- **Tailwind CSS v4** (`tailwindcss ^4.2.0`) — Utility-first CSS, configured via `app/globals.css`
- **tw-animate-css** — Animation utilities
- **shadcn/ui** (`style: base-nova`) — Component library built on Radix/Base UI primitives
- **@base-ui/react** — Underlying headless UI primitives for shadcn
- **lucide-react** — Icon library
- **class-variance-authority + clsx + tailwind-merge** — Variant and class management

## Database
- **Drizzle ORM ^0.45.2** — Type-safe ORM
- **drizzle-kit ^0.31.10** — Migrations and schema management
- **pg ^8.22.0** — PostgreSQL driver

## Authentication
- **better-auth ^1.6.23** — Full-stack auth library (server config in `lib/auth.ts`, client in `lib/auth-client.ts`)

## Analytics
- **@vercel/analytics 1.6.1** — Vercel deployment analytics

## Utilities
- **date-fns ^4.4.0** — Date formatting/manipulation

## Package Manager
- **pnpm** (pnpm-lock.yaml present; hono overridden to 4.12.25 via pnpm overrides)

## Development Commands
```bash
pnpm dev        # Start dev server (Next.js)
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # ESLint
```

## Configuration Files
- `next.config.mjs` — `ignoreBuildErrors: true`, `images.unoptimized: true`
- `drizzle.config.ts` — Drizzle Kit database connection and schema path
- `components.json` — shadcn/ui: style `base-nova`, CSS variables, `@/` aliases
- `tsconfig.json` — TypeScript config with `@/` path alias
- `app/globals.css` — Tailwind v4 theme and CSS custom properties
