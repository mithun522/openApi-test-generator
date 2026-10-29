/* App chrome from the ContractForge design: top bar, navigation drawer and docked bottom nav. */
import { useEffect, useRef } from "react";
import { Icon } from "./ui";

export type Mode = "tests" | "docs";
export interface ApiInfo { title: string; endpoints: number }

const NAV: { mode: Mode; icon: string; label: string; short: string }[] = [
  { mode: "tests", icon: "checklist", label: "Test Cases", short: "Test Cases" },
  { mode: "docs", icon: "menu_book", label: "System Docs", short: "Docs" },
];

function Logo({ small }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {small ? <Icon name="data_object" className="text-xl text-primary" /> : (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary shadow-xs">
          <Icon name="data_object" className="text-lg" />
        </span>
      )}
      <span className="font-headline text-headline-md font-bold tracking-tight text-primary">ContractForge</span>
    </span>
  );
}

export function TopBar({ api, onMenu }: { api: ApiInfo | null; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-container bg-surface/95 shadow-xs backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-margin-mobile py-2.5 md:px-margin">
        <div className="flex items-center gap-2.5">
          <button aria-label="Open navigation" onClick={onMenu} className="-ml-1 rounded-lg p-1.5 text-primary transition-colors hover:bg-surface-container active:scale-95">
            <Icon name="menu" className="text-2xl" />
          </button>
          <Logo small />
        </div>
        <div className="flex items-center gap-1.5">
          {api && <span className="chip hidden bg-surface-container-high text-on-surface-variant sm:inline-flex">{api.title}</span>}
          <button onClick={onMenu} className="flex items-center gap-1 rounded-lg border border-surface-container-highest bg-surface-container-low px-2.5 py-1 text-label-sm text-primary transition-colors hover:bg-surface-container">
            <Icon name="menu_open" className="text-base" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function Drawer({ open, mode, api, onClose, onMode }: {
  open: boolean; mode: Mode; api: ApiInfo | null; onClose: () => void; onMode: (m: Mode) => void;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  // a closed drawer is off-screen: keep it out of the tab order and the accessibility tree
  useEffect(() => { if (panel.current) panel.current.inert = !open; }, [open]);
  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("overflow-hidden");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("overflow-hidden"); };
  }, [open, onClose]);

  return (
    <>
      <div onClick={onClose} aria-hidden="true"
        className={`fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside ref={panel} aria-label="Navigation"
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-surface-container-highest bg-surface-container-lowest shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-between border-b border-surface-container px-5 py-4">
          <span>
            <Logo />
            <span className="ml-[2.375rem] block font-mono text-[10px] uppercase tracking-wider text-outline">OpenAPI suite</span>
          </span>
          <button ref={closeBtn} aria-label="Close navigation" onClick={onClose} className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container">
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {NAV.map((n) => {
            const active = n.mode === mode;
            return (
              <button key={n.mode} onClick={() => { onMode(n.mode); onClose(); }} aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-body-md transition-colors ${active ? "bg-primary-fixed/60 font-semibold text-primary" : "text-on-surface-variant hover:bg-surface-container hover:text-primary"}`}>
                <Icon name={n.icon} className="text-xl" filled={active} />
                <span className="flex-1">{n.label}</span>
                {active && <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-surface">Active</span>}
              </button>
            );
          })}
        </nav>
        {api && (
          <div className="flex items-center justify-between border-t border-surface-container bg-surface-container-low/60 p-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-surface">
                {api.title.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-body-sm font-semibold text-on-surface">{api.title}</span>
                <span className="font-mono text-[11px] text-outline">{api.endpoints} endpoints</span>
              </span>
            </div>
            <span className="h-2 w-2 rounded-full bg-pos" title="Contract loaded" />
          </div>
        )}
      </aside>
    </>
  );
}

export function BottomNav({ mode, onMode, onMore }: { mode: Mode; onMode: (m: Mode) => void; onMore: () => void }) {
  const item = "flex flex-col items-center justify-center transition-transform duration-150 active:scale-95";
  return (
    <nav aria-label="Sections" className="fixed bottom-0 left-0 z-40 w-full border-t border-surface-container bg-surface-container-lowest/95 shadow-md backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="mx-auto flex max-w-xl items-center justify-around px-margin-mobile py-2">
        {NAV.map((n) => (
          <button key={n.mode} onClick={() => onMode(n.mode)} aria-current={n.mode === mode ? "page" : undefined}
            className={`${item} ${n.mode === mode ? "font-semibold text-primary" : "text-outline hover:text-primary"}`}>
            <Icon name={n.icon} className="text-xl" filled={n.mode === mode} />
            <span className="text-[11px]">{n.short}</span>
          </button>
        ))}
        <button onClick={onMore} className={`${item} text-outline hover:text-primary`}>
          <Icon name="menu" className="text-xl" />
          <span className="text-[11px]">More</span>
        </button>
      </div>
    </nav>
  );
}
