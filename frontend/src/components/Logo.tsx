/** CanopyChain mark: a leaf inside a hexagonal block. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path
        d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25L16 2.5Z"
        className="fill-accent/10 stroke-accent/60"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10.5 20.5c0-6 4.2-9.6 11-10-.3 6.8-3.9 11-10 11" className="fill-accent" />
      <path d="M10.5 21.5 16 16" className="stroke-canvas" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
