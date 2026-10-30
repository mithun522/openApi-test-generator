/* Generation settings in one collapsible card: endpoints, categories, auth, Postman variable names. */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { AuthMode, AuthSettings, OpEntry, Options, VarKey, VarNames } from "../../core/types";
import { AccordionHeader } from "../ui";

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur(); };

function Group({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2 rounded-lg border border-surface-container-highest p-3">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-outline">{title}</legend>
      {aside}
      {children}
    </fieldset>
  );
}

const INCLUDE: [keyof Options, string][] = [
  ["positive", "Happy paths"], ["negative", "Validation errors"], ["boundary", "Boundary values"],
  ["security", "Auth checks"], ["nulls", "Null values"], ["contentType", "Wrong content type"],
];
const MODES: [AuthMode, string][] = [
  ["contract", "Use the contract's security schemes"], ["bearer", "Bearer token"], ["apikey", "API key"],
  ["basic", "Basic auth"], ["oauth2", "OAuth 2.0 access token"], ["none", "No auth"],
];
const VARS: [VarKey, string][] = [["baseUrl", "Base URL"], ["token", "Token"], ["apiKey", "API key"], ["username", "Username"], ["password", "Password"]];

interface Props {
  ops: OpEntry[];
  selected: Set<string>;
  onSelect: (next: Set<string>, rerun: boolean) => void;
  opts: Options;
  onOpts: (o: Options) => void;
  auth: AuthSettings;
  onAuth: (a: AuthSettings) => void;
  authInfo: string;
  vars: VarNames;
  onVars: (v: VarNames) => void;
}

export function SettingsPanel(p: Props) {
  const [open, setOpen] = useState(false);
  const cats = INCLUDE.filter(([k]) => p.opts[k]).length;
  return (
    <section className="card overflow-hidden">
      <AccordionHeader open={open} onToggle={() => setOpen((o) => !o)} icon="tune" title="Generation settings" controls="gen-settings">
        <span className="font-mono text-code-sm text-outline">
          {p.ops.length ? `${p.selected.size}/${p.ops.length} endpoints · ` : ""}{cats}/{INCLUDE.length} categories · auth: {p.auth.mode}
        </span>
      </AccordionHeader>
      <div id="gen-settings" hidden={!open} className="grid gap-3 p-space-md md:grid-cols-2">
        <EndpointPicker ops={p.ops} selected={p.selected} onChange={p.onSelect} />
        <Group title="Include">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {INCLUDE.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-body-sm">
                <input type="checkbox" className="check" checked={p.opts[k]} onChange={(e) => p.onOpts({ ...p.opts, [k]: e.target.checked })} /> {label}
              </label>
            ))}
          </div>
        </Group>
        <Group title="Authorization">
          <div className="flex flex-wrap gap-2">
            <select className="select flex-1" aria-label="Authorization type" value={p.auth.mode} onChange={(e) => p.onAuth({ ...p.auth, mode: e.target.value as AuthMode })}>
              {MODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            {p.auth.mode === "apikey" && (
              <>
                {/* commit on blur, so typing doesn't regenerate per keystroke */}
                <input key={p.auth.apiKeyName} defaultValue={p.auth.apiKeyName} aria-label="API key name" className="field w-32 py-1.5"
                  onBlur={(e) => e.target.value !== p.auth.apiKeyName && p.onAuth({ ...p.auth, apiKeyName: e.target.value })} onKeyDown={blurOnEnter} />
                <select className="select" aria-label="API key location" value={p.auth.apiKeyIn} onChange={(e) => p.onAuth({ ...p.auth, apiKeyIn: e.target.value as "header" | "query" })}>
                  <option value="header">in header</option>
                  <option value="query">in query</option>
                </select>
              </>
            )}
          </div>
          {p.authInfo && <p className="text-body-sm text-on-surface-variant">{p.authInfo}</p>}
        </Group>
        <Group title="Postman variable names">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {VARS.map(([k, label]) => (
              <label key={k} className="space-y-0.5 text-body-sm text-on-surface-variant">
                <span className="block">{label}</span>
                <input defaultValue={p.vars[k]} aria-label={`${label} variable name`} className="field py-1 font-mono"
                  onBlur={(e) => e.target.value !== p.vars[k] && p.onVars({ ...p.vars, [k]: e.target.value })} onKeyDown={blurOnEnter} />
              </label>
            ))}
          </div>
          <p className="text-body-sm text-outline">Used as <code className="font-mono">{"{{name}}"}</code> in requests and the collection's Variables tab. Letters, digits and underscores only.</p>
        </Group>
      </div>
    </section>
  );
}

function EndpointPicker({ ops, selected, onChange }: { ops: OpEntry[]; selected: Set<string>; onChange: Props["onSelect"] }) {
  const [filter, setFilter] = useState("");
  const q = filter.toLowerCase().trim();
  const shown = ops.filter((o) => !q || (o.key + " " + o.summary).toLowerCase().includes(q));
  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onChange(next, true);
  };
  return (
    <Group title="Endpoints" aside={
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" placeholder="Filter endpoints" aria-label="Filter endpoints" className="field flex-1 py-1" value={filter} onChange={(e) => setFilter(e.target.value)} disabled={!ops.length} />
        <button type="button" className="btn-outline px-2 py-1 text-label-sm" onClick={() => onChange(new Set(ops.map((o) => o.key)), true)} disabled={!ops.length}>Select all</button>
        <button type="button" className="btn-outline px-2 py-1 text-label-sm" onClick={() => onChange(new Set(), false)} disabled={!ops.length}>Select none</button>
      </div>
    }>
      {ops.length ? (
        <div id="opsBox" role="group" aria-label="Endpoints to generate tests for" className="max-h-56 space-y-0.5 overflow-y-auto">
          {shown.length ? shown.map((o) => (
            <label key={o.key} className="flex items-center gap-2 rounded px-1 py-0.5 text-body-sm hover:bg-surface-container-low">
              <input type="checkbox" className="check" checked={selected.has(o.key)} onChange={(e) => toggle(o.key, e.target.checked)} />
              <span className={`w-14 shrink-0 font-mono text-code-sm font-bold m-${o.method}`}>{o.method}</span>
              <span className="min-w-0 break-all font-mono text-code-sm text-on-surface">{o.path}</span>
            </label>
          )) : <p className="text-body-sm text-outline">No endpoints match.</p>}
          <p className="pt-1 text-body-sm text-outline">{selected.size} of {ops.length} selected</p>
        </div>
      ) : <p className="text-body-sm text-outline">Paste a contract to choose endpoints.</p>}
    </Group>
  );
}
