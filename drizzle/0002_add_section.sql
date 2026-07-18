ALTER TABLE "files" ADD COLUMN "section" text DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "section" text DEFAULT 'staff' NOT NULL;