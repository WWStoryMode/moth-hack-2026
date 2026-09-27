// The backstory, revealed one paragraph per tap.
import { useState } from "react";
import { Paper } from "../components/Paper.tsx";
import { S } from "../strings.ts";

export function StoryScreen(props: { onDone: () => void }) {
  const paras = S.story.paragraphs;
  const [shown, setShown] = useState(1);
  const last = shown >= paras.length;
  return (
    <Paper>
      <div className="story">
        {paras.slice(0, shown).map((p) => (
          <p key={p} className="story-line">{p}</p>
        ))}
      </div>
      <button type="button" className={last ? "primary" : "secondary"} onClick={() => (last ? props.onDone() : setShown(shown + 1))}>
        {last ? S.story.enter : S.story.next}
      </button>
    </Paper>
  );
}
