/* Generated test cases: sticky metrics dock, view tabs, the browsable list, JSON and Postman views. */
import { useMemo, useState } from "react";
import { exportCases } from "../../core/postman";
import type { Category, Schema, TestCase } from "../../core/types";
import { copyText, downloadText } from "../../core/util";
import { Icon } from "../ui";
import type { Result } from "./TestsMode";

type Tab = "browse" | "json" | "postman";
const CATS: Category[] = ["positive", "negative", "boundary", "security"];
const PAGE = 50;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const fileBase = (doc: Schema) => (((doc.info && doc.info.title) || "api") as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "api";

export function Results({ result, totalOps, notify }: { result: Result; totalOps: number; notify: (t: string) => void }) {
  const [tab, setTab] = useState<Tab>("browse");
  const { cases } = result;
  const counts = useMemo(() => Object.fromEntries(CATS.map((k) => [k, cases.filter((c) => c.category === k).length])) as Record<Category, number>, [cases]);
  const json = useMemo(() => JSON.stringify(exportCases(result.spec, cases), null, 2), [result, cases]);
  const collection = useMemo(() => JSON.stringify(result.collection, null, 2), [result]);
  const base = fileBase(result.spec.doc);
  const download = (kind: "json" | "postman") => {
    const name = `${base}-${kind === "postman" ? "postman_collection" : "test-cases"}.json`;
    downloadText(name, kind === "postman" ? collection : json, "application/json");
    notify(`Downloaded ${name}.`);
  };

  return (
    <>
      {/* metrics stay visible while scrolling the list */}
      <section className="sticky top-[3.4rem] z-20 bg-surface/95 py-1 backdrop-blur-md" aria-label="Test case summary">
        <div className="card space-y-2 p-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-headline text-sm font-semibold text-on-surface sm:text-base">Generated tests</h2>
              <span className="rounded-full bg-primary-fixed px-2 py-0.5 font-mono text-[11px] font-medium text-primary">{cases.length} vectors</span>
            </div>
            <div className="flex items-center gap-1 text-body-sm text-on-surface-variant">
              <Icon name="alt_route" className="text-sm text-primary" />
              <span className="font-medium text-on-surface">{result.ops}/{totalOps || result.ops}</span>
              <span className="hidden sm:inline">endpoints</span>
            </div>
          </div>
          <div className="stats grid grid-cols-5 gap-1.5 text-center">
            <Tile label="Total" value={cases.length} cls="border-surface-container-highest bg-surface-container-low text-primary" />
            {CATS.map((k) => <Tile key={k} label={cap(k)} value={counts[k]} cls={`pill-${k}`} />)}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="seg" role="tablist" aria-label="Output view">
            {([["browse", "Browse vectors"], ["json", "JSON payload"], ["postman", "Postman config"]] as [Tab, string][]).map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? "font-semibold" : ""}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button className="btn-outline px-2.5 py-1 text-label-sm" onClick={() => download("json")}>
              <Icon name="file_download" className="text-sm" /> Export JSON
            </button>
            <button className="btn-primary px-2.5 py-1 text-label-sm" onClick={() => download("postman")}>
              <Icon name="bolt" className="text-sm" /> Postman collection
            </button>
          </div>
        </div>
        {tab === "browse" && <BrowseList cases={cases} counts={counts} />}
        {tab === "json" && (
          <CodeCard file={`${base}-test-cases.json`} text={json} notify={notify} onDownload={() => download("json")} />
        )}
        {tab === "postman" && <PostmanCard result={result} text={collection} notify={notify} onDownload={() => download("postman")} />}
      </section>
    </>
  );
}

function Tile({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`flex flex-col justify-center rounded-lg border px-1 py-1.5 ${cls}`}>
      <span className="font-headline text-base font-bold leading-tight tabular-nums">{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-90">{label}</span>
    </div>
  );
}

const statusCls = (s: number) => (s < 300 ? "pill-positive" : s < 400 ? "pill-boundary" : "pill-negative");

function BrowseList({ cases, counts }: { cases: TestCase[]; counts: Record<Category, number> }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const query = q.toLowerCase().trim();
  const list = cases.filter((c) => (!cat || c.category === cat) &&
    (!query || `${c.path} ${c.name} ${c.expected.status} ${c.method}`.toLowerCase().includes(query)));
  const shown = list.slice(0, limit);
  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-outline" />
          <input type="search" placeholder="Filter by path, name or status" aria-label="Filter test cases" className="field py-1.5 pl-8"
            value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        </div>
        <select aria-label="Category" className="select" value={cat} onChange={(e) => { setCat(e.target.value); setLimit(PAGE); }}>
          <option value="">All categories ({cases.length})</option>
          {CATS.map((k) => <option key={k} value={k}>{cap(k)} only ({counts[k]})</option>)}
        </select>
      </div>
      <div className="card p-space-sm shadow-sm">
        <div className="list divide-y divide-surface-container">
          {shown.length ? shown.map((c) => {
            const isOpen = open.has(c.id);
            return (
              <div key={c.id} className={"tc group" + (isOpen ? " open" : "")}>
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(c.id)}
                  className="flex w-full items-start justify-between gap-2 rounded-lg p-2 text-left transition-colors hover:bg-surface-container-low">
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`m font-mono text-code-sm font-bold m-${c.method}`}>{c.method}</span>
                      <span className="truncate font-mono text-code-sm font-semibold text-on-surface">{c.path}</span>
                      <span className="font-mono text-code-sm text-outline">{c.id}</span>
                      <span className={`rounded px-2 font-mono text-[10px] font-medium uppercase pill-${c.category}`}>{c.category}</span>
                    </span>
                    <span className="block text-body-sm font-medium text-on-surface">{c.name.replace(/^[^:]+:\s*/, "")}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`chip font-semibold ${statusCls(c.expected.status)}`}>{c.expected.status}</span>
                    <Icon name="chevron_right" className={`text-base text-outline transition-transform group-hover:text-primary ${isOpen ? "rotate-90" : ""}`} />
                  </span>
                </button>
                {isOpen && (
                  <pre className="mx-2 mb-2 overflow-x-auto rounded-lg border border-surface-container bg-surface-container-low p-2.5 font-mono text-[11px] leading-5">
                    {JSON.stringify(c.request, null, 2)}
                  </pre>
                )}
              </div>
            );
          }) : <p className="py-8 text-center text-body-sm text-outline">No test cases match this filter.</p>}
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-surface-container px-1 pt-2 text-body-sm text-outline">
          <span>Showing {shown.length} of {list.length} test vectors</span>
          {list.length > shown.length && (
            <button className="text-label-sm text-primary hover:underline" onClick={() => setLimit((n) => n + PAGE)}>
              Load next {Math.min(PAGE, list.length - shown.length)} →
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function CodeCard({ file, text, notify, onDownload }: { file: string; text: string; notify: (t: string) => void; onDownload: () => void }) {
  return (
    <div className="card space-y-2 p-space-md shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-label-md text-on-surface">{file}</span>
        <span className="flex gap-3">
          <button className="flex items-center gap-1 font-mono text-code-sm text-primary hover:underline"
            onClick={async () => notify((await copyText(text)) ? "JSON copied to clipboard." : "Copy was blocked by the browser. Download the file instead.")}>
            <Icon name="content_copy" className="text-xs" /> Copy JSON
          </button>
          <button className="flex items-center gap-1 font-mono text-code-sm text-primary hover:underline" onClick={onDownload}>
            <Icon name="file_download" className="text-xs" /> Download
          </button>
        </span>
      </div>
      <pre id="out" className="max-h-[32rem] overflow-auto rounded-lg bg-surface-container-low p-3 font-mono text-[11px] leading-5 text-on-surface">{text}</pre>
    </div>
  );
}

function PostmanCard({ result, text, notify, onDownload }: { result: Result; text: string; notify: (t: string) => void; onDownload: () => void }) {
  const [scripts, setScripts] = useState(false);
  const col = result.collection;
  const assertions = text.split("pm.test(").length - 1;
  const baseVar = col.variable?.[0];
  return (
    <div className="card space-y-3 p-space-md shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-headline text-sm font-semibold text-on-surface">Postman collection v2.1</h3>
          <p className="text-body-sm text-outline">Test scripts check status, response time, JSON and the contract schema (AJV) for every request.</p>
        </div>
        <span className="chip pill-positive font-medium">Ready</span>
      </div>
      <dl className="space-y-1.5 rounded-lg border border-surface-container bg-surface-container-low p-3 font-mono text-code-sm">
        {[
          ["Collection name", col.info.name],
          ["Requests", String(result.cases.length)],
          ["Test assertions", assertions.toLocaleString()],
          ["Base URL variable", baseVar ? `{{${baseVar.key}}} = ${baseVar.value}` : "None"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-outline">{k}</dt>
            <dd className="truncate text-right font-semibold text-on-surface">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-2">
        <button className="btn-primary flex-1 py-2" onClick={onDownload}>
          <Icon name="file_download" className="text-base" /> Download collection (.json)
        </button>
        <button className="btn-outline px-4 py-2" aria-expanded={scripts} onClick={() => setScripts((s) => !s)}>{scripts ? "Hide JSON" : "View JSON"}</button>
      </div>
      {scripts && <CodeCard file="postman_collection.json" text={text} notify={notify} onDownload={onDownload} />}
      <div className="text-body-sm text-on-surface-variant">
        <p className="font-semibold text-on-surface">To run in Postman</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>Download the collection.</li>
          <li>In Postman choose Import and drop in the file.</li>
          <li>Open the collection's Variables tab and fill in the base URL and the auth values. The Authorization tab already points at them.</li>
          <li>Run the collection with the Collection Runner.</li>
        </ol>
      </div>
    </div>
  );
}
