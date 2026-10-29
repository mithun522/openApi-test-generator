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
import { Message, type Msg } from "../Message";
import { EndpointPicker } from "./EndpointPicker";
import { Results } from "./Results";
import { AuthFieldset, IncludeFieldset, VariablesFieldset } from "./Settings";

export interface Result {
  spec: Spec;
  cases: TestCase[];
  collection: Schema;
}

const DEFAULT_OPTS: Options = { positive: true, negative: true, boundary: true, security: true, nulls: false, contentType: true, emptyStrings: false };

export function TestsMode({ hidden }: { hidden: boolean }) {
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTS);
  const [auth, setAuth] = useState<AuthSettings>({ mode: "contract", apiKeyName: "X-API-Key", apiKeyIn: "header" });
  const [vars, setVars] = useState<VarNames>(DEFAULT_VARS);
  const [ops, setOps] = useState<OpEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Result | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [authInfo, setAuthInfo] = useState("");

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
    return all;
  }, []);

  const run = useCallback((source?: string, sel?: Set<string>) => {
    const { text: current, opts: o, auth: a, vars: v } = latest.current;
    const src = source ?? current;
    try {
      const spec = new Spec(parseSpec(src));
      loaded.current = true;
      const synced = syncOps(src, spec);
      const use = sel ?? synced;
      if (!use.size) throw new Error("No endpoints selected. Tick at least one endpoint to generate tests for.");
      const cases = generate({ spec, opts: o, selected: use, auth: a, vars: v });
      setResult({ spec, cases, collection: toPostman(spec, cases, v) });
      const n = new Set(cases.map((c) => c.method + c.path)).size;
      setMsg({ text: `Generated ${cases.length} test cases across ${n} operations.`, kind: "ok" });
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
      setMsg({ text: (e as Error).message || String(e), kind: "err" });
    }
  }, [syncOps]);

  // fill the endpoint list as soon as a valid contract is pasted, without generating
  useEffect(() => {
    const t = setTimeout(() => {
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
    if (loaded.current) run();
  }, [opts, auth, vars, run]);

  const loadText = (t: string) => { setText(t); run(t); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { loadText(await f.text()); } catch { setMsg({ text: "Couldn't read that file. Try pasting its contents instead.", kind: "err" }); }
  };
  const changeSelection = (next: Set<string>, rerun: boolean) => {
    setSelected(next);
    if (rerun && result && next.size) run(undefined, next);
  };

  return (
    <main hidden={hidden}>
      <section className="pane" aria-labelledby="in-h">
        <h2 id="in-h">Your contract</h2>
        <textarea id="spec" spellCheck={false} placeholder={"openapi: 3.0.3\ninfo:\n  title: My API\n  ..."} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => run()}>Generate test cases</button>
          <label className="filebtn">
            Upload file
            <input type="file" accept=".json,.yaml,.yml,.txt" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button onClick={() => loadText(SAMPLE_CONTRACT)}>Load sample contract</button>
        </div>
        <EndpointPicker ops={ops} selected={selected} onChange={changeSelection} />
        <IncludeFieldset opts={opts} onChange={setOpts} />
        <AuthFieldset auth={auth} onChange={setAuth} info={authInfo} />
        <VariablesFieldset vars={vars} onChange={setVars} />
        <Message msg={msg} />
      </section>
      <section className="pane" aria-labelledby="out-h">
        <h2 id="out-h">Generated tests</h2>
        {result ? <Results result={result} /> : (
          <div className="empty">Paste a contract and select Generate test cases. Not sure where to start? Load the sample contract.</div>
        )}
      </section>
    </main>
  );
}
