import "./landing.css";

const orb = document.getElementById("lp-orb");
const n = document.getElementById("lp-n");
const hint = document.getElementById("lp-hint");
let count = 0;
let hue = 250;
orb?.addEventListener("click", () => {
  count += 1;
  hue = (hue + 23) % 360;
  document.documentElement.style.setProperty("--h", String(hue));
  if (n) n.textContent = String(count);
  try { navigator.vibrate?.(8); } catch { /* no haptics */ }
  orb.classList.remove("pop");
  void orb.offsetWidth;
  orb.classList.add("pop");
  if (hint) {
    hint.textContent = count >= 10 ? `Locked hue ${hue}°. Keep going in the full game →` : count >= 3 ? "Nice. Keep tapping…" : "Try it — tap the orb";
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}
