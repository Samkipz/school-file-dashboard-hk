CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"learner_id" uuid,
	"folder_id" uuid,
	"object_key" varchar(512) NOT NULL,
	"original_name" varchar(160) NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" varchar(1000),
	"category" varchar(24) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by_actor_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" varchar(16) DEFAULT 'pending' NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "media_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "media_assets_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "media_asset_target" CHECK (("media_assets"."learner_id" is null) <> ("media_assets"."folder_id" is null)),
	CONSTRAINT "media_asset_size" CHECK ("media_assets"."size" > 0 and "media_assets"."size" <= 10485760),
	CONSTRAINT "media_asset_state" CHECK ("media_assets"."state" in ('pending','ready','failed')),
	CONSTRAINT "media_asset_category" CHECK ("media_assets"."category" in ('general','work','certificate','photo','video'))
);
--> statement-breakpoint
CREATE TABLE "media_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(1000),
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "media_folders_school_id_id_unique" UNIQUE("school_id","id")
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("uploaded_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_school_id_learner_id_learners_school_id_id_fk" FOREIGN KEY ("school_id","learner_id") REFERENCES "public"."learners"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_school_id_folder_id_media_folders_school_id_id_fk" FOREIGN KEY ("school_id","folder_id") REFERENCES "public"."media_folders"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_asset_learner_idx" ON "media_assets" USING btree ("school_id","learner_id");--> statement-breakpoint
CREATE INDEX "media_asset_folder_idx" ON "media_assets" USING btree ("school_id","folder_id");--> statement-breakpoint
CREATE INDEX "media_asset_actor_idx" ON "media_assets" USING btree ("uploaded_by_actor_id");--> statement-breakpoint
CREATE INDEX "media_folder_actor_idx" ON "media_folders" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_folder_name_unique" ON "media_folders" USING btree ("school_id","name") WHERE "media_folders"."archived_at" is null;