/**
 * The flow engine: pure functions that walk a FormSpec. Shared by the public
 * runner (real randomness, persisted assignments) and the admin live preview
 * (so what you build is exactly what respondents see).
 */
import {
	END,
	type AllowedCount,
	type AllowedCountMode,
	type AnswerValue,
	type Condition,
	type End,
	type FlowRule,
	type FormSpec,
	type Node,
	type QuestionNode,
	type SplitNode,
	type Validation
} from './types';

export function isEnd(id: string | End): id is End {
	return id === END;
}

function isAnswered(value: AnswerValue | undefined): boolean {
	if (value === undefined || value === null) return false;
	if (typeof value === 'string') return value.trim() !== '';
	if (Array.isArray(value)) return value.length > 0;
	return true; // number
}

/** Resolve the effective selection-limit mode for a multi question. */
export function multiLimitMode(node: {
	allowedCount?: AllowedCount;
	allowedCountMode?: AllowedCountMode;
}): AllowedCountMode | null {
	if (node.allowedCount !== 2 && node.allowedCount !== 3) return null;
	return node.allowedCountMode === 'exact' ? 'exact' : 'upTo';
}

/**
 * Validate a multi-choice answer against `allowedCount` / `allowedCountMode`.
 * Empty answers are allowed here when the question is not required (required is
 * checked separately by the UI). Returns a Portuguese message for the runner.
 * The sentinel `"none"` is valid when `noneOfTheAbove` is enabled.
 */
export function checkMultiSelection(
	node: Pick<
		QuestionNode,
		'type' | 'required' | 'allowedCount' | 'allowedCountMode' | 'options' | 'noneOfTheAbove'
	>,
	value: AnswerValue | undefined
): string | null {
	if (node.type !== 'multi') return null;
	if (value === 'none') {
		return node.noneOfTheAbove === true ? null : 'Seleção inválida.';
	}
	const mode = multiLimitMode(node);
	if (!mode || !node.allowedCount) return null;

	const selected = Array.isArray(value) ? value : [];
	const count = node.allowedCount;
	const optionIds = new Set((node.options ?? []).map((o) => o.id));
	if (selected.some((id) => !optionIds.has(id))) {
		return 'Seleção inválida.';
	}
	if (selected.length > count) {
		return `Selecione no máximo ${count} opções.`;
	}
	if (selected.length === 0) {
		// Leave emptiness to the required check; limits only constrain non-empty answers
		// except exact mode when required (handled below via canContinue / submit).
		return null;
	}
	if (mode === 'exact' && selected.length !== count) {
		return `Selecione exatamente ${count} opções.`;
	}
	return null;
}

/**
 * Whether a multi answer satisfies required + selection-limit rules enough to continue.
 * Pass the raw answer value when `"none"` may be selected.
 */
export function multiSelectionComplete(
	node: Pick<
		QuestionNode,
		'type' | 'required' | 'allowedCount' | 'allowedCountMode' | 'noneOfTheAbove'
	>,
	value: AnswerValue | undefined
): boolean {
	if (node.type !== 'multi') return true;
	if (value === 'none') return node.noneOfTheAbove === true;

	const selected = Array.isArray(value) ? value : [];
	const mode = multiLimitMode(node);
	const required = node.required === true;
	const n = selected.length;

	if (!mode || !node.allowedCount) {
		return !required || n > 0;
	}
	const count = node.allowedCount;
	if (n > count) return false;
	if (mode === 'exact') {
		if (n === 0) return !required;
		return n === count;
	}
	// upTo
	if (required) return n >= 1 && n <= count;
	return n <= count;
}

function defaultValidationMessage(rule: Validation): string {
	switch (rule.type) {
		case 'regex':
			return 'Must match the required format.';
		case 'biggerThan':
			return `Must be greater than ${rule.value}.`;
		case 'lowerThan':
			return `Must be less than ${rule.value}.`;
	}
}

function checkRule(rule: Validation, value: AnswerValue): string | null {
	switch (rule.type) {
		case 'regex': {
			const text = Array.isArray(value) ? value.join(',') : String(value);
			try {
				const re = new RegExp(rule.pattern, rule.flags);
				if (!re.test(text)) return rule.message?.trim() || defaultValidationMessage(rule);
			} catch {
				return rule.message?.trim() || 'Invalid validation pattern.';
			}
			return null;
		}
		case 'biggerThan': {
			if (typeof value !== 'number' || !(value > rule.value)) {
				return rule.message?.trim() || defaultValidationMessage(rule);
			}
			return null;
		}
		case 'lowerThan': {
			if (typeof value !== 'number' || !(value < rule.value)) {
				return rule.message?.trim() || defaultValidationMessage(rule);
			}
			return null;
		}
		default:
			// Unknown types are ignored so older clients stay forward-compatible.
			return null;
	}
}

/**
 * Run chained answer validations. Returns the first failing message, or null
 * when the answer is empty / has no rules / every rule passes.
 */
export function runValidations(
	rules: Validation[] | undefined,
	value: AnswerValue | undefined
): string | null {
	if (!rules || rules.length === 0 || !isAnswered(value)) return null;
	for (const rule of rules) {
		const msg = checkRule(rule, value as AnswerValue);
		if (msg) return msg;
	}
	return null;
}

function valuesEqual(value: AnswerValue | undefined, target: string | number): boolean {
	if (Array.isArray(value)) return value.includes(String(target));
	if (typeof value === 'number') return value === Number(target);
	return value === String(target);
}

export function evaluateCondition(
	cond: Condition | undefined,
	value: AnswerValue | undefined
): boolean {
	if (!cond) return true; // unconditional default rule
	switch (cond.op) {
		case 'answered':
			return isAnswered(value);
		case 'eq':
			return valuesEqual(value, cond.value);
		case 'neq':
			return !valuesEqual(value, cond.value);
		case 'contains':
			return Array.isArray(value) ? value.includes(cond.value) : value === cond.value;
		case 'gt':
			return typeof value === 'number' && value > cond.value;
		case 'gte':
			return typeof value === 'number' && value >= cond.value;
		case 'lt':
			return typeof value === 'number' && value < cond.value;
		case 'lte':
			return typeof value === 'number' && value <= cond.value;
		default:
			return false;
	}
}

/** First flow rule whose condition matches; falls back to END if none match. */
export function resolveFlow(rules: FlowRule[], value: AnswerValue | undefined): string | End {
	for (const rule of rules) {
		if (evaluateCondition(rule.if, value)) return rule.goTo;
	}
	return END;
}

/** Weighted random pick of a split variant id. */
export function pickVariant(
	variants: SplitNode['variants'],
	rng: () => number = Math.random
): string {
	const total = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
	if (total <= 0) return variants[0]?.id ?? '';
	let r = rng() * total;
	for (const v of variants) {
		r -= Math.max(0, v.weight);
		if (r <= 0) return v.id;
	}
	return variants[variants.length - 1].id;
}

export type ResolveResult = {
	/** The next node to display, or END. */
	nodeId: string | End;
	/** Assignments after transparently walking any split nodes (may add keys). */
	assignments: Record<string, string>;
};

/**
 * Follow a target id to the next *visible* node (question or break), walking
 * through any split nodes and recording their branch choices. Guards against
 * broken references and cycles.
 */
export function resolveTarget(
	spec: FormSpec,
	targetId: string | End,
	assignments: Record<string, string>,
	rng: () => number = Math.random
): ResolveResult {
	const next = { ...assignments };
	const seen = new Set<string>();
	let current: string | End = targetId;

	while (!isEnd(current)) {
		const node: Node | undefined = spec.nodes[current];
		if (!node) return { nodeId: END, assignments: next }; // dangling reference
		if (node.kind !== 'split') return { nodeId: current, assignments: next };

		if (seen.has(current)) return { nodeId: END, assignments: next }; // cycle guard
		seen.add(current);

		let variantId = next[current];
		let variant = node.variants.find((v) => v.id === variantId);
		if (!variant) {
			variantId = pickVariant(node.variants, rng);
			variant = node.variants.find((v) => v.id === variantId);
			next[current] = variantId;
		}
		current = variant ? variant.next : END;
	}

	return { nodeId: END, assignments: next };
}

/** The first node a respondent sees. */
export function startNode(
	spec: FormSpec,
	assignments: Record<string, string> = {},
	rng: () => number = Math.random
): ResolveResult {
	return resolveTarget(spec, spec.start, assignments, rng);
}

/** Given the current node and its answer, compute the next node to display. */
export function advance(
	spec: FormSpec,
	currentId: string,
	value: AnswerValue | undefined,
	assignments: Record<string, string>,
	rng: () => number = Math.random
): ResolveResult {
	const node = spec.nodes[currentId];
	if (!node || node.kind === 'split') {
		return { nodeId: END, assignments: { ...assignments } };
	}
	const target = resolveFlow(node.next, value);
	return resolveTarget(spec, target, assignments, rng);
}

/**
 * Structural validation used by the builder before saving. Returns a list of
 * human-readable problems; empty means the spec is publishable.
 */
export function validateSpec(spec: FormSpec): string[] {
	const errors: string[] = [];
	const ids = Object.keys(spec.nodes);

	if (ids.length === 0) errors.push('The form has no questions.');
	if (!spec.start) errors.push('No start question is set.');
	else if (!spec.nodes[spec.start]) errors.push('The start question does not exist.');

	const exists = (id: string | End) => id === END || Boolean(spec.nodes[id]);

	for (const [id, node] of Object.entries(spec.nodes)) {
		const label = nodeLabel(node, id);
		if (node.kind === 'split') {
			if (node.variants.length < 2) {
				errors.push(`Split "${label}" needs at least two variants.`);
			}
			for (const v of node.variants) {
				if (!exists(v.next)) errors.push(`Split "${label}" points to a missing question.`);
			}
		} else {
			if (!node.title?.trim()) errors.push(`A ${node.kind} is missing a title.`);
			if (node.next.length === 0) {
				errors.push(`"${label}" has no flow rule (add at least a default "go to").`);
			}
			for (const rule of node.next) {
				if (!exists(rule.goTo)) errors.push(`"${label}" points to a missing question.`);
			}
			if (node.kind === 'question' && (node.type === 'single' || node.type === 'multi')) {
				if (!node.options || node.options.length === 0) {
					errors.push(`"${label}" is a choice question but has no options.`);
				}
			}
			if (node.kind === 'question' && node.type === 'multi' && node.allowedCount != null) {
				if (node.allowedCount !== 2 && node.allowedCount !== 3) {
					errors.push(`"${label}" selection limit must be 2 or 3.`);
				} else if ((node.options?.length ?? 0) < node.allowedCount) {
					errors.push(
						`"${label}" needs at least ${node.allowedCount} options for its selection limit.`
					);
				}
			}
			if (node.kind === 'question' && node.validations) {
				for (const [i, rule] of node.validations.entries()) {
					const n = i + 1;
					switch (rule.type) {
						case 'regex':
							if (!rule.pattern?.trim()) {
								errors.push(`"${label}" validation #${n} has an empty regex pattern.`);
							} else {
								try {
									new RegExp(rule.pattern, rule.flags);
								} catch {
									errors.push(`"${label}" validation #${n} has an invalid regex pattern.`);
								}
							}
							break;
						case 'biggerThan':
						case 'lowerThan':
							if (typeof rule.value !== 'number' || Number.isNaN(rule.value)) {
								errors.push(`"${label}" validation #${n} needs a numeric threshold.`);
							}
							break;
					}
				}
			}
		}
	}

	return errors;
}

export function nodeLabel(node: Node, id: string): string {
	if (node.kind === 'split') {
		return node.title?.trim() || `A/B split ${id}`;
	}
	return node.title?.trim() || `(untitled ${id})`;
}
