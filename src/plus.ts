import type { SoundPack } from "./audio.ts";
import { WORLDS, type WorldId } from "./logic.ts";

export const PLUS_PRICE = "$3";

export interface PlusConfig {
  unlockUrl: string;
  codeHash: string;
}

export type RestoreResult = "ok" | "miss" | "unconfigured";

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function plusConfigFrom(unlockUrl: string, codeHash: string): PlusConfig {
  const url = unlockUrl.trim();
  const hash = codeHash.trim().toLowerCase();
  return {
    unlockUrl: isHttpsUrl(url) ? url : "",
    codeHash: /^[a-f0-9]{64}$/.test(hash) ? hash : "",
  };
}

export function currentPlusConfig(): PlusConfig {
  const env = import.meta.env;
  const unlockUrl = env.VITE_UNLOCK_URL || env.NEXT_PUBLIC_UNLOCK_URL || "";
  const codeHash = env.VITE_PLUS_CODE_SHA256 || env.NEXT_PUBLIC_PLUS_CODE_SHA256 || "";
  return plusConfigFrom(String(unlockUrl), String(codeHash));
}

export function plusReady(config: PlusConfig): boolean {
  return config.unlockUrl.length > 0;
}

export function worldNeedsPlus(id: WorldId): boolean {
  return WORLDS[id].plus;
}

export function soundNeedsPlus(id: SoundPack): boolean {
  return id !== "tick";
}

export function playWorld(id: WorldId, plus: boolean): WorldId {
  if (plus || !worldNeedsPlus(id)) return id;
  return "studio";
}

export function playSound(id: SoundPack, plus: boolean): SoundPack {
  if (plus || !soundNeedsPlus(id)) return id;
  return "tick";
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function matchRestoreCode(code: string, config: PlusConfig): Promise<RestoreResult> {
  if (!config.codeHash) return "unconfigured";
  const trimmed = code.trim();
  if (trimmed.length < 4 || trimmed.length > 80) return "miss";
  const hash = await sha256Hex(trimmed);
  return hashesMatch(hash, config.codeHash) ? "ok" : "miss";
}

export function stripPlusParam(href: string): { code: string | null; next: string } {
  const url = new URL(href, "https://huecount.local");
  const code = url.searchParams.get("plus");
  url.searchParams.delete("plus");
  const search = url.searchParams.toString();
  const next = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  return { code, next };
}
