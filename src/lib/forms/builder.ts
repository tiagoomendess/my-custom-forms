/**
 * Client-side helpers for the admin builder: id generation, node factories, and
 * converting between the stored FlowRule[] and an editor-friendly shape
 * (an ordered list of conditional branches plus a single default target).
 */
import {
	END,
	type BreakNode,
	type Condition,
	type FlowRule,
	type FormSpec,
	type Node,
	type Option,
	type QuestionNode,
	type QuestionType,
	type SplitNode,
	type Validation,
	type ValidationType
} from './types';

export function genId(prefix = 'n'): string {
	return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function newQuestion(type: QuestionType): QuestionNode {
	const base: QuestionNode = {
		kind: 'question',
		type,
		title: '',
		required: false,
		next: [{ goTo: END }]
	};
	if (type === 'single' || type === 'multi') {
		base.options = [newOption('Option 1'), newOption('Option 2')];
	}
	if (type === 'single') base.autoAdvance = true;
	if (type === 'slider') base.range = { min: 1, max: 100, step: 1 };
	return base;
}

export function newBreak(): BreakNode {
	return { kind: 'break', title: 'Section break', description: '', next: [{ goTo: END }] };
}

export function newSplit(): SplitNode {
	return {
		kind: 'split',
		title: 'A/B split',
		variants: [
			{ id: genId('v'), weight: 1, next: END },
			{ id: genId('v'), weight: 1, next: END }
		]
	};
}

export function newOption(label = ''): Option {
	return { id: genId('opt'), label };
}

/** Registry of validation kinds the builder can offer, filtered by question type. */
export const VALIDATION_TYPES: {
	value: ValidationType;
	label: string;
	forTypes: QuestionType[];
}[] = [
	{ value: 'regex', label: 'Matches regex', forTypes: ['text'] },
	{ value: 'biggerThan', label: 'Bigger than', forTypes: ['number', 'slider'] },
	{ value: 'lowerThan', label: 'Lower than', forTypes: ['number', 'slider'] }
];

export function validationsForType(type: QuestionType): ValidationType[] {
	return VALIDATION_TYPES.filter((t) => t.forTypes.includes(type)).map((t) => t.value);
}

export function newValidation(type: ValidationType): Validation {
	switch (type) {
		case 'regex':
			return { type: 'regex', pattern: '' };
		case 'biggerThan':
			return { type: 'biggerThan', value: 0 };
		case 'lowerThan':
			return { type: 'lowerThan', value: 0 };
	}
}

/** Drop rules that no longer apply after a question-type change. */
export function filterValidationsForType(
	rules: Validation[] | undefined,
	type: QuestionType
): Validation[] | undefined {
	if (!rules?.length) return undefined;
	const allowed = new Set(validationsForType(type));
	const kept = rules.filter((r) => allowed.has(r.type));
	return kept.length ? kept : undefined;
}

/** An editor-friendly view of a node's flow: branches first, one default last. */
export type EditableFlow = {
	branches: { condition: Condition; goTo: string | typeof END }[];
	defaultGoTo: string | typeof END;
};

export function flowToEditable(rules: FlowRule[]): EditableFlow {
	const branches: EditableFlow['branches'] = [];
	let defaultGoTo: string | typeof END = END;
	for (const rule of rules) {
		if (rule.if) branches.push({ condition: rule.if, goTo: rule.goTo });
		else defaultGoTo = rule.goTo; // last unconditional wins
	}
	return { branches, defaultGoTo };
}

export function editableToFlow(flow: EditableFlow): FlowRule[] {
	const rules: FlowRule[] = flow.branches.map((b) => ({ if: b.condition, goTo: b.goTo }));
	rules.push({ goTo: flow.defaultGoTo });
	return rules;
}

/** A node paired with its id, the shape the builder edits as an ordered list. */
export type Item = { id: string; node: Node };

export function specToItems(spec: FormSpec): Item[] {
	// The nodes map does not keep its key order through storage, so re-sort by the
	// explicit `order` field. Nodes without one (legacy specs) fall back to their
	// current position, preserving today's behaviour until the next save.
	return Object.entries(spec.nodes)
		.map(([id, node], index) => ({ id, node, index }))
		.sort((a, b) => {
			const ao = typeof a.node.order === 'number' ? a.node.order : a.index;
			const bo = typeof b.node.order === 'number' ? b.node.order : b.index;
			return ao - bo;
		})
		.map(({ id, node }) => ({ id, node }));
}

export function itemsToSpec(items: Item[], startId: string): FormSpec {
	return {
		version: 1,
		start: startId,
		// Stamp each node with its list position so the order survives storage.
		nodes: Object.fromEntries(items.map((item, index) => [item.id, { ...item.node, order: index }]))
	};
}

export const CONDITION_OPS: { value: Condition['op']; label: string }[] = [
	{ value: 'eq', label: 'is equal to' },
	{ value: 'neq', label: 'is not equal to' },
	{ value: 'contains', label: 'includes option' },
	{ value: 'gt', label: 'is greater than' },
	{ value: 'gte', label: 'is greater than or equal to' },
	{ value: 'lt', label: 'is less than' },
	{ value: 'lte', label: 'is less than or equal to' },
	{ value: 'answered', label: 'was answered' }
];
