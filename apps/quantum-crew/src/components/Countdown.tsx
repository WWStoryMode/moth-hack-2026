/** A bar that drains over `ms`. Restarts when `id` changes; freezes when `paused`. */
export function Countdown({ id, ms, paused }: { id: string | number; ms: number; paused: boolean }) {
  return (
    <div className={`countdown ${paused ? "countdown--paused" : ""}`} role="presentation">
      <div key={id} className="countdown__bar" style={{ animationDuration: `${ms}ms` }} />
    </div>
  );
}
