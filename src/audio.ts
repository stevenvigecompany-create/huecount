interface Graph {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  filter: BiquadFilterNode;
  pads: OscillatorNode[];
  timer: number;
  step: number;
  alive: boolean;
}

let graph: Graph | null = null;

function context(): Graph | null {
  if (graph) return graph;
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const music = ctx.createGain();
  music.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 880;
  filter.connect(music);
  music.connect(master);
  graph = { ctx, master, music, filter, pads: [], timer: 0, step: 0, alive: false };
  return graph;
}

function tone(freq: number, delay: number, dur: number, peak: number, type: OscillatorType = "sine"): void {
  const g = context();
  if (!g) return;
  if (g.ctx.state === "suspended") void g.ctx.resume();
  const t = g.ctx.currentTime + delay;
  const osc = g.ctx.createOscillator();
  const gain = g.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(g.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const SOUND_PACKS = ["tick", "glass", "wood"] as const;
export type SoundPack = (typeof SOUND_PACKS)[number];

export function isSoundPack(value: string): value is SoundPack {
  return (SOUND_PACKS as readonly string[]).includes(value);
}

export function playTap(enabled: boolean, step: number, pack: SoundPack = "tick"): void {
  if (!enabled) return;
  if (pack === "glass") {
    tone(860 + (step % 5) * 36, 0, 0.045, 0.035);
    tone(1720, 0.012, 0.04, 0.012);
    return;
  }
  if (pack === "wood") {
    tone(196 + (step % 5) * 18, 0, 0.08, 0.06, "triangle");
    return;
  }
  tone(470 + (step % 7) * 22, 0, 0.07, 0.05);
}

export function playArrival(enabled: boolean, pack: SoundPack = "tick"): void {
  if (!enabled) return;
  if (pack === "glass") {
    tone(988, 0, 0.08, 0.04);
    tone(1480, 0.04, 0.12, 0.03);
    return;
  }
  if (pack === "wood") {
    tone(330, 0, 0.1, 0.06, "triangle");
    tone(440, 0.05, 0.14, 0.045, "triangle");
    return;
  }
  tone(660, 0, 0.12, 0.06);
  tone(880, 0.05, 0.16, 0.045);
}

export function playSmearTap(enabled: boolean, pack: SoundPack = "tick"): void {
  if (!enabled) return;
  if (pack === "glass") {
    tone(240, 0, 0.07, 0.04, "triangle");
    return;
  }
  tone(pack === "wood" ? 110 : 180, 0, 0.09, 0.05, "triangle");
}

export function playLock(enabled: boolean, kind: "exact" | "close" | "smear", pack: SoundPack = "tick"): void {
  if (!enabled) return;
  const voice: OscillatorType = pack === "tick" ? "sine" : pack === "wood" ? "triangle" : "sine";
  const lift = pack === "glass" ? 1.25 : 1;
  if (kind === "smear") {
    tone(pack === "glass" ? 196 : 140, 0, 0.16, 0.06, pack === "tick" ? "triangle" : voice);
    return;
  }
  if (kind === "close") {
    tone(494 * lift, 0, 0.16, 0.055, voice);
    tone(622 * lift, 0.06, 0.2, 0.04, voice);
    return;
  }
  tone(523 * lift, 0, 0.18, 0.06, voice);
  tone(784 * lift, 0.07, 0.28, 0.05, voice);
}

export function syncMusic(enabled: boolean): void {
  try {
    if (!enabled && !graph) return;
    const g = context();
    if (!g) return;
    if (g.ctx.state === "suspended") void g.ctx.resume();
    if (!enabled) {
      g.music.gain.setTargetAtTime(0, g.ctx.currentTime, 0.06);
      return;
    }
    if (!g.alive) {
      g.alive = true;
      [196, 246.94].forEach((freq, index) => {
        const osc = g.ctx.createOscillator();
        const gain = g.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.value = index === 0 ? 0.07 : 0.04;
        osc.connect(gain);
        gain.connect(g.filter);
        osc.start();
        g.pads.push(osc);
      });
      const scale = [220, 261.63, 293.66, 329.63, 392];
      const loop = () => {
        if (!graph?.alive) return;
        if (graph.music.gain.value > 0.01) {
          tone(scale[graph.step % scale.length] ?? 220, 0, 1.1, 0.03);
        }
        graph.step += 1;
        graph.timer = window.setTimeout(loop, 1600);
      };
      loop();
    }
    g.music.gain.setTargetAtTime(0.16, g.ctx.currentTime, 0.4);
  } catch {
    /* audio blocked or missing */
  }
}

export function duckMusic(enabled: boolean): void {
  if (!enabled || !graph) return;
  const gain = graph.music.gain;
  const t = graph.ctx.currentTime;
  gain.cancelScheduledValues(t);
  gain.setValueAtTime(Math.max(0.02, gain.value), t);
  gain.linearRampToValueAtTime(0.04, t + 0.03);
  gain.linearRampToValueAtTime(0.16, t + 0.45);
}

export function swellMusic(enabled: boolean): void {
  if (!enabled || !graph) return;
  const gain = graph.music.gain;
  const t = graph.ctx.currentTime;
  gain.cancelScheduledValues(t);
  gain.setValueAtTime(Math.max(0.02, gain.value), t);
  gain.linearRampToValueAtTime(0.28, t + 0.08);
  gain.linearRampToValueAtTime(0.16, t + 0.9);
}
