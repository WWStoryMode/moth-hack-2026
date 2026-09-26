/** The officer speaks from behind the glass. Original art: a cap and a speech box, nothing borrowed. */
export function Officer({ line }: { line: string }) {
  return (
    <div className="officer" role="status" aria-live="polite">
      <svg className="officer-cap" viewBox="0 0 64 40" aria-hidden="true">
        <path d="M6 26 Q32 2 58 26 Z" fill="currentColor" />
        <rect x="4" y="26" width="56" height="6" rx="2" fill="currentColor" />
        <path d="M14 32 Q32 42 50 32 Z" fill="currentColor" opacity="0.6" />
        <circle cx="32" cy="17" r="4" fill="var(--paper)" />
      </svg>
      <p className="officer-line">“{line}”</p>
    </div>
  );
}
