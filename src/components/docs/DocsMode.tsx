/* System documentation mode: several contracts in, one Markdown + Mermaid document out. */
import { useMemo, useState } from "react";
import { parseSpecs } from "../../core/spec-parser";
import { copyText, downloadText, slug } from "../../core/util";
import { ghSlug } from "../../docs/markdown";
import { SAMPLE_SYSTEM } from "../../docs/sample-system";
import { buildSystemDocs, type Contract, type SystemDocs } from "../../docs/system";
import { ErrorBanner, Icon } from "../ui";
import { DocView } from "./DocView";
import { SuggestedLinks } from "./SuggestedLinks";

function toContracts(text: string, source: string): Contract[] {
  let docs;
  try { docs = parseSpecs(text); } catch (e) { throw new Error(`${source}: ${(e as Error).message}`); }
  return docs.map((doc, i) => ({ doc, source: docs.length > 1 ? `${source} #${i + 1}` : source }));
}
const plural = (n: number) => `${n} contract${n === 1 ? "" : "s"}`;

export function DocsMode({ hidden, notify }: { hidden: boolean; notify: (t: string) => void }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(true);
  const [manage, setManage] = useState(true);
  const [sysName, setSysName] = useState("System");
  const [view, setView] = useState<"doc" | "md">("doc");
  const [error, setError] = useState("");

  const built = useMemo((): { docs: SystemDocs | null; error: string } => {
    if (!contracts.length) return { docs: null, error: "" };
    try { return { docs: buildSystemDocs(contracts, excluded, sysName), error: "" }; }
    catch (e) { console.error(e); return { docs: null, error: (e as Error).message || String(e) }; }
  }, [contracts, excluded, sysName]);
  const docs = built.docs;
  const sections = useMemo(() => (docs ? [...docs.markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1]) : []), [docs]);

  const add = (list: Contract[]) => {
    setContracts((c) => [...c, ...list]);
    setError("");
    setPasteOpen(false);
    setManage(false);
    notify(`Added ${plural(list.length)}. Documenting ${plural(contracts.length + list.length)}.`);
  };
  const addFromPaste = () => {
    try {
      const list = toContracts(paste, "Pasted contract");
      setPaste("");
      add(list);
    } catch (e) { setError((e as Error).message); }
  };
  const addFromFiles = async (files: File[]) => {
    const list: Contract[] = [], errors: string[] = [];
    for (const f of files) {
      try { list.push(...toContracts(await f.text(), f.name)); } catch (e) { errors.push((e as Error).message); }
    }
    if (list.length) add(list);
    setError(errors.join(" "));
  };
  const loadSample = () => {
    const list = toContracts(SAMPLE_SYSTEM, "Sample");
    setContracts(list);
    setExcluded(new Set());
    setSysName("Shop");
    setError("");
    setPasteOpen(false);
    setManage(false);
    notify(`Loaded the 4-service sample shop.`);
  };
  const remove = (i: number) => setContracts((c) => c.filter((_, j) => j !== i));
  const clear = () => { setContracts([]); setExcluded(new Set()); setManage(true); setPasteOpen(true); };
  const toggleLink = (id: string, on: boolean) => setExcluded((s) => {
    const next = new Set(s);
    if (on) next.delete(id);
    else next.add(id);
    return next;
  });
  const copy = async () => {
    if (!docs) return;
    const ok = await copyText(docs.markdown);
    if (!ok) setView("md");
    notify(ok ? "Markdown copied to clipboard." : "Copy was blocked by the browser. Select the Markdown and press Ctrl/Cmd+C.");
  };
  const download = () => {
    if (!docs) return;
    const name = `${slug(sysName.trim() || "system")}-system-docs.md`;
    downloadText(name, docs.markdown, "text/markdown");
    notify(`Downloaded ${name}.`);
  };
  const showManage = manage || !contracts.length;

  return (
    <main hidden={hidden} className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-margin-mobile pb-6 pt-3 md:px-margin">
      <section className="space-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-0.5 font-mono text-code-sm text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> OpenAPI 3.x / Swagger 2.0
        </span>
        <h1 className="font-headline text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Contracts to system documentation</h1>
        <p className="text-body-sm leading-relaxed text-on-surface-variant">
          Compile the OpenAPI contracts of every service into one document: system map, flows, every endpoint and data model, and consistency checks, as Markdown for Confluence or Git.
        </p>
      </section>

      {/* loaded contracts capsule */}
      <section className="card rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon name="layers" className="text-[18px] text-secondary" />
            <span className="font-headline text-body-sm font-semibold text-primary">{plural(contracts.length)} loaded</span>
          </span>
          {contracts.length > 0 && (
            <button className="flex items-center gap-1 text-label-md text-secondary hover:text-primary" aria-expanded={showManage} onClick={() => setManage((m) => !m)}>
              Manage <Icon name="expand_more" className={`text-[16px] transition-transform ${showManage ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        {showManage && (
          <div className="mt-2 space-y-2 border-t border-surface-container pt-2">
            {docs && (
              <div className="clist space-y-2">
                {docs.services.map((s, i) => (
                  <div key={s.id} className="citem flex items-center justify-between rounded border border-surface-container bg-surface-container-low p-2 text-body-sm">
                    <div className="min-w-0 pr-2">
                      <div className="truncate font-semibold text-primary">{s.name}</div>
                      <div className="truncate font-mono text-code-sm text-outline">{[s.version && "v" + s.version, s.spec, `${s.operations.length} ops`, s.source].filter(Boolean).join(" · ")}</div>
                    </div>
                    <button className="rounded px-2 py-1 text-label-sm text-error hover:bg-error-container/50" onClick={() => remove(i)} aria-label={`Remove ${s.name}`}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button className="btn-soft flex-1" aria-expanded={pasteOpen} onClick={() => setPasteOpen((o) => !o)}>
                <Icon name="add" className="text-[16px]" /> Paste spec
              </button>
              <label className="btn-soft flex-1 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-secondary">
                <Icon name="upload_file" className="text-[16px]" /> Upload files
                <input type="file" className="sr-only" accept=".json,.yaml,.yml,.txt" multiple onChange={(e) => { addFromFiles([...(e.target.files || [])]); e.target.value = ""; }} />
              </label>
              {contracts.length > 0 && <button className="btn px-2 text-error hover:bg-error-container/50" onClick={clear}>Remove all</button>}
            </div>
            {pasteOpen && (
              <div className="space-y-2">
                <textarea id="docsSpec" spellCheck={false} aria-label="Contracts to add" className="code-editor min-h-[12rem]"
                  placeholder="Paste one contract, or several separated by a line containing only ---" value={paste} onChange={(e) => setPaste(e.target.value)} />
                <button className="btn-primary w-full" onClick={addFromPaste}><Icon name="add" className="text-base" /> Add contract</button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* system name and status */}
      <section className="card flex flex-wrap items-center justify-between gap-2 rounded-lg p-2.5">
        <div className="flex items-center gap-2">
          <label htmlFor="sysName" className="font-mono text-code-sm uppercase tracking-wider text-outline">System:</label>
          {/* commit on blur so the document (and its diagrams) isn't rebuilt on every keystroke */}
          <input id="sysName" key={sysName} defaultValue={sysName} size={14}
            className="rounded border border-surface-container-highest bg-surface-container px-2 py-0.5 font-mono text-code-md font-semibold text-primary focus:border-secondary focus:outline-none"
            onBlur={(e) => setSysName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-outline">
            <span className={`h-1.5 w-1.5 rounded-full ${docs ? "bg-pos" : "bg-outline"}`} /> {docs ? "Ready" : "No contracts"}
          </span>
        </div>
        <button className="btn-outline px-2.5 py-1" onClick={loadSample}>Load sample system</button>
      </section>

      {docs && <SuggestedLinks services={docs.services} links={docs.allLinks} excluded={excluded} onToggle={toggleLink} />}
      <ErrorBanner text={built.error || error} />

      {docs ? (
        <article className="card overflow-hidden rounded-lg">
          <div className="flex flex-col gap-2.5 border-b border-surface-container-highest bg-surface-container-low p-3">
            <div className="flex items-center justify-between">
              <div className="seg bg-surface-container-high" role="tablist" aria-label="Document view">
                <button role="tab" aria-selected={view === "doc"} onClick={() => setView("doc")}>Document</button>
                <button role="tab" aria-selected={view === "md"} onClick={() => setView("md")}>Markdown</button>
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-code-sm text-outline" title="The document updates as you add contracts or review links">
                <Icon name="sync" className="text-[14px] text-secondary" /> Synced
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-primary flex-1 font-mono text-code-sm" onClick={copy}><Icon name="content_copy" className="text-[15px]" /> Copy Markdown</button>
              <button className="btn border border-surface-container-highest bg-surface-container px-3 font-mono text-code-sm text-primary hover:bg-surface-container-high" onClick={download}>
                <Icon name="download" className="text-[15px]" /> .md
              </button>
            </div>
          </div>
          {view === "doc" && (
            <nav aria-label="Table of contents" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-surface-container bg-surface-container-lowest px-3 py-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-outline">Jump:</span>
              {sections.map((s) => (
                <a key={s} href={`#${ghSlug(s)}`} className="whitespace-nowrap rounded px-2 py-0.5 text-label-md font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary">{s}</a>
              ))}
            </nav>
          )}
          <div className="p-3.5">
            {view === "doc" ? <DocView markdown={docs.markdown} /> : (
              <textarea id="docsOut" readOnly spellCheck={false} value={docs.markdown} aria-label="Generated Markdown" className="code-editor min-h-[36rem]" />
            )}
          </div>
        </article>
      ) : (
        <section className="card flex flex-col items-center gap-2 rounded-lg px-6 py-12 text-center">
          <Icon name="menu_book" className="text-4xl text-outline" />
          <p className="font-headline text-headline-md text-on-surface">No documentation yet</p>
          <p className="max-w-md text-body-sm text-on-surface-variant">Add one or more contracts to document your system. Not sure where to start? Load the sample system.</p>
        </section>
      )}
    </main>
  );
}
