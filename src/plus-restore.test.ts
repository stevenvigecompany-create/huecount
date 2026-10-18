import { describe, expect, it } from "vitest";
import { restoreNote, serverRestore, shouldKeepPending } from "./plus.ts";

const fake = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const offline = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
const CODE = "a1b2c3d4e5f6a7b8";

describe("serverRestore outcomes (money path after Stripe redirect)", () => {
  it("ok with token", async () => {
    expect(await serverRestore(CODE, fake(200, { result: "ok", token: "t.s" }))).toEqual({ result: "ok", token: "t.s" });
  });
  it("offline / 5xx / ok-without-token are 'error', not 'miss'", async () => {
    expect((await serverRestore(CODE, offline)).result).toBe("error");
    expect((await serverRestore(CODE, fake(500, { error: "boom" }))).result).toBe("error");
    expect((await serverRestore(CODE, fake(200, { result: "ok" }))).result).toBe("error");
  });
  it("429 is 'slow'; a real mismatch is 'miss'; unconfigured passes through", async () => {
    expect((await serverRestore(CODE, fake(429, { result: "slow" }))).result).toBe("slow");
    expect((await serverRestore(CODE, fake(200, { result: "miss" }))).result).toBe("miss");
    expect((await serverRestore(CODE, fake(200, { result: "unconfigured" }))).result).toBe("unconfigured");
  });
});

describe("restore copy + pending code", () => {
  it("never tells a paying buyer their code is wrong when the network failed", () => {
    expect(restoreNote("error")).not.toMatch(/doesn't match/);
    expect(restoreNote("error")).toMatch(/try again/i);
    expect(restoreNote("slow")).toMatch(/wait/i);
    expect(restoreNote("miss")).toBe("That code doesn't match.");
    expect(restoreNote("unconfigured")).toBe("Plus coming soon.");
  });
  it("keeps the code only for retryable outcomes", () => {
    expect(shouldKeepPending("error")).toBe(true);
    expect(shouldKeepPending("slow")).toBe(true);
    for (const r of ["ok", "miss", "unconfigured"] as const) expect(shouldKeepPending(r)).toBe(false);
  });
});
