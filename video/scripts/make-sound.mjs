// Makes the music bed and sound effects with ffmpeg (no downloads, no licences): npm run sound
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../public/sfx');
mkdirSync(out, { recursive: true });
const force = process.argv.includes('--force');
const ff = (name, args) => {
  const file = join(out, name);
  if (!force && existsSync(file)) return;
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args, '-ar', '44100', '-ac', '2', file]);
  console.log('made', name);
};
const src = (spec) => ['-f', 'lavfi', '-i', spec];

// Soft air sweep: scene changes.
ff('whoosh.wav', [...src('anoisesrc=d=0.9:c=pink:r=44100:a=0.9'), '-af', 'highpass=f=250,lowpass=f=5200,afade=t=in:st=0:d=0.32,afade=t=out:st=0.32:d=0.58,volume=0.7']);
// Low boom + noise burst: the moment the money is gone.
ff('impact.wav', [...src('sine=f=52:d=1.4:r=44100'), ...src('anoisesrc=d=0.3:c=white:r=44100:a=0.6'), '-filter_complex',
  '[0]afade=t=out:st=0:d=1.4:curve=exp,volume=1.4[a];[1]lowpass=f=900,afade=t=out:st=0:d=0.3:curve=exp[b];[a][b]amix=inputs=2:normalize=0,alimiter=limit=0.9']);
// Little UI "pop" and "tick".
ff('pop.wav', [...src('sine=f=760:d=0.14:r=44100'), ...src('sine=f=1520:d=0.14:r=44100'), '-filter_complex',
  '[0]afade=t=out:st=0:d=0.14:curve=exp[a];[1]volume=0.4,afade=t=out:st=0:d=0.1:curve=exp[b];[a][b]amix=inputs=2:normalize=0,volume=0.9']);
ff('tick.wav', [...src('anoisesrc=d=0.05:c=white:r=44100:a=0.7'), '-af', 'highpass=f=2500,lowpass=f=9000,afade=t=out:st=0:d=0.05:curve=exp']);
// Bright "ding": a timeline item landed.
ff('ding.wav', [...src('sine=f=1318.5:d=1.1:r=44100'), ...src('sine=f=1975.5:d=1.1:r=44100'), ...src('sine=f=2637:d=1.1:r=44100'), '-filter_complex',
  '[0]volume=0.6[a];[1]volume=0.3[b];[2]volume=0.15[c];[a][b][c]amix=inputs=3:normalize=0,afade=t=out:st=0:d=1.1:curve=exp,aecho=0.7:0.6:80:0.35']);
// Rising tension before the network lights up.
ff('riser.wav', [...src('anoisesrc=d=2.4:c=pink:r=44100:a=0.8'), '-af', 'highpass=f=600,lowpass=f=7000,tremolo=f=10:d=0.45,afade=t=in:st=0:d=2.3:curve=exp,afade=t=out:st=2.3:d=0.1,volume=0.5']);
// Four-note rising chime for the finish.
ff('chime.wav', [...src('sine=f=523.25:d=1.6:r=44100'), ...src('sine=f=659.25:d=1.6:r=44100'), ...src('sine=f=783.99:d=1.6:r=44100'), ...src('sine=f=1046.5:d=1.9:r=44100'), '-filter_complex',
  '[0]afade=t=out:st=0:d=1.6:curve=exp[a];[1]adelay=130|130,afade=t=out:st=0:d=1.6:curve=exp[b];[2]adelay=260|260,afade=t=out:st=0:d=1.6:curve=exp[c];[3]adelay=390|390,afade=t=out:st=0:d=1.9:curve=exp[d];[a][b][c][d]amix=inputs=4:normalize=0,volume=0.5,aecho=0.8:0.7:90:0.4']);
// Warm ambient pad with a soft heartbeat pulse: 32 s so it always outlasts the 30 s video.
ff('music.wav', [
  ...src('sine=f=110:d=32:r=44100'), ...src('sine=f=164.81:d=32:r=44100'), ...src('sine=f=220:d=32:r=44100'), ...src('sine=f=277.18:d=32:r=44100'), ...src('sine=f=329.63:d=32:r=44100'), ...src('sine=f=55:d=32:r=44100'),
  '-filter_complex',
  '[0]volume=0.5[p0];[1]volume=0.35,tremolo=f=0.13:d=0.5[p1];[2]volume=0.3,tremolo=f=0.2:d=0.6[p2];[3]volume=0.18,tremolo=f=0.17:d=0.6[p3];[4]volume=0.12,tremolo=f=0.23:d=0.6[p4];' +
  '[5]volume=0.9,tremolo=f=2:d=0.95[beat];[p0][p1][p2][p3][p4]amix=inputs=5:normalize=0,lowpass=f=1500[pad];[pad][beat]amix=inputs=2:weights=1 0.35:normalize=0,' +
  'aecho=0.8:0.85:600|1100:0.35|0.25,afade=t=in:st=0:d=2.5,afade=t=out:st=28:d=4,volume=0.8',
]);
