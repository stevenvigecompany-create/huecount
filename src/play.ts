import "./styles.css";
import {
  PACE_ORDER,
  PACES,
  RUSH_LIMIT,
  WORLD_ORDER,
  WORLDS,
  badgeLabel,
  beatLost,
  coachLine,
  colorCss,
  gradeRound,
  hueName,
  isPace,
  isWorld,
  makePigment,
  pickTarget,
  rampAfter,
  climbAfter,
  rushExpired,
  streakAfter,
  today,
  wallColor,
  type Grade,
} from "./logic.ts";
import { loadSave, persist, type Save } from "./store.ts";
import { duckMusic, playArrival, playLock, playSmearTap, playTap, swellMusic, syncMusic } from "./audio.ts";
import { HAPTIC, hapticAvailable, playHaptic } from "./haptics.ts";

const ICON_WALL = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>`;
const ICON_SET = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="17" r="2" fill="currentColor"/></svg>`;

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<unknown>;
}

const save: Save = loadSave();
const state = {
  view: "home" as "home" | "play" | "wall",
  sheet: null as null | "settings" | "pause",
  pace: save.pace,
  world: save.world,
  taps: 0,
  target: 7,
  pigment: makePigment("studio"),
  lastTap: null as number | null,
  smashed: false,
  rushed: false,
  paused: false,
  heldByHide: false,
  result: null as Grade | null,
  hideTarget: false,
  rushOrigin: 0,
  rushHold: 0,
  rushHeldAt: 0,
  newBest: false,
};

let deferredPrompt: InstallPrompt | null = null;
let wakeLock: WakeLockSentinel | null = null;
let rushRaf = 0;
let lastPointer = 0;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function motionCalm(): boolean {
  return save.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function installed(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function activePigment(): { h: number; s: number; l: number } | null {
  if (state.view === "play") return state.pigment;
  return save.wall[0] ?? null;
}

function applyChrome(): void {
  const root = document.documentElement;
  const mode = save.theme === "system" ? (systemDark() ? "dark" : "light") : save.theme;
  root.dataset.theme = mode;
  root.dataset.world = state.view === "play" ? state.world : save.world;
  root.dataset.motion = motionCalm() ? "reduce" : "ok";
  const pigment = activePigment();
  root.style.setProperty("--pig-s", String(pigment?.s ?? 64));
  root.style.setProperty("--pig-l", String(pigment?.l ?? 60));
  if (pigment && !motionCalm()) {
    root.dataset.hueLive = "off";
    root.style.setProperty("--hue", String(pigment.h));
  } else if (pigment) {
    root.dataset.hueLive = "off";
    root.style.setProperty("--hue", String(pigment.h));
  } else if (motionCalm()) {
    root.dataset.hueLive = "off";
    root.style.setProperty("--hue", "252");
  } else {
    root.dataset.hueLive = "on";
    root.style.removeProperty("--hue");
  }
  root.style.backgroundColor = "";
  const meta = document.getElementById("theme-color");
  if (meta) meta.setAttribute("content", mode === "light" ? "#e7edf8" : "#070814");
  const badge = badgeLabel(state.result, state.newBest);
  document.title = badge ? `${badge} · Huecount` : "Huecount";
}

function stopRush(): void {
  if (rushRaf) cancelAnimationFrame(rushRaf);
  rushRaf = 0;
}

function rushElapsed(now: number): number {
  if (!state.rushOrigin) return 0;
  const extra = state.paused && state.rushHeldAt ? now - state.rushHeldAt : 0;
  return Math.max(0, now - state.rushOrigin - state.rushHold - extra);
}

function rushScale(now = performance.now()): number {
  if (!state.rushOrigin) return 1;
  return Math.max(0, (RUSH_LIMIT - rushElapsed(now)) / RUSH_LIMIT);
}

function rushLoop(): void {
  if (state.view !== "play" || state.pace !== "rush" || state.result) return;
  const now = performance.now();
  const elapsed = rushElapsed(now);
  const bar = document.getElementById("rushfill");
  if (bar instanceof HTMLElement) bar.style.transform = `scaleX(${Math.max(0, 1 - elapsed / RUSH_LIMIT).toFixed(4)})`;
  if (!state.paused && state.rushOrigin && rushExpired(elapsed)) {
    state.rushed = true;
    finish();
    return;
  }
  rushRaf = requestAnimationFrame(rushLoop);
}

function progressValue(): number {
  if (state.target <= 0) return 0;
  if (state.pace === "drift" && state.hideTarget) return 0;
  return Math.min(1, state.taps / state.target);
}

function isArmed(): boolean {
  return !state.result && !state.smashed && state.taps > 0 && state.taps === state.target;
}

function ofText(): string {
  return state.hideTarget ? "hidden" : `of ${state.target}`;
}

function orbLabel(): string {
  if (state.result) return "Play again";
  if (state.hideTarget) return `Count is ${state.taps}. Target hidden.`;
  return `Count is ${state.taps} of ${state.target}.`;
}

function line(): string {
  return coachLine({
    target: state.target,
    pace: state.pace,
    result: state.result,
    smashed: state.smashed,
    rushed: state.rushed,
    hideTarget: state.hideTarget,
  });
}

function armBeat(): void {
  const beat = document.getElementById("beat");
  if (!(beat instanceof HTMLElement)) return;
  beat.classList.remove("run");
  beat.style.opacity = "";
  if (state.pace !== "pulse" || state.result || state.paused || state.lastTap == null || state.smashed) return;
  beat.style.setProperty("--gap", `${PACES.pulse.maxGap ?? 280}ms`);
  if (motionCalm()) {
    beat.style.opacity = "0.4";
    return;
  }
  void beat.offsetWidth;
  beat.classList.add("run");
}

function gem(className: string, p: number): string {
  return `<div class="orb ${className}" style="--p:${p}" data-empty="false" aria-hidden="true"><span class="orb-glow"></span><span class="orb-scale"><span class="orb-progress"></span><span class="orb-head"></span><span class="orb-glass"><span class="orb-sheen"></span></span></span></div>`;
}

function showFault(): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `<header class="topbar"><span class="mark">Hue<em>count</em></span></header><main class="view"><h1 class="title">Something slipped.</h1><p class="lede">Reload Huecount. Your wall and best streak stay on this device.</p></main>`;
}

function headerHTML(): string {
  const pill = state.view === "play"
    ? `<span class="pill${state.newBest ? " pop" : ""}"><i></i>Streak ${save.streak}</span>`
    : "";
  return `<header class="topbar"><button type="button" class="mark" data-act="home">Hue<em>count</em></button><div class="top-actions">${pill}<button type="button" class="iconbtn" data-act="wall" aria-label="Wall">${ICON_WALL}</button><button type="button" class="iconbtn" data-act="settings" aria-label="Settings">${ICON_SET}</button></div></header>`;
}

function chip(kind: "pace" | "world", id: string): string {
  if (kind === "world") {
    if (!isWorld(id)) return "";
    const item = WORLDS[id];
    const on = save.world === id;
    return `<button type="button" class="chip" data-act="pick" data-kind="world" data-arg="${id}" aria-pressed="${on}"><i class="dot" style="background:${item.swatch}"></i>${esc(item.name)}</button>`;
  }
  if (!isPace(id)) return "";
  const item = PACES[id];
  return `<button type="button" class="chip" data-act="pick" data-kind="pace" data-arg="${id}" aria-pressed="${save.pace === id}">${esc(item.name)}</button>`;
}

function homeHTML(): string {
  const pace = PACES[save.pace];
  const dailyDone = save.pace === "daily" && save.dailyStamp === today();
  const install = deferredPrompt && !installed()
    ? `<button type="button" class="quiet" data-act="install">Install app</button>`
    : "";
  const hint = installed() ? "" : `<p class="fine">Add Huecount to your home screen for the full-screen app.</p>`;
  return `${gem("preview", 0.68)}<div class="hero-copy"><h1 class="title">Tap the count.<span>Lock the color.</span></h1><p class="lede">${esc(pace.blurb)}</p>${dailyDone ? `<p class="fine">Today's color is already on the wall.</p>` : ""}</div><div class="statbar" aria-label="Scores saved on this device"><div class="best"><b>${save.bestStreak}</b><span>Best</span></div><div><b>${save.streak}</b><span>Streak</span></div><div><b>${save.locks}</b><span>Locked</span></div></div><div class="group"><p class="label">Pace</p><div class="chips scroll">${PACE_ORDER.map((id) => chip("pace", id)).join("")}</div></div><div class="group"><p class="label">Room</p><div class="chips">${WORLD_ORDER.map((id) => chip("world", id)).join("")}</div></div>${hint}${install}<div class="actions"><button type="button" class="primary" data-act="play">Play</button></div>`;
}

function playOrb(): string {
  const p = progressValue();
  const grade = state.result ? ` data-grade="${state.result}"` : "";
  const empty = p === 0;
  return `<button type="button" class="orb" id="orb" data-act="tap" style="--p:${p.toFixed(4)}"${grade} data-empty="${empty}" data-armed="${isArmed()}" data-over="${state.taps > state.target}" data-smashed="${state.smashed}" aria-label="${esc(orbLabel())}"><span class="orb-glow"></span><span class="orb-beat" id="beat"></span><span class="orb-scale"><span class="orb-progress"></span><span class="orb-head"></span><span class="orb-glass"><span class="orb-sheen"></span><span class="orb-ripple"></span><span class="count" id="count">${state.taps}</span><span class="of${(!state.hideTarget && state.taps > state.target) ? " over" : ""}" id="of">${esc(ofText())}</span></span></span></button>`;
}

function playHTML(): string {
  const pace = PACES[state.pace];
  const world = WORLDS[state.world];
  const badge = badgeLabel(state.result, state.newBest);
  const badgeHTML = badge ? `<p class="badge show${state.result === "smear" ? " warn" : ""}">${esc(badge)}</p>` : "";
  const meter = state.pace === "rush" && !state.result
    ? `<div class="meter" aria-hidden="true"><span id="rushfill" style="transform:scaleX(${rushScale().toFixed(4)})"></span></div>`
    : "";
  const kept = state.pace === "daily" && save.dailyStamp === today() ? " · on the wall today" : "";
  const actions = state.result
    ? `<div class="actions split"><button type="button" class="quiet" data-act="home">Home</button><button type="button" class="primary" data-act="again">Again</button></div>`
    : `<div class="actions split"><button type="button" class="quiet" data-act="pause">Pause</button><button type="button" class="primary" data-act="lock">Lock</button></div>`;
  return `<div class="stage-mid"><p class="where">${esc(world.name)} · ${esc(pace.name)}</p>${badgeHTML}${playOrb()}${meter}<p class="note" id="note" aria-live="polite">${esc(line())}</p><p class="pigment"><i></i>${esc(hueName(state.pigment.h) + kept)}</p></div>${actions}`;
}

function wallHTML(): string {
  const cards = save.wall.map((item) => {
    const when = item.at ? new Date(item.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    const grade = item.grade === "close" ? "Close" : "Exact";
    return `<article class="tile" style="background:${colorCss(item)}"><b>${esc(item.name)}</b><span>${esc(grade)}${when ? ` · ${esc(when)}` : ""}</span></article>`;
  }).join("");
  const body = cards
    ? `<div class="tiles">${cards}</div>`
    : `<div class="empty">${gem("tiny", 0.62)}<p class="lede">No colors yet. Lock an exact count, or miss by one, and the pigment stays here.</p></div>`;
  const countLabel = save.wall.length === 1 ? "1 color" : `${save.wall.length} colors`;
  return `<div class="hero-copy"><h1 class="title">The wall.<span>What locked.</span></h1><p class="lede">Exact locks the color. One away still stays, a little softer. A miss leaves the wall alone.</p><p class="fine">${countLabel}</p></div>${body}`;
}

function toggle(act: string, label: string, on: boolean, hint: string, disabled = false): string {
  return `<div class="setting"><div><b>${esc(label)}</b><small>${esc(hint)}</small></div><button type="button" class="switch" role="switch" data-act="${act}" aria-checked="${on}" aria-label="${esc(label)}"${disabled ? " disabled" : ""}><span></span></button></div>`;
}

function themeButton(id: Save["theme"], label: string): string {
  return `<button type="button" data-act="theme" data-arg="${id}" aria-pressed="${save.theme === id}">${label}</button>`;
}

function settingsHTML(): string {
  const canBuzz = hapticAvailable();
  return `<div class="grabber" aria-hidden="true"></div><div class="group"><p class="label">Settings</p><h2>On this device</h2></div><div class="group"><p class="label">Theme</p><div class="seg">${themeButton("dark", "Dark")}${themeButton("light", "Light")}${themeButton("system", "System")}</div></div><div class="card">${toggle("sound", "Sound", save.sound, "Ticks and the lock chime.")}${toggle("music", "Music", save.music, "A quiet bed under the count.")}${toggle("haptics", "Haptics", save.haptics && canBuzz, canBuzz ? "A short pulse in the hand." : "This browser doesn't vibrate. Taps still press in.", !canBuzz)}${toggle("motion", "Reduce motion", save.reduceMotion, "Stops the pops and the color drift.")}</div><button type="button" class="primary" data-act="close">Done</button>`;
}

function pauseHTML(): string {
  const copy = state.pace === "pulse"
    ? "Pulse timing waits until the next tap."
    : state.pace === "rush"
      ? "The bar waits with you."
      : "Take a breath. Lock when the count feels right.";
  return `<div class="grabber" aria-hidden="true"></div><div class="group"><p class="label">Paused</p><h2>The count holds.</h2><p>${esc(copy)}</p></div><div class="actions split"><button type="button" class="quiet" data-act="leave">Leave</button><button type="button" class="primary" data-act="resume">Resume</button></div>`;
}

function sheetHTML(): string {
  if (!state.sheet) return "";
  const body = state.sheet === "settings" ? settingsHTML() : pauseHTML();
  return `<button type="button" class="scrim" data-act="close" aria-label="Close"></button><div class="sheet-wrap"><section class="sheet" role="dialog" aria-modal="true" tabindex="-1">${body}</section></div>`;
}

function mainHTML(): string {
  if (state.view === "wall") return wallHTML();
  if (state.view === "play") return playHTML();
  return homeHTML();
}

function render(): void {
  const previous = document.querySelector(".view");
  const scroll = previous instanceof HTMLElement ? previous.scrollTop : 0;
  try {
    applyChrome();
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = `${headerHTML()}<main class="view ${state.view}">${mainHTML()}</main>${sheetHTML()}`;
    const next = document.querySelector(".view");
    if (next instanceof HTMLElement) next.scrollTop = scroll;
    if (state.view === "play" && state.pace === "rush" && state.rushOrigin && !state.result) {
      stopRush();
      rushRaf = requestAnimationFrame(rushLoop);
    }
    armBeat();
    const sheet = document.querySelector(".sheet");
    if (sheet instanceof HTMLElement) sheet.focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    showFault();
  }
}

function paintSettings(): void {
  document.querySelectorAll<HTMLElement>("[data-act=theme]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.arg === save.theme));
  });
  const pairs: Array<[string, boolean]> = [
    ["sound", save.sound],
    ["music", save.music],
    ["haptics", save.haptics && hapticAvailable()],
    ["motion", save.reduceMotion],
  ];
  for (const [act, on] of pairs) {
    const button = document.querySelector<HTMLElement>(`[data-act=${act}]`);
    if (button) button.setAttribute("aria-checked", String(on));
  }
  applyChrome();
}

function paintTap(): void {
  const orb = document.getElementById("orb");
  const count = document.getElementById("count");
  const of = document.getElementById("of");
  if (!(orb instanceof HTMLElement) || !(count instanceof HTMLElement) || !(of instanceof HTMLElement)) return;
  count.textContent = String(state.taps);
  of.textContent = ofText();
  of.classList.toggle("over", !state.hideTarget && state.taps > state.target);
  const p = progressValue();
  orb.style.setProperty("--p", p.toFixed(4));
  orb.dataset.empty = String(p === 0);
  orb.dataset.armed = String(isArmed());
  orb.dataset.over = String(state.taps > state.target);
  orb.dataset.smashed = String(state.smashed);
  orb.setAttribute("aria-label", orbLabel());
  const note = document.getElementById("note");
  const nextLine = line();
  if (note && note.textContent !== nextLine) note.textContent = nextLine;
  if (!motionCalm()) {
    orb.classList.remove("is-down");
    count.classList.remove("tick");
    void orb.offsetWidth;
    orb.classList.add("is-down");
    count.classList.add("tick");
  }
  armBeat();
}

async function lockWake(): Promise<void> {
  if (state.view !== "play" || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

function releaseWake(): void {
  if (!wakeLock) return;
  void wakeLock.release().catch(() => undefined);
  wakeLock = null;
}

function holdRound(): void {
  if (state.view !== "play" || state.result || state.paused) return;
  if (state.pace === "rush" && state.rushOrigin && !state.rushHeldAt) state.rushHeldAt = performance.now();
  state.paused = true;
}

function resumeRound(): void {
  state.sheet = null;
  state.paused = false;
  state.heldByHide = false;
  if (state.pace === "pulse") state.lastTap = null;
  if (state.rushHeldAt) {
    state.rushHold += performance.now() - state.rushHeldAt;
    state.rushHeldAt = 0;
  }
  render();
}

function goHome(): void {
  stopRush();
  releaseWake();
  state.view = "home";
  state.sheet = null;
  state.paused = false;
  state.heldByHide = false;
  state.result = null;
  render();
}

function openWall(): void {
  if (state.view === "play" && !state.result && state.taps > 0) {
    holdRound();
    state.sheet = "pause";
    render();
    return;
  }
  stopRush();
  releaseWake();
  state.view = "wall";
  state.sheet = null;
  state.paused = false;
  render();
}

function startRound(): void {
  const pace = isPace(save.pace) ? save.pace : "steady";
  const world = isWorld(save.world) ? save.world : "studio";
  stopRush();
  state.view = "play";
  state.sheet = null;
  state.pace = pace;
  state.world = world;
  state.taps = 0;
  state.target = pickTarget(pace, save);
  state.pigment = makePigment(pace === "daily" ? `daily-${today()}` : `round-${Date.now()}-${Math.random()}`);
  state.lastTap = null;
  state.smashed = false;
  state.rushed = false;
  state.paused = false;
  state.heldByHide = false;
  state.result = null;
  state.hideTarget = false;
  state.rushOrigin = 0;
  state.rushHold = 0;
  state.rushHeldAt = 0;
  state.newBest = false;
  render();
  void lockWake();
  syncMusic(save.music);
}

function finish(): void {
  if (state.result || state.view !== "play") return;
  stopRush();
  const grade = gradeRound(state.taps, state.target, { smashed: state.smashed, rushed: state.rushed });
  state.result = grade;
  state.paused = false;
  state.heldByHide = false;
  state.sheet = null;
  const previousBest = save.bestStreak;
  save.streak = streakAfter(save.streak, grade);
  state.newBest = false;
  if (grade === "exact") {
    save.exacts += 1;
    save.locks += 1;
    save.bestStreak = Math.max(previousBest, save.streak);
    state.newBest = save.streak > previousBest;
    swellMusic(save.music);
  } else if (grade === "close") {
    save.closes += 1;
    save.locks += 1;
    swellMusic(save.music);
  } else {
    save.smears += 1;
    duckMusic(save.music);
  }
  playLock(save.sound, grade);
  const pattern = grade === "exact" ? HAPTIC.exact : grade === "close" ? HAPTIC.close : HAPTIC.smear;
  playHaptic(pattern, save.haptics);
  const already = state.pace === "daily" && save.dailyStamp === today();
  if ((grade === "exact" || grade === "close") && !already) {
    const pigment = wallColor(state.pigment, grade);
    save.wall.unshift({
      h: pigment.h,
      s: pigment.s,
      l: pigment.l,
      name: hueName(pigment.h),
      grade,
      pace: state.pace,
      world: state.world,
      at: Date.now(),
    });
    if (save.wall.length > 80) save.wall.length = 80;
  }
  if ((grade === "exact" || grade === "close") && state.pace === "daily") save.dailyStamp = today();
  if (state.pace === "ramp") save.rampFloor = rampAfter(save.rampFloor, grade);
  if (state.pace === "climb") save.climbRung = climbAfter(save.climbRung, grade);
  persist(save);
  render();
}

function registerTap(now = performance.now()): void {
  if (state.view !== "play" || state.result || state.paused || state.sheet) return;
  const late = state.pace === "pulse" && state.lastTap != null && beatLost(now - state.lastTap);
  if (late) state.smashed = true;
  state.lastTap = now;
  state.taps += 1;
  if (state.pace === "drift") state.hideTarget = true;
  if (state.pace === "rush" && state.taps === 1) {
    state.rushOrigin = now;
    state.rushHold = 0;
    state.rushHeldAt = 0;
    stopRush();
    rushRaf = requestAnimationFrame(rushLoop);
  }
  if (late) playSmearTap(save.sound);
  else if (!state.smashed && state.taps === state.target) playArrival(save.sound);
  else playTap(save.sound, state.taps);
  duckMusic(save.music);
  const pattern = late ? HAPTIC.smash : !state.smashed && state.taps === state.target ? HAPTIC.arrival : HAPTIC.tap;
  playHaptic(pattern, save.haptics);
  paintTap();
}

function onOrb(now: number): void {
  if (now - lastPointer < 35) return;
  lastPointer = now;
  if (state.result) {
    startRound();
    return;
  }
  registerTap(now);
}

const actions: Record<string, (arg?: string, button?: HTMLElement) => void> = {
  home() { goHome(); },
  wall() { openWall(); },
  settings() {
    if (state.view === "play" && !state.result) holdRound();
    state.sheet = "settings";
    render();
  },
  close() {
    if (state.view === "play" && state.paused && !state.result) {
      resumeRound();
      return;
    }
    state.sheet = null;
    render();
  },
  play() { startRound(); },
  again() { startRound(); },
  pause() {
    if (state.view !== "play" || state.result) return;
    holdRound();
    state.sheet = "pause";
    render();
  },
  resume() { resumeRound(); },
  leave() { goHome(); },
  lock() {
    if (state.view !== "play" || state.result) return;
    finish();
  },
  pick(arg, button) {
    if (!arg || !button) return;
    if (button.dataset.kind === "world") {
      if (!isWorld(arg)) return;
      save.world = arg;
    } else {
      if (!isPace(arg)) return;
      save.pace = arg;
    }
    persist(save);
    render();
  },
  theme(arg) {
    if (arg !== "dark" && arg !== "light" && arg !== "system") return;
    save.theme = arg;
    persist(save);
    paintSettings();
  },
  sound() {
    save.sound = !save.sound;
    persist(save);
    if (save.sound) playTap(true, 2);
    paintSettings();
  },
  music() {
    save.music = !save.music;
    persist(save);
    syncMusic(save.music);
    paintSettings();
  },
  haptics() {
    if (!hapticAvailable()) return;
    save.haptics = !save.haptics;
    persist(save);
    if (save.haptics) playHaptic(HAPTIC.tap, true);
    paintSettings();
  },
  motion() {
    save.reduceMotion = !save.reduceMotion;
    persist(save);
    paintSettings();
  },
  install() {
    if (!deferredPrompt) return;
    const pending = deferredPrompt;
    deferredPrompt = null;
    void pending.prompt().finally(() => render());
  },
};

document.body.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const orb = target.closest("[data-act=tap]");
  if (!(orb instanceof HTMLElement)) return;
  event.preventDefault();
  onOrb(performance.now());
}, { passive: false });

document.body.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest("[data-act]");
  if (!(button instanceof HTMLElement)) return;
  const act = button.dataset.act ?? "";
  if (act === "tap") {
    if (event.detail === 0) onOrb(performance.now());
    return;
  }
  actions[act]?.(button.dataset.arg, button);
});

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.key === "Escape" && state.sheet) {
    event.preventDefault();
    actions.close();
    return;
  }
  if (state.view !== "play" || state.sheet || state.result) return;
  if (event.code !== "Space" && event.key !== "Enter") return;
  const el = event.target;
  const onOrbTarget = el instanceof Element && !!el.closest("[data-act=tap]");
  const onBody = el === document.body || el === document.documentElement;
  if (!onOrbTarget && !onBody) return;
  event.preventDefault();
  onOrb(performance.now());
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event as InstallPrompt;
  if (state.view === "home" && !state.sheet) render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (state.view === "play" && !state.result && !state.paused) {
      holdRound();
      state.heldByHide = true;
    }
    return;
  }
  if (state.heldByHide) resumeRound();
  if (state.view === "play" && !state.result) void lockWake();
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (save.theme === "system") applyChrome();
});

window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
  applyChrome();
});

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}
