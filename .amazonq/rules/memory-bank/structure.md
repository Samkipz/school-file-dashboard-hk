# Project Structure

## Directory Layout
```
school-file-dashboard-hk/
├── app/                        # Next.js App Router
│   ├── actions/
│   │   └── dashboard.ts        # Server actions for dashboard data
│   ├── api/
│   │   └── auth/[...all]/      # better-auth catch-all API route
│   ├── general/page.tsx        # General info section
│   ├── media-files/page.tsx    # Media files section
│   ├── noticeboard/page.tsx    # Noticeboard section
│   ├── sign-in/page.tsx        # Auth: sign in
│   ├── sign-up/page.tsx        # Auth: sign up
│   ├── staff-resources/page.tsx# Staff resources section
│   ├── globals.css             # Global styles + Tailwind CSS v4 theme
│   ├── layout.tsx              # Root layout with sidebar
│   └── page.tsx                # Dashboard home page
├── components/
│   ├── ui/                     # shadcn/ui primitives (avatar, badge, button, card, input, label)
│   ├── activity-feed.tsx       # Dashboard activity feed widget
│   ├── announcements-section.tsx # Announcements widget
│   ├── auth-form.tsx           # Shared sign-in/sign-up form component
│   ├── events-section.tsx      # Upcoming events widget
│   └── sidebar-nav.tsx         # Persistent sidebar navigation
├── lib/
│   ├── db/
│   │   ├── index.ts            # Drizzle ORM client (PostgreSQL via pg)
│   │   └── schema.ts           # Database schema definitions
│   ├── auth-client.ts          # better-auth browser client
│   ├── auth.ts                 # better-auth server config
│   └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── public/                     # Static assets and icons
├── drizzle.config.ts           # Drizzle Kit config
├── next.config.mjs             # Next.js config
├── components.json             # shadcn/ui config
└── tsconfig.json
```

## Architectural Patterns
- **Next.js App Router** — All pages use the `app/` directory with RSC by default
- **Server Actions** — Data fetching and mutations via `app/actions/` (not API routes)
- **Auth catch-all route** — `app/api/auth/[...all]/route.ts` delegates to better-auth handler
- **Shared layout** — `app/layout.tsx` wraps all pages with sidebar navigation
- **Component separation** — Page-level logic in `app/`, reusable UI in `components/`, data/auth in `lib/`
- **Database** — Drizzle ORM with PostgreSQL; schema defined in `lib/db/schema.ts`
