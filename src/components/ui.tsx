/* Small shared pieces: icons, error banner, toast, accordion header. */
import { useEffect, type ReactNode } from "react";

export function Icon({ name, className = "", filled }: { name: string; className?: string; filled?: boolean }) {
  return <span className={`icon ${filled ? "filled " : ""}${className}`} aria-hidden="true">{name}</span>;
}

export function ErrorBanner({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="banner-err" role="alert">
      <Icon name="error" className="text-[18px]" />
      <span>{text}</span>
    </div>
  );
}

/* bottom-of-screen confirmation for copy / download / generate */
export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [text, onDone]);
  return (
    <div role="status" aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-margin-mobile"
      style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }}>
      {text && (
        <div className="flex items-center gap-2 rounded-lg bg-inverse-surface px-3.5 py-2 text-body-sm text-background shadow-lg">
          <Icon name="check_circle" className="text-[18px]" />
          {text}
        </div>
      )}
    </div>
  );
}

/* clickable summary bar of a collapsible card */
export function AccordionHeader({ open, onToggle, icon, title, children, controls }: {
  open: boolean; onToggle: () => void; icon: string; title: string; children?: ReactNode; controls: string;
}) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={controls}
      className={`flex w-full items-center justify-between gap-2 bg-surface-container-low/70 p-3 text-left transition-colors hover:bg-surface-container-low ${open ? "border-b border-surface-container" : ""}`}>
      <span className="flex min-w-0 items-center gap-2">
        <Icon name={icon} className="text-lg text-primary" />
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-label-md text-on-surface">{title}</span>
          {children}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="hidden text-label-sm text-primary sm:inline">{open ? "Collapse" : "Expand / Edit"}</span>
        <Icon name="expand_more" className={`text-primary transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </span>
    </button>
  );
}
