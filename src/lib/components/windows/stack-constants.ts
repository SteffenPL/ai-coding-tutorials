export const STACK_PARAMS = {
	txStep: 50,
	tyStep: -22,
	scaleDecay: 0.04,
	opacityDecay: 0.3,
	brightnessDecay: 0.12,
	minScale: 0.7,
	minOpacity: 0.1,
	minBrightness: 0.35,
	baseZ: 30,
	zStep: 5
} as const;

export function computeStackStyle(depth: number): {
	tx: number; ty: number; scale: number; opacity: number; brightness: number; z: number;
} {
	const { txStep, tyStep, scaleDecay, opacityDecay, brightnessDecay, minScale, minOpacity, minBrightness, baseZ, zStep } = STACK_PARAMS;
	return {
		tx: depth * txStep,
		ty: depth * tyStep,
		scale: Math.max(minScale, 1 - depth * scaleDecay),
		opacity: Math.max(minOpacity, 1 - depth * opacityDecay),
		brightness: Math.max(minBrightness, 1 - depth * brightnessDecay),
		z: Math.max(2, baseZ - depth * zStep)
	};
}
