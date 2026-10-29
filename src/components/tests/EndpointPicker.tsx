/* Which operations tests are generated for. */
import { useState } from "react";
import type { OpEntry } from "../../core/types";

interface Props {
  ops: OpEntry[];
  selected: Set<string>;
  onChange: (next: Set<string>, rerun: boolean) => void;
}

export function EndpointPicker({ ops, selected, onChange }: Props) {
  const [filter, setFilter] = useState("");
  if (!ops.length) return null;
  const q = filter.toLowerCase().trim();
  const shown = ops.filter((o) => !q || (o.key + " " + o.summary).toLowerCase().includes(q));
  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onChange(next, true);
  };
  return (
    <fieldset>
      <legend>Endpoints</legend>
      <div className="row">
        <input type="search" placeholder="Filter endpoints" aria-label="Filter endpoints" size={18} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button type="button" onClick={() => onChange(new Set(ops.map((o) => o.key)), true)}>Select all</button>
        <button type="button" onClick={() => onChange(new Set(), false)}>Select none</button>
        <span className="hint" style={{ margin: 0 }}>{selected.size} of {ops.length} selected</span>
      </div>
      <div id="opsBox" role="group" aria-label="Endpoints to generate tests for">
        {shown.length ? shown.map((o) => (
          <label className="chk" key={o.key}>
            <input type="checkbox" checked={selected.has(o.key)} onChange={(e) => toggle(o.key, e.target.checked)} />
            <span className={`m ${o.method}`}>{o.method}</span>
            <span className="p">{o.path}</span>
          </label>
        )) : <div className="hint">No endpoints match.</div>}
      </div>
    </fieldset>
  );
}
