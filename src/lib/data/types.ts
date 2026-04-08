export interface LocalizedString {
	en: string;
	ja?: string;
}

export interface Tutorial {
	slug: string;
	title: LocalizedString;
	tags: string[];
	updatedDate: string;
	durationMinutes?: number;
	hasVideo: boolean;
	videoUrl?: string;
	githubUrl?: string;
	links?: { label: LocalizedString; url: string }[];
	/** Content sections rendered in order */
	content: ContentBlock[];
}

export type ContentBlock =
	| { type: 'text'; body: LocalizedString }
	| { type: 'code'; language: string; code: string }
	| { type: 'prompt'; body: string }
	| { type: 'heading'; level: 2 | 3; text: LocalizedString };
