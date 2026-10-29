/* System documentation mode: several contracts in, one Markdown + Mermaid document out. */
import { useMemo, useRef, useState } from "react";
import { parseSpecs } from "../../core/spec-parser";
import { copyText, downloadText, slug } from "../../core/util";
import { SAMPLE_SYSTEM } from "../../docs/sample-system";
import { buildSystemDocs, type Contract, type SystemDocs } from "../../docs/system";
import { Message, type Msg } from "../Message";
import { DocView } from "./DocView";
import { SuggestedLinks } from "./SuggestedLinks";

function toContracts(text: string, source: string): Contract[] {
  let docs;
  try { docs = parseSpecs(text); } catch (e) { throw new Error(`${source}: ${(e as Error).message}`); }
  return docs.map((doc, i) => ({ doc, source: docs.length > 1 ? `${source} #${i + 1}` : source }));
}
const plural = (n: number) => `${n} contract${n === 1 ? "" : "s"}`;

export function DocsMode({ hidden }: { hidden: boolean }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [paste, setPaste] = useState("");
  const [sysName, setSysName] = useState("System");
  const [view, setView] = useState<"doc" | "md">("doc");
  const [msg, setMsg] = useState<Msg | null>(null);
  const [note, setNote] = useState("");
  const mdBox = useRef<HTMLTextAreaElement>(null);

  const built = useMemo((): { docs: SystemDocs | null; error: string } => {
    if (!contracts.length) return { docs: null, error: "" };
    try { return { docs: buildSystemDocs(contracts, excluded, sysName), error: "" }; }
    catch (e) { console.error(e); return { docs: null, error: (e as Error).message || String(e) }; }
  }, [contracts, excluded, sysName]);
  const docs = built.docs;
  const shownMsg: Msg | null = built.error ? { text: built.error, kind: "err" } : msg;

  const add = (list: Contract[], text: string) => {
    setContracts((c) => [...c, ...list]);
    setMsg({ text: `${text} Documenting ${plural(contracts.length + list.length)}.`, kind: "ok" });
  };
  const addFromPaste = () => {
    try {
      const list = toContracts(paste, "Pasted contract");
      setPaste("");
      add(list, `Added ${plural(list.length)}.`);
    } catch (e) { setMsg({ text: (e as Error).message, kind: "err" }); }
  };
  const addFromFiles = async (files: File[]) => {
    const list: Contract[] = [], errors: string[] = [];
    for (const f of files) {
      try { list.push(...toContracts(await f.text(), f.name)); } catch (e) { errors.push((e as Error).message); }
    }
    if (list.length) add(list, `Added ${plural(list.length)}.`);
    if (errors.length) setMsg({ text: errors.join(" "), kind: "err" });
  };
  const loadSample = () => {
    const list = toContracts(SAMPLE_SYSTEM, "Sample");
    setContracts(list);
    setExcluded(new Set());
    setSysName("Shop");
    setMsg({ text: `Loaded the 4-service sample shop. Documenting ${plural(list.length)}.`, kind: "ok" });
  };
  const remove = (i: number) => { setContracts((c) => c.filter((_, j) => j !== i)); setMsg(null); };
  const clear = () => { setContracts([]); setExcluded(new Set()); setMsg(null); };
  const toggleLink = (id: string, on: boolean) => setExcluded((s) => {
    const next = new Set(s);
    if (on) next.delete(id);
    else next.add(id);
    return next;
  });

  const copy = async () => {
    if (!docs) return;
    const ok = await copyText(docs.markdown, view === "md" ? mdBox.current : null);
    if (!ok) setView("md");
    setNote(ok ? "Markdown copied to clipboard." : "Copy was blocked by the browser. Select the Markdown and press Ctrl/Cmd+C.");
  };
  const download = () => {
    if (!docs) return;
    const name = `${slug(sysName.trim() || "system")}-system-docs.md`;
    downloadText(name, docs.markdown, "text/markdown");
    setNote(`Downloaded ${name}.`);
  };

  return (
    <main className="docs" hidden={hidden}>
      <section className="pane" aria-labelledby="dc-h">
        <h2 id="dc-h">Your contracts</h2>
        {docs && (
          <div className="clist">
            {docs.services.map((s, i) => (
              <div className="citem" key={s.id}>
                <div>
                  <b>{s.name}</b>
                  <div className="hint">{[s.version && "v" + s.version, s.spec, `${s.operations.length} operations`, s.source].filter(Boolean).join(" · ")}</div>
                </div>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${s.name}`}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <textarea id="docsSpec" spellCheck={false} placeholder="Paste one contract, or several separated by a line containing only ---" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={addFromPaste}>Add contract</button>
          <label className="filebtn">
            Upload files
            <input type="file" accept=".json,.yaml,.yml,.txt" multiple onChange={(e) => { addFromFiles([...(e.target.files || [])]); e.target.value = ""; }} />
          </label>
          <button onClick={loadSample}>Load sample system</button>
          <button onClick={clear}>Remove all</button>
        </div>
        <fieldset>
          <legend>System</legend>
          <label className="chk">
            Name{" "}
            {/* commit on blur so the document (and its diagrams) isn't rebuilt on every keystroke */}
            <input key={sysName} defaultValue={sysName} size={20} aria-label="System name"
              onBlur={(e) => setSysName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          </label>
        </fieldset>
        {docs && <SuggestedLinks services={docs.services} links={docs.allLinks} excluded={excluded} onToggle={toggleLink} />}
        <Message msg={shownMsg} />
      </section>

      <section className="pane" aria-labelledby="do-h">
        <h2 id="do-h">System documentation</h2>
        {!docs ? (
          <div className="empty">Add one or more contracts to document your system. Not sure where to start? Load the sample system.</div>
        ) : (
          <div>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={view === "doc"} onClick={() => setView("doc")}>Document</button>
              <button role="tab" aria-selected={view === "md"} onClick={() => setView("md")}>Markdown</button>
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              <button className="primary" onClick={copy}>Copy Markdown</button>
              <button onClick={download}>Download .md</button>
              <span className="hint" style={{ margin: 0 }}>{note}</span>
            </div>
            {view === "doc" ? <DocView markdown={docs.markdown} /> : (
              <textarea id="docsOut" ref={mdBox} readOnly spellCheck={false} value={docs.markdown} aria-label="Generated Markdown" />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
