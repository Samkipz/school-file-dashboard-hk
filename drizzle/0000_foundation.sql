CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"code" varchar(160) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	CONSTRAINT "academic_years_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "academic_years_school_id_code_unique" UNIQUE("school_id","code"),
	CONSTRAINT "year_dates" CHECK ("academic_years"."ends_on" is null or "academic_years"."ends_on" >= "academic_years"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255),
	"kind" varchar(16) NOT NULL,
	"actor_code" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_actors_actor_code_unique" UNIQUE("actor_code"),
	CONSTRAINT "actor_shape" CHECK (("audit_actors"."kind" = 'human' and "audit_actors"."user_id" is not null) or ("audit_actors"."kind" = 'service' and "audit_actors"."user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"actor_id" uuid NOT NULL,
	"membership_id" uuid,
	"event_type" varchar(160) NOT NULL,
	"resource_type" varchar(160) NOT NULL,
	"resource_id" uuid,
	"command_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" varchar(500),
	"safe_changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"origin" varchar(16) DEFAULT 'native' NOT NULL,
	CONSTRAINT "audit_events_command_id_sequence_unique" UNIQUE("command_id","sequence"),
	CONSTRAINT "audit_sequence" CHECK ("audit_events"."sequence" > 0),
	CONSTRAINT "audit_origin" CHECK ("audit_events"."origin" in ('native', 'legacy_import')),
	CONSTRAINT "audit_school_shape" CHECK (("audit_events"."membership_id" is null or "audit_events"."school_id" is not null) and ("audit_events"."school_id" is not null or "audit_events"."event_type" like 'auth.%' or "audit_events"."event_type" like 'platform.%'))
);
--> statement-breakpoint
CREATE TABLE "class_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"code" varchar(160) NOT NULL,
	"label" varchar(160) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	CONSTRAINT "class_groups_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "class_groups_school_id_id_academic_year_id_grade_id_unique" UNIQUE("school_id","id","academic_year_id","grade_id"),
	CONSTRAINT "class_groups_school_id_academic_year_id_grade_id_code_unique" UNIQUE("school_id","academic_year_id","grade_id","code")
);
--> statement-breakpoint
CREATE TABLE "class_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"enrolment_id" uuid NOT NULL,
	"class_group_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	CONSTRAINT "class_placements_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "placement_full_context_unique" UNIQUE("school_id","id","enrolment_id","class_group_id","academic_year_id","grade_id"),
	CONSTRAINT "class_placements_school_id_enrolment_id_starts_on_unique" UNIQUE("school_id","enrolment_id","starts_on"),
	CONSTRAINT "placement_dates" CHECK ("class_placements"."ends_on" is null or "class_placements"."ends_on" >= "class_placements"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_code" varchar(160) NOT NULL,
	"code" varchar(160) NOT NULL,
	"label" varchar(160) NOT NULL,
	"ordinal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "grades_curriculum_code_code_unique" UNIQUE("curriculum_code","code"),
	CONSTRAINT "grade_ordinal" CHECK ("grades"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "learner_admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"learner_id" uuid NOT NULL,
	"admission_number" varchar(160) NOT NULL,
	"admitted_on" date NOT NULL,
	"left_on" date,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	CONSTRAINT "learner_admissions_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "learner_admissions_school_id_id_learner_id_unique" UNIQUE("school_id","id","learner_id"),
	CONSTRAINT "learner_admissions_school_id_admission_number_unique" UNIQUE("school_id","admission_number"),
	CONSTRAINT "admission_dates" CHECK ("learner_admissions"."left_on" is null or "learner_admissions"."left_on" >= "learner_admissions"."admitted_on")
);
--> statement-breakpoint
CREATE TABLE "learner_enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"learner_id" uuid NOT NULL,
	"admission_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	CONSTRAINT "learner_enrolments_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "learner_enrolments_school_id_id_academic_year_id_grade_id_unique" UNIQUE("school_id","id","academic_year_id","grade_id"),
	CONSTRAINT "learner_enrolments_school_id_learner_id_academic_year_id_unique" UNIQUE("school_id","learner_id","academic_year_id"),
	CONSTRAINT "enrolment_dates" CHECK ("learner_enrolments"."ends_on" is null or "learner_enrolments"."ends_on" >= "learner_enrolments"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "learner_subject_enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"enrolment_id" uuid NOT NULL,
	"placement_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"class_group_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	CONSTRAINT "learner_subject_enrolments_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "subject_enrolment_start_unique" UNIQUE("school_id","enrolment_id","offering_id","starts_on"),
	CONSTRAINT "subject_enrolment_dates" CHECK ("learner_subject_enrolments"."ends_on" is null or "learner_subject_enrolments"."ends_on" >= "learner_subject_enrolments"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "learners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"display_name" varchar(160) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"login_membership_id" uuid,
	CONSTRAINT "learners_school_id_id_unique" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "membership_roles_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "membership_roles_school_id_membership_id_role_id_valid_from_unique" UNIQUE("school_id","membership_id","role_id","valid_from"),
	CONSTRAINT "role_grant_dates" CHECK ("membership_roles"."valid_until" is null or "membership_roles"."valid_until" > "membership_roles"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(160) NOT NULL,
	"name" varchar(160) NOT NULL,
	"scope" varchar(16) NOT NULL,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "roles_code_unique" UNIQUE("code"),
	CONSTRAINT "role_scope" CHECK ("roles"."scope" in ('school', 'platform')),
	CONSTRAINT "role_policy_version" CHECK ("roles"."policy_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "school_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"user_id" varchar(255) NOT NULL,
	"status" varchar(24) DEFAULT 'invited' NOT NULL,
	"joined_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "school_memberships_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "school_memberships_school_id_user_id_unique" UNIQUE("school_id","user_id"),
	CONSTRAINT "active_membership_joined" CHECK ("school_memberships"."status" <> 'active' or ("school_memberships"."joined_at" is not null and "school_memberships"."ended_at" is null)),
	CONSTRAINT "membership_dates" CHECK ("school_memberships"."ended_at" is null or "school_memberships"."ended_at" >= "school_memberships"."joined_at")
);
--> statement-breakpoint
CREATE TABLE "school_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"subject_id" uuid NOT NULL,
	"local_code" varchar(160) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "school_subjects_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "school_subjects_school_id_id_subject_id_unique" UNIQUE("school_id","id","subject_id"),
	CONSTRAINT "school_subjects_school_id_subject_id_unique" UNIQUE("school_id","subject_id"),
	CONSTRAINT "school_subjects_school_id_local_code_unique" UNIQUE("school_id","local_code")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(160) NOT NULL,
	"name" varchar(160) NOT NULL,
	"timezone" varchar(160) DEFAULT 'Africa/Nairobi' NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "schools_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"membership_id" uuid NOT NULL,
	"staff_code" varchar(160) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	CONSTRAINT "staff_profiles_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "staff_profiles_school_id_membership_id_unique" UNIQUE("school_id","membership_id"),
	CONSTRAINT "staff_profiles_school_id_staff_code_unique" UNIQUE("school_id","staff_code")
);
--> statement-breakpoint
CREATE TABLE "subject_catalogue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_code" varchar(160) NOT NULL,
	"code" varchar(160) NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "subject_catalogue_curriculum_code_code_unique" UNIQUE("curriculum_code","code")
);
--> statement-breakpoint
CREATE TABLE "subject_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "subject_grades_subject_id_grade_id_unique" UNIQUE("subject_id","grade_id")
);
--> statement-breakpoint
CREATE TABLE "subject_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"school_subject_id" uuid NOT NULL,
	"class_group_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	CONSTRAINT "subject_offerings_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "subject_offerings_school_id_class_group_id_school_subject_id_unique" UNIQUE("school_id","class_group_id","school_subject_id"),
	CONSTRAINT "offering_full_context_unique" UNIQUE("school_id","id","class_group_id","academic_year_id","grade_id")
);
--> statement-breakpoint
CREATE TABLE "teacher_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	CONSTRAINT "teacher_assignments_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "teacher_assignments_school_id_staff_id_offering_id_starts_on_unique" UNIQUE("school_id","staff_id","offering_id","starts_on"),
	CONSTRAINT "teacher_dates" CHECK ("teacher_assignments"."ends_on" is null or "teacher_assignments"."ends_on" >= "teacher_assignments"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"academic_year_id" uuid NOT NULL,
	"code" varchar(160) NOT NULL,
	"ordinal" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	CONSTRAINT "terms_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "terms_school_id_academic_year_id_code_unique" UNIQUE("school_id","academic_year_id","code"),
	CONSTRAINT "terms_school_id_academic_year_id_ordinal_unique" UNIQUE("school_id","academic_year_id","ordinal"),
	CONSTRAINT "term_ordinal" CHECK ("terms"."ordinal" > 0),
	CONSTRAINT "term_dates" CHECK ("terms"."ends_on" is null or "terms"."ends_on" >= "terms"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_actors" ADD CONSTRAINT "audit_actors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_audit_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_school_id_membership_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","membership_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_school_id_academic_year_id_academic_years_school_id_id_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_placements" ADD CONSTRAINT "class_placements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_placements" ADD CONSTRAINT "class_placements_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_placements" ADD CONSTRAINT "class_placements_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_placements" ADD CONSTRAINT "class_placements_school_id_enrolment_id_academic_year_id_grade_id_learner_enrolments_school_id_id_academic_year_id_grade_id_fk" FOREIGN KEY ("school_id","enrolment_id","academic_year_id","grade_id") REFERENCES "public"."learner_enrolments"("school_id","id","academic_year_id","grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_placements" ADD CONSTRAINT "class_placements_school_id_class_group_id_academic_year_id_grade_id_class_groups_school_id_id_academic_year_id_grade_id_fk" FOREIGN KEY ("school_id","class_group_id","academic_year_id","grade_id") REFERENCES "public"."class_groups"("school_id","id","academic_year_id","grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_school_id_learner_id_learners_school_id_id_fk" FOREIGN KEY ("school_id","learner_id") REFERENCES "public"."learners"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_enrolments" ADD CONSTRAINT "learner_enrolments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_enrolments" ADD CONSTRAINT "learner_enrolments_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_enrolments" ADD CONSTRAINT "learner_enrolments_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_enrolments" ADD CONSTRAINT "learner_enrolments_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_enrolments" ADD CONSTRAINT "learner_enrolments_school_id_learner_id_learners_school_id_id_fk" FOREIGN KEY ("school_id","learner_id") REFERENCES "public"."learners"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_enrolments" ADD CONSTRAINT "learner_enrolments_school_id_academic_year_id_academic_years_school_id_id_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_enrolments" ADD CONSTRAINT "learner_enrolments_school_id_admission_id_learner_id_learner_admissions_school_id_id_learner_id_fk" FOREIGN KEY ("school_id","admission_id","learner_id") REFERENCES "public"."learner_admissions"("school_id","id","learner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_subject_enrolments" ADD CONSTRAINT "learner_subject_enrolments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_subject_enrolments" ADD CONSTRAINT "learner_subject_enrolments_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_subject_enrolments" ADD CONSTRAINT "learner_subject_enrolments_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_subject_enrolments" ADD CONSTRAINT "subject_enrolment_placement_context_fk" FOREIGN KEY ("school_id","placement_id","enrolment_id","class_group_id","academic_year_id","grade_id") REFERENCES "public"."class_placements"("school_id","id","enrolment_id","class_group_id","academic_year_id","grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_subject_enrolments" ADD CONSTRAINT "subject_enrolment_offering_context_fk" FOREIGN KEY ("school_id","offering_id","class_group_id","academic_year_id","grade_id") REFERENCES "public"."subject_offerings"("school_id","id","class_group_id","academic_year_id","grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_school_id_login_membership_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","login_membership_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_school_id_membership_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","membership_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_subject_id_subject_catalogue_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject_catalogue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_school_id_membership_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","membership_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_catalogue" ADD CONSTRAINT "subject_catalogue_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_catalogue" ADD CONSTRAINT "subject_catalogue_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_grades" ADD CONSTRAINT "subject_grades_subject_id_subject_catalogue_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject_catalogue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_grades" ADD CONSTRAINT "subject_grades_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_grades" ADD CONSTRAINT "subject_grades_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_grades" ADD CONSTRAINT "subject_grades_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_school_id_school_subject_id_subject_id_school_subjects_school_id_id_subject_id_fk" FOREIGN KEY ("school_id","school_subject_id","subject_id") REFERENCES "public"."school_subjects"("school_id","id","subject_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_school_id_class_group_id_academic_year_id_grade_id_class_groups_school_id_id_academic_year_id_grade_id_fk" FOREIGN KEY ("school_id","class_group_id","academic_year_id","grade_id") REFERENCES "public"."class_groups"("school_id","id","academic_year_id","grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_subject_id_grade_id_subject_grades_subject_id_grade_id_fk" FOREIGN KEY ("subject_id","grade_id") REFERENCES "public"."subject_grades"("subject_id","grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_school_id_staff_id_staff_profiles_school_id_id_fk" FOREIGN KEY ("school_id","staff_id") REFERENCES "public"."staff_profiles"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_school_id_offering_id_subject_offerings_school_id_id_fk" FOREIGN KEY ("school_id","offering_id") REFERENCES "public"."subject_offerings"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_school_id_academic_year_id_academic_years_school_id_id_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "year_start_idx" ON "academic_years" USING btree ("school_id","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_user_unique" ON "audit_actors" USING btree ("user_id") WHERE "audit_actors"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_school_time_idx" ON "audit_events" USING btree ("school_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_actor_time_idx" ON "audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_events" USING btree ("school_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "class_status_idx" ON "class_groups" USING btree ("school_id","academic_year_id","grade_id","status");--> statement-breakpoint
CREATE INDEX "placement_class_dates_idx" ON "class_placements" USING btree ("school_id","class_group_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "grade_ordinal_idx" ON "grades" USING btree ("curriculum_code","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_active_unique" ON "learner_admissions" USING btree ("school_id","learner_id") WHERE "learner_admissions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "admission_learner_dates_idx" ON "learner_admissions" USING btree ("school_id","learner_id","admitted_on");--> statement-breakpoint
CREATE INDEX "enrolment_year_status_idx" ON "learner_enrolments" USING btree ("school_id","academic_year_id","grade_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_enrolment_open_unique" ON "learner_subject_enrolments" USING btree ("school_id","enrolment_id","offering_id") WHERE "learner_subject_enrolments"."ends_on" is null;--> statement-breakpoint
CREATE INDEX "subject_enrolment_offering_status_idx" ON "learner_subject_enrolments" USING btree ("school_id","offering_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "learner_login_unique" ON "learners" USING btree ("school_id","login_membership_id") WHERE "learners"."login_membership_id" is not null;--> statement-breakpoint
CREATE INDEX "learner_status_name_idx" ON "learners" USING btree ("school_id","status","display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "role_open_grant_unique" ON "membership_roles" USING btree ("school_id","membership_id","role_id") WHERE "membership_roles"."valid_until" is null and "membership_roles"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "membership_role_idx" ON "membership_roles" USING btree ("school_id","role_id");--> statement-breakpoint
CREATE INDEX "membership_user_status_idx" ON "school_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "membership_school_status_idx" ON "school_memberships" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "school_subject_enabled_idx" ON "school_subjects" USING btree ("school_id","enabled");--> statement-breakpoint
CREATE INDEX "school_status_idx" ON "schools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_status_idx" ON "staff_profiles" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "subject_curriculum_status_idx" ON "subject_catalogue" USING btree ("curriculum_code","status");--> statement-breakpoint
CREATE INDEX "subject_grade_idx" ON "subject_grades" USING btree ("grade_id");--> statement-breakpoint
CREATE INDEX "offering_context_idx" ON "subject_offerings" USING btree ("school_id","academic_year_id","grade_id","subject_id");--> statement-breakpoint
CREATE INDEX "teacher_staff_status_idx" ON "teacher_assignments" USING btree ("school_id","staff_id","status");--> statement-breakpoint
CREATE INDEX "teacher_offering_status_idx" ON "teacher_assignments" USING btree ("school_id","offering_id","status");--> statement-breakpoint
CREATE INDEX "term_start_idx" ON "terms" USING btree ("school_id","academic_year_id","starts_on");