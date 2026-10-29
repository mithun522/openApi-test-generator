/* Generated test cases: stats, a filterable list, and the JSON / Postman output. */
import { useMemo, useRef, useState } from "react";
import { exportCases } from "../../core/postman";
import type { Category } from "../../core/types";
import { copyText, downloadText } from "../../core/util";
import type { Result } from "./TestsMode";

type Tab = "browse" | "cases" | "postman";
const CATS: Category[] = ["positive", "negative", "boundary", "security"];
const MAX_SHOWN = 400;

export function Results({ result }: { result: Result }) {
  const [tab, setTab] = useState<Tab>("browse");
  const { cases } = result;
  const count = (k: Category) => cases.filter((c) => c.category === k).length;
  return (
    <div>
      <div className="stats">
        <div><b>{cases.length}</b>Total</div>
        {CATS.map((k) => <div key={k}><b>{count(k)}</b>{k[0].toUpperCase() + k.slice(1)}</div>)}
      </div>
      <div className="tabs" role="tablist">
        {([["browse", "Browse"], ["cases", "Test cases JSON"], ["postman", "Postman collection"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>
      {tab === "browse" ? <BrowseList result={result} /> : <Output result={result} postman={tab === "postman"} />}
    </div>
  );
}

function BrowseList({ result }: { result: Result }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const query = q.toLowerCase().trim();
  const list = result.cases.filter((c) => (!cat || c.category === cat) &&
    (!query || `${c.path} ${c.name} ${c.expected.status} ${c.method}`.toLowerCase().includes(query)));
  const shown = list.slice(0, MAX_SHOWN);
  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return (
    <div>
      <div className="filters">
        <input type="search" placeholder="Filter by path, name or status" aria-label="Filter test cases" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
        </select>
      </div>
      <div className="list">
        {shown.length ? shown.map((c) => {
          const isOpen = open.has(c.id);
          return (
            <div key={c.id} className={"tc" + (isOpen ? " open" : "")} tabIndex={0} role="button" aria-expanded={isOpen}
              onClick={(e) => { if (!(e.target as HTMLElement).closest(".detail")) toggle(c.id); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); toggle(c.id); } }}>
              <span className={`m ${c.method}`}>{c.method}</span>
              <div>
                <div className="n"><span className={`cat ${c.category}`}>{c.category}</span>{c.name.replace(/^[^:]+:\s*/, "")}</div>
                <div className="p">{c.path} · {c.id}</div>
              </div>
              <span className="st">{c.expected.status}</span>
              <div className="detail"><pre>{JSON.stringify(c.request, null, 2)}</pre></div>
            </div>
          );
        }) : <div className="empty">No test cases match this filter.</div>}
        {list.length > shown.length && (
          <div className="empty">Showing {MAX_SHOWN} of {list.length}. Narrow the filter to see the rest; the JSON export includes all of them.</div>
        )}
      </div>
    </div>
  );
}

function Output({ result, postman }: { result: Result; postman: boolean }) {
  const out = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState("");
  const text = useMemo(
    () => JSON.stringify(postman ? result.collection : exportCases(result.spec, result.cases), null, 2),
    [result, postman],
  );
  const doc = result.spec.doc;
  const title = (((doc.info && doc.info.title) || "api") as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "api";
  const download = () => {
    const name = `${title}-${postman ? "postman_collection" : "test-cases"}.json`;
    downloadText(name, text, "application/json");
    setNote(`Downloaded ${name}.`);
  };
  const copy = async () => {
    const ok = await copyText(text, out.current);
    setNote(ok ? "Copied to clipboard." : "Copy was blocked by the browser. Use Select all, then Ctrl/Cmd+C.");
  };
  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="primary" onClick={copy}>{postman ? "Copy collection" : "Copy JSON"}</button>
        <button onClick={download}>{postman ? "Download collection" : "Download JSON"}</button>
        <button onClick={() => { out.current?.focus(); out.current?.select(); }}>Select all</button>
        <span className="hint" style={{ margin: 0 }}>{note}</span>
      </div>
      <textarea id="out" ref={out} readOnly spellCheck={false} value={text} aria-label={postman ? "Postman collection" : "Test cases JSON"} />
      {postman && (
        <div className="hint">
          To run in Postman:
          <ol>
            <li>Download the collection (or copy its JSON).</li>
            <li>In Postman choose Import, then drop in the downloaded file, or pick Raw text and paste the JSON.</li>
            <li>Open the collection's Variables tab and fill in the base URL and the auth values (by default <code>baseUrl</code>, <code>token</code>, <code>apiKey</code>, <code>username</code>/<code>password</code>; rename them under Postman variable names). The Authorization tab already points at them.</li>
            <li>Run the collection with the Collection Runner to execute every test.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
