/**
 * The form specification. A form is a graph of nodes; the runner walks it one
 * node at a time, using each node's flow rules to decide where to go next.
 *
 * This shape is the single source of truth shared by the admin builder, the
 * public runner, and the server. It is stored verbatim in `forms.spec`.
 */

export type QuestionType = 'text' | 'number' | 'single' | 'multi' | 'slider';

/** How many options a `multi` question may accept when a limit is set. */
export type AllowedCount = 2 | 3;

/**
 * For `multi` with `allowedCount`: `exact` requires that many selections;
 * `upTo` allows fewer (including zero unless the question is required).
 */
export type AllowedCountMode = 'exact' | 'upTo';

/** Terminal marker: reaching it marks the submission FINISHED. */
export const END = 'END' as const;
export type End = typeof END;

export type Option = { id: string; label: string };

/** A value stored for an answered question, depending on the question type. */
export type AnswerValue = string | number | string[];

/**
 * A validation rule checked against a question's answer when one is provided.
 * Rules are chained: every rule in the list must pass. The set is intentionally
 * open-ended — to add a new kind, extend this union, then handle it in
 * `runValidations` (engine), `newValidation`/`VALIDATION_TYPES` (builder), and
 * the builder UI. Unknown types are ignored at runtime so older specs stay safe.
 */
export type Validation =
	| { type: 'regex'; pattern: string; flags?: string; message?: string }
	| { type: 'biggerThan'; value: number; message?: string }
	| { type: 'lowerThan'; value: number; message?: string };

export type ValidationType = Validation['type'];

/**
 * A condition evaluated against the answer of the node it belongs to.
 * `answered` just checks that any answer exists.
 */
export type Condition =
	| { op: 'eq' | 'neq'; value: string | number }
	| { op: 'contains'; value: string }
	| { op: 'gt' | 'gte' | 'lt' | 'lte'; value: number }
	| { op: 'answered' };

/**
 * An ordered flow rule. Rules are evaluated top to bottom; the first whose
 * condition matches wins. A rule without a condition is an unconditional
 * default and should be last.
 */
export type FlowRule = { if?: Condition; goTo: string | End };

interface BaseNode {
	title: string;
	description?: string;
	imageKey?: string;
	/**
	 * Position in the builder's list. The spec is stored in a MySQL JSON column,
	 * which does not preserve object key order, so the editor order is kept here
	 * explicitly and used to re-sort nodes on load.
	 */
	order?: number;
}

export interface QuestionNode extends BaseNode {
	kind: 'question';
	type: QuestionType;
	required?: boolean;
	/** For `single` / `multi`. */
	options?: Option[];
	/**
	 * For `multi`: when set, respondents may select this many options
	 * (`allowedCountMode` controls exact vs up-to). Omit for unlimited.
	 */
	allowedCount?: AllowedCount;
	/** For `multi` with `allowedCount`. Defaults to `upTo` when omitted. */
	allowedCountMode?: AllowedCountMode;
	/**
	 * For `multi`: when true, the runner shows a synthetic "Nenhuma das anteriores"
	 * option; selecting it stores the answer as `"none"`.
	 */
	noneOfTheAbove?: boolean;
	/** For `slider`. */
	range?: { min: number; max: number; step?: number };
	/** Single-choice tap-to-advance. */
	autoAdvance?: boolean;
	/** Chained answer validations; all must pass before advancing. */
	validations?: Validation[];
	next: FlowRule[];
}

/** A section break: informational screen with only continue / back. */
export interface BreakNode extends BaseNode {
	kind: 'break';
	next: FlowRule[];
}

/**
 * An A/B split. When first reached, a branch is chosen by weight and stored on
 * the submission so the path stays sticky. Has no UI of its own.
 */
export interface SplitNode {
	kind: 'split';
	/** Admin-facing label (not shown to respondents). Defaults to "A/B split". */
	title?: string;
	/** See `BaseNode.order`. */
	order?: number;
	variants: { id: string; weight: number; next: string | End }[];
}

export type Node = QuestionNode | BreakNode | SplitNode;

export type FormSpec = {
	version: 1;
	/** Id of the first node. */
	start: string;
	nodes: Record<string, Node>;
};

export function emptySpec(): FormSpec {
	return { version: 1, start: '', nodes: {} };
}

/**
 * A node as sent to the public runner: it carries its id and everything needed
 * to render, but never the flow rules (those stay server-side). Split nodes are
 * resolved away and never sent.
 */
export type PublicNode =
	| {
			id: string;
			kind: 'question';
			type: QuestionType;
			title: string;
			description?: string;
			imageKey?: string;
			required?: boolean;
			options?: Option[];
			allowedCount?: AllowedCount;
			allowedCountMode?: AllowedCountMode;
			noneOfTheAbove?: boolean;
			range?: { min: number; max: number; step?: number };
			autoAdvance?: boolean;
			validations?: Validation[];
	  }
	| { id: string; kind: 'break'; title: string; description?: string; imageKey?: string };

export function toPublicNode(node: Node, id: string): PublicNode | null {
	if (node.kind === 'split') return null;
	if (node.kind === 'break') {
		return {
			id,
			kind: 'break',
			title: node.title,
			description: node.description,
			imageKey: node.imageKey
		};
	}
	return {
		id,
		kind: 'question',
		type: node.type,
		title: node.title,
		description: node.description,
		imageKey: node.imageKey,
		required: node.required,
		options: node.options,
		allowedCount: node.allowedCount,
		allowedCountMode: node.allowedCountMode,
		noneOfTheAbove: node.noneOfTheAbove,
		range: node.range,
		autoAdvance: node.autoAdvance,
		validations: node.validations
	};
}
