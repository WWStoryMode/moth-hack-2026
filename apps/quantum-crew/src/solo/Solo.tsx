// Solo mode: one screen per phase of the store. Act III screens get the Entanglement Tool's look.
import { Batch } from "./Batch.tsx";
import { Ceiling } from "./Ceiling.tsx";
import { Debrief } from "./Debrief.tsx";
import { Intro } from "./Intro.tsx";
import { Plan } from "./Plan.tsx";
import { Readout } from "./Readout.tsx";
import { ToolReveal } from "./ToolReveal.tsx";
import { Tuning } from "./Tuning.tsx";
import { QuantumBackdrop } from "../components/QuantumBackdrop.tsx";
import { useSolo, type Phase } from "./soloStore.ts";
import { MuteToggle } from "../components/MuteToggle.tsx";

const QUANTUM_PHASES: Phase[] = ["toolReveal", "act3Plan", "act3Batch", "act3Readout"];

export function Solo() {
  const phase = useSolo((s) => s.phase);
  return (
    <div className={`solo ${QUANTUM_PHASES.includes(phase) ? "quantum" : ""}`}>
      {QUANTUM_PHASES.includes(phase) && <QuantumBackdrop />}
      <div className="mute--float">
        <MuteToggle where="solo" />
      </div>
      {screenFor(phase)}
    </div>
  );
}

function screenFor(phase: Phase) {
  switch (phase) {
    case "intro":
      return <Intro />;
    case "act2Plan":
      return <Plan />;
    case "act2Batch":
    case "act3Batch":
      return <Batch />;
    case "act2Readout":
    case "act3Readout":
      return <Readout />;
    case "ceiling":
      return <Ceiling />;
    case "toolReveal":
      return <ToolReveal />;
    case "act3Plan":
      return <Tuning />;
    case "debrief":
      return <Debrief />;
  }
}
