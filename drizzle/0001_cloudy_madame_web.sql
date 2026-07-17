CREATE TABLE "portfolioFiles" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"originalName" text NOT NULL,
	"mimeType" text NOT NULL,
	"size" bigint NOT NULL,
	"uploadedBy" text NOT NULL,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"bucketPath" text NOT NULL,
	"studentId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"className" text NOT NULL,
	"avatarUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
