import { pgTable, text, timestamp, boolean, bigint } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------
// Add your app tables below. Always include a plain `userId` column so queries
// can be scoped per user — the security model depends on this column existing,
// not on a foreign key. Do NOT add a foreign key constraint
// (`.references(() => user.id, ...)`) unless the user explicitly asks for
// foreign keys or referential integrity; FK constraints make iterating on the
// schema harder.
//
// Example:
//
// import { serial } from "drizzle-orm/pg-core"
//
// export const todos = pgTable("todos", {
//   id: serial("id").primaryKey(),
//   userId: text("userId").notNull(),
//   title: text("title").notNull(),
//   completed: boolean("completed").notNull().default(false),
//   createdAt: timestamp("createdAt").notNull().defaultNow(),
// })
//
// If the user asks for foreign keys, add the reference back in:
//   userId: text("userId")
//     .notNull()
//     .references(() => user.id, { onDelete: "cascade" }),

export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  parentFolderId: text('parentFolderId'),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('originalName').notNull(),
  mimeType: text('mimeType').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  uploadedBy: text('uploadedBy').notNull(),
  uploadedAt: timestamp('uploadedAt').notNull().defaultNow(),
  bucketPath: text('bucketPath').notNull(),
  folderId: text('folderId').notNull(),
})

export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull().default('general'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: timestamp('eventDate').notNull(),
  location: text('location'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  actionType: text('actionType').notNull(),
  description: text('description').notNull(),
  targetId: text('targetId'),
  targetType: text('targetType'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const students = pgTable('students', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  className: text('className').notNull(),
  avatarUrl: text('avatarUrl'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const portfolioFiles = pgTable('portfolioFiles', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('originalName').notNull(),
  mimeType: text('mimeType').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  uploadedBy: text('uploadedBy').notNull(),
  uploadedAt: timestamp('uploadedAt').notNull().defaultNow(),
  bucketPath: text('bucketPath').notNull(),
  studentId: text('studentId').notNull(),
})
