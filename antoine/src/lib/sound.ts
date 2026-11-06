/**
 * Tiny synthesized sound kit (Web Audio). No files to download; off by
 * default (09 §5) and only ever played after a user gesture.
 */
export type SoundName = "tap" | "win" | "hit" | "sparkle" | "fanfare" | "drum" | "miss";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18, slideTo?: number) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + start + dur);
  amp.gain.setValueAtTime(0.0001, ac.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

export function play(name: SoundName) {
  const ac = audio();
  if (!ac) return;
  switch (name) {
    case "tap": tone(ac, 1250, 0, 0.035, "triangle", 0.06); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, i * 0.07, 0.22, "triangle", 0.14)); break;
    case "hit": tone(ac, 180, 0, 0.18, "square", 0.12, 70); tone(ac, 90, 0.02, 0.22, "sine", 0.2, 45); break;
    case "sparkle": [1568, 2093, 2637].forEach((f, i) => tone(ac, f, i * 0.05, 0.16, "sine", 0.08)); break;
    case "miss": tone(ac, 330, 0, 0.18, "triangle", 0.12, 220); tone(ac, 247, 0.16, 0.26, "triangle", 0.1, 165); break;
    case "drum": for (let i = 0; i < 10; i += 1) tone(ac, 110 + (i % 2) * 8, i * 0.08, 0.07, "square", 0.05); break;
    case "fanfare": [392, 523, 659, 784, 659, 1047].forEach((f, i) => tone(ac, f, i * 0.12, i === 5 ? 0.6 : 0.16, "triangle", 0.16)); break;
  }
}
