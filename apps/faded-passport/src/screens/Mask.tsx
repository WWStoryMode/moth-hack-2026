// "Who are you?" — the player draws around their face. That outline becomes TeleBlur's mask:
// the quantum morph only happens inside it, so the player chooses what of themselves fades.
import { useEffect, useRef, useState } from "react";
import { SIZE } from "../config.ts";
import { Officer } from "../components/Officer.tsx";
import { Paper } from "../components/Paper.tsx";
import { areaFraction, renderMask, smooth, tracePath, type Point, type Stroke } from "../lib/mask.ts";
import { S } from "../strings.ts";

const MIN_AREA = 0.02; // a face outline smaller than 2% of the photo is almost certainly a slip

export function MaskScreen(props: { portraitUrl: string; onDone: (mask: Blob) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const current = useRef<Point[] | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"draw" | "move">("draw");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redraw = () => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#b3261e";
    ctx.fillStyle = "rgba(179,38,30,0.18)";
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
      <Officer line={S.mask.officer} />
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
          props.onDone(await renderMask(strokes));
        }}
      >
        {S.mask.next}
      </button>
    </Paper>
  );
}
