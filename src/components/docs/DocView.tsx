/* Renders the generated Markdown as HTML and its ```mermaid blocks as diagrams.
   Mermaid is loaded on demand so the test-case mode doesn't pay for it. */
import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";
import { ghSlug } from "../../docs/markdown";

type Mermaid = typeof import("mermaid").default;
let mermaidLoad: Promise<Mermaid> | null = null;
function loadMermaid(): Promise<Mermaid> {
  if (!mermaidLoad) {
    mermaidLoad = import("mermaid").then(({ default: m }) => {
      const t = document.documentElement.dataset.theme;
      const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      m.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
      return m;
    });
  }
  return mermaidLoad;
}

export function DocView({ markdown }: { markdown: string }) {
  const ref = useRef<HTMLElement>(null);
  const [diagramError, setDiagramError] = useState(false);
  // contract text in the Markdown is already escaped (see docs/markdown.ts), so the HTML carries no raw tags from contracts
  const html = useMemo(() => marked.parse(markdown, { async: false }) as string, [markdown]);

  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    let cancelled = false;
    // GitHub-style ids so the contents links work in the app too
    const used = new Map<string, number>();
    view.querySelectorAll("h1,h2,h3,h4").forEach((h) => {
      const base = ghSlug(h.textContent || ""), n = used.get(base) || 0;
      used.set(base, n + 1);
      h.id = n ? `${base}-${n}` : base;
    });
    view.querySelectorAll("a[href]").forEach((a) => {
      if (!/^(#|https?:|mailto:)/i.test(a.getAttribute("href") || "")) a.removeAttribute("href");
    });
    const nodes = [...view.querySelectorAll("pre > code.language-mermaid")].map((c) => {
      const div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = c.textContent;
      c.parentElement!.replaceWith(div);
      return div as HTMLElement;
    });
    if (nodes.length) {
      loadMermaid()
        .then((m) => (cancelled ? undefined : m.run({ nodes, suppressErrors: true })))
        .then(() => !cancelled && setDiagramError(false))
        .catch((e) => {
          console.error(e);
          if (cancelled) return;
          nodes.forEach((n) => n.classList.add("raw"));
          setDiagramError(true);
        });
    }
    return () => { cancelled = true; };
  }, [html]);

  return (
    <>
      {diagramError && (
        <p className="banner-err mb-3" role="alert">
          The diagram library couldn't load, so diagrams are shown as Mermaid source. They render in Confluence (with a Mermaid macro) and on GitHub.
        </p>
      )}
      <article ref={ref} className="doc" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
