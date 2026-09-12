// Historical definitions for disabled UI adapters. Not part of the migration schema.
import { pgTable, text, timestamp, bigint } from 'drizzle-orm/pg-core'
export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  parentFolderId: text('parentFolderId'),
  name: text('name').notNull(),
  description: text('description'),
  section: text('section').notNull().default('staff'),
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
  section: text('section').notNull().default('staff'),
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

