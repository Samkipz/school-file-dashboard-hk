export { user, session, account, verification } from './auth-schema';
import { user } from './auth-schema';
import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, date, integer, bigint, boolean, jsonb, index, unique, uniqueIndex, check, foreignKey, type AnyPgColumn } from 'drizzle-orm/pg-core';
const id = () => uuid('id').primaryKey().defaultRandom();
const label = (name: string) => varchar(name, {
    length: 160
}).notNull();
const instant = (name: string) => timestamp(name, {
    withTimezone: true
});
const status = <T extends string>(values: [
    T,
    ...T[]
], initial: T) => varchar('status', {
    length: 24, enum: values
}).notNull().default(initial);
const reference = (name: string, target: () => AnyPgColumn) => uuid(name).notNull().references(target, {
    onDelete: 'restrict'
});
export const auditActors = pgTable('audit_actors', {
    id: id(), userId: varchar('user_id', {
        length: 255
    }).references(() => user.id, {
        onDelete: 'restrict'
    }),
    kind: varchar('kind', {
        length: 16, enum: ['human', 'service']
    }).notNull(), actorCode: label('actor_code'), createdAt: instant('created_at').notNull().defaultNow(),
}, t => [
    unique().on(t.actorCode), uniqueIndex('actor_user_unique').on(t.userId).where(sql `${t.userId} is not null`), check('actor_shape', sql `(${t.kind} = 'human' and ${t.userId} is not null) or (${t.kind} = 'service' and ${t.userId} is null)`)
]);
const lifecycle = () => ({
    createdAt: instant('created_at').notNull().defaultNow(), updatedAt: instant('updated_at').notNull().defaultNow(),
    createdByActorId: reference('created_by_actor_id', () => auditActors.id), updatedByActorId: reference('updated_by_actor_id', () => auditActors.id),
    rowVersion: bigint('row_version', {
        mode: 'number'
    }).notNull().default(1), archivedAt: instant('archived_at'),
});
export const schools = pgTable('schools', {
    id: id(), code: label('code'), name: label('name'), timezone: label('timezone').default('Africa/Nairobi'), status: status(['active', 'suspended', 'archived'], 'active'), ...lifecycle(),
}, t => [
    unique().on(t.code), index('school_status_idx').on(t.status)
]);
const tenant = () => ({
    id: id(), schoolId: reference('school_id', () => schools.id), ...lifecycle()
});
const tenantKey = (t: {
    schoolId: AnyPgColumn;
    id: AnyPgColumn;
}) => unique().on(t.schoolId, t.id);
const tenantFk = (t: {
    schoolId: AnyPgColumn;
}, col: AnyPgColumn, parent: {
    schoolId: AnyPgColumn;
    id: AnyPgColumn;
}) => foreignKey({
    columns: [
        t.schoolId, col
    ], foreignColumns: [
        parent.schoolId, parent.id
    ]
}).onDelete('restrict');
const interval = (name: string, start: AnyPgColumn, end: AnyPgColumn) => check(name, sql `${end} is null or ${end} >= ${start}`);
export const schoolMemberships = pgTable('school_memberships', {
    ...tenant(), userId: varchar('user_id', {
        length: 255
    }).notNull().references(() => user.id, {
        onDelete: 'restrict'
    }), status: status(['invited', 'active', 'suspended', 'left'], 'invited'), joinedAt: instant('joined_at'), endedAt: instant('ended_at'),
}, t => [
    tenantKey(t), unique().on(t.schoolId, t.userId), index('membership_user_status_idx').on(t.userId, t.status), index('membership_school_status_idx').on(t.schoolId, t.status), check('active_membership_joined', sql `${t.status} <> 'active' or (${t.joinedAt} is not null and ${t.endedAt} is null)`), interval('membership_dates', t.joinedAt, t.endedAt)
]);
export const roles = pgTable('roles', {
    id: id(), code: label('code'), name: label('name'), scope: varchar('scope', {
        length: 16, enum: ['school', 'platform']
    }).notNull(), policyVersion: integer('policy_version').notNull().default(1), ...lifecycle(),
}, t => [
    unique().on(t.code), check('role_scope', sql `${t.scope} in ('school', 'platform')`), check('role_policy_version', sql `${t.policyVersion} > 0`)
]);
export const membershipRoles = pgTable('membership_roles', {
    ...tenant(), membershipId: uuid('membership_id').notNull(), roleId: reference('role_id', () => roles.id), validFrom: instant('valid_from').notNull(), validUntil: instant('valid_until'), revokedAt: instant('revoked_at'),
}, t => [
    tenantKey(t), tenantFk(t, t.membershipId, schoolMemberships), unique().on(t.schoolId, t.membershipId, t.roleId, t.validFrom), uniqueIndex('role_open_grant_unique').on(t.schoolId, t.membershipId, t.roleId).where(sql `${t.validUntil} is null and ${t.revokedAt} is null`), index('membership_role_idx').on(t.schoolId, t.roleId), check('role_grant_dates', sql `${t.validUntil} is null or ${t.validUntil} > ${t.validFrom}`)
]);
export const staffProfiles = pgTable('staff_profiles', {
    ...tenant(), membershipId: uuid('membership_id').notNull(), staffCode: label('staff_code'), displayName: label('display_name'), status: status(['active', 'inactive'], 'active'),
}, t => [
    tenantKey(t), tenantFk(t, t.membershipId, schoolMemberships), unique().on(t.schoolId, t.membershipId), unique().on(t.schoolId, t.staffCode), index('staff_status_idx').on(t.schoolId, t.status)
]);
export const learners = pgTable('learners', {
    ...tenant(), displayName: label('display_name'), status: status(['active', 'left', 'completed', 'archived'], 'active'), loginMembershipId: uuid('login_membership_id'),
}, t => [
    tenantKey(t), tenantFk(t, t.loginMembershipId, schoolMemberships), uniqueIndex('learner_login_unique').on(t.schoolId, t.loginMembershipId).where(sql `${t.loginMembershipId} is not null`), index('learner_status_name_idx').on(t.schoolId, t.status, t.displayName)
]);
export const learnerAdmissions = pgTable('learner_admissions', {
    ...tenant(), learnerId: uuid('learner_id').notNull(), admissionNumber: label('admission_number'), admittedOn: date('admitted_on').notNull(), leftOn: date('left_on'), status: status(['active', 'closed'], 'active'),
}, t => [
    tenantKey(t), tenantFk(t, t.learnerId, learners), unique().on(t.schoolId, t.id, t.learnerId), unique().on(t.schoolId, t.admissionNumber), uniqueIndex('admission_active_unique').on(t.schoolId, t.learnerId).where(sql `${t.status} = 'active'`), index('admission_learner_dates_idx').on(t.schoolId, t.learnerId, t.admittedOn), interval('admission_dates', t.admittedOn, t.leftOn)
]);
export const academicYears = pgTable('academic_years', {
    ...tenant(), code: label('code'), startsOn: date('starts_on').notNull(), endsOn: date('ends_on').notNull(), status: status(['draft', 'active', 'closed'], 'draft'),
}, t => [
    tenantKey(t), unique().on(t.schoolId, t.code), index('year_start_idx').on(t.schoolId, t.startsOn), interval('year_dates', t.startsOn, t.endsOn)
]);
export const terms = pgTable('terms', {
    ...tenant(), academicYearId: uuid('academic_year_id').notNull(), code: label('code'), ordinal: integer('ordinal').notNull(), startsOn: date('starts_on').notNull(), endsOn: date('ends_on').notNull(),
}, t => [
    tenantKey(t), tenantFk(t, t.academicYearId, academicYears), unique().on(t.schoolId, t.academicYearId, t.code), unique().on(t.schoolId, t.academicYearId, t.ordinal), index('term_start_idx').on(t.schoolId, t.academicYearId, t.startsOn), check('term_ordinal', sql `${t.ordinal} > 0`), interval('term_dates', t.startsOn, t.endsOn)
]);
export const grades = pgTable('grades', {
    id: id(), curriculumCode: label('curriculum_code'), code: label('code'), label: label('label'), ordinal: integer('ordinal').notNull(), ...lifecycle(),
}, t => [
    unique().on(t.curriculumCode, t.code), index('grade_ordinal_idx').on(t.curriculumCode, t.ordinal), check('grade_ordinal', sql `${t.ordinal} > 0`)
]);
export const classGroups = pgTable('class_groups', {
    ...tenant(), academicYearId: uuid('academic_year_id').notNull(), gradeId: reference('grade_id', () => grades.id), code: label('code'), label: label('label'), status: status(['active', 'closed'], 'active'),
}, t => [
    tenantKey(t), tenantFk(t, t.academicYearId, academicYears), unique().on(t.schoolId, t.id, t.academicYearId, t.gradeId), unique().on(t.schoolId, t.academicYearId, t.gradeId, t.code), index('class_status_idx').on(t.schoolId, t.academicYearId, t.gradeId, t.status)
]);
export const learnerEnrolments = pgTable('learner_enrolments', {
    ...tenant(), learnerId: uuid('learner_id').notNull(), admissionId: uuid('admission_id').notNull(), academicYearId: uuid('academic_year_id').notNull(), gradeId: reference('grade_id', () => grades.id), startsOn: date('starts_on').notNull(), endsOn: date('ends_on'), status: status(['active', 'withdrawn', 'completed'], 'active'),
}, t => [
    tenantKey(t), tenantFk(t, t.learnerId, learners), tenantFk(t, t.academicYearId, academicYears), foreignKey({
        columns: [
            t.schoolId, t.admissionId, t.learnerId
        ], foreignColumns: [
            learnerAdmissions.schoolId, learnerAdmissions.id, learnerAdmissions.learnerId
        ]
    }).onDelete('restrict'), unique().on(t.schoolId, t.id, t.academicYearId, t.gradeId), unique().on(t.schoolId, t.learnerId, t.academicYearId), index('enrolment_year_status_idx').on(t.schoolId, t.academicYearId, t.gradeId, t.status), interval('enrolment_dates', t.startsOn, t.endsOn)
]);
export const classPlacements = pgTable('class_placements', {
    ...tenant(), enrolmentId: uuid('enrolment_id').notNull(), classGroupId: uuid('class_group_id').notNull(), academicYearId: uuid('academic_year_id').notNull(), gradeId: uuid('grade_id').notNull(), startsOn: date('starts_on').notNull(), endsOn: date('ends_on'),
}, t => [
    tenantKey(t), foreignKey({
        columns: [
            t.schoolId, t.enrolmentId, t.academicYearId, t.gradeId
        ], foreignColumns: [
            learnerEnrolments.schoolId, learnerEnrolments.id, learnerEnrolments.academicYearId, learnerEnrolments.gradeId
        ]
    }).onDelete('restrict'), foreignKey({
        columns: [
            t.schoolId, t.classGroupId, t.academicYearId, t.gradeId
        ], foreignColumns: [
            classGroups.schoolId, classGroups.id, classGroups.academicYearId, classGroups.gradeId
        ]
    }).onDelete('restrict'), unique('placement_full_context_unique').on(t.schoolId, t.id, t.enrolmentId, t.classGroupId, t.academicYearId, t.gradeId), unique().on(t.schoolId, t.enrolmentId, t.startsOn), index('placement_class_dates_idx').on(t.schoolId, t.classGroupId, t.startsOn, t.endsOn), interval('placement_dates', t.startsOn, t.endsOn)
]);
export const subjectCatalogue = pgTable('subject_catalogue', {
    id: id(), curriculumCode: label('curriculum_code'), code: label('code'), name: label('name'), status: status(['active', 'retired'], 'active'), ...lifecycle(),
}, t => [
    unique().on(t.curriculumCode, t.code), index('subject_curriculum_status_idx').on(t.curriculumCode, t.status)
]);
export const subjectGrades = pgTable('subject_grades', {
    id: id(), subjectId: reference('subject_id', () => subjectCatalogue.id), gradeId: reference('grade_id', () => grades.id), ...lifecycle(),
}, t => [
    unique().on(t.subjectId, t.gradeId), index('subject_grade_idx').on(t.gradeId)
]);
export const schoolSubjects = pgTable('school_subjects', {
    ...tenant(), subjectId: reference('subject_id', () => subjectCatalogue.id), localCode: label('local_code'), displayName: label('display_name'), enabled: boolean('enabled').notNull().default(true),
}, t => [
    tenantKey(t), unique().on(t.schoolId, t.id, t.subjectId), unique().on(t.schoolId, t.subjectId), unique().on(t.schoolId, t.localCode), index('school_subject_enabled_idx').on(t.schoolId, t.enabled)
]);
export const subjectOfferings = pgTable('subject_offerings', {
    ...tenant(), schoolSubjectId: uuid('school_subject_id').notNull(), classGroupId: uuid('class_group_id').notNull(), academicYearId: uuid('academic_year_id').notNull(), gradeId: uuid('grade_id').notNull(), subjectId: uuid('subject_id').notNull(), status: status(['active', 'closed'], 'active'),
}, t => [
    tenantKey(t), foreignKey({
        columns: [
            t.schoolId, t.schoolSubjectId, t.subjectId
        ], foreignColumns: [
            schoolSubjects.schoolId, schoolSubjects.id, schoolSubjects.subjectId
        ]
    }).onDelete('restrict'), foreignKey({
        columns: [
            t.schoolId, t.classGroupId, t.academicYearId, t.gradeId
        ], foreignColumns: [
            classGroups.schoolId, classGroups.id, classGroups.academicYearId, classGroups.gradeId
        ]
    }).onDelete('restrict'), foreignKey({
        columns: [
            t.subjectId, t.gradeId
        ], foreignColumns: [
            subjectGrades.subjectId, subjectGrades.gradeId
        ]
    }).onDelete('restrict'), unique().on(t.schoolId, t.classGroupId, t.schoolSubjectId), unique('offering_full_context_unique').on(t.schoolId, t.id, t.classGroupId, t.academicYearId, t.gradeId), index('offering_context_idx').on(t.schoolId, t.academicYearId, t.gradeId, t.subjectId)
]);
export const learnerSubjectEnrolments = pgTable('learner_subject_enrolments', {
    ...tenant(), enrolmentId: uuid('enrolment_id').notNull(), placementId: uuid('placement_id').notNull(), offeringId: uuid('offering_id').notNull(), classGroupId: uuid('class_group_id').notNull(), academicYearId: uuid('academic_year_id').notNull(), gradeId: uuid('grade_id').notNull(), startsOn: date('starts_on').notNull(), endsOn: date('ends_on'), status: status(['active', 'withdrawn', 'completed'], 'active'),
}, t => [
    tenantKey(t), foreignKey({
        name: 'subject_enrolment_placement_context_fk', columns: [
            t.schoolId, t.placementId, t.enrolmentId, t.classGroupId, t.academicYearId, t.gradeId
        ], foreignColumns: [
            classPlacements.schoolId, classPlacements.id, classPlacements.enrolmentId, classPlacements.classGroupId, classPlacements.academicYearId, classPlacements.gradeId
        ]
    }).onDelete('restrict'), foreignKey({
        name: 'subject_enrolment_offering_context_fk', columns: [
            t.schoolId, t.offeringId, t.classGroupId, t.academicYearId, t.gradeId
        ], foreignColumns: [
            subjectOfferings.schoolId, subjectOfferings.id, subjectOfferings.classGroupId, subjectOfferings.academicYearId, subjectOfferings.gradeId
        ]
    }).onDelete('restrict'), unique('subject_enrolment_start_unique').on(t.schoolId, t.enrolmentId, t.offeringId, t.startsOn), uniqueIndex('subject_enrolment_open_unique').on(t.schoolId, t.enrolmentId, t.offeringId).where(sql `${t.endsOn} is null`), index('subject_enrolment_offering_status_idx').on(t.schoolId, t.offeringId, t.status), interval('subject_enrolment_dates', t.startsOn, t.endsOn)
]);
export const teacherAssignments = pgTable('teacher_assignments', {
    ...tenant(), staffId: uuid('staff_id').notNull(), offeringId: uuid('offering_id').notNull(), startsOn: date('starts_on').notNull(), endsOn: date('ends_on'), status: status(['active', 'ended', 'revoked'], 'active'),
}, t => [
    tenantKey(t), tenantFk(t, t.staffId, staffProfiles), tenantFk(t, t.offeringId, subjectOfferings), unique().on(t.schoolId, t.staffId, t.offeringId, t.startsOn), index('teacher_staff_status_idx').on(t.schoolId, t.staffId, t.status), index('teacher_offering_status_idx').on(t.schoolId, t.offeringId, t.status), interval('teacher_dates', t.startsOn, t.endsOn)
]);
export const auditEvents = pgTable('audit_events', {
    id: id(), schoolId: uuid('school_id').references(() => schools.id, {
        onDelete: 'restrict'
    }), actorId: reference('actor_id', () => auditActors.id), membershipId: uuid('membership_id'), eventType: label('event_type'), resourceType: label('resource_type'), resourceId: uuid('resource_id'), commandId: uuid('command_id').notNull(), sequence: integer('sequence').notNull(), occurredAt: instant('occurred_at').notNull().defaultNow(), reason: varchar('reason', {
        length: 500
    }), safeChanges: jsonb('safe_changes').$type<Record<string, unknown>>().notNull().default({}), origin: varchar('origin', {
        length: 16, enum: ['native', 'legacy_import']
    }).notNull().default('native'),
}, t => [
    tenantFk(t, t.membershipId, schoolMemberships), unique().on(t.commandId, t.sequence), index('audit_school_time_idx').on(t.schoolId, t.occurredAt), index('audit_actor_time_idx').on(t.actorId, t.occurredAt), index('audit_resource_idx').on(t.schoolId, t.resourceType, t.resourceId), check('audit_sequence', sql `${t.sequence} > 0`), check('audit_origin', sql `${t.origin} in ('native', 'legacy_import')`), check('audit_school_shape', sql `(${t.membershipId} is null or ${t.schoolId} is not null) and (${t.schoolId} is not null or ${t.eventType} like 'auth.%' or ${t.eventType} like 'platform.%')`)
]);

// Stable private object records, independent of academic years.
export const mediaFolders = pgTable('media_folders', {
    id: id(), schoolId: reference('school_id', () => schools.id), name: label('name'),
    description: varchar('description', { length: 1000 }),
    createdByActorId: reference('created_by_actor_id', () => auditActors.id),
    createdAt: instant('created_at').notNull().defaultNow(), archivedAt: instant('archived_at'),
}, t => [tenantKey(t), index('media_folder_actor_idx').on(t.createdByActorId),
    uniqueIndex('media_folder_name_unique').on(t.schoolId, t.name).where(sql `${t.archivedAt} is null`)]);
export const mediaAssets = pgTable('media_assets', {
    id: id(), schoolId: reference('school_id', () => schools.id), learnerId: uuid('learner_id'), folderId: uuid('folder_id'),
    objectKey: varchar('object_key', { length: 512 }).notNull().unique(),
    originalName: label('original_name'), title: label('title'), description: varchar('description', { length: 1000 }),
    category: varchar('category', { length: 24 }).notNull(), mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(), uploadedByActorId: reference('uploaded_by_actor_id', () => auditActors.id),
    uploadedAt: instant('uploaded_at').notNull().defaultNow(),
    state: varchar('state', { length: 16 }).notNull().default('pending'), archivedAt: instant('archived_at'),
}, t => [tenantKey(t), tenantFk(t, t.learnerId, learners), tenantFk(t, t.folderId, mediaFolders),
    index('media_asset_learner_idx').on(t.schoolId, t.learnerId), index('media_asset_folder_idx').on(t.schoolId, t.folderId),
    index('media_asset_actor_idx').on(t.uploadedByActorId),
    check('media_asset_target', sql `(${t.learnerId} is null) <> (${t.folderId} is null)`),
    check('media_asset_size', sql `${t.size} > 0 and ${t.size} <= 10485760`),
    check('media_asset_state', sql `${t.state} in ('pending','ready','failed')`),
    check('media_asset_category', sql `${t.category} in ('general','work','certificate','photo','video')`),
]);
