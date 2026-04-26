import { z } from 'zod';

export const NORMALIZED_SESSION_FORMAT_VERSION = '2.0.0';

export const SessionProvider = z.enum(['claude', 'codex', 'unknown']);
export type SessionProvider = z.infer<typeof SessionProvider>;

export const TextResultPart = z.object({
	type: z.literal('text'),
	text: z.string()
});

export const ImageResultPart = z.object({
	type: z.literal('image'),
	source: z.object({
		type: z.literal('base64'),
		media_type: z.string(),
		data: z.string()
	})
});

export const ReferenceResultPart = z.object({
	type: z.literal('tool_reference'),
	tool_name: z.string()
});

export const ToolResultContent = z.union([
	z.string(),
	z.array(z.discriminatedUnion('type', [TextResultPart, ImageResultPart, ReferenceResultPart]))
]);

const BaseEvent = {
	uuid: z.string(),
	timestamp: z.string().optional()
};

export const HeaderEvent = z.object({
	type: z.literal('header'),
	formatVersion: z.string(),
	provider: SessionProvider.optional(),
	importDate: z.string().optional(),
	sourceSessionId: z.string().optional(),
	rawPath: z.string().optional()
});

export const UserMessageEvent = z.object({
	type: z.literal('user-message'),
	...BaseEvent,
	text: z.string(),
	isMeta: z.boolean().optional(),
	startsRound: z.boolean().optional()
});

export const AssistantMessageEvent = z.object({
	type: z.literal('assistant-message'),
	...BaseEvent,
	text: z.string(),
	model: z.string().optional()
});

export const ThinkingEvent = z.object({
	type: z.literal('thinking'),
	...BaseEvent,
	text: z.string()
});

export const ToolCallEvent = z.object({
	type: z.literal('tool-call'),
	...BaseEvent,
	toolCallId: z.string(),
	name: z.string(),
	input: z.record(z.string(), z.unknown())
});

export const ToolResultEvent = z.object({
	type: z.literal('tool-result'),
	...BaseEvent,
	toolCallId: z.string(),
	content: ToolResultContent,
	isError: z.boolean().optional()
});

export const CompactBoundaryEvent = z.object({
	type: z.literal('compact-boundary'),
	...BaseEvent,
	trigger: z.string().optional(),
	preTokens: z.number().optional()
});

export const CustomTitleEvent = z.object({
	type: z.literal('custom-title'),
	customTitle: z.string()
});

export const NormalizedSessionEvent = z.discriminatedUnion('type', [
	HeaderEvent,
	UserMessageEvent,
	AssistantMessageEvent,
	ThinkingEvent,
	ToolCallEvent,
	ToolResultEvent,
	CompactBoundaryEvent,
	CustomTitleEvent
]);

export type NormalizedSessionEvent = z.infer<typeof NormalizedSessionEvent>;
export type HeaderEvent = z.infer<typeof HeaderEvent>;
export type UserMessageEvent = z.infer<typeof UserMessageEvent>;
export type AssistantMessageEvent = z.infer<typeof AssistantMessageEvent>;
export type ThinkingEvent = z.infer<typeof ThinkingEvent>;
export type ToolCallEvent = z.infer<typeof ToolCallEvent>;
export type ToolResultEvent = z.infer<typeof ToolResultEvent>;
export type CompactBoundaryEvent = z.infer<typeof CompactBoundaryEvent>;
export type CustomTitleEvent = z.infer<typeof CustomTitleEvent>;
export type ToolResultContent = z.infer<typeof ToolResultContent>;
