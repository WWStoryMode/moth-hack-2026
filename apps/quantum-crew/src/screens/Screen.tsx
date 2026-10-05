// The shared TV / projector: room code + QR, the station, pooled stability, per-pair meters, round timer,
// and the facilitator's host controls. Readable from across a room.
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Countdown } from "../components/Countdown.tsx";
import { StabilityMeter, pct } from "../components/StabilityMeter.tsx";
import { atlasUrl, isVideo } from "../assets/atlas/manifest.ts";
import { playSfx } from "../audio/sfx.ts";
import { CreditsList } from "../components/CreditsList.tsx";
import { CrewIcon } from "../components/CrewIcon.tsx";
import { MuteToggle } from "../components/MuteToggle.tsx";
import { QuantumBackdrop } from "../components/QuantumBackdrop.tsx";
import { OptimalDials, fmt } from "../components/DebriefParts.tsx";
import { StationVisual } from "../components/StationVisual.tsx";
import { MP_ROUND_MS } from "../config.ts";
import { SURVIVAL_THRESHOLD } from "../shared/chsh.ts";
import { useHost } from "../net/hostStore.ts";
import { useRemainingMs } from "../net/useCountdown.ts";
import type { HostCommand, PairInfo, RateSummary, RoomState } from "../shared/protocol.ts";
import { S } from "../strings.ts";

const rate = (r: RateSummary) => (r.rounds ? r.wins / r.rounds : null);

export function Screen() {
  const { status, state, localDeadline, results, error, start, command } = useHost();
  useEffect(() => start(), [start]);
  // Facilitator-only, so it lives on the TV: the hint and the debrief step.
  const [hint, setHint] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (state?.phase !== "debrief") setStep(0);
    if (!state?.toolUnlocked) setHint(false);
  }, [state?.phase, state?.toolUnlocked]);
  useTvSounds(state, results);

  if (!state) {
    return (
      <main className="screen screen--center">
        <p className="muted">{status === "closed" ? S.event.reconnecting : S.event.connecting}</p>
      </main>
    );
  }

  const joinUrl = `${location.origin}/play?room=${state.room}`;
  const actRate = state.act === 2 ? state.stability.act2 : state.stability.act3;
  const lobby = state.phase === "lobby";

  const quantum = state.act === 3 && state.phase !== "debrief";
  return (
    <main className={`tv ${quantum ? "quantum" : ""}`}>
      {quantum && <QuantumBackdrop />}
      <header className="tv__head">
        <p className="kicker">{S.title}</p>
        <div className="screen-top">
          <p className="kicker">
            {S.tv.station(state.room)} {status !== "open" && `· ${S.event.reconnecting}`}
          </p>
          <MuteToggle where="tv" />
        </div>
      </header>

      <section className="tv__main">
        {state.phase !== "debrief" && <PhaseBanner state={state} localDeadline={localDeadline} />}
        {hint && state.act === 3 && state.phase !== "debrief" && <p className="tv__hint">{S.tuning.hint}</p>}
        {state.phase === "ceiling" ? (
          <CeilingPanel />
        ) : state.phase === "tool" ? (
          <ToolPanel />
        ) : state.phase === "debrief" ? (
          <TvDebrief state={state} step={step} setStep={setStep} />
        ) : (
          <StationVisual rate={state.stability.rolling} />
        )}
        <div className="panel" hidden={state.phase === "debrief"}>
          <StabilityMeter
            value={state.stability.rolling}
            label={S.tv.pooled}
            showCeiling={state.ceilingRevealed}
            showLimit={state.toolUnlocked}
          />
          {actRate.rounds > 0 && (
            <p className="muted">
              {S.tv.allTime(state.act, pct(actRate.wins / actRate.rounds), actRate.rounds)}
              {actRate.timeouts > 0 && ` · ${S.tv.timeouts(actRate.timeouts)}`}
            </p>
          )}
        </div>
      </section>

      <aside className="tv__side">
        <JoinPanel url={joinUrl} code={state.room} big={lobby} />
        <Pairs
          state={state}
          lastResults={
            state.phase === "roundResult" && results?.roundId === `${state.batchNo}-${state.roundNo}` ? results.results : null
          }
        />
      </aside>

      <HostControls state={state} onCommand={command} error={error} hint={hint} onHint={() => setHint((h) => !h)} />
    </main>
  );
}

/**
 * TV sounds: a chime when most pairs held a round, the alarm when pooled stability drops below the survival line
 * (or a batch ends below it), and the reveal when the tool unlocks.
 */
function useTvSounds(state: RoomState | null, results: { roundId: string; results: { win: boolean }[] } | null) {
  const prev = useRef<{ roundId?: string; rolling: number | null; phase?: string }>({ rolling: null });
  useEffect(() => {
    const p = prev.current;
    if (results && results.roundId !== p.roundId) {
      p.roundId = results.roundId;
      const wins = results.results.filter((r) => r.win).length;
      if (results.results.length && wins * 2 >= results.results.length) playSfx("win", "tv");
    }
  }, [results]);
  useEffect(() => {
    if (!state) return;
    const p = prev.current;
    const r = state.stability.rolling;
    const crossed = p.rolling !== null && r !== null && p.rolling >= SURVIVAL_THRESHOLD && r < SURVIVAL_THRESHOLD;
    const batchLow =
      state.phase === "batchDone" && p.phase !== "batchDone" && !!state.lastBatch &&
      state.lastBatch.wins / Math.max(1, state.lastBatch.rounds) < SURVIVAL_THRESHOLD;
    if (crossed || batchLow) playSfx("alarm", "tv");
    if (state.phase === "tool" && p.phase !== "tool") playSfx("reveal", "tv");
    p.rolling = r;
    p.phase = state.phase;
  }, [state]);
}

function PhaseBanner({ state, localDeadline }: { state: RoomState; localDeadline: number | null }) {
  const left = useRemainingMs(localDeadline);
  const inBatch = state.phase === "round" || state.phase === "roundResult";
  return (
    <div className={`tv__banner tv__banner--${state.phase}`}>
      <h1>{S.tv.phase[state.phase]}</h1>
      {state.phase === "strategy" && left !== null && <div className="tv__clock">{Math.ceil(left / 1000)}</div>}
      {inBatch && (
        <>
          <p className="kicker">{S.tv.roundOf(state.batchNo, state.roundNo, state.batchSize)}</p>
          <Countdown
            id={`${state.batchNo}-${state.roundNo}`}
            ms={MP_ROUND_MS}
            paused={state.phase !== "round"}
          />
        </>
      )}
      {state.phase === "batchDone" && state.lastBatch && (
        <p className="tv__big">{S.tv.batchHeld(pct(state.lastBatch.wins / Math.max(1, state.lastBatch.rounds)))}</p>
      )}
    </div>
  );
}

function CeilingPanel() {
  return (
    <div className="panel stack tv__ceiling">
      <div className="huge">{S.ceiling.big}</div>
      {S.ceiling.lines.map((l) => (
        <p key={l} className="tv__line">
          {l}
        </p>
      ))}
    </div>
  );
}

function ToolPanel() {
  const art = atlasUrl("entanglement-reveal");
  return (
    <div className="panel stack reveal">
      <div className="reveal__field" aria-hidden="true" style={art ? { filter: "none", opacity: 0.5 } : undefined}>
        {art && (isVideo(art) ? <video src={art} autoPlay loop muted playsInline /> : <img src={art} alt="" />)}
      </div>
      <div className="reveal__crystals" aria-hidden="true">
        <div className="crystal" />
        <div className="crystal" />
      </div>
      {S.tv.toolLines.map((l) => (
        <p key={l} className="tv__line">
          {l}
        </p>
      ))}
    </div>
  );
}

/** The debrief on the big screen: the same four steps as solo, with the whole crew's numbers. */
function TvDebrief({ state, step, setStep }: { state: RoomState; step: number; setStep: (n: number) => void }) {
  const steps = S.debrief.steps;
  const content = steps[step]!;
  const act2 = rate(state.stability.act2);
  const act3 = rate(state.stability.act3);
  return (
    <div className="panel stack tv__debrief">
      <div className="steps" aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>
      <p className="kicker">{S.debrief.kicker}</p>
      <h1>{content.title}</h1>
      {content.body.map((p) => (
        <p key={p} className="tv__line">
          {p}
        </p>
      ))}
      {step === 0 && act2 !== null && <p className="tv__big">{S.tv.crewAct(2, pct(act2), state.stability.act2.rounds)}</p>}
      {step === 1 && (
        <>
          {act3 !== null && <p className="tv__big">{S.tv.crewAct(3, pct(act3), state.stability.act3.rounds)}</p>}
          <div className="row">
            <OptimalDials table="A" />
            <OptimalDials table="B" />
          </div>
        </>
      )}
      {step === 2 && state.marginals && (
        <>
          <MarginalTable {...state.marginals} />
          <p className="muted small">{S.tv.wobble}</p>
        </>
      )}
      {step === 3 && <CreditsList />}
      <div className="row tv__debrief-nav">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          {S.debrief.back}
        </button>
        <button className="btn btn--primary" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>
          {S.debrief.next}
        </button>
      </div>
    </div>
  );
}

/** Each seat's own valve: OPEN rate when the partner saw GREEN vs RED. Both ≈ 50%: no message got through. */
function MarginalTable({ rows, crew }: NonNullable<RoomState["marginals"]>) {
  const cell = (r: number | null) => (
    <td>
      <div className="bar__track">
        <div className="bar__fill" style={{ width: `${(r ?? 0) * 100}%` }} />
        <div className="bar__half" />
      </div>
      <span>{fmt(r)}</span>
    </td>
  );
  return (
    <table className="marginals">
      <thead>
        <tr>
          <th>{S.tv.marginalHead.player}</th>
          <th>{S.tv.marginalHead.green}</th>
          <th>{S.tv.marginalHead.red}</th>
          <th>{S.tv.marginalHead.rounds}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="marginals__crew">
          <td>{S.tv.wholeCrew}</td>
          {cell(crew.partnerGreen)}
          {cell(crew.partnerRed)}
          <td className="muted">{crew.rounds}</td>
        </tr>
        {rows.map((m) => (
          <tr key={`${m.table}-${m.name}`}>
            <td>
              {m.name} <span className="muted">({m.table})</span>
            </td>
            {cell(m.partnerGreen)}
            {cell(m.partnerRed)}
            <td className="muted">{m.rounds}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JoinPanel({ url, code, big }: { url: string; code: string; big: boolean }) {
  const svg = useQr(url);
  return (
    <div className={`panel tv__join ${big ? "tv__join--big" : ""}`}>
      {svg && <div className="tv__qr" dangerouslySetInnerHTML={{ __html: svg }} />}
      <div className="stack">
        <p className="kicker">{S.tv.join}</p>
        <p className="tv__code">
          <span className="muted">{S.tv.code}</span> {code}
        </p>
        {big && <p className="muted small">{S.tv.joinAt(url.replace(/^https?:\/\//, ""))}</p>}
      </div>
    </div>
  );
}

function useQr(text: string): string | null {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(text, { type: "svg", margin: 1, color: { dark: "#0a0e13", light: "#eef3f8" } }).then(
      (s) => live && setSvg(s),
      () => live && setSvg(null),
    );
    return () => {
      live = false;
    };
  }, [text]);
  return svg;
}

function Pairs({ state, lastResults }: { state: RoomState; lastResults: { pairId: number; win: boolean; timedOut: boolean }[] | null }) {
  const unseated = state.players.filter((p) => p.pairId === null);
  if (state.pairs.length === 0 && unseated.length === 0) return <p className="muted">{S.tv.noPlayers}</p>;
  return (
    <div className="stack">
      {state.pairs.map((pair) => (
        <PairCard key={pair.id} pair={pair} state={state} result={lastResults?.find((r) => r.pairId === pair.id) ?? null} />
      ))}
      {unseated.length > 0 && (
        <p className="muted small">
          {S.phone.waitingSeat} {unseated.map((p) => `${p.name} (${p.table})`).join(", ")}
        </p>
      )}
    </div>
  );
}

function PairCard({ pair, state, result }: { pair: PairInfo; state: RoomState; result: { win: boolean; timedOut: boolean } | null }) {
  const r = rate(state.act === 2 ? pair.act2 : pair.act3);
  const connected = (id: string | null) => id === null || state.players.find((p) => p.id === id)?.connected;
  const seat = (side: "a" | "b") => {
    const s = pair[side];
    const answered = state.phase === "round" && pair.answered[side];
    return (
      <span className={`seat ${connected(s.playerId) ? "" : "seat--off"} ${s.playerId === null ? "seat--bot" : ""}`}>
        <CrewIcon table={side === "a" ? "A" : "B"} bot={s.playerId === null} size={28} />
        <b>{side.toUpperCase()}</b> {s.name}
        {answered && " ✓"}
      </span>
    );
  };
  return (
    <div className={`panel pair ${result ? (result.win ? "pair--win" : "pair--loss") : ""}`}>
      <div className="pair__head">
        <span className="kicker">{S.tv.pair(pair.id)}</span>
        <strong>{r === null ? "—" : pct(r)}</strong>
      </div>
      <div className="pair__seats">
        {seat("a")}
        {seat("b")}
      </div>
      <div className="minimeter">
        <div className={`minimeter__fill ${r !== null && r >= 0.8 ? "minimeter__fill--ok" : ""}`} style={{ width: `${(r ?? 0) * 100}%` }} />
        <div className="minimeter__line" style={{ left: "80%" }} />
      </div>
    </div>
  );
}

function HostControls({
  state,
  onCommand,
  error,
  hint,
  onHint,
}: {
  state: RoomState;
  onCommand: (c: HostCommand) => void;
  error: string | null;
  hint: boolean;
  onHint: () => void;
}) {
  const inBatch = state.phase === "round" || state.phase === "roundResult";
  const hasPlayers = state.players.length > 0;
  const enabled = useMemo<Record<HostCommand, boolean>>(
    () => ({
      startStrategy: !inBatch && hasPlayers && !["strategy", "ceiling", "debrief"].includes(state.phase),
      startBatch: !inBatch && hasPlayers && !["ceiling", "debrief"].includes(state.phase),
      revealCeiling: !inBatch && state.act === 2 && state.stability.act2.rounds > 0 && state.phase !== "ceiling",
      // DECISION: the tool unlocks after the ceiling has been revealed, to keep the learning arc in order.
      unlockTool: !inBatch && state.ceilingRevealed && !state.toolUnlocked,
      debrief: !inBatch && state.act === 3 && state.stability.act3.rounds > 0 && state.phase !== "debrief",
      reset: true,
    }),
    [inBatch, hasPlayers, state.phase, state.act, state.stability.act2.rounds, state.stability.act3.rounds, state.ceilingRevealed, state.toolUnlocked],
  );
  const order: HostCommand[] = ["startStrategy", "startBatch", "revealCeiling", "unlockTool", "debrief", "reset"];
  return (
    <footer className="tv__controls">
      <span className="kicker">{S.tv.controls}</span>
      {order.map((cmd) => (
        <button
          key={cmd}
          className={`btn ${cmd === "reset" ? "btn--ghost" : ""}`}
          disabled={!enabled[cmd]}
          onClick={() => (cmd !== "reset" || confirm(S.tv.resetConfirm)) && onCommand(cmd)}
        >
          {S.tv.cmd[cmd]}
        </button>
      ))}
      {state.act === 3 && state.phase !== "debrief" && (
        <button className={`btn ${hint ? "btn--selected" : ""}`} onClick={onHint}>
          {hint ? S.tv.hideHint : S.tv.showHint}
        </button>
      )}
      {error && <span className="tv__error">{error}</span>}
    </footer>
  );
}
