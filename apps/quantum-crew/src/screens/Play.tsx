// A phone in event mode: join a room at a table, then show only what the round needs (own light, valve
// buttons or MEASURE with the dial in use, countdown). Everything else is on the TV.
import { useEffect, useState, type ReactNode } from "react";
import { Countdown } from "../components/Countdown.tsx";
import { Dial } from "../components/Dial.tsx";
import { SensorLight } from "../components/SensorLight.tsx";
import { navigate } from "../lib/router.ts";
import { usePlayer } from "../net/playerStore.ts";
import { useRemainingMs } from "../net/useCountdown.ts";
import { CLOSED, GREEN, OPEN, RED, type Light, type Table, type Valve } from "../shared/chsh.ts";
import { NAME_MAX, ROOM_CODE } from "../shared/protocol.ts";
import { S } from "../strings.ts";

export function Play() {
  const p = usePlayer();
  const [tried, setTried] = useState(false);

  // After a reload, rejoin the seat this tab had.
  useEffect(() => {
    if (!tried) {
      setTried(true);
      if (!p.seat) p.resume();
    }
  }, [tried, p]);

  if (!p.seat) return <JoinForm error={p.error} />;
  if (!p.state || !p.playerId) {
    return (
      <main className="screen screen--center">
        <p className="muted">{p.status === "closed" ? S.event.reconnecting : S.event.connecting}</p>
      </main>
    );
  }
  return <InRoom />;
}

function JoinForm({ error }: { error: string | null }) {
  const join = usePlayer((s) => s.join);
  const params = new URLSearchParams(location.search);
  const [room, setRoom] = useState((params.get("room") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [table, setTable] = useState<Table | null>(null);
  const valid = ROOM_CODE.test(room) && name.trim().length > 0 && table !== null;

  return (
    <main className="screen">
      <p className="kicker">{S.title}</p>
      <h1>{S.phone.title}</h1>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) join({ room, name: name.trim(), table: table! });
        }}
      >
        <label className="field">
          <span className="kicker">{S.phone.code}</span>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            placeholder="ABCD"
            className="input input--code"
          />
        </label>
        <label className="field">
          <span className="kicker">{S.phone.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            autoComplete="nickname"
            className="input"
          />
        </label>
        <div className="field">
          <span className="kicker">{S.phone.pickTable}</span>
          <div className="row" role="radiogroup">
            {(["A", "B"] as const).map((t) => (
              <button
                type="button"
                key={t}
                role="radio"
                aria-checked={table === t}
                className={`btn table-pick ${table === t ? "btn--selected" : ""}`}
                onClick={() => setTable(t)}
              >
                {S.event.table(t)}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="tv__error">{error}</p>}
        <button className="btn btn--primary" disabled={!valid}>
          {S.phone.join}
        </button>
      </form>
      <div className="spacer" />
      <button className="btn btn--ghost" onClick={() => navigate("/")}>
        {S.credits.back}
      </button>
    </main>
  );
}

function InRoom() {
  const p = usePlayer();
  const { state, seat, playerId, round, flash, plan, tuning, status, localDeadline, answer, measure, setPlan, setTuning, leave } = p;
  const left = useRemainingMs(localDeadline);

  // Keyboard for laptop testing: O / C in Act II, Space / Enter = MEASURE in Act III.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "o") answer(OPEN);
      if (k === "c") answer(CLOSED);
      if (k === " " || k === "enter") {
        e.preventDefault();
        measure();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, measure]);

  if (!state || !seat) return null;

  const me = state.players.find((pl) => pl.id === playerId);
  const pair = state.pairs.find((pr) => pr.id === me?.pairId);
  const partner = pair ? (seat.table === "A" ? pair.b : pair.a) : null;
  const otherTable = seat.table === "A" ? "B" : "A";
  const quantum = state.act === 3 && state.phase !== "debrief";
  const wrap = (children: ReactNode) => <div className={quantum ? "quantum" : undefined}>{children}</div>;

  // During a live round the phone shows only the light, the control and the countdown.
  if (round && round.answered === null) {
    return wrap(
      <main className="screen">
        <Countdown id={round.roundId} ms={round.ms} paused={round.measuring} />
        <SensorLight light={round.light} label={S.batch.yourLight} />
        <div className="spacer" />
        {round.act === 2 ? (
          <div className="valves">
            {[OPEN, CLOSED].map((v) => (
              <button key={v} className="btn valve" onPointerDown={() => answer(v)} onClick={() => answer(v)}>
                <span className="valve__icon" aria-hidden="true">
                  {v === OPEN ? "═ ═" : "═╪═"}
                </span>
                {S.valve[v]}
                {plannedValve(plan, round.light) === v && <span className="valve__plan">{S.batch.planTag}</span>}
              </button>
            ))}
          </div>
        ) : (
          <>
            {round.dialDeg !== null && <Dial value={round.dialDeg} small />}
            <button className="btn measure" disabled={round.measuring} onPointerDown={measure} onClick={measure}>
              {S.batch.measure}
            </button>
          </>
        )}
      </main>,
    );
  }

  const tuningPanel = (
    <div className="row panel">
      <Dial value={tuning.greenDeg} onChange={(d) => setTuning({ ...tuning, greenDeg: d })} label={<SensorLight light={GREEN} small />} />
      <Dial value={tuning.redDeg} onChange={(d) => setTuning({ ...tuning, redDeg: d })} label={<SensorLight light={RED} small />} />
    </div>
  );

  return wrap(
    <main className="screen">
      <div className="meter__head">
        <span className="kicker">{S.phone.seat(seat.table, seat.name)}</span>
        {status !== "open" && <span className="kicker">{S.event.reconnecting}</span>}
      </div>
      {partner && <p className="muted">{S.phone.partner(partner.name, otherTable)}</p>}

      {round && round.answered !== null && (
        <div className="result spacer">
          <p className="result__verdict">{S.phone.valveSet(S.valve[round.answered])}</p>
        </div>
      )}

      {!round && flash && (state.phase === "roundResult" || state.phase === "round") && (
        <div className={`result spacer ${flash.win ? "result--win" : "result--loss"}`} role="status">
          <div className="result__verdict">
            {flash.win ? "✓ " : "✗ "}
            {flash.timedOut ? S.batch.slow : flash.win ? S.batch.stable : S.batch.leak}
          </div>
        </div>
      )}

      {!round && state.phase === "tool" && (
        <div className="stack reveal">
          <div className="reveal__crystals" aria-hidden="true">
            <div className="crystal" />
            <div className="crystal" />
          </div>
          <h2 className="reveal__title">{S.tool.title}</h2>
          {S.tool.lines.slice(0, 2).map((l) => (
            <p key={l}>{l}</p>
          ))}
          <p>{S.phone.tuneNow}</p>
          {tuningPanel}
        </div>
      )}

      {!round && state.phase === "strategy" && (
        <div className="stack">
          <h2>{S.phone.huddle}</h2>
          {left !== null && <div className="tv__clock">{Math.ceil(left / 1000)}</div>}
          <p>{state.act === 2 ? S.phone.huddleBody : S.phone.huddleBody3}</p>
          <div className="panel rule">
            <p className="kicker">{S.rule.head}</p>
            <p>{S.rule.body}</p>
          </div>
          {state.act === 2 ? (
            <PlanPicker
              plan={plan}
              onChange={(light, v) => setPlan(light === GREEN ? { ...plan, onGreen: v } : { ...plan, onRed: v })}
            />
          ) : (
            tuningPanel
          )}
        </div>
      )}

      {!round && !me?.pairId && state.phase !== "lobby" && <p className="muted">{S.phone.waitingSeat}</p>}
      {!round && state.phase === "lobby" && <p className="spacer">{S.phone.lobby}</p>}
      {!round && (state.phase === "batchDone" || state.phase === "ceiling" || state.phase === "debrief") && (
        <p className="spacer">{S.phone.watch}</p>
      )}
      {!round && state.phase === "batchDone" && state.act === 3 && (
        <details className="panel">
          <summary className="kicker">{S.phone.retune}</summary>
          {tuningPanel}
        </details>
      )}

      <div className="spacer" />
      <button
        className="btn btn--ghost"
        onClick={() => {
          leave();
          navigate("/");
        }}
      >
        {S.phone.leave}
      </button>
    </main>,
  );
}

const plannedValve = (plan: { onGreen: Valve; onRed: Valve }, light: Light) => (light === GREEN ? plan.onGreen : plan.onRed);

function PlanPicker({ plan, onChange }: { plan: { onGreen: Valve; onRed: Valve }; onChange: (light: Light, v: Valve) => void }) {
  return (
    <div className="panel stack">
      <p className="kicker">{S.phone.plan}</p>
      {([GREEN, RED] as const).map((light) => (
        <div className="stack" key={light}>
          <div className="dial__label">
            <SensorLight light={light} small />
          </div>
          <div className="row" role="radiogroup">
            {[OPEN, CLOSED].map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={plannedValve(plan, light) === v}
                className={`btn ${plannedValve(plan, light) === v ? "btn--selected" : ""}`}
                onClick={() => onChange(light, v)}
              >
                {S.valve[v]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
