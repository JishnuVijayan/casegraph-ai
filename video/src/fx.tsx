import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from './theme';
import { useAudio } from './audio';
import { T } from './timing';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Each scene is designed for `ref` frames; the real scene is as long as its narration. Animation time is stretched to match. */
const ScaleContext = createContext(1);
export const Scaled = ({ frames: designFrames, children }: { frames: number; children: ReactNode }) => {
  const { durationInFrames } = useVideoConfig();
  return <ScaleContext.Provider value={designFrames / Math.max(1, durationInFrames - T)}>{children}</ScaleContext.Provider>;
};
export const useFrame = () => useCurrentFrame() * useContext(ScaleContext);
/** A spring that starts at `delay` and settles at 1. */
export const useSpring = (delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const frame = useFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 150, mass: 0.7, ...config } });
};

/** The living background: deep gradient, aurora that breathes with the voice, a drifting network of connected points, a glowing perspective floor and a slow light sweep. */
export const Backdrop = ({ a, b, c = C.mint, base = C.navy }: { a: string; b: string; c?: string; base?: string }) => {
  const f = useCurrentFrame();
  const { voice, bass } = useAudio();
  const W = 1920, H = 1080;
  const blob = (x: number, y: number, size: number, color: string, speed: number, phase: number, op = 0.42): CSSProperties => {
    const s = size * (1 + voice * 0.2 + bass * 0.08);
    return { position: 'absolute', width: s, height: s, borderRadius: '50%', background: color, opacity: op + voice * 0.2, filter: 'blur(140px)', mixBlendMode: 'screen',
      left: `${x + Math.sin(f / speed + phase) * 7}%`, top: `${y + Math.cos(f / (speed * 1.3) + phase) * 9}%`, transform: 'translate(-50%,-50%)' };
  };
  // Drifting points, joined when they come close: a quiet nod to the case network.
  const pts = Array.from({ length: 30 }, (_, i) => ({
    x: (random(`px${i}`) * W * 1.2 + Math.sin(f / (90 + i * 4) + i) * 90 + f * (0.15 + random(`pv${i}`) * 0.25)) % (W * 1.2) - W * 0.1,
    y: random(`py${i}`) * H + Math.cos(f / (110 + i * 3) + i * 2) * 70,
    r: 2 + random(`pr${i}`) * 3.5,
  }));
  const links: ReactNode[] = [];
  for (let i = 0; i < pts.length; i += 1) for (let j = i + 1; j < pts.length; j += 1) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    if (d < 280) links.push(<line key={`${i}-${j}`} x1={pts[i].x} y1={pts[i].y} x2={pts[j].x} y2={pts[j].y} stroke="#fff" strokeOpacity={(1 - d / 280) * (0.22 + voice * 0.25)} strokeWidth={1.4} />);
  }
  const sweep = ((f * 5) % 3600) - 900;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 20% 0%, ${base}, #050c1a 75%)`, overflow: 'hidden' }}>
      <div style={blob(16, 18, 1100, a, 60, 0)} /><div style={blob(84, 80, 1200, b, 75, 2)} /><div style={blob(62, 10, 760, c, 95, 4, 0.3)} /><div style={blob(8, 92, 700, b, 80, 1, 0.28)} />
      {/* Glowing floor in perspective, scrolling toward the camera */}
      <div style={{ position: 'absolute', left: '-25%', right: '-25%', bottom: -120, height: 640, perspective: 520, perspectiveOrigin: '50% 0%', WebkitMaskImage: 'linear-gradient(to top, #000 15%, transparent 92%)', maskImage: 'linear-gradient(to top, #000 15%, transparent 92%)' }}>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateX(68deg)', transformOrigin: '50% 0%', backgroundImage: `linear-gradient(${c}55 2px, transparent 2px), linear-gradient(90deg, ${c}44 2px, transparent 2px)`, backgroundSize: '110px 110px', backgroundPosition: `0 ${(f * 1.4) % 110}px`, opacity: 0.5 + bass * 0.3 }} />
      </div>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
        {links}
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r + voice * 2} fill="#fff" opacity={0.35 + random(`po${i}`) * 0.4} />)}
      </svg>
      {/* Soft bokeh and a slow diagonal light sweep */}
      {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ position: 'absolute', left: `${10 + random(`bx${i}`) * 80}%`, top: `${8 + random(`by${i}`) * 80}%`, width: 120 + random(`bs${i}`) * 220, height: 120 + random(`bs${i}`) * 220, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)', transform: `translateY(${Math.sin(f / (70 + i * 12) + i) * 24}px)` }} />)}
      <div style={{ position: 'absolute', top: -300, left: sweep, width: 380, height: 1700, transform: 'rotate(18deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)', filter: 'blur(14px)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)' }} />
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
