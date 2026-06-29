// Titled panel wrapper used for every chart/section block.
export default function Panel({ title, subtitle, accent, children, className = '' }) {
  return (
    <section className={`panel flex flex-col p-4 ${className}`}>
      {(title || subtitle) && (
        <header className="mb-3 flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            {accent && <span className="h-3 w-1 rounded-full" style={{ background: accent }} />}
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              {title}
            </h3>
          </div>
          {subtitle && <span className="text-sm text-text-faint">{subtitle}</span>}
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
