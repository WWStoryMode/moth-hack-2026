// The crossing, step by step: years → portrait → mask → home → TeleBlur → verdict → document.
import { useMemo, useState } from "react";
import { Officer } from "./components/Officer.tsx";
import { Paper } from "./components/Paper.tsx";
import { BorderError, submit, waitForMorph, type Job } from "./lib/api.ts";
import { maskedChange, reasonFor } from "./lib/diff.ts";
import type { DocumentInput } from "./lib/document.ts";
import type { Prepared } from "./lib/image.ts";
import { DocumentScreen } from "./screens/Document.tsx";
import { IntroScreen } from "./screens/Intro.tsx";
import { MaskScreen } from "./screens/Mask.tsx";
import { PhotoStep } from "./screens/PhotoStep.tsx";
import { ProcessingScreen } from "./screens/Processing.tsx";
import { VerdictScreen } from "./screens/Verdict.tsx";
import { S } from "./strings.ts";

type Step = "intro" | "portrait" | "mask" | "home" | "processing" | "verdict" | "document" | "error";

interface Outcome {
  job: Job;
  morphUrl: string;
  reason: string;
}

export function App() {
  const [step, setStep] = useState<Step>("intro");
  const [years, setYears] = useState(10);
  const [portrait, setPortrait] = useState<Prepared | null>(null);
  const [mask, setMask] = useState<Prepared | null>(null);
  const [home, setHome] = useState<Prepared | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string>(S.errors.generic);

  const reset = () => {
    for (const p of [portrait, mask, home]) if (p) URL.revokeObjectURL(p.url);
    if (outcome) URL.revokeObjectURL(outcome.morphUrl);
    setPortrait(null);
    setMask(null);
    setHome(null);
    setOutcome(null);
    setStep("intro");
  };

  const cross = async (homePhoto: Prepared) => {
    if (!portrait || !mask) return;
    setHome(homePhoto);
    setElapsed(0);
    setStep("processing");
    try {
      const job = await submit({ portrait: portrait.blob, home: homePhoto.blob, mask: mask.blob, years });
      const morph = await waitForMorph(job, setElapsed);
      const morphUrl = URL.createObjectURL(morph);
      // The verdict comes from what the quantum morph actually did to the face.
      const change = await maskedChange(portrait.url, morphUrl, mask.url);
      if (import.meta.env.DEV) console.info(`[faded-passport] strength ${job.params.strength} → masked change ${change.toFixed(3)}`);
      setOutcome({ job, morphUrl, reason: S.verdict.reasons[reasonFor(change)] });
      setStep("verdict");
    } catch (e) {
      const code = e instanceof BorderError ? e.code : "generic";
      setError((S.errors as Record<string, string>)[code] ?? S.errors.generic);
      setStep("error");
    }
  };

  const doc = useMemo<DocumentInput | null>(
    () =>
      outcome && home
        ? { morphUrl: outcome.morphUrl, homeUrl: home.url, years, reason: outcome.reason, jobId: outcome.job.jobId, params: outcome.job.params }
        : null,
    [outcome, home, years],
  );

  switch (step) {
    case "intro":
      return <IntroScreen onStart={(y) => { setYears(y); setStep("portrait"); }} />;
    case "portrait":
      return (
        <PhotoStep step="1 / 4" text={S.portrait} camera="user" type="image/png" alt="Your passport photo"
          onDone={(p) => { setPortrait(p); setStep("mask"); }} />
      );
    case "mask":
      return portrait && (
        <MaskScreen portraitUrl={portrait.url}
          onDone={(blob) => { setMask({ blob, url: URL.createObjectURL(blob) }); setStep("home"); }} />
      );
    case "home":
      return <PhotoStep step="4 / 4" text={S.home} camera="environment" type="image/jpeg" alt="Home" onDone={cross} />;
    case "processing":
      return portrait && <ProcessingScreen elapsedMs={elapsed} portraitUrl={portrait.url} />;
    case "verdict":
      return outcome && <VerdictScreen morphUrl={outcome.morphUrl} reason={outcome.reason} years={years} onNext={() => setStep("document")} />;
    case "document":
      return doc && <DocumentScreen input={doc} onAgain={reset} />;
    case "error":
      return (
        <Paper>
          <Officer line={error} />
          <button type="button" className="primary" onClick={reset}>{S.errors.retry}</button>
        </Paper>
      );
  }
}
