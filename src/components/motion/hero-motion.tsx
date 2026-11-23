"use client";

import { useEffect, useRef } from "react";

/**
 * Hero motion, loaded after hydration (GSAP is imported on demand so it never
 * blocks first paint) and skipped entirely for prefers-reduced-motion:
 *  - stat counters tick up from 85% to their real value (no jarring reset to 0)
 *  - the hero wheel rolls slowly; scrolling adds momentum that eases back off
 *    (scrolling up rolls it backwards), and it pauses while the hero is off screen
 * Entrance effects are CSS animations so they run from the very first paint.
 */
export function HeroMotion() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = ref.current?.closest<HTMLElement>("[data-hero]");
    if (!root) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("gsap").then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        const format = new Intl.NumberFormat("en-US");
        root.querySelectorAll<HTMLElement>("[data-count-to]").forEach((el) => {
          const target = Number(el.dataset.countTo);
          if (!Number.isFinite(target) || target < 20) return;
          const counter = { value: Math.round(target * 0.85) };
          gsap.to(counter, {
            value: target,
            duration: 1.4,
            ease: "power3.out",
            delay: 0.15,
            onUpdate: () => {
              el.textContent = format.format(Math.round(counter.value));
            },
          });
        });
      }, root);

      cleanup = () => ctx.revert();
    });

    const stopWheel = startWheel(root);

    return () => {
      cancelled = true;
      cleanup?.();
      stopWheel();
    };
  }, []);

  return <span ref={ref} hidden />;
}

/** Base roll speed (deg/s), scroll impulse per pixel, and how fast momentum decays (1/s). */
const BASE_SPEED = 7.5;
const SCROLL_GAIN = 1.1;
const MAX_SPEED = 320;
const FRICTION = 1.8;

function currentAngle(el: Element): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  const m = new DOMMatrixReadOnly(t);
  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
}

/**
 * Drives every [data-wheel-rotor] layer with a tiny physics loop: constant roll plus
 * scroll-driven velocity with exponential friction. Picks up from the CSS animation's
 * current angle so there's no jump, and only runs while the hero is visible.
 */
function startWheel(root: HTMLElement): () => void {
  const rotors = [...root.querySelectorAll<SVGGElement>("[data-wheel-rotor]")];
  if (rotors.length === 0) return () => undefined;

  let angle = currentAngle(rotors[0]);
  let boost = 0;
  let lastY = window.scrollY;
  let lastT = 0;
  let frame = 0;
  let visible = true;

  for (const r of rotors) {
    r.style.animation = "none";
    r.style.transform = `rotate(${angle}deg)`;
    r.style.willChange = "transform";
  }

  const tick = (t: number) => {
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0;
    lastT = t;
    boost *= Math.exp(-FRICTION * dt);
    if (Math.abs(boost) < 0.05) boost = 0;
    angle = (angle + (BASE_SPEED + boost) * dt) % 360;
    const value = `rotate(${angle.toFixed(3)}deg)`;
    for (const r of rotors) r.style.transform = value;
    frame = visible ? requestAnimationFrame(tick) : 0;
  };

  const onScroll = () => {
    const y = window.scrollY;
    boost = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, boost + (y - lastY) * SCROLL_GAIN));
    lastY = y;
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !frame) {
      lastT = 0;
      lastY = window.scrollY;
      frame = requestAnimationFrame(tick);
    }
  });

  observer.observe(root);
  window.addEventListener("scroll", onScroll, { passive: true });
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    for (const r of rotors) {
      r.style.animation = "";
      r.style.transform = "";
      r.style.willChange = "";
    }
  };
}
