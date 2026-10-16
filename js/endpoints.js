/* Endpoint picker: which operations tests are generated for. */
"use strict";

/* ---------- endpoint selection ---------- */
let selectedOps = null; // Set of "METHOD /path" keys, or null before a contract is loaded (= everything)
let opsSource = null;   // contract text the endpoint list was built from
const opKey = (method, path) => `${method.toUpperCase()} ${path}`;
function listOps(doc){
  const out = [];
  for (const [path, item0] of Object.entries(doc.paths || {})){
    const item = resolve(item0) || {};
    for (const m of METHODS) if (item[m]) out.push({ key: opKey(m, path), method: m.toUpperCase(), path, summary: item[m].summary || item[m].operationId || "" });
  }
  return out;
}
let allOps = [];
function syncOps(text, doc){
  if (text === opsSource) return;
  opsSource = text;
  allOps = listOps(doc);
  selectedOps = new Set(allOps.map(o => o.key));
  $("#opsFilter").value = "";
  renderOps();
}
function renderOps(){
  $("#opsSet").hidden = !allOps.length;
  const q = $("#opsFilter").value.toLowerCase().trim();
  $("#opsBox").innerHTML = allOps.filter(o => !q || (o.key + " " + o.summary).toLowerCase().includes(q)).map(o =>
    `<label class="chk"><input type="checkbox" data-op="${esc(o.key)}"${selectedOps.has(o.key) ? " checked" : ""}><span class="m ${o.method}">${o.method}</span><span class="p">${esc(o.path)}</span></label>`).join("")
    || `<div class="hint">No endpoints match.</div>`;
  $("#opsCount").textContent = `${selectedOps.size} of ${allOps.length} selected`;
}
function previewOps(){ // populate the endpoint list as soon as a valid contract is pasted, without generating
  try { const text = $("#spec").value; const doc = parseSpec(text); spec = doc; syncOps(text, doc); } catch(e){ /* surfaced on Generate */ }
}
