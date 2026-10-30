/* Review list for guessed links: unticking one removes it from the map, flows and summary. */
import { useState } from "react";
import type { Link } from "../../docs/links";
import type { Service } from "../../docs/model";
import { Icon } from "../ui";

interface Props {
  services: Service[];
  links: Link[];
  excluded: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}

export function SuggestedLinks({ services, links, excluded, onToggle }: Props) {
  const [open, setOpen] = useState(true);
  const review = links.filter((l) => l.kind === "inferred" || l.kind === "shared");
  if (!review.length) return null;
  const name = (id: string) => services.find((s) => s.id === id)?.name ?? id;
  const accepted = review.filter((l) => !excluded.has(l.id)).length;
  return (
    <section className="card rounded-lg p-3">
      <button className="flex w-full items-center justify-between text-left" aria-expanded={open} aria-controls="linksBox" onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-2">
          <Icon name="hub" className="text-[18px] text-secondary" />
          <span className="font-headline text-body-sm font-semibold text-primary">Suggested links</span>
          <span className="font-mono text-code-sm text-outline">{accepted} of {review.length} accepted</span>
        </span>
        <Icon name="expand_more" className={`text-[16px] text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div hidden={!open} className="mt-2 space-y-2 border-t border-surface-container pt-2">
        <p className="text-body-sm text-on-surface-variant">
          Contracts say what a service offers, not what it calls, so these are guesses from shared IDs and model names. Untick any that are wrong;
          declare real calls with <code className="rounded bg-surface-container px-1 font-mono text-code-sm text-primary">x-calls</code> to make them certain.
        </p>
        <div id="linksBox" className="max-h-56 space-y-1 overflow-y-auto">
          {review.map((l) => (
            <label key={l.id} className="flex items-start gap-2 rounded px-1 py-1 text-body-sm hover:bg-surface-container-low">
              <input type="checkbox" className="check mt-0.5" checked={!excluded.has(l.id)} onChange={(e) => onToggle(l.id, e.target.checked)} />
              <span>
                <span className="font-medium text-on-surface">{name(l.from)} {l.kind === "shared" ? "↔" : "→"} {name(l.to)}</span>{" "}
                <span className="font-mono text-code-sm text-outline">{l.kind === "inferred" ? l.items.map((i) => i.field).join(", ") : "shares " + l.items.map((i) => i.model).join(", ")}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
