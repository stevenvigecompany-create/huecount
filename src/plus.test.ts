import { describe, expect, it } from "vitest";
import { hashesMatch, isHttpsUrl, matchRestoreCode, playSound, playWorld, plusConfigFrom, plusReady, sha256Hex, stripPlusParam } from "./plus.ts";

describe("plusConfigFrom", () => {
  it("keeps an https payment link and a 64-character hash", () => {
    const hash = "a".repeat(64);
    const config = plusConfigFrom("  https://buy.stripe.com/test_abc  ", hash.toUpperCase());
    expect(config.unlockUrl).toBe("https://buy.stripe.com/test_abc");
    expect(config.codeHash).toBe(hash);
    expect(plusReady(config)).toBe(true);
  });

  it("drops a missing or unsafe link", () => {
    expect(plusConfigFrom("", "ab").unlockUrl).toBe("");
    expect(plusConfigFrom("http://buy.stripe.com/test", "ab").unlockUrl).toBe("");
    expect(plusConfigFrom("javascript:alert(1)", "ab").unlockUrl).toBe("");
    expect(plusReady(plusConfigFrom("", ""))).toBe(false);
    expect(isHttpsUrl("https://huecount.vercel.app/play")).toBe(true);
  });

  it("rejects a hash that is not sha256 hex", () => {
    expect(plusConfigFrom("https://buy.stripe.com/test", "not-a-hash").codeHash).toBe("");
    expect(plusConfigFrom("https://buy.stripe.com/test", "abcd").codeHash).toBe("");
  });
});

describe("matchRestoreCode", () => {
  it("accepts the code that hashes to the configured digest", async () => {
    const code = "huecount-test-code";
    const config = plusConfigFrom("https://buy.stripe.com/test", await sha256Hex(code));
    expect(await matchRestoreCode(`  ${code}  `, config)).toBe("ok");
    expect(await matchRestoreCode("nope-nope", config)).toBe("miss");
  });

  it("stays closed when the hash was not configured", async () => {
    const config = plusConfigFrom("https://buy.stripe.com/test", "");
    expect(await matchRestoreCode("huecount-test-code", config)).toBe("unconfigured");
  });

  it("compares hashes without bailing on the first difference", () => {
    expect(hashesMatch("ab", "ab")).toBe(true);
    expect(hashesMatch("ab", "ac")).toBe(false);
    expect(hashesMatch("ab", "abc")).toBe(false);
    expect(hashesMatch("", "")).toBe(false);
  });
});

describe("entitlements", () => {
  it("keeps Studio and Tick without Plus", () => {
    expect(playWorld("studio", false)).toBe("studio");
    expect(playWorld("dusk", false)).toBe("studio");
    expect(playWorld("field", true)).toBe("field");
    expect(playSound("tick", false)).toBe("tick");
    expect(playSound("glass", false)).toBe("tick");
    expect(playSound("wood", true)).toBe("wood");
  });
});

describe("stripPlusParam", () => {
  it("reads the restore code and drops it from the address", () => {
    const { code, next } = stripPlusParam("https://huecount.vercel.app/play?plus=secret-code&x=1#top");
    expect(code).toBe("secret-code");
    expect(next).toBe("/play?x=1#top");
  });

  it("leaves a bare play url alone", () => {
    expect(stripPlusParam("https://huecount.vercel.app/play").code).toBeNull();
    expect(stripPlusParam("https://huecount.vercel.app/play").next).toBe("/play");
  });
});
