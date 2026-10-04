import { S } from "../strings.ts";

/** The station rule, always on screen while planning. */
export function Rule() {
  return (
    <div className="panel rule">
      <p className="kicker">{S.rule.head}</p>
      <p>{S.rule.body}</p>
    </div>
  );
}
