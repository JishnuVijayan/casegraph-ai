import { AbsoluteFill, interpolate } from 'remotion';
import { Backdrop, CountUp, Headline, Logo, Phone, Ring, Scaled, Shot, clamp, useFrame, useSpring } from './fx';
import { useAudio } from './audio';
import { SceneShell } from './parts';
import { C, FONT, shot } from './theme';

const box = (extra: object = {}) => ({ fontFamily: FONT, ...extra });

/* ───────────────────────── 1. HOOK ───────────────────────── */
const Notice = ({ at, title, body, tone, icon }: { at: number; title: string; body: string; tone: string; icon: string }) => {
  const f = useFrame();
  const p = useSpring(at, { damping: 13, stiffness: 190 });
  const buzz = f > at && f < at + 10 ? Math.sin(f * 2.4) * 4 : 0;
  return (
    <div style={box({ margin: '0 22px 16px', padding: '20px 22px', borderRadius: 26, background: 'rgba(255,255,255,0.94)', display: 'flex', gap: 18, alignItems: 'center', opacity: p, transform: `translate(${buzz}px, ${interpolate(p, [0, 1], [-90, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`, boxShadow: '0 12px 30px rgba(0,0,0,0.25)' })}>
      <div style={{ width: 62, height: 62, borderRadius: 16, background: tone, color: '#fff', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div><div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>{title}</div><div style={{ fontSize: 23, color: '#475569', marginTop: 2, lineHeight: 1.25 }}>{body}</div></div>
    </div>
  );
};

export const Hook = () => {
  const f = useFrame();
  const gone = f >= 52;
  const flash = interpolate(f, [52, 56, 70], [0, 0.55, 0], clamp);
  const glitch = gone && f < 76 ? Math.sin(f * 9) * 8 : 0;
  const audioHook = useAudio();
  const vibrate = f > 6 && f < 52 ? Math.sin(f * 2.2) * (2 + audioHook.bass * 5) : 0;
  return (
    <SceneShell bg="transparent"><Scaled frames={100}>
      <Backdrop a={C.primary} b={C.red} c={C.navy2} />
      <AbsoluteFill style={{ padding: '0 0 0 140px', justifyContent: 'center' }}>
        <Headline lines={['A call.']} size={168} delay={4} />
        <Headline lines={['A link.']} size={168} delay={16} />
        <Headline lines={['A message.']} size={168} delay={28} />
        <div style={{ transform: `translateX(${glitch}px)` }}>
          <Headline lines={["And it's gone."]} size={158} delay={52} color={C.red} stagger={6} style={{ textShadow: gone ? `${-glitch}px 0 ${C.sky}88, ${glitch}px 0 ${C.red}` : undefined }} />
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', right: 150, top: 40 }}>
        <Phone delay={6} tilt={4} shake={vibrate}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#1e3a8a,#0b1f3a)' }} />
          <div style={box({ position: 'absolute', top: 100, width: '100%', textAlign: 'center', color: '#fff' })}>
            <div style={{ fontSize: 120, fontWeight: 200 }}>9:41</div><div style={{ fontSize: 28, opacity: 0.8 }}>Saturday, 11 July</div>
          </div>
          <div style={{ position: 'absolute', top: 360, width: '100%' }}>
            <Notice at={8} icon="📞" tone="#16a34a" title="Incoming call" body="Unknown number · +91 90000 ····" />
            <Notice at={20} icon="✉" tone={C.primary} title="BANK-ALERT" body="Your KYC has expired. Update now: kyc-secure.link/verify" />
            <Notice at={32} icon="💬" tone="#0ea5a5" title="WhatsApp" body="Congratulations! Claim your prize in the next 10 minutes" />
          </div>
          <AbsoluteFill style={{ background: C.red, opacity: flash, zIndex: 8 }} />
          {gone && (
            <div style={box({ position: 'absolute', left: 30, right: 30, bottom: 90, padding: '28px 30px', borderRadius: 28, background: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', zIndex: 9, transform: `translateX(${glitch}px)` })}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>Savings account balance</div>
              <div style={{ fontSize: 86, fontWeight: 800, color: f > 74 ? C.red : C.ink, letterSpacing: '-0.03em' }}><CountUp from={84500} to={0} start={54} end={74} prefix="₹" /></div>
            </div>
          )}
        </Phone>
      </div>
    </Scaled></SceneShell>
  );
};

/* ───────────────────────── 2. PROBLEM ───────────────────────── */
const FORMS = [
  { t: 'FIR Form 14-B', x: 1200, y: 90, r: -9, d: 6 }, { t: 'Annexure III', x: 1500, y: 150, r: 7, d: 12 }, { t: 'Section 66D, IT Act', x: 1260, y: 400, r: 5, d: 18 },
  { t: 'Notarised affidavit', x: 1530, y: 470, r: -6, d: 24 }, { t: 'Jurisdiction proof?', x: 1300, y: 700, r: 8, d: 30 }, { t: 'Supporting documents', x: 1560, y: 760, r: -4, d: 36 },
];
const Form = ({ t, x, y, r, d }: typeof FORMS[number]) => {
  const p = useSpring(d, { damping: 11, stiffness: 120 });
  const f = useFrame();
  return (
    <div style={box({ position: 'absolute', left: x, top: y, width: 330, padding: '24px 26px', borderRadius: 16, background: '#fffdf6', boxShadow: '0 30px 60px rgba(0,0,0,0.4)', transform: `translateY(${interpolate(p, [0, 1], [-900, 0])}px) rotate(${r + (1 - p) * 25}deg)`, opacity: Math.min(1, p * 2) })}>
      <div style={{ fontSize: 27, fontWeight: 800, color: '#7c2d12' }}>{t}</div>
      {[88, 100, 72, 94].map((w, i) => <div key={i} style={{ marginTop: 13, height: 11, width: `${w}%`, borderRadius: 6, background: '#d6d3d1' }} />)}
      {f > d + 30 && <div style={{ position: 'absolute', right: 14, bottom: 16, padding: '5px 12px', border: `4px solid ${C.red}`, color: C.red, fontSize: 24, fontWeight: 900, borderRadius: 8, transform: `rotate(-12deg) scale(${interpolate(f, [d + 30, d + 36], [2, 1], clamp)})`, opacity: interpolate(f, [d + 30, d + 33], [0, 1], clamp) }}>PENDING</div>}
    </div>
  );
};

export const Problem = () => {
  const f = useFrame();
  const hand = interpolate(f, [10, 120], [0, 1080], { ...clamp, easing: (t) => t * t });
  const clock = useSpring(8, { damping: 12 });
  return (
    <SceneShell bg="transparent"><Scaled frames={120}>
      <Backdrop a={C.red} b={C.navy2} c={C.primary} base={C.ink} />
      <AbsoluteFill style={{ padding: '0 0 0 140px', justifyContent: 'center', gap: 24 }}>
        <Headline lines={['Then comes the', 'hard part:']} size={92} color={C.sky} delay={2} style={{ fontWeight: 700 }} />
        <Headline lines={['reporting it.']} size={190} delay={14} hot={['it.']} />
        <div style={box({ marginTop: 26, display: 'flex', gap: 22 })}>
          {['Long forms', 'Legal jargon', 'Days of waiting'].map((t, i) => (
            <div key={t} style={{ padding: '16px 32px', borderRadius: 16, border: '2px solid rgba(255,255,255,0.28)', color: '#fff', fontSize: 40, fontWeight: 700, opacity: interpolate(f, [34 + i * 9, 44 + i * 9], [0, 1], clamp), textDecoration: f > 90 + i * 5 ? 'line-through' : 'none', textDecorationColor: C.red, textDecorationThickness: 5 }}>{t}</div>
          ))}
        </div>
      </AbsoluteFill>
      {FORMS.map((fm) => <Form key={fm.t} {...fm} />)}
      <div style={{ position: 'absolute', right: 70, top: 50, width: 150, height: 150, borderRadius: '50%', background: '#fff', border: `8px solid ${C.ink}`, transform: `scale(${clock})`, boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 8, height: 54, background: C.ink, borderRadius: 4, transformOrigin: '50% 100%', transform: `translate(-50%,-100%) rotate(${hand}deg)` }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 38, background: C.red, borderRadius: 4, transformOrigin: '50% 100%', transform: `translate(-50%,-100%) rotate(${hand / 12}deg)` }} />
      </div>
    </Scaled></SceneShell>
  );
};

/* ───────────────────────── 3. TELL US ───────────────────────── */
const TEXT = "A man called saying he was from my bank. He asked for a code, and then 12,000 rupees left my account.";
export const Tell = () => {
  const f = useFrame();
  const audio = useAudio();
  const shown = TEXT.slice(0, Math.max(0, Math.floor((f - 26) * 1.7)));
  const mic = f > 58;
  const real = shot('tell');
  return (
    <SceneShell bg="transparent"><Scaled frames={180}>
      <Backdrop a={C.primary} b={C.teal} c={C.sky} base={C.navy2} />
      <AbsoluteFill style={{ padding: '0 0 0 140px', justifyContent: 'center' }}>
        <Headline lines={['Just tell us', 'what happened.']} size={128} delay={4} hot={['happened.']} />
        <div style={{ display: 'flex', gap: 20, marginTop: 56 }}>
          {[['🎙  Speak', C.teal, 60], ['⌨  Type', C.primary, 70], ['📷  Screenshots', C.amber, 80]].map(([t, c, d]) => {
            const p = useSpring(d as number, { damping: 11, stiffness: 190 });
            return <div key={t as string} style={box({ padding: '16px 32px', borderRadius: 999, background: c as string, color: '#fff', fontSize: 38, fontWeight: 700, opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.5, 1])})` })}>{t}</div>;
          })}
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', right: 170, top: 40 }}>
        <Phone delay={10} tilt={-3}>
          {real ? <Shot src={real} /> : (
            <div style={box({ padding: '86px 30px 0' })}>
              <div style={{ fontSize: 40, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>Tell us what happened</div>
              <div style={{ marginTop: 22, minHeight: 300, padding: 24, borderRadius: 22, border: `3px solid ${mic ? C.teal : C.primary}`, background: '#fff', fontSize: 31, lineHeight: 1.4, color: '#1f2937' }}>
                {shown}<span style={{ opacity: Math.floor(f / 8) % 2 ? 0 : 1, color: C.primary }}>|</span>
              </div>
              <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ position: 'relative', width: 96, height: 96 }}>
                  {mic && [0, 1].map((i) => <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `4px solid ${C.teal}`, opacity: 1 - ((f + i * 14) % 28) / 28, transform: `scale(${1 + ((f + i * 14) % 28) / 28 * 0.9})` }} />)}
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: mic ? C.teal : C.primary, color: '#fff', fontSize: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎙</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 80 }}>
                  {Array.from({ length: 16 }, (_, i) => <div key={i} style={{ width: 9, borderRadius: 5, background: C.teal, height: mic ? 14 + (audio.voice > 0.01 ? audio.bins[i + 1] * 96 : Math.abs(Math.sin(f / 4 + i * 0.9)) * 58) : 10 }} />)}
                </div>
              </div>
              <div style={{ marginTop: 30, fontSize: 26, fontWeight: 700, color: '#64748b' }}>Add proof</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                {[96, 112, 128].map((d, i) => {
                  const p = useSpring(d, { damping: 12, stiffness: 150 });
                  return <div key={d} style={{ width: 132, height: 170, borderRadius: 18, background: `linear-gradient(160deg, ${['#dbeafe', '#fef3c7', '#dcfce7'][i]}, #fff)`, border: '2px solid #e2e8f0', opacity: p, transform: `translateY(${interpolate(p, [0, 1], [260, 0])}px) rotate(${(1 - p) * -14}deg)`, position: 'relative' }}>
                    <div style={{ margin: 14, height: 12, width: '70%', borderRadius: 6, background: '#94a3b8' }} /><div style={{ margin: '0 14px', height: 12, width: '50%', borderRadius: 6, background: '#cbd5e1' }} />
                    <div style={{ position: 'absolute', right: 10, bottom: 10, width: 36, height: 36, borderRadius: '50%', background: C.teal, color: '#fff', textAlign: 'center', lineHeight: '36px', fontSize: 22 }}>✓</div>
                  </div>;
                })}
              </div>
            </div>
          )}
        </Phone>
      </div>
    </Scaled></SceneShell>
  );
};

/* ───────────────────────── 4. AI TIMELINE ───────────────────────── */
const STEPS = [
  { when: 'Yesterday · 7:50 pm', title: 'Call from “bank officer”', detail: 'Asked for a code', tone: C.red, at: 34 },
  { when: 'Yesterday · 8:00 pm', title: '₹12,000 left your account', detail: 'UPI transaction ID read from your screenshot', tone: C.amber, at: 52 },
  { when: 'Date not stated', title: 'You realised it was a fraud', detail: 'We will ask only if it matters', tone: C.teal, at: 70 },
];
export const AiTimeline = () => {
  const f = useFrame();
  const beam = interpolate(f, [24, 86], [-10, 110], clamp);
  const card = useSpring(6, { damping: 15, stiffness: 120 });
  const q = useSpring(102, { damping: 13, stiffness: 150 });
  const tapped = f > 138;
  const line = interpolate(f, [30, 90], [0, 1], clamp);
  return (
    <SceneShell bg="transparent"><Scaled frames={160}>
      <Backdrop a={C.teal} b={C.primary} c={C.mint} base={C.navy} />
      <AbsoluteFill style={{ padding: '0 0 0 140px', justifyContent: 'center', width: 860 }}>
        <Headline lines={['AI builds', 'your timeline.']} size={124} delay={4} hot={['timeline.']} />
        <div style={box({ marginTop: 40, fontSize: 40, color: C.mint, fontWeight: 700, lineHeight: 1.3, opacity: interpolate(f, [60, 76], [0, 1], clamp) })}>It reads your files, and asks only<br />for what is missing.</div>
      </AbsoluteFill>
      <div style={box({ position: 'absolute', right: 120, top: 90, width: 940, height: 900, borderRadius: 40, background: '#fff', boxShadow: '0 70px 140px rgba(0,0,0,0.55)', overflow: 'hidden', opacity: card, transform: `translateY(${interpolate(card, [0, 1], [500, 0])}px) scale(${interpolate(card, [0, 1], [0.9, 1])})` })}>
        <div style={{ padding: '34px 44px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.12em', color: C.primary }}>CHECK YOUR STORY</div><div style={{ fontSize: 40, fontWeight: 800, color: C.ink, marginTop: 6 }}>Fake bank call, ₹12,000</div></div>
          <Ring size={130} value={interpolate(f, [30, 120], [0.18, 0.92], clamp)} color={C.teal} track="#e2e8f0" stroke={14}><span style={{ fontSize: 34, fontWeight: 800, color: C.ink }}><CountUp from={18} to={92} start={30} end={120} format={(n) => `${Math.round(n)}%`} /></span></Ring>
        </div>
        <div style={{ position: 'absolute', left: 44, top: 218, bottom: 250, width: 6, borderRadius: 3, background: '#e2e8f0' }}><div style={{ width: '100%', height: `${line * 100}%`, background: C.primary, borderRadius: 3 }} /></div>
        <div style={{ padding: '36px 44px 0 84px' }}>
          {STEPS.map((s, i) => {
            const p = useSpring(s.at, { damping: 13, stiffness: 170 });
            const known = i === 2 && tapped;
            return (
              <div key={s.title} style={{ position: 'relative', marginBottom: 22, padding: '22px 28px', borderRadius: 22, background: '#f8fafc', border: '2px solid #e2e8f0', opacity: p, transform: `translateX(${interpolate(p, [0, 1], [160, 0])}px)` }}>
                <div style={{ position: 'absolute', left: -52, top: 34, width: 24, height: 24, borderRadius: '50%', background: s.tone, border: '5px solid #fff', boxShadow: `0 0 0 3px ${s.tone}55` }} />
                <div style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>{known ? 'Yesterday · about 8:30 pm' : s.when}</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, marginTop: 2 }}>{s.title}</div>
                <div style={{ fontSize: 26, color: '#475569', marginTop: 4 }}>{s.detail}</div>
                <div style={{ position: 'absolute', right: 22, top: 22, padding: '4px 14px', borderRadius: 99, background: '#e0f2fe', color: '#075985', fontSize: 20, fontWeight: 700 }}>{i === 1 ? 'From your file' : 'You told us'}</div>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${beam}%`, height: 90, background: `linear-gradient(180deg, transparent, ${C.mint}55, transparent)`, opacity: f < 90 ? 1 : 0, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 26, padding: '24px 30px', borderRadius: 26, background: C.navy, color: '#fff', opacity: q, transform: `translateY(${interpolate(q, [0, 1], [260, 0])}px)` }}>
          <div style={{ fontSize: 23, fontWeight: 700, color: C.mint }}>ONE QUICK QUESTION</div>
          <div style={{ fontSize: 36, fontWeight: 800, marginTop: 6 }}>When did you realise it was a fraud?</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            {['Around 8:30 pm', 'I don’t know'].map((c, i) => <div key={c} style={{ padding: '12px 26px', borderRadius: 99, fontSize: 28, fontWeight: 700, background: i === 0 && tapped ? C.mint : 'rgba(255,255,255,0.14)', color: i === 0 && tapped ? C.ink : '#fff', transform: `scale(${i === 0 && f > 134 && f < 144 ? 0.92 : 1})` }}>{c}</div>)}
          </div>
        </div>
      </div>
    </Scaled></SceneShell>
  );
};

/* ───────────────────────── 5. CASE NETWORK ───────────────────────── */
const NODES = [
  { x: 480, y: 360, label: 'Your case', main: true, c: C.primary }, { x: 150, y: 120, label: 'CG-…041', c: C.amber }, { x: 120, y: 560, label: 'CG-…008', c: C.red },
  { x: 800, y: 100, label: 'CG-…005', c: C.red }, { x: 850, y: 600, label: 'CG-…042', c: C.mint }, { x: 480, y: 640, label: 'CG-…046', c: C.sky },
];
const EDGES: [number, string, string][] = [[1, 'Same phone', C.red], [2, 'Same UPI ID', C.amber], [3, 'Same website', C.mint], [4, 'Same bank account', C.sky]];
export const Network = () => {
  const f = useFrame();
  const audio = useAudio();
  const score = useSpring(100, { damping: 12, stiffness: 140 });
  return (
    <SceneShell bg="transparent"><Scaled frames={150}>
      <Backdrop a={C.primary} b={C.mint} c={C.red} base={C.ink} />
      <AbsoluteFill style={{ padding: '0 0 0 140px', justifyContent: 'center', width: 900 }}>
        <Headline lines={['One submit.', 'The whole', 'network.']} size={118} delay={4} hot={['network.']} />
        <div style={box({ marginTop: 36, fontSize: 38, color: C.sky, lineHeight: 1.4, opacity: interpolate(f, [34, 52], [0, 1], clamp) })}>Earlier complaints with the same phone,<br />UPI ID or website, found in seconds.</div>
        <div style={box({ marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 22, padding: '18px 30px', borderRadius: 24, background: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', opacity: score, transform: `scale(${interpolate(score, [0, 1], [0.8, 1])})` })}>
          <Ring size={110} value={interpolate(f, [100, 140], [0, 0.72], clamp)} color={C.mint} stroke={12}><span style={{ fontSize: 34, fontWeight: 800, color: '#fff' }}><CountUp from={0} to={72} start={100} end={140} /></span></Ring>
          <div style={{ color: '#fff', fontSize: 30, fontWeight: 700, lineHeight: 1.25 }}>Match score<br /><span style={{ color: C.sky, fontWeight: 500, fontSize: 24 }}>a lead for the officer, never proof</span></div>
        </div>
      </AbsoluteFill>
      <svg width="1000" height="760" viewBox="0 0 1000 760" style={{ position: 'absolute', right: 80, top: 140 }}>
        <defs><filter id="glow"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        {EDGES.map(([to, label, color], i) => {
          const a = NODES[0], b = NODES[to];
          const t = interpolate(f, [28 + i * 14, 54 + i * 14], [0, 1], clamp);
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          const pulse = ((f - 70 - i * 9) % 46) / 46;
          return (
            <g key={label}>
              <line x1={a.x} y1={a.y} x2={x} y2={y} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.9} filter="url(#glow)" />
              {t >= 1 && f > 70 + i * 9 && <circle cx={a.x + (b.x - a.x) * Math.max(0, pulse)} cy={a.y + (b.y - a.y) * Math.max(0, pulse)} r={9} fill="#fff" />}
              {t >= 1 && <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}><rect x={-(label.length * 6.8 + 34)} y={-22} width={label.length * 13.6 + 68} height={44} rx={22} fill={C.ink} stroke={color} strokeWidth={2.5} /><text y={8} textAnchor="middle" fontSize="23" fontWeight="700" fill="#fff" fontFamily={FONT}>{label}</text></g>}
            </g>
          );
        })}
        {(() => { const t = interpolate(f, [88, 112], [0, 1], clamp); const a = NODES[3], b = NODES[4]; return <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * t} y2={a.y + (b.y - a.y) * t} stroke="#fff" strokeWidth={3} strokeDasharray="10 10" opacity={0.6} />; })()}
        {NODES.map((n, i) => {
          const p = useSpring(6 + i * 7, { damping: 11, stiffness: 190 });
          return (
            <g key={n.label} transform={`translate(${n.x} ${n.y}) scale(${p})`}>
              {n.main && <circle r={92 + Math.sin(f / 9) * 6 + audio.bass * 26} fill="none" stroke={C.mint} strokeWidth={3} opacity={0.45 + audio.voice * 0.4} />}
              <circle r={n.main ? 72 : 52} fill={C.ink} stroke={n.c} strokeWidth={6} filter="url(#glow)" />
              <text y={8} textAnchor="middle" fontSize={n.main ? 26 : 21} fontWeight="800" fill="#fff" fontFamily={FONT}>{n.label}</text>
            </g>
          );
        })}
      </svg>
    </Scaled></SceneShell>
  );
};

/* ───────────────────────── 6. CALL TO ACTION ───────────────────────── */
export const Cta = () => {
  const f = useFrame();
  const audio = useAudio();
  const logo = useSpring(4, { damping: 11, stiffness: 120 });
  const chip = useSpring(52, { damping: 12, stiffness: 160 });
  const draw = interpolate(f, [6, 34], [0, 1], clamp);
  return (
    <SceneShell bg="transparent"><Scaled frames={120}>
      <Backdrop a={C.primary} b={C.teal} c={C.mint} base={C.navy} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: `4px solid ${C.mint}`, opacity: Math.max(0, 0.6 - ((f + i * 30) % 90) / 90), transform: `scale(${1 + ((f + i * 30) % 90) / 90 * 4})`, top: 215 }} />)}
        <div style={{ transform: `scale(${interpolate(logo, [0, 1], [0.3, 1]) * (1 + audio.voice * 0.06)}) rotate(${(1 - logo) * -25}deg)`, opacity: logo }}><Logo size={220} draw={draw} /></div>
        <div style={{ marginTop: 26 }}><Headline lines={['CaseGraph']} size={190} delay={14} style={{ textAlign: 'center', justifyContent: 'center' }} /></div>
        <div style={{ marginTop: 6, fontFamily: FONT, fontSize: 68, fontWeight: 600, color: C.sky, opacity: interpolate(f, [30, 46], [0, 1], clamp), transform: `translateY(${interpolate(f, [30, 46], [30, 0], clamp)}px)` }}>Report a cyber crime in minutes.</div>
        <div style={{ marginTop: 50, padding: '22px 56px', borderRadius: 999, background: C.mint, color: C.ink, fontFamily: FONT, fontSize: 48, fontWeight: 800, opacity: chip, transform: `scale(${interpolate(chip, [0, 1], [0.5, 1]) * (1 + Math.sin(f / 7) * 0.02)})`, boxShadow: `0 0 ${50 + audio.bass * 90}px ${C.mint}88` }}>Lost money? Call 1930 first</div>
        <div style={{ marginTop: 22, fontFamily: FONT, fontSize: 32, color: 'rgba(255,255,255,0.7)', opacity: interpolate(f, [70, 86], [0, 1], clamp) }}>cybercrime.gov.in</div>
      </AbsoluteFill>
    </Scaled></SceneShell>
  );
};
