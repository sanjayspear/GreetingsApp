import { rng } from "../core/math";

/* ---------- Music: soft celebration theme, generated in the browser ---------- */
export const SR = 48000;
const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const PROG = [
  // chord tones, bass, melody (each chord lasts 2.5s)
  { pad: [60, 64, 67, 71], bass: 36, mel: [72, 76, 79, 83, 79] },
  { pad: [57, 60, 64, 67], bass: 33, mel: [76, 72, 69, 72, 76] },
  { pad: [53, 57, 60, 64], bass: 29, mel: [77, 76, 72, 69, 72] },
  { pad: [55, 59, 62, 67], bass: 31, mel: [74, 79, 83, 79, 74] }
];

function buildMusic(ac: BaseAudioContext, out: AudioNode, SECS: number) {
  const master = ac.createGain();
  master.connect(out);
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(2.2, 0.4);
  master.gain.setValueAtTime(2.2, SECS - 1.4);
  master.gain.linearRampToValueAtTime(0, SECS);
  // Reverb from generated impulse
  const irLen = Math.floor(ac.sampleRate * 2.8),
    ir = ac.createBuffer(2, irLen, ac.sampleRate),
    rr = rng(21);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) d[i] = (rr() * 2 - 1) * Math.pow(1 - i / irLen, 3);
  }
  const verb = ac.createConvolver();
  verb.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.42;
  verb.connect(wet);
  wet.connect(master);
  const dry = ac.createGain();
  dry.gain.value = 0.75;
  dry.connect(master);
  const bus = ac.createGain();
  bus.connect(dry);
  bus.connect(verb);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  lp.connect(bus);

  const pad = (t: number, dur: number, notes: number[]) =>
    notes.forEach((n) => {
      [0, 5].forEach((det) => {
        const o = ac.createOscillator(),
          g = ac.createGain();
        o.type = det ? "sine" : "triangle";
        o.frequency.value = midiHz(n);
        o.detune.value = det;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 0.9);
        g.gain.setValueAtTime(0.028, t + dur);
        g.gain.linearRampToValueAtTime(0, t + dur + 1.3);
        o.connect(g);
        g.connect(lp);
        o.start(t);
        o.stop(t + dur + 1.4);
      });
    });
  const bass = (t: number, dur: number, n: number) => {
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.type = "sine";
    o.frequency.value = midiHz(n);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.02, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.3);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.35);
  };
  const bell = (t: number, n: number, vel: number) => {
    (
      [
        [1, 1],
        [2.01, 0.32],
        [3.98, 0.1]
      ] as const
    ).forEach(([m, a]) => {
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = "sine";
      o.frequency.value = midiHz(n) * m;
      const peak = 0.075 * vel * a;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (m === 1 ? 1.9 : 0.8));
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 2);
    });
  };
  // Opening sparkle
  [84, 88, 91, 96].forEach((n, i) => bell(0.05 + i * 0.07, n, 0.45));
  const nChords = Math.ceil((SECS - 0.5) / 2.5);
  for (let i = 0; i < nChords; i++) {
    const c = PROG[i % PROG.length],
      t = i * 2.5;
    pad(t, 2.5, c.pad);
    bass(t, 2.4, c.bass);
    c.mel.forEach((n, j) => {
      const tt = t + 0.3 + j * 0.45;
      if (tt < SECS - 1.5) bell(tt, n, j === 0 ? 1 : 0.75);
    });
  }
  // Closing chime
  [72, 76, 79, 84].forEach((n, i) => bell(SECS - 1.3 + i * 0.12, n, 0.6));
}

const musicCache = new Map<number, Promise<AudioBuffer | null>>();
/** Render the theme offline (also used for the video soundtrack). Cached per whole-second length. */
export function getMusic(secs: number): Promise<AudioBuffer | null> {
  secs = Math.ceil(secs);
  const cached = musicCache.get(secs);
  if (cached) return cached;
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const job: Promise<AudioBuffer | null> = !OAC
    ? Promise.resolve(null)
    : (async () => {
        try {
          const ac = new OAC(2, SR * secs, SR);
          buildMusic(ac, ac.destination, secs);
          return await ac.startRendering();
        } catch {
          return null;
        }
      })();
  musicCache.set(secs, job);
  return job;
}

// Live playback
let actx: AudioContext | null = null,
  liveSrc: AudioBufferSourceNode | null = null,
  musicOn = true;

export const isMusicOn = (): boolean => musicOn;
export const setMusicOn = (v: boolean): void => {
  musicOn = v;
};
export const getAudioContext = (): AudioContext | null => actx;

export function ensureAudio(): AudioContext | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!actx) {
    try {
      actx = new AC({ sampleRate: SR });
    } catch {
      actx = new AC();
    }
  }
  if (actx.state === "suspended") actx.resume().catch(() => {});
  return actx;
}

export function stopMusic(): void {
  if (liveSrc) {
    try {
      liveSrc.stop();
    } catch {
      /* already stopped */
    }
    liveSrc = null;
  }
}

/** Play the theme for a story that lasts `storySecs`. No-op when muted or no context yet. */
export async function playMusic(delay: number, storySecs: number): Promise<void> {
  stopMusic();
  if (!musicOn || !actx) return;
  const buf = await getMusic(storySecs + 0.8);
  if (!buf || !musicOn || !actx) return;
  stopMusic();
  const src = actx.createBufferSource();
  src.buffer = buf;
  const g = actx.createGain();
  g.gain.value = 0.8;
  src.connect(g);
  g.connect(actx.destination);
  src.start(actx.currentTime + (delay || 0));
  liveSrc = src;
}
