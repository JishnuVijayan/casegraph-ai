import timing from './timing.json';

export type SceneId = 'hook' | 'problem' | 'tell' | 'ai' | 'network' | 'cta';
export const FPS = timing.fps;
/** Frames two neighbouring scenes overlap while one transitions into the next. */
export const T = 12;
export const TOTAL = timing.total;
export const HAS_VOICEOVER = timing.voiceover;
export const scenes = timing.scenes as { id: SceneId; from: number; len: number }[];
export const scene = (id: SceneId) => scenes.find((s) => s.id === id)!;
