/* Test-case mode: one contract in, test cases and a Postman collection out. */
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_VARS } from "../../core/auth";
import { listOps } from "../../core/endpoints";
import { generate } from "../../core/generator";
import { toPostman } from "../../core/postman";
import { Spec } from "../../core/refs";
import { SAMPLE_CONTRACT } from "../../core/sample-contract";
import { parseSpec } from "../../core/spec-parser";
import type { AuthSettings, OpEntry, Options, Schema, TestCase, VarNames } from "../../core/types";
import { copyText } from "../../core/util";
import type { ApiInfo } from "../Shell";
import { AccordionHeader, ErrorBanner, Icon } from "../ui";
import { Results } from "./Results";
import { SettingsPanel } from "./Settings";

export interface Result {
  spec: Spec;
  cases: TestCase[];
  collection: Schema;
  ops: number; // selected operations
}

const DEFAULT_OPTS: Options = { positive: true, negative: true, boundary: true, security: true, nulls: false, contentType: true, emptyStrings: false };

/* what the accordion summary bar says about the pasted text */
function describe(text: string): { title: string; format: string } | null {
  try {
    const doc = parseSpec(text);
    const format = text.trim().startsWith("{") ? "JSON" : "YAML";
    return { title: (doc.info && doc.info.title) || "Untitled API", format: `${format} / ${doc.openapi ? "OpenAPI " + doc.openapi : "Swagger " + doc.swagger}` };
  } catch {
    return null;
  }
}

export function TestsMode({ hidden, onApi, notify }: { hidden: boolean; onApi: (a: ApiInfo | null) => void; notify: (t: string) => void }) {
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTS);
  const [auth, setAuth] = useState<AuthSettings>({ mode: "contract", apiKeyName: "X-API-Key", apiKeyIn: "header" });
  const [vars, setVars] = useState<VarNames>(DEFAULT_VARS);
  const [ops, setOps] = useState<OpEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [editorOpen, setEditorOpen] = useState(true);
  const [info, setInfo] = useState<{ title: string; format: string } | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);

  // values the generator reads; refs keep run() stable for effects and handlers
  const opsSource = useRef<string | null>(null);
  const loaded = useRef(false); // a contract has parsed at least once (preview or run)
  const latest = useRef({ text, opts, auth, vars, selected });
  latest.current = { text, opts, auth, vars, selected };

  /* rebuild the endpoint list only when the contract text changed; a new contract selects everything */
  const syncOps = useCallback((source: string, spec: Spec): Set<string> => {
    if (source === opsSource.current) return latest.current.selected;
    opsSource.current = source;
    const list = listOps(spec);
    const all = new Set(list.map((o) => o.key));
    setOps(list);
    setSelected(all);
    onApi({ title: (spec.doc.info && spec.doc.info.title) || "Untitled API", endpoints: list.length });
    return all;
  }, [onApi]);

  const run = useCallback((source?: string, sel?: Set<string>, announce = true) => {
    const { text: current, opts: o, auth: a, vars: v } = latest.current;
    const src = source ?? current;
    try {
      const spec = new Spec(parseSpec(src));
      loaded.current = true;
      const use = sel ?? syncOps(src, spec);
      if (!use.size) throw new Error("No endpoints selected. Tick at least one endpoint to generate tests for.");
      const cases = generate({ spec, opts: o, selected: use, auth: a, vars: v });
      const n = new Set(cases.map((c) => c.method + c.path)).size;
      setResult({ spec, cases, collection: toPostman(spec, cases, v), ops: use.size });
      setError("");
      setEditorOpen(false); // results move above the fold; the contract stays one click away
      if (announce) notify(`Generated ${cases.length} test cases across ${n} operations.`);
      const authed = cases.filter((c) => c.category === "positive" && c.request.auth.type !== "noauth");
      const types = [...new Set(authed.map((c) => {
        const j = c.request.auth;
        return j.type + (j.type === "apikey" ? ` (${j.key} in ${j.in})` : "");
      }))];
      setAuthInfo(types.length
        ? `Applied: ${types.join(", ")}. Set it once on the collection's Authorization tab variables; every request uses it.`
        : "No authorization found in the contract. Pick a type above if your API needs one.");
    } catch (e) {
      console.error(e);
      setError((e as Error).message || String(e));
      setEditorOpen(true);
    }
  }, [syncOps, notify]);

  // fill the endpoint list as soon as a valid contract is pasted, without generating
  useEffect(() => {
    const t = setTimeout(() => {
      setInfo(describe(text));
      try {
        const spec = new Spec(parseSpec(text));
        loaded.current = true;
        syncOps(text, spec);
      } catch { /* surfaced on Generate */ }
    }, 400);
    return () => clearTimeout(t);
  }, [text, syncOps]);

  // settings changes regenerate once a contract is loaded
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (loaded.current) run(undefined, undefined, false);
  }, [opts, auth, vars, run]);

  const loadText = (t: string) => { setText(t); setInfo(describe(t)); run(t); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { loadText(await f.text()); } catch { setError("Couldn't read that file. Try pasting its contents instead."); }
  };
  const changeSelection = (next: Set<string>, rerun: boolean) => {
    setSelected(next);
    if (rerun && result && next.size) run(undefined, next, false);
  };
  const lines = text ? text.split("\n").length : 0;

  return (
    <main hidden={hidden} className="mx-auto w-full max-w-7xl space-y-3 px-margin-mobile pt-3 md:px-margin">
      <section className="space-y-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h1 className="font-headline text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Contract to test cases</h1>
          <span className="font-mono text-code-sm text-outline">OpenAPI 3.x / Swagger 2.0</span>
        </div>
        <p className="max-w-3xl text-body-sm text-on-surface-variant">
          Generates every positive, validation, boundary and auth test case your OpenAPI contract implies, as plain JSON or a Postman collection with test scripts ready to run.
        </p>
      </section>

      {/* collapsible contract editor: open until results exist, then collapsed so they sit above the fold */}
      <section className="card overflow-hidden">
        <AccordionHeader open={editorOpen} onToggle={() => setEditorOpen((o) => !o)} icon="data_object" title="Contract schema" controls="contract-editor">
          {info ? (
            <>
              <span className="chip truncate bg-primary-fixed/80 font-medium text-primary">{info.title} ({lines} lines)</span>
              <span className="hidden font-mono text-code-sm text-outline sm:inline">{info.format}</span>
            </>
          ) : (
            <span className="font-mono text-code-sm text-outline">{text.trim() ? "Not a valid contract yet" : "Paste, upload or load a sample"}</span>
          )}
        </AccordionHeader>
        <div id="contract-editor" hidden={!editorOpen} className="space-y-2 p-space-md">
          <div className="relative">
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-surface-container-highest bg-surface-container-low px-3 pb-1 pt-2 font-mono text-[11px] text-on-surface-variant">
              <span className="truncate">{info ? `contract: ${info.title}` : "contract"}</span>
              <span className="text-outline">lines: {lines}</span>
            </div>
            <textarea id="spec" ref={editor} spellCheck={false} aria-label="OpenAPI contract"
              placeholder={"openapi: 3.0.3\ninfo:\n  title: My API\n  ..."}
              className="code-editor min-h-[18rem] rounded-t-none" value={text} onChange={(e) => setText(e.target.value)} />
            {text && (
              <button type="button" className="btn-outline absolute bottom-3 right-3 px-2 py-1 font-mono text-code-sm text-primary"
                onClick={async () => notify((await copyText(text, editor.current)) ? "Contract copied to clipboard." : "Copy was blocked by the browser.")}>
                <Icon name="content_copy" className="text-sm" /> Copy
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-1 flex-wrap gap-2">
              <button className="btn-primary flex-1 py-2 sm:flex-none" onClick={() => run()}>
                <Icon name="play_arrow" className="text-base" /> {result ? "Re-generate test cases" : "Generate test cases"}
              </button>
              <label className="btn-outline cursor-pointer py-2 focus-within:outline focus-within:outline-2 focus-within:outline-secondary">
                <Icon name="upload_file" className="text-base" /> Upload file
                <input type="file" className="sr-only" accept=".json,.yaml,.yml,.txt" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
            <button className="btn-link" onClick={() => loadText(SAMPLE_CONTRACT)}>Load sample contract (Pet Store)</button>
          </div>
        </div>
      </section>

      <SettingsPanel ops={ops} selected={selected} onSelect={changeSelection}
        opts={opts} onOpts={setOpts} auth={auth} onAuth={setAuth} authInfo={authInfo} vars={vars} onVars={setVars} />

      <ErrorBanner text={error} />

      {result ? <Results result={result} totalOps={ops.length} notify={notify} /> : (
        <section className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Icon name="checklist" className="text-4xl text-outline" />
          <p className="font-headline text-headline-md text-on-surface">No test cases yet</p>
          <p className="max-w-md text-body-sm text-on-surface-variant">Paste a contract and select Generate test cases. Not sure where to start? Load the sample contract.</p>
        </section>
      )}
    </main>
  );
}
