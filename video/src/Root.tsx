import { Composition } from 'remotion';
import { Launch } from './Launch';
import { DemoCut } from './demo/DemoCut';
import { TOTAL as DEMO_TOTAL } from './demo/constants';
import timing from './timing.json';

export const Root = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={timing.total} fps={timing.fps} width={1920} height={1080} />
    <Composition id="DemoCut" component={DemoCut} durationInFrames={DEMO_TOTAL} fps={30} width={1920} height={1080} />
  </>
);
