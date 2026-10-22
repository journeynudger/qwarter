"use client";

import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";

import { setMotionPaused, useMotion } from "@/components/paper/motion";

/**
 * Paper shaders in carried markup.
 *
 * A page's body is the reference design's own HTML (content/pages/<slug>.html), so a
 * shader cannot be written into it as a React element. Instead a surface asks for one:
 *
 *   <section data-paper-shader="MeshGradient"
 *            data-paper-params='{"colors":["#0b0b0b","#1d1d1f"],"distortion":0.6}'
 *            data-paper-speed="0.12">
 *
 * and this island, mounted once by the layout, draws the shader as the surface's first
 * child: absolutely positioned behind the content, aria-hidden, pointer-events none.
 * The surface's own background stays as the fallback while WebGL loads or where it is
 * missing. Optional attributes:
 *
 *   data-paper-speed     motion speed while moving (0 for a still shader)
 *   data-paper-opacity   how much of the shader shows through (Verowater settled on 0.5)
 *   data-paper-pause     "off" to omit the pause button (only for a surface that does not move)
 *
 * Verowater's rules carry over: the shaders stop for reduced motion and for the visitor's
 * pause, the library stops drawing off screen and in hidden tabs, and the render
 * resolution is capped (soft light looks the same at a fraction of the pixels).
 */

const SHADERS = {
  MeshGradient: lazy(() => import("@/components/paper/shaders").then((m) => ({ default: m.MeshGradient }))),
  Water: lazy(() => import("@/components/paper/shaders").then((m) => ({ default: m.Water }))),
  GrainGradient: lazy(() => import("@/components/paper/shaders").then((m) => ({ default: m.GrainGradient }))),
  PaperTexture: lazy(() => import("@/components/paper/shaders").then((m) => ({ default: m.PaperTexture }))),
} as unknown as Record<string, ComponentType<Record<string, unknown>>>;

const RESOLUTION = { minPixelRatio: 1, maxPixelCount: 1280 * 800 } as const;
const FILL = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;

/** A stable starting point per surface, so two surfaces on one page never move in step. */
export function frameFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 60000;
}

function Surface({ name, params, speed, opacity, seed }: { name: string; params: Record<string, unknown>; speed: number; opacity: number; seed: string }) {
  const motion = useMotion();
  const Shader = SHADERS[name];
  return (
    <div style={{ ...FILL, opacity }}>
      <Suspense fallback={null}>
        <Shader {...params} speed={motion === "moving" ? speed : 0} frame={frameFor(seed)} {...RESOLUTION} style={FILL} />
      </Suspense>
    </div>
  );
}

function PauseButton() {
  const motion = useMotion();
  if (motion === "reduced") return null;
  const moving = motion === "moving";
  const label = moving ? "Pause background animation" : "Play background animation";
  return (
    <button type="button" className="paper-pause" onClick={() => setMotionPaused(moving)} title={label} aria-label={label}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
        {moving ? <path d="M4 2h3v12H4zM9 2h3v12H9z" /> : <path d="M4 2l10 6-10 6z" />}
      </svg>
    </button>
  );
}

function parseParams(raw: string | undefined, where: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch {
    console.error(`paper shader on ${where}: data-paper-params is not JSON`);
    return {};
  }
}

export function PaperShaders() {
  useEffect(() => {
    const mounted: { root: Root; host: HTMLElement }[] = [];
    document.querySelectorAll<HTMLElement>("[data-paper-shader]").forEach((surface, i) => {
      const name = surface.dataset.paperShader ?? "";
      if (!(name in SHADERS)) {
        console.error(`paper shader "${name}" is not one of ${Object.keys(SHADERS).join(", ")}`);
        return;
      }
      if (getComputedStyle(surface).position === "static") surface.style.position = "relative";
      surface.style.isolation = "isolate";
      const where = surface.id || surface.className || `surface ${i}`;
      const speed = Number(surface.dataset.paperSpeed ?? 0.15);

      const host = document.createElement("div");
      host.className = "paper-shader-host";
      host.setAttribute("aria-hidden", "true");
      surface.prepend(host);
      const root = createRoot(host);
      root.render(
        <Surface
          name={name}
          params={parseParams(surface.dataset.paperParams, where)}
          speed={speed}
          opacity={Number(surface.dataset.paperOpacity ?? 1)}
          seed={`${location.pathname}#${i}`}
        />,
      );
      mounted.push({ root, host });

      if (speed > 0 && surface.dataset.paperPause !== "off") {
        const pauseHost = document.createElement("div");
        pauseHost.className = "paper-pause-host";
        surface.append(pauseHost);
        const pauseRoot = createRoot(pauseHost);
        pauseRoot.render(<PauseButton />);
        mounted.push({ root: pauseRoot, host: pauseHost });
      }
    });
    return () => {
      for (const { root, host } of mounted) {
        root.unmount();
        host.remove();
      }
    };
  }, []);
  return null;
}
