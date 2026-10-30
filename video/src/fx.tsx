import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from './theme';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Each scene is designed for `ref` frames; the real scene is as long as its narration. Animation time is stretched to match. */
const ScaleContext = createContext(1);
export const Scaled = ({ frames: designFrames, children }: { frames: number; children: ReactNode }) => {
  const { durationInFrames } = useVideoConfig();
  return <ScaleContext.Provider value={designFrames / Math.max(1, durationInFrames - 6)}>{children}</ScaleContext.Provider>;
};
export const useFrame = () => useCurrentFrame() * useContext(ScaleContext);
/** A spring that starts at `delay` and settles at 1. */
export const useSpring = (delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const frame = useFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 150, mass: 0.7, ...config } });
};

/** Moving aurora, soft grid and drifting dust: the living background behind every scene. */
export const Backdrop = ({ a, b, c = C.mint, base = C.navy }: { a: string; b: string; c?: string; base?: string }) => {
  const f = useCurrentFrame();
  const blob = (x: number, y: number, size: number, color: string, speed: number, phase: number): CSSProperties => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%', background: color, opacity: 0.4, filter: 'blur(150px)',
    left: `${x + Math.sin(f / speed + phase) * 6}%`, top: `${y + Math.cos(f / (speed * 1.3) + phase) * 8}%`, transform: 'translate(-50%,-50%)',
  });
  return (
    <AbsoluteFill style={{ background: base, overflow: 'hidden' }}>
      <div style={blob(18, 20, 1000, a, 55, 0)} /><div style={blob(82, 78, 1100, b, 70, 2)} /><div style={blob(60, 12, 700, c, 90, 4)} />
      <AbsoluteFill style={{ opacity: 0.07, backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '90px 90px', transform: `translateY(${(f * 0.6) % 90}px)` }} />
      {Array.from({ length: 36 }, (_, i) => {
        const x = random(`x${i}`) * 100, size = 3 + random(`s${i}`) * 6, speed = 0.15 + random(`v${i}`) * 0.5;
        const y = ((random(`y${i}`) * 140 - f * speed * 0.12 + 140) % 140) - 20;
        return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: '50%', background: '#fff', opacity: 0.12 + random(`o${i}`) * 0.25 }} />;
      })}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />
    </AbsoluteFill>
  );
};

/** Headline that rises word by word. */
export const Headline = ({ lines, size = 112, delay = 0, hot = [], color = C.white, stagger = 4, style }: {
  lines: string[]; size?: number; delay?: number; hot?: string[]; color?: string; stagger?: number; style?: CSSProperties;
}) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  let n = 0;
  return (
    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.035em', color, ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.25}px`, overflow: 'hidden', paddingBottom: size * 0.2, marginBottom: -size * 0.12 }}>
          {line.split(' ').map((w, wi) => {
            const p = spring({ frame: f - delay - n++ * stagger, fps, config: { damping: 15, stiffness: 170, mass: 0.6 } });
            const strip = (x: string) => x.replace(/[^\w'’]/g, '').toLowerCase();
            const isHot = hot.some((h) => strip(h) === strip(w));
            return <span key={wi} style={{ display: 'inline-block', opacity: p, transform: `translateY(${interpolate(p, [0, 1], [size * 0.9, 0])}px)`, color: isHot ? C.mint : undefined, textShadow: isHot ? `0 0 40px ${C.mint}55` : undefined }}>{w}</span>;
          })}
        </div>
      ))}
    </div>
  );
};

export const Phone = ({ children, delay = 0, tilt = 0, shake = 0, scale = 1 }: { children: ReactNode; delay?: number; tilt?: number; shake?: number; scale?: number }) => {
  const f = useFrame();
  const p = useSpring(delay, { damping: 15, stiffness: 110, mass: 0.9 });
  const float = Math.sin((f + delay) / 24) * 9;
  return (
    <div style={{ width: 500, height: 1000, borderRadius: 70, background: 'linear-gradient(145deg,#1b2a44,#05101f)', padding: 14, boxShadow: '0 80px 140px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.12)', opacity: p, transform: `translate(${shake}px, ${interpolate(p, [0, 1], [700, 0]) + float}px) rotate(${tilt}deg) scale(${interpolate(p, [0, 1], [0.8, 1]) * scale})` }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 58, overflow: 'hidden', background: C.paper, position: 'relative', fontFamily: FONT }}>
        <div style={{ position: 'absolute', top: 14, left: '50%', width: 130, height: 34, marginLeft: -65, borderRadius: 20, background: '#05101f', zIndex: 5 }} />
        {children}
      </div>
    </div>
  );
};

export const CountUp = ({ from, to, start, end, prefix = '', format = (n: number) => Math.round(n).toLocaleString('en-IN') }: {
  from: number; to: number; start: number; end: number; prefix?: string; format?: (n: number) => string;
}) => {
  const f = useFrame();
  return <>{prefix}{format(interpolate(f, [start, end], [from, to], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) }))}</>;
};

export const Ring = ({ size, value, color, track = 'rgba(255,255,255,0.14)', stroke = 14, children }: { size: number; value: number; color: string; track?: string; stroke?: number; children?: ReactNode }) => {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - value)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
};

export const Logo = ({ size = 160, draw = 1 }: { size?: number; draw?: number }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 30px 80px rgba(0,0,0,0.45), 0 0 80px ${C.mint}44` }}>
    <Img src={staticFile('logo.png')} style={{ width: '78%', height: '78%', objectFit: 'contain', opacity: Math.min(1, draw * 1.6), transform: `scale(${0.7 + 0.3 * draw}) rotate(${(1 - draw) * -20}deg)` }} />
  </div>
);

export const Shot = ({ src }: { src: string }) => <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
