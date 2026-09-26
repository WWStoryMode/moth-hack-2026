// {{APP}} — {{CHALLENGE}}
//
// Quantum idea: <one or two sentences on what the engine's circuit does and why it matters here>
import { fileURLToPath } from "node:url";
import { createClient, loadEnv, saveRun } from "@moth-hack/atlas-client";

const OUTPUT_DIR = fileURLToPath(new URL("../output/", import.meta.url));

loadEnv();
const moth = createClient();

// Inline-result engine: save the run (provenance + result) straight away.
const run = await moth.run("coin-toss-v1", { mode: "emu", shots: 10 });
console.log("Saved", await saveRun(OUTPUT_DIR, run));

// File-output engine: download outputs with a provenance file next to each.
// const files = await moth.downloadOutputs(run.provenance.jobId, OUTPUT_DIR, run.provenance);
