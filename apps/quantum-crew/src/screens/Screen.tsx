// The shared TV / projector: room code + QR, the station, pooled stability, per-pair meters, round timer,
// and the facilitator's host controls. Readable from across a room.
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Countdown } from "../components/Countdown.tsx";
import { StabilityMeter, pct } from "../components/StabilityMeter.tsx";
import { StationVisual } from "../components/StationVisual.tsx";
import { MP_ROUND_MS } from "../config.ts";
import { useHost } from "../net/hostStore.ts";
import { useRemainingMs } from "../net/useCountdown.ts";
import type { HostCommand, PairInfo, RateSummary, RoomState } from "../shared/protocol.ts";
import { S } from "../strings.ts";

const rate = (r: RateSummary) => (r.rounds ? r.wins / r.rounds : null);

export function Screen() {
  const { status, state, localDeadline, results, error, start, command } = useHost();
  useEffect(() => start(), [start]);

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

  return (
    <main className="tv">
      <header className="tv__head">
        <p className="kicker">{S.title}</p>
        <p className="kicker">
          {S.tv.station(state.room)} {status !== "open" && `· ${S.event.reconnecting}`}
        </p>
      </header>

      <section className="tv__main">
        <PhaseBanner state={state} localDeadline={localDeadline} />
        {state.phase === "ceiling" ? (
          <CeilingPanel />
        ) : (
          <StationVisual rate={state.stability.rolling} />
        )}
        <div className="panel">
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

      <HostControls state={state} onCommand={command} error={error} />
    </main>
  );
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
    <div className="panel stack">
      <div className="huge">{S.ceiling.big}</div>
      {S.ceiling.lines.map((l) => (
        <p key={l} className="tv__line">
          {l}
        </p>
      ))}
    </div>
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

function HostControls({ state, onCommand, error }: { state: RoomState; onCommand: (c: HostCommand) => void; error: string | null }) {
  const inBatch = state.phase === "round" || state.phase === "roundResult";
  const hasPlayers = state.players.length > 0;
  const enabled = useMemo<Record<HostCommand, boolean>>(
    () => ({
      startStrategy: !inBatch && hasPlayers && state.phase !== "strategy" && state.phase !== "ceiling",
      startBatch: !inBatch && hasPlayers && state.phase !== "ceiling",
      revealCeiling: !inBatch && state.act === 2 && state.stability.act2.rounds > 0 && state.phase !== "ceiling",
      unlockTool: false, // M4
      debrief: false, // M4
      reset: true,
    }),
    [inBatch, hasPlayers, state.phase, state.act, state.stability.act2.rounds],
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
          title={cmd === "unlockTool" || cmd === "debrief" ? S.tv.next : undefined}
          onClick={() => (cmd !== "reset" || confirm(S.tv.resetConfirm)) && onCommand(cmd)}
        >
          {S.tv.cmd[cmd]}
        </button>
      ))}
      {error && <span className="tv__error">{error}</span>}
    </footer>
  );
}
