import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { TOTAL, scene, type SceneId } from './timing';

type Fx = 'whoosh' | 'impact' | 'pop' | 'tick' | 'ding' | 'riser' | 'chime';
const SCENE_REF: Record<SceneId, number> = { hook: 100, problem: 120, tell: 180, ai: 160, network: 150, cta: 120 };

/** A moment inside a scene, given in the scene's design time, converted to the real frame (scenes are stretched to fit the narration). */
const at = (id: SceneId, designFrame: number) => {
  const s = scene(id);
  return Math.round(s.from + (designFrame * Math.max(1, s.len)) / SCENE_REF[id]);
};

const CUES: { fx: Fx; frame: number; volume: number }[] = [
  // Scene changes
  ...(['problem', 'tell', 'ai', 'network', 'cta'] as SceneId[]).map((id) => ({ fx: 'whoosh' as Fx, frame: scene(id).from - 5, volume: 0.5 })),
  { fx: 'whoosh', frame: 0, volume: 0.35 },
  // 1 Hook: three notifications arrive, then the money is gone
  { fx: 'pop', frame: at('hook', 8), volume: 0.5 }, { fx: 'pop', frame: at('hook', 20), volume: 0.5 }, { fx: 'pop', frame: at('hook', 32), volume: 0.5 },
  { fx: 'impact', frame: at('hook', 52), volume: 0.8 }, { fx: 'tick', frame: at('hook', 56), volume: 0.5 }, { fx: 'tick', frame: at('hook', 64), volume: 0.5 },
  // 2 Problem: forms land and get stamped
  ...[6, 12, 18, 24, 30, 36].map((d) => ({ fx: 'pop' as Fx, frame: at('problem', d), volume: 0.28 })),
  ...[36, 42, 48, 54, 60, 66].map((d) => ({ fx: 'tick' as Fx, frame: at('problem', d), volume: 0.6 })),
  // 3 Tell: three ways to report, then proof arrives
  ...[60, 70, 80].map((d) => ({ fx: 'pop' as Fx, frame: at('tell', d), volume: 0.5 })),
  ...[96, 112, 128].map((d) => ({ fx: 'pop' as Fx, frame: at('tell', d), volume: 0.45 })),
  // 4 AI: timeline items land, the question appears, an answer is tapped
  ...[34, 52, 70].map((d) => ({ fx: 'ding' as Fx, frame: at('ai', d), volume: 0.4 })),
  { fx: 'pop', frame: at('ai', 102), volume: 0.5 }, { fx: 'tick', frame: at('ai', 136), volume: 0.8 }, { fx: 'ding', frame: at('ai', 142), volume: 0.45 },
  // 5 Network: tension, links light up one by one, score lands
  { fx: 'riser', frame: scene('network').from - 55, volume: 0.45 },
  ...[28, 42, 56, 70].map((d) => ({ fx: 'pop' as Fx, frame: at('network', d + 20), volume: 0.5 })),
  { fx: 'ding', frame: at('network', 100), volume: 0.5 }, { fx: 'ding', frame: at('network', 138), volume: 0.4 },
  // 6 CTA
  { fx: 'chime', frame: at('cta', 6), volume: 0.6 }, { fx: 'pop', frame: at('cta', 52), volume: 0.5 },
];

/** Music bed (ducked under the voice, swelling at the start and the end) plus the sound effects. */
export const SoundTrack = () => (
  <>
    <Audio src={staticFile('sfx/music.wav')} volume={(f) => interpolate(f, [0, 40, 70, TOTAL - 120, TOTAL - 30, TOTAL], [0.34, 0.34, 0.15, 0.15, 0.3, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    {CUES.map((c, i) => {
      const from = Math.max(0, c.frame);
      return <Sequence key={`${c.fx}-${i}`} from={from} durationInFrames={Math.min(110, TOTAL - from)}><Audio src={staticFile(`sfx/${c.fx}.wav`)} volume={c.volume} /></Sequence>;
    })}
  </>
);
