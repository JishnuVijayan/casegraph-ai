import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { AiTimeline, Cta, Hook, Network, Problem, Tell } from './scenes';
import { SoundTrack } from './sound';
import { HAS_VOICEOVER, TOTAL, scenes, type SceneId } from './timing';
import { C } from './theme';

const SCENES: Record<SceneId, () => JSX.Element> = { hook: Hook, problem: Problem, tell: Tell, ai: AiTimeline, network: Network, cta: Cta };

export const Launch = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {/* Scenes overlap by a few frames so the spring-out of one meets the spring-in of the next. */}
      {scenes.map((s) => {
        const Scene = SCENES[s.id];
        return <Sequence key={s.id} from={s.from} durationInFrames={s.len + 6}><Scene /></Sequence>;
      })}
      {HAS_VOICEOVER && <Audio src={staticFile('voiceover.mp3')} volume={1} />}
      <SoundTrack />
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 8, width: `${interpolate(frame, [0, TOTAL], [0, 100])}%`, background: C.mint }} />
    </AbsoluteFill>
  );
};
