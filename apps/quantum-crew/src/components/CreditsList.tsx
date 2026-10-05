import { ATLAS_ASSETS, assetPresent, assetProvenance } from "../assets/atlas/manifest.ts";
import { S } from "../strings.ts";

/** Every Atlas asset from the manifest, with engine and parameters. */
export function CreditsList() {
  return (
      <div className="stack">
        <p>{S.credits.lead}</p>
        <p className="muted">{S.credits.simulated}</p>
        <div className="panel stack">
          <p className="kicker">{S.credits.assets}</p>
          <ul className="assets">
            {ATLAS_ASSETS.map((a) => {
            const prov = assetProvenance(a.key);
            const params = a.params ?? prov?.params;
            return (
              <li key={a.key}>
                <span>
                  <code>{a.key}</code> · {a.engine}
                  {a.engineId ? ` (${a.engineId})` : ""}
                </span>
                <span className="muted small">{a.use}</span>
                {params && <span className="small">{JSON.stringify(params)}</span>}
                {prov && <span className="muted small">{S.credits.job(prov.jobId)}</span>}
                {!assetPresent(a.key) && <span className="muted small">{S.credits.pending}</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <a href={S.credits.learnUrl} target="_blank" rel="noreferrer">
        {S.credits.learn}
      </a>
    </div>
  );
}
