import {
	mysqlTable,
	varchar,
	json,
	mysqlEnum,
	timestamp,
	boolean,
	index,
	unique
} from 'drizzle-orm/mysql-core';
import type { FormSpec, AnswerValue } from '../../forms/types';

/** A form definition. The whole question graph lives in the `spec` JSON column. */
export const forms = mysqlTable('forms', {
	id: varchar('id', { length: 36 }).primaryKey(),
	name: varchar('name', { length: 255 }).notNull(),
	spec: json('spec').$type<FormSpec>().notNull(),
	status: mysqlEnum('status', ['draft', 'published', 'archived']).notNull().default('draft'),
	/** Local storage key for social/OG cover image. */
	coverImageKey: varchar('cover_image_key', { length: 512 }),
	/** After this instant, the public form rejects new submissions. Null = no deadline. */
	allowSubmitUntil: timestamp('allow_submit_until'),
	/** When false, best-effort block of repeat replies (cookie + IP). */
	allowMultipleSubmits: boolean('allow_multiple_submits').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

/** One row per (started) attempt at filling a form. */
export const submissions = mysqlTable(
	'submissions',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		formId: varchar('form_id', { length: 36 }).notNull(),
		status: mysqlEnum('status', ['PARTIAL', 'FINISHED']).notNull().default('PARTIAL'),
		source: varchar('source', { length: 255 }),
		ip: varchar('ip', { length: 45 }),
		userAgent: varchar('user_agent', { length: 512 }),
		/** Records which branch each `split` node picked, so paths are sticky and analyzable. */
		abAssignments: json('ab_assignments').$type<Record<string, string>>().notNull().default({}),
		startedAt: timestamp('started_at').notNull().defaultNow(),
		finishedAt: timestamp('finished_at')
	},
	(t) => [
		index('submissions_form_id_idx').on(t.formId),
		index('submissions_form_status_ip_idx').on(t.formId, t.status, t.ip)
	]
);

/** One row per answered question, upserted so partial progress is never lost. */
export const answers = mysqlTable(
	'answers',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		submissionId: varchar('submission_id', { length: 36 }).notNull(),
		questionId: varchar('question_id', { length: 128 }).notNull(),
		value: json('value').$type<AnswerValue>().notNull(),
		answeredAt: timestamp('answered_at').notNull().defaultNow().onUpdateNow()
	},
	(t) => [
		index('answers_submission_id_idx').on(t.submissionId),
		// One answer row per question per submission, enabling upserts.
		unique('answers_submission_question_uq').on(t.submissionId, t.questionId)
	]
);

export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type Answer = typeof answers.$inferSelect;
export type NewAnswer = typeof answers.$inferInsert;
