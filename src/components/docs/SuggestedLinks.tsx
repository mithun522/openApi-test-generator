/* Review list for guessed links: unticking one removes it from the map, flows and summary. */
import type { Link } from "../../docs/links";
import type { Service } from "../../docs/model";

interface Props {
  services: Service[];
  links: Link[];
  excluded: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}

export function SuggestedLinks({ services, links, excluded, onToggle }: Props) {
  const open = links.filter((l) => l.kind === "inferred" || l.kind === "shared");
  if (!open.length) return null;
  const name = (id: string) => services.find((s) => s.id === id)?.name ?? id;
  return (
    <fieldset>
      <legend>Suggested links</legend>
      <div className="hint" style={{ margin: "0 0 8px" }}>
        Contracts say what a service offers, not what it calls, so these links are guesses from shared IDs and model names. Untick any that are wrong.
        Declare real calls with <code>x-calls</code> to make them certain.
      </div>
      <div id="linksBox">
        {open.map((l) => (
          <label className="chk" key={l.id}>
            <input type="checkbox" checked={!excluded.has(l.id)} onChange={(e) => onToggle(l.id, e.target.checked)} />
            <span>
              {name(l.from)} {l.kind === "shared" ? "↔" : "→"} {name(l.to)}{" "}
              <span className="hint">{l.kind === "inferred" ? l.items.map((i) => i.field).join(", ") : "shares " + l.items.map((i) => i.model).join(", ")}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
