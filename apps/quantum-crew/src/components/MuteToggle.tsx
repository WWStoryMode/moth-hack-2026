import { useSound, type SoundContext } from "../audio/sfx.ts";
import { S } from "../strings.ts";

export function MuteToggle({ where }: { where: SoundContext }) {
  const on = useSound((s) => s.on[where]);
  const toggle = useSound((s) => s.toggle);
  return (
    <button
      className="btn btn--ghost mute"
      aria-pressed={!on}
      aria-label={on ? S.sound.mute : S.sound.unmute}
      title={on ? S.sound.mute : S.sound.unmute}
      onClick={() => toggle(where)}
    >
      <span aria-hidden="true">{on ? "🔊" : "🔇"}</span>
    </button>
  );
}
