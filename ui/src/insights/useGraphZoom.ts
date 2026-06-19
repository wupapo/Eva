import { useCallback, useEffect, useRef, useState } from "react";
import { VB_H, VB_W } from "./useGraphLayout";

/**
 * useGraphZoom — pan + zoom for the Connections graph (Phase 19).
 *
 * It works by animating the SVG's own ``viewBox`` rather than wrapping the nodes
 * in a transformed group. That choice matters: node dragging in useGraphLayout
 * maps pointer coordinates through ``getScreenCTM()``, which already reflects the
 * live viewBox — so zoom and drag compose correctly with no extra maths, and the
 * force layout keeps running in its own untouched 0…820 × 0…600 space.
 *
 * The signature interaction is ``focusOn``: tapping a node smoothly frames it and
 * its neighbours, turning the whole web into something you explore by touch (a
 * star-map of the self) instead of squinting at a fixed thumbnail. Plain wheel
 * zoom is gated behind a modifier while inline so the page can still scroll past
 * the graph; in the expanded view the graph owns the wheel.
 */

export type ViewBox = { x: number; y: number; w: number; h: number };

const ASPECT = VB_H / VB_W;
const FULL: ViewBox = { x: 0, y: 0, w: VB_W, h: VB_H };
const MIN_W = VB_W * 0.24; // closest zoom-in (a single cluster fills the frame)
const MAX_W = VB_W; // never zoom out past the whole world
const PAN_MARGIN = 0.12 * VB_W; // how far past the edges a pan may drift

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Keep a viewBox sane: clamp the zoom, keep aspect, and keep the world in view. */
function clampVb(vb: ViewBox): ViewBox {
  const w = Math.max(MIN_W, Math.min(MAX_W, vb.w));
  const h = w * ASPECT;
  const minX = -PAN_MARGIN;
  const maxX = VB_W - w + PAN_MARGIN;
  const minY = -PAN_MARGIN;
  const maxY = VB_H - h + PAN_MARGIN;
  const x = maxX >= minX ? Math.max(minX, Math.min(maxX, vb.x)) : (VB_W - w) / 2;
  const y = maxY >= minY ? Math.max(minY, Math.min(maxY, vb.y)) : (VB_H - h) / 2;
  return { x, y, w, h };
}

export type GraphZoom = {
  vb: ViewBox;
  /** True while zoomed past the resting full view (controls the Reset button). */
  zoomed: boolean;
  /** Begin a background pan from a pointerdown on the canvas backdrop. */
  beginPan: (e: React.PointerEvent) => void;
  /** Did the last background gesture move (so a click shouldn't deselect)? */
  didPan: () => boolean;
  /** Smoothly frame a set of points (a node and its neighbours). */
  focusOn: (pts: { x: number; y: number }[]) => void;
  /** Smoothly return to the full graph. */
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export function useGraphZoom(
  svgRef: React.RefObject<SVGSVGElement>,
  wheelAlways: boolean,
  ready: boolean,
): GraphZoom {
  const [vb, setVbState] = useState<ViewBox>(FULL);
  const vbRef = useRef(vb);
  const tween = useRef(0);
  const pan = useRef<{ cx: number; cy: number; vb: ViewBox; moved: boolean } | null>(null);

  const cancelTween = () => {
    if (tween.current) cancelAnimationFrame(tween.current);
    tween.current = 0;
  };

  const commit = useCallback((next: ViewBox) => {
    const c = clampVb(next);
    vbRef.current = c;
    setVbState(c);
  }, []);

  const setNow = useCallback(
    (next: ViewBox) => {
      cancelTween();
      commit(next);
    },
    [commit],
  );

  const animateTo = useCallback(
    (target: ViewBox) => {
      cancelTween();
      const to = clampVb(target);
      if (prefersReducedMotion()) {
        commit(to);
        return;
      }
      const from = vbRef.current;
      // Drive the tween by frame count rather than wall-clock time: ~20 frames is
      // a smooth ~⅓s at 60fps, and it stays correct even where the page clock is
      // coarse or frozen (some sandboxed/automation renderers), which a
      // time-delta tween would stall on.
      const FRAMES = 20;
      let i = 0;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
      const frame = () => {
        i += 1;
        const t = Math.min(1, i / FRAMES);
        const k = ease(t);
        const cur = {
          x: from.x + (to.x - from.x) * k,
          y: from.y + (to.y - from.y) * k,
          w: from.w + (to.w - from.w) * k,
          h: from.h + (to.h - from.h) * k,
        };
        vbRef.current = cur;
        setVbState(cur);
        if (t < 1) tween.current = requestAnimationFrame(frame);
        else tween.current = 0;
      };
      tween.current = requestAnimationFrame(frame);
    },
    [commit],
  );

  // Map a screen point to SVG user space using the live CTM (viewBox-aware).
  const clientToSvg = useCallback(
    (cx: number, cy: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = cx;
      pt.y = cy;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const p = pt.matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [svgRef],
  );

  // Zoom by `factor` keeping the point under (cx,cy) fixed on screen.
  const zoomAtClient = useCallback(
    (cx: number, cy: number, factor: number) => {
      const v = vbRef.current;
      const p = clientToSvg(cx, cy) ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      const newW = Math.max(MIN_W, Math.min(MAX_W, v.w * factor));
      const newH = newW * ASPECT;
      const nx = p.x - (p.x - v.x) * (newW / v.w);
      const ny = p.y - (p.y - v.y) * (newH / v.h);
      setNow({ x: nx, y: ny, w: newW, h: newH });
    },
    [clientToSvg, setNow],
  );

  // Zoom around the current centre (the +/- buttons).
  const zoomCenter = useCallback(
    (factor: number) => {
      const v = vbRef.current;
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      const newW = Math.max(MIN_W, Math.min(MAX_W, v.w * factor));
      const newH = newW * ASPECT;
      animateTo({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH });
    },
    [animateTo],
  );

  // Native non-passive wheel listener so we can preventDefault (React's onWheel
  // is passive). Inline, plain wheel scrolls the page; ⌘/Ctrl-wheel zooms. When
  // expanded, the graph owns the wheel.
  // `ready` is in the deps so the listener (re)attaches once the SVG actually
  // mounts — the graph renders only after its data loads, so an effect keyed on
  // the stable ref alone would bind to nothing and wheel-zoom would never work.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !ready) return;
    const onWheel = (e: WheelEvent) => {
      if (!wheelAlways && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomAtClient(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef, zoomAtClient, wheelAlways, ready]);

  const beginPan = useCallback(
    (e: React.PointerEvent) => {
      cancelTween();
      const rect = svgRef.current?.getBoundingClientRect();
      pan.current = { cx: e.clientX, cy: e.clientY, vb: vbRef.current, moved: false };
      const onMove = (ev: PointerEvent) => {
        const st = pan.current;
        if (!st || !rect) return;
        const dx = ev.clientX - st.cx;
        const dy = ev.clientY - st.cy;
        if (Math.abs(dx) + Math.abs(dy) > 3) st.moved = true;
        commit({
          x: st.vb.x - (dx * st.vb.w) / rect.width,
          y: st.vb.y - (dy * st.vb.h) / rect.height,
          w: st.vb.w,
          h: st.vb.h,
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [commit, svgRef],
  );

  const didPan = useCallback(() => pan.current?.moved ?? false, []);

  const focusOn = useCallback(
    (pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const padX = Math.max(80, (maxX - minX) * 0.4);
      const padY = Math.max(80, (maxY - minY) * 0.4);
      let w = maxX - minX + padX * 2;
      let h = maxY - minY + padY * 2;
      // Grow the short side so the frame keeps the canvas aspect (no squish).
      if (w / h > VB_W / VB_H) h = w * ASPECT;
      else w = h / ASPECT;
      w = Math.max(MIN_W, Math.min(MAX_W, w));
      h = w * ASPECT;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      animateTo({ x: cx - w / 2, y: cy - h / 2, w, h });
    },
    [animateTo],
  );

  const reset = useCallback(() => animateTo(FULL), [animateTo]);

  useEffect(() => cancelTween, []);

  const zoomed = vb.w < VB_W - 1 || vb.x !== 0 || vb.y !== 0;

  return {
    vb,
    zoomed,
    beginPan,
    didPan,
    focusOn,
    reset,
    zoomIn: () => zoomCenter(0.7),
    zoomOut: () => zoomCenter(1 / 0.7),
  };
}
