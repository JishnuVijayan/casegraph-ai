import { Composition } from 'remotion';
import { Launch } from './Launch';
import timing from './timing.json';

export const Root = () => (
  <Composition id="Launch" component={Launch} durationInFrames={timing.total} fps={timing.fps} width={1920} height={1080} />
);
