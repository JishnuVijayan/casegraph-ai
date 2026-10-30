import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from './theme';

/** One scene: a slow camera push-in that never stops, so nothing ever sits still. Transitions between scenes are handled by TransitionSeries. */
export const SceneShell = ({ children, bg }: { children: ReactNode; bg: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const push = interpolate(frame, [0, durationInFrames], [1, 1.045], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: bg, fontFamily: FONT, transform: `scale(${push})` }}>{children}</AbsoluteFill>;
};

/** Kinetic type: each word springs up on its own beat. `hot` words get the accent colour. */
export const Words = ({ text, size = 120, color = C.white, hot = [], delay = 0, stagger = 4, weight = 800, align = 'left', style }: {
  text: string; size?: number; color?: string; hot?: string[]; delay?: number; stagger?: number; weight?: number; align?: CSSProperties['textAlign']; style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.26}px`, justifyContent: align === 'center' ? 'center' : 'flex-start', fontSize: size, fontWeight: weight, lineHeight: 1.04, letterSpacing: '-0.03em', color, ...style }}>
      {text.split(' ').map((w, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 14, stiffness: 170, mass: 0.6 } });
        const isHot = hot.includes(w.replace(/[^\w']/g, ''));
        return (
          <span key={`${w}-${i}`} style={{ display: 'inline-block', opacity: p, transform: `translateY(${interpolate(p, [0, 1], [60, 0])}px) rotate(${interpolate(p, [0, 1], [3, 0])}deg)`, color: isHot ? C.mint : color }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Pill = ({ children, color = C.primary, delay = 0 }: { children: ReactNode; color?: string; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <span style={{ display: 'inline-block', padding: '14px 30px', borderRadius: 999, background: color, color: C.white, fontSize: 38, fontWeight: 700, opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})` }}>
      {children}
    </span>
  );
};

/** A phone frame. Shows your real screenshot when `src` is set, otherwise a clearly labelled placeholder. */
export const Phone = ({ src, label, delay = 0, tilt = 0 }: { src: string | null; label: string; delay?: number; tilt?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120, mass: 0.9 } });
  const float = Math.sin((frame + delay) / 22) * 8;
  return (
    <div style={{ width: 470, height: 940, borderRadius: 64, background: '#05101f', padding: 16, boxShadow: '0 60px 120px rgba(0,0,0,0.45)', transform: `translateY(${interpolate(p, [0, 1], [500, 0]) + float}px) rotate(${tilt}deg) scale(${interpolate(p, [0, 1], [0.85, 1])})`, opacity: p }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 50, overflow: 'hidden', background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {src ? <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
          <div style={{ textAlign: 'center', color: C.navy2, padding: 40, fontSize: 34, fontWeight: 700, lineHeight: 1.3 }}>
            <div style={{ fontSize: 24, letterSpacing: '0.14em', color: C.primary, marginBottom: 14 }}>PLACEHOLDER</div>
            {label}
            <div style={{ fontSize: 22, fontWeight: 500, color: '#64748b', marginTop: 16 }}>Add a screenshot in src/theme.ts</div>
          </div>
        )}
      </div>
    </div>
  );
};
