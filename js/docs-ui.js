/* Docs mode UI: contract list, suggested-link review, rendered document, copy and download. */
"use strict";

const DOCS = { contracts: [], excluded: new Set(), view: "doc", md: "", renderId: 0 };

function setMode(mode){
  document.querySelectorAll(".modes button").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === mode));
  document.querySelectorAll("[data-mode-show]").forEach(el => el.hidden = el.dataset.modeShow !== mode);
}
function docsMsg(text, kind){
  const m = $("#docsMsg"); m.textContent = text; m.className = "msg " + (text ? kind : "");
}

/* ---------- contract list ---------- */
function addContracts(text, source){
  let docs;
  try { docs = parseSpecs(text); } catch(e){ throw new Error(`${source}: ${e.message}`); }
  docs.forEach((doc, i) => DOCS.contracts.push({ doc, source: docs.length > 1 ? `${source} #${i + 1}` : source }));
  return docs.length;
}
function addFromPaste(){
  try {
    const n = addContracts($("#docsSpec").value, "Pasted contract");
    $("#docsSpec").value = "";
    buildDocs(`Added ${n} contract${n === 1 ? "" : "s"}.`);
  } catch(e){ docsMsg(e.message, "err"); }
}
async function addFromFiles(e){
  const files = [...e.target.files];
  e.target.value = "";
  let n = 0;
  const errors = [];
  for (const f of files){
    try { n += addContracts(await f.text(), f.name); } catch(err){ errors.push(err.message); }
  }
  buildDocs(errors.length ? null : `Added ${n} contract${n === 1 ? "" : "s"}.`);
  if (errors.length) docsMsg(errors.join(" "), "err");
}
function loadSampleSystem(){
  DOCS.contracts = [];
  DOCS.excluded.clear();
  addContracts(SAMPLE_SYSTEM, "Sample");
  $("#sysName").value = "Shop";
  buildDocs("Loaded the 4-service sample shop.");
}
function removeContract(i){
  DOCS.contracts.splice(i, 1);
  buildDocs("");
}
function clearContracts(){
  DOCS.contracts = [];
  DOCS.excluded.clear();
  buildDocs("");
}
function renderContracts(services){
  $("#docsList").innerHTML = services.map((s, i) => `
    <div class="citem">
      <div><b>${esc(s.name)}</b><div class="hint">${esc([s.version && "v" + s.version, s.spec, `${s.operations.length} operations`, s.source].filter(Boolean).join(" · "))}</div></div>
      <button type="button" data-rm="${i}" aria-label="Remove ${esc(s.name)}">Remove</button>
    </div>`).join("");
}

/* ---------- build ---------- */
function buildDocs(okText){
  if (!DOCS.contracts.length){
    $("#docsList").innerHTML = "";
    $("#linksSet").hidden = true;
    $("#docsResults").hidden = true;
    $("#docsEmpty").hidden = false;
    if (okText !== null) docsMsg("", "");
    return;
  }
  try {
    const services = dedupeServices(DOCS.contracts.map(c => serviceModel(c.doc, c.source)));
    const { links: allLinks, events, externals, shared } = findLinks(services);
    const links = allLinks.filter(l => !DOCS.excluded.has(l.id));
    const flows = buildFlows(services, links, events);
    DOCS.md = toMarkdown({
      title: $("#sysName").value.trim() || "System", services, links, allLinks, events, externals, shared, flows,
      narrative: systemNarrative(services, links, events, externals), checks: consistencyChecks(services, shared)
    });
    renderContracts(services);
    renderSuggested(allLinks, services);
    $("#docsEmpty").hidden = true;
    $("#docsResults").hidden = false;
    renderDocs();
    if (okText) docsMsg(`${okText} Documenting ${services.length} service${services.length === 1 ? "" : "s"}.`, "ok");
    else if (okText === "") docsMsg("", "");
  } catch(e){
    console.error(e);
    docsMsg(e.message || String(e), "err");
  }
}
function renderSuggested(links, services){
  const name = id => (services.find(s => s.id === id) || { name: id }).name;
  const open = links.filter(l => l.kind === "inferred" || l.kind === "shared");
  $("#linksSet").hidden = !open.length;
  $("#linksBox").innerHTML = open.map(l => {
    const what = l.kind === "inferred" ? `${l.items.map(i => i.field).join(", ")}` : `shares ${l.items.map(i => i.model).join(", ")}`;
    return `<label class="chk"><input type="checkbox" data-link="${esc(l.id)}"${DOCS.excluded.has(l.id) ? "" : " checked"}>
      <span>${esc(name(l.from))} ${l.kind === "shared" ? "↔" : "→"} ${esc(name(l.to))} <span class="hint">${esc(what)}</span></span></label>`;
  }).join("");
}
function toggleLink(e){
  const id = e.target.dataset.link;
  if (id === undefined) return;
  e.target.checked ? DOCS.excluded.delete(id) : DOCS.excluded.add(id);
  buildDocs("");
}

/* ---------- render ---------- */
function setDocsView(v){
  DOCS.view = v;
  document.querySelectorAll("[data-dtab]").forEach(b => b.setAttribute("aria-selected", b.dataset.dtab === v));
  renderDocs();
}
let mermaidReady = false;
function initMermaid(){
  if (mermaidReady || !window.mermaid) return;
  const t = document.documentElement.dataset.theme;
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
  mermaidReady = true;
}
async function renderDocs(){
  const isDoc = DOCS.view === "doc";
  $("#docView").hidden = !isDoc;
  $("#docsOut").hidden = isDoc;
  $("#docsCopied").textContent = "";
  if (!isDoc){ $("#docsOut").value = DOCS.md; return; }
  const view = $("#docView");
  if (!window.marked){
    view.innerHTML = `<p class="msg err">The Markdown renderer couldn't load, so the document is shown as plain Markdown. Copy and Download still work.</p><pre>${esc(DOCS.md)}</pre>`;
    return;
  }
  const id = ++DOCS.renderId;
  view.innerHTML = marked.parse(DOCS.md);
  view.querySelectorAll("a[href]").forEach(a => { if (!/^(#|https?:|mailto:)/i.test(a.getAttribute("href"))) a.removeAttribute("href"); });
  const used = new Map();
  view.querySelectorAll("h1,h2,h3,h4").forEach(h => {
    const base = ghSlug(h.textContent), n = used.get(base) || 0;
    used.set(base, n + 1);
    h.id = n ? `${base}-${n}` : base;
  });
  const nodes = [...view.querySelectorAll("pre > code.language-mermaid")].map(c => {
    const div = document.createElement("div");
    div.className = "mermaid";
    div.textContent = c.textContent;
    c.parentElement.replaceWith(div);
    return div;
  });
  if (!nodes.length) return;
  if (!window.mermaid){
    nodes.forEach(n => n.classList.add("raw"));
    view.insertAdjacentHTML("afterbegin", `<p class="msg err">The diagram library couldn't load, so diagrams are shown as Mermaid source. They render in Confluence (with a Mermaid macro) and on GitHub.</p>`);
    return;
  }
  initMermaid();
  try { if (id === DOCS.renderId) await mermaid.run({ nodes, suppressErrors: true }); } catch(e){ console.error(e); }
}
async function copyDocs(){
  let ok = false;
  try { await navigator.clipboard.writeText(DOCS.md); ok = true; } catch(e){
    setDocsView("md");
    const ta = $("#docsOut"); ta.focus(); ta.select();
    try { ok = document.execCommand("copy"); } catch(e2){}
  }
  $("#docsCopied").textContent = ok ? "Markdown copied to clipboard." : "Copy was blocked by the browser. Select the Markdown and press Ctrl/Cmd+C.";
}
function downloadDocs(){
  const name = `${slug($("#sysName").value.trim() || "system")}-system-docs.md`;
  const url = URL.createObjectURL(new Blob([DOCS.md], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#docsCopied").textContent = `Downloaded ${name}.`;
}
