// The crossing, step by step: title → story → years → portrait → mask → home → Teleblur → verdict → document.
import { useEffect, useMemo, useState } from "react";
import { DebugBadge } from "./components/DebugBadge.tsx";
import { DebugInputs } from "./components/DebugInputs.tsx";
import type { ScanPhase } from "./components/ScanOverlay.tsx";
import { BoothWindow } from "./components/BoothWindow.tsx";
import { Paper } from "./components/Paper.tsx";
import { BorderError, submit, waitForMorph, type Job } from "./lib/api.ts";
import { applyAge, stageFor } from "./lib/ageing.ts";
import { DEBUG } from "./lib/debug.ts";
import { maskedChange, reasonFor } from "./lib/diff.ts";
import type { DocumentInput } from "./lib/document.ts";
import type { Prepared } from "./lib/image.ts";
import { DocumentScreen } from "./screens/Document.tsx";
import { IntroScreen } from "./screens/Intro.tsx";
import { MaskScreen } from "./screens/Mask.tsx";
import { PhotoStep } from "./screens/PhotoStep.tsx";
import { ProcessingScreen } from "./screens/Processing.tsx";
import { StoryScreen } from "./screens/Story.tsx";
import { TitleScreen } from "./screens/Title.tsx";
import { VerdictScreen } from "./screens/Verdict.tsx";
import { yearsToStrength } from "./config.ts";
import { SAMPLES } from "./samples.ts";
import { S } from "./strings.ts";

/** Minimum time the scan's job readout stays visible before the verdict. */
const SCAN_MIN_MS = 1500;

type Step = "title" | "story" | "intro" | "portrait" | "mask" | "home" | "processing" | "verdict" | "document" | "error";

interface Outcome {
  job: Job;
  morphUrl: string;
  reason: string;
}

export function App() {
  const [step, setStep] = useState<Step>("title");
  const [years, setYears] = useState(10);
  const [portrait, setPortrait] = useState<Prepared | null>(null);
  /** Sent to Teleblur (see MASK in config.ts). */
  const [mask, setMask] = useState<Prepared | null>(null);
  /** The drawn face outline: where the verdict measures change. */
  const [face, setFace] = useState<Prepared | null>(null);
  const [home, setHome] = useState<Prepared | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /** What the scan overlay shows: real job data only. */
  const [scan, setScan] = useState<{ phase: ScanPhase; job?: Job }>({ phase: "uploading" });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string>(S.errors.generic);

  // Ageing (?age=all) follows the years from the years screen onward; the title and story stay fresh.
  useEffect(() => applyAge(step === "title" || step === "story" ? null : years), [step, years]);

  const reset = () => {
    for (const p of [portrait, mask, face, home]) if (p) URL.revokeObjectURL(p.url);
    if (outcome) URL.revokeObjectURL(outcome.morphUrl);
    setPortrait(null);
    setMask(null);
    setFace(null);
    setHome(null);
    setOutcome(null);
    setStep("intro"); // a replay skips the title and story
  };

  const cross = async (homePhoto: Prepared) => {
    if (!portrait || !mask || !face) return;
    setHome(homePhoto);
    setElapsed(0);
    setScan({ phase: "uploading" });
    setStep("processing");
    try {
      const job = await submit({ portrait: portrait.blob, home: homePhoto.blob, mask: mask.blob, years });
      const jobShownAt = Date.now();
      setScan({ phase: "submitted", job }); // accepted by the server; real status comes from polling
      const morph = await waitForMorph(job, (ms, status) => {
        setElapsed(ms);
        if (status === "queued" || status === "processing" || status === "completed") setScan({ phase: status, job });
        else setScan({ phase: "processing", job }); // in-between states (e.g. "fetching") count as processing
      });
      const morphUrl = URL.createObjectURL(morph);
      // The verdict comes from what the quantum morph actually did to the face.
      const change = await maskedChange(portrait.url, morphUrl, face.url);
      if (import.meta.env.DEV) console.info(`[faded-passport] strength ${job.params.strength} → masked change ${change.toFixed(3)}`);
      setOutcome({ job, morphUrl, reason: S.verdict.reasons[reasonFor(change)] });
      // Keep the job readout on screen for at least ~1.5 s so it can be read; never longer otherwise.
      const shown = Date.now() - jobShownAt;
      if (shown < SCAN_MIN_MS) await new Promise((r) => setTimeout(r, SCAN_MIN_MS - shown));
      setStep("verdict");
    } catch (e) {
      const code = e instanceof BorderError ? e.code : "generic";
      setError((S.errors as Record<string, string>)[code] ?? S.errors.generic);
      setStep("error");
    }
  };

  const doc = useMemo<DocumentInput | null>(
    () =>
      outcome && home && face
        ? { morphUrl: outcome.morphUrl, outlineUrl: face.url, homeUrl: home.url, years, reason: outcome.reason, jobId: outcome.job.jobId, params: outcome.job.params }
        : null,
    [outcome, home, face, years],
  );

  return (
    <>
      {screen()}
      <DebugBadge detail={`step=${step} · years=${years} · age ${yearsToStrength(years).toFixed(3)} · stage=${stageFor(years)}`} />
    </>
  );

  function screen() {
    switch (step) {
      case "title":
        return <TitleScreen onBegin={() => setStep("story")} />;
      case "story":
        return <StoryScreen onDone={() => setStep("intro")} />;
      case "intro":
        return <IntroScreen initial={years} onYears={setYears} onStart={(y) => { setYears(y); setStep("portrait"); }} />;
      case "portrait":
        return (
          <PhotoStep step="1 / 4" text={S.portrait} camera="user" type="image/png" alt="Your passport photo" passport samples={SAMPLES.portrait}
            onDone={(p) => { setPortrait(p); setStep("mask"); }} />
        );
      case "mask":
        return portrait && (
          <MaskScreen portraitUrl={portrait.url}
            onDone={({ outline, engine }) => {
              setFace({ blob: outline, url: URL.createObjectURL(outline) });
              setMask({ blob: engine, url: URL.createObjectURL(engine) });
              setStep("home");
            }} />
        );
      case "home":
        return (
          <PhotoStep step="4 / 4" text={S.home} camera="environment" type="image/jpeg" alt="Home" onDone={cross} samples={SAMPLES.home}
            extra={DEBUG && portrait && mask && face
              ? (h) => <DebugInputs portrait={portrait} home={h} mask={mask} outline={face} years={years} />
              : undefined} />
        );
      case "processing":
        return portrait && <ProcessingScreen elapsedMs={elapsed} portraitUrl={portrait.url} phase={scan.phase} job={scan.job} />;
      case "verdict":
        return outcome && face && (
          <VerdictScreen morphUrl={outcome.morphUrl} outlineUrl={face.url} reason={outcome.reason} years={years} onNext={() => setStep("document")} />
        );
      case "document":
        return doc && <DocumentScreen input={doc} onAgain={reset} />;
      case "error":
        return (
          <Paper>
            <BoothWindow line={error} />
            <button type="button" className="primary" onClick={reset}>{S.errors.retry}</button>
          </Paper>
        );
    }
  }
}
