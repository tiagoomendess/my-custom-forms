import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ breaks: true, gfm: true });

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'p',
		'br',
		'strong',
		'em',
		'a',
		'ul',
		'ol',
		'li',
		'code',
		'pre',
		'blockquote',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'hr'
	],
	allowedAttributes: {
		a: ['href', 'title', 'target', 'rel']
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	transformTags: {
		a: (_tagName, attribs) => ({
			tagName: 'a',
			attribs: {
				...attribs,
				target: '_blank',
				rel: 'noopener noreferrer'
			}
		})
	}
};

/** Parse markdown and return sanitized HTML safe for {@html}. */
export function renderMarkdown(source: string): string {
	const trimmed = source.trim();
	if (!trimmed) return '';

	const raw = marked.parse(trimmed, { async: false }) as string;
	return sanitizeHtml(raw, SANITIZE_OPTIONS);
}
