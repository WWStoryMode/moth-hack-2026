// Hand the passport over by dragging it into the booth's document slot. Pointer events, so it works
// with touch and mouse. A missed drop springs back. A real "Hand it over" button (tap, Enter, Space)
// runs the same slide-through animation, so nobody has to drag.
import { useRef, useState, type ReactNode, type RefObject } from "react";

type State = "idle" | "dragging" | "returning" | "posting";

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function DragToSlot(props: {
  slotRef: RefObject<HTMLDivElement | null>;
  onDone: () => void;
  buttonLabel: string;
  hint: string;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  const grab = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [state, setState] = useState<State>("idle");

  /** Slide the card into the slot and through it, then continue exactly as the old button did. */
  const post = (from = offset) => {
    const el = card.current;
    const slot = props.slotRef.current;
    if (!el || state === "posting") return;
    setState("posting");
    if (!slot || reducedMotion()) {
      const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
      a.onfinish = () => props.onDone();
      return;
    }
    const r = el.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    // Card geometry without the current drag offset.
    const left = r.left - from.x;
    const top = r.top - from.y;
    const scale = Math.min(1, (s.width * 0.82) / r.width);
    const dx = s.left + s.width / 2 - (left + r.width / 2);
    // The card's top edge meets the slot line, then the card rises through it while everything that
    // has passed the line is clipped away (it's inside the booth now).
    const atSlot = s.top + s.height / 2 - top;
    const through = atSlot - r.height * scale;
    const T = (x: number, y: number, k: number) => `translate(${x}px, ${y}px) scale(${k})`;
    el.style.transformOrigin = "0 0"; // so the maths above holds
    const a = el.animate(
      [
        { transform: T(from.x, from.y, 1), clipPath: "inset(0 0 0 0)" },
        { transform: T(dx, atSlot, scale), clipPath: "inset(0 0 0 0)", offset: 0.5 },
        { transform: T(dx, through, scale), clipPath: "inset(100% 0 0 0)" },
      ],
      { duration: 700, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" },
    );
    a.onfinish = () => props.onDone();
  };

  const hitsSlot = (x: number, y: number) => {
    const slot = props.slotRef.current;
    const el = card.current;
    if (!slot || !el) return false;
    const s = slot.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    // Forgiving target: the pointer, or the card's top edge, near the slot.
    const near = (px: number, py: number) => px > s.left - 40 && px < s.right + 40 && py > s.top - 90 && py < s.bottom + 60;
    return near(x, y) || near(c.left + c.width / 2, c.top);
  };

  return (
    <div className="handover">
      <div
        ref={card}
        className={`drag-card drag-${state}`}
        style={state === "posting" ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onPointerDown={(e) => {
          if (state === "posting") return;
          e.currentTarget.setPointerCapture(e.pointerId);
          grab.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
          setState("dragging");
        }}
        onPointerMove={(e) => {
          if (!grab.current) return;
          setOffset({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y });
        }}
        onPointerUp={(e) => {
          if (!grab.current) return;
          grab.current = null;
          if (hitsSlot(e.clientX, e.clientY)) post();
          else {
            setState("returning");
            setOffset({ x: 0, y: 0 });
          }
        }}
        onPointerCancel={() => {
          grab.current = null;
          setState("returning");
          setOffset({ x: 0, y: 0 });
        }}
        onTransitionEnd={() => state === "returning" && setState("idle")}
      >
        {props.children}
      </div>
      <p className="fineprint handover-hint">{props.hint}</p>
      <button type="button" className="text-button" onClick={() => post()} disabled={state === "posting"}>
        {props.buttonLabel}
      </button>
    </div>
  );
}
