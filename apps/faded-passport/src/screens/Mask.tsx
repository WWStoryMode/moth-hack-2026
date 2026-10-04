// "Who are you?" — the player draws around their face. That outline becomes Teleblur's mask:
// the quantum morph only happens inside it, so the player chooses what of themselves fades.
import { useEffect, useRef, useState } from "react";
import { SIZE } from "../config.ts";
import { BoothWindow } from "../components/BoothWindow.tsx";
import { Paper } from "../components/Paper.tsx";
import { DEBUG } from "../lib/debug.ts"; // ?debug: preview the outline and the exact mask sent to Teleblur
import { cssVar } from "../lib/tokens.ts";
import { areaFraction, engineMask, maskRangeLabel, renderMask, smooth, tracePath, type Point, type Stroke } from "../lib/mask.ts";
import { S } from "../strings.ts";

const MIN_AREA = 0.02; // a face outline smaller than 2% of the photo is almost certainly a slip

/** `outline`: the drawn face (for the verdict); `engine`: the mask actually sent to Teleblur. */
export function MaskScreen(props: { portraitUrl: string; onDone: (masks: { outline: Blob; engine: Blob }) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const current = useRef<Point[] | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"draw" | "move">("draw");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ outline: string; engine: string } | null>(null);

  useEffect(() => {
    if (!DEBUG || !strokes.length) return setPreview(null);
    let urls: { outline: string; engine: string } | undefined;
    let live = true;
    (async () => {
      const outline = await renderMask(strokes);
      const engine = await engineMask(props.portraitUrl, outline);
      if (!live) return;
      urls = { outline: URL.createObjectURL(outline), engine: URL.createObjectURL(engine) };
      setPreview(urls);
    })();
    return () => {
      live = false;
      if (urls) for (const u of Object.values(urls)) URL.revokeObjectURL(u);
    };
  }, [strokes, props.portraitUrl]);

  const redraw = () => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = cssVar("--stamp", "#b3261e");
    ctx.fillStyle = cssVar("--stamp-tint", "rgba(179,38,30,0.18)");
    for (const s of strokes) {
      ctx.beginPath();
      tracePath(ctx, s);
      ctx.fill();
      ctx.setLineDash([8, 6]);
      ctx.stroke();
    }
    const c = current.current;
    if (c && c.length > 1) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(c[0]!.x, c[0]!.y);
      for (const p of c.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };
  useEffect(redraw, [strokes]);

  // Centre the view when zooming in, so the face (usually central) is on screen.
  useEffect(() => {
    const v = view.current;
    if (v && zoom === 2) {
      v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2;
      v.scrollTop = (v.scrollHeight - v.clientHeight) / 2;
    }
    if (zoom === 1) setMode("draw");
  }, [zoom]);

  const toImage = (e: React.PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  const drawing = mode === "draw";

  return (
    <Paper step="3 / 4">
      <BoothWindow line={S.mask.officer} />
      <p className="hint">{note ?? S.mask.hint}</p>
      <div ref={view} className="mask-view" style={{ overflow: zoom > 1 ? "auto" : "hidden" }}>
        <div className="mask-inner" style={{ width: `${zoom * 100}%` }}>
          <img src={props.portraitUrl} alt="Your passport photo" draggable={false} />
          <canvas
            ref={canvas}
            width={SIZE}
            height={SIZE}
            style={{ touchAction: drawing ? "none" : "pan-x pan-y" }}
            onPointerDown={(e) => {
              if (!drawing) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              current.current = [toImage(e)];
              setNote(null);
            }}
            onPointerMove={(e) => {
              const c = current.current;
              if (!c) return;
              const p = toImage(e);
              const last = c[c.length - 1]!;
              if (Math.hypot(p.x - last.x, p.y - last.y) > 2) c.push(p);
              redraw();
            }}
            onPointerUp={() => {
              const c = current.current;
              current.current = null;
              if (!c || c.length < 10) return redraw();
              const loop = smooth(c); // auto-closed on release
              if (areaFraction(loop) < MIN_AREA) {
                setNote(S.mask.tooSmall);
                return redraw();
              }
              setStrokes((s) => [...s, loop]);
            }}
            onPointerCancel={() => {
              current.current = null;
              redraw();
            }}
          />
        </div>
      </div>
      {preview && (
        <figure className="mask-preview">
          <img src={preview.outline} alt="Your drawn outline" />
          <img src={preview.engine} alt="The mask sent to Teleblur" />
          <figcaption>
            Left: your outline. Right: the {SIZE}×{SIZE} mask sent to Teleblur (portrait brightness {maskRangeLabel()}).
            White = morphed into home, black = your photo unchanged, grey = in between.
          </figcaption>
        </figure>
      )}
      <div className="row">
        <button type="button" className="secondary" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
          {S.mask.undo}
        </button>
        <button type="button" className="secondary" disabled={!strokes.length} onClick={() => setStrokes([])}>
          {S.mask.clear}
        </button>
        <button type="button" className="secondary" aria-pressed={zoom === 2} onClick={() => setZoom(zoom === 1 ? 2 : 1)}>
          {S.mask.zoom} {zoom === 1 ? "2×" : "1×"}
        </button>
        {zoom === 2 && (
          <button type="button" className="secondary" onClick={() => setMode(drawing ? "move" : "draw")}>
            {drawing ? S.mask.move : S.mask.draw}
          </button>
        )}
      </div>
      <button
        type="button"
        className="primary"
        disabled={!strokes.length || busy}
        onClick={async () => {
          setBusy(true);
          const outline = await renderMask(strokes);
          props.onDone({ outline, engine: await engineMask(props.portraitUrl, outline) });
        }}
      >
        {S.mask.next}
      </button>
    </Paper>
  );
}
