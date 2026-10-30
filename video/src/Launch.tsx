import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { AudioReactive } from './audio';
import { Grain, ProgressLine } from './extras';
import { AiTimeline, Cta, Hook, Network, Problem, Tell } from './scenes';
import { SoundTrack } from './sound';
import { HAS_VOICEOVER, T, TOTAL, scenes, type SceneId } from './timing';
import { C } from './theme';

const SCENES: Record<SceneId, () => JSX.Element> = { hook: Hook, problem: Problem, tell: Tell, ai: AiTimeline, network: Network, cta: Cta };
// How each scene hands over to the next one (i = the scene that is ending).
const spring200 = () => springTiming({ config: { damping: 200 }, durationInFrames: T });
const handOver = (i: number) => {
  switch (i) {
    case 0: return <TransitionSeries.Transition key="t0" presentation={wipe({ direction: 'from-left' })} timing={spring200()} />;
    case 1: return <TransitionSeries.Transition key="t1" presentation={slide({ direction: 'from-bottom' })} timing={spring200()} />;
    case 2: return <TransitionSeries.Transition key="t2" presentation={fade()} timing={linearTiming({ durationInFrames: T })} />;
    case 3: return <TransitionSeries.Transition key="t3" presentation={slide({ direction: 'from-right' })} timing={spring200()} />;
    default: return <TransitionSeries.Transition key={`t${i}`} presentation={flip({ direction: 'from-bottom' })} timing={spring200()} />;
  }
};

export const Launch = () => (
  <AudioReactive>
    <AbsoluteFill style={{ background: C.ink }}>
      <TransitionSeries>
        {scenes.flatMap((s, i) => {
          const Scene = SCENES[s.id];
          // Each scene runs T frames into the next, so scene i still starts exactly at its narrated moment.
          const seq = <TransitionSeries.Sequence key={s.id} durationInFrames={s.len + (i < scenes.length - 1 ? T : 0)}><Scene /></TransitionSeries.Sequence>;
          return i < scenes.length - 1 ? [seq, handOver(i)] : [seq];
        })}
      </TransitionSeries>
      <Grain />
      <ProgressLine total={TOTAL} />
      {HAS_VOICEOVER && <Audio src={staticFile('voiceover.mp3')} volume={1} />}
      <SoundTrack />
    </AbsoluteFill>
  </AudioReactive>
);
