/* Rendering, output tabs, copy and download. */
"use strict";

/* ---------- UI ---------- */
function options(){
  const o = { emptyStrings: false };
  document.querySelectorAll("[data-opt]").forEach(el => o[el.dataset.opt] = el.checked);
  return o;
}
function showMsg(text, kind){
  const m = $("#msg"); m.textContent = text; m.className = "msg " + kind;
}
function run(){
  try {
    spec = parseSpec($("#spec").value);
    syncOps($("#spec").value, spec);
    if (!selectedOps.size) throw new Error("No endpoints selected. Tick at least one endpoint to generate tests for.");
    const cases = generate(options());
    RESULT.cases = cases;
    RESULT.collection = toPostman(cases);
    const ops = new Set(cases.map(c => c.method + c.path)).size;
    showMsg(`Generated ${cases.length} test cases across ${ops} operations.`, "ok");
    const authed = cases.filter(c => c.category === "positive" && c.request.auth.type !== "noauth");
    const types = [...new Set(authed.map(c => c.request.auth.type + (c.request.auth.key ? ` (${c.request.auth.key} in ${c.request.auth.in})` : "")))];
    $("#authInfo").textContent = types.length
      ? `Applied: ${types.join(", ")}. Set it once on the collection's Authorization tab variables; every request uses it.`
      : "No authorization found in the contract. Pick a type above if your API needs one.";
    render();
  } catch(e){
    console.error(e);
    showMsg(e.message || String(e), "err");
  }
}
function exportCases(){
  return {
    api: { title: spec.info && spec.info.title, version: spec.info && spec.info.version, baseUrl: baseUrl() },
    generatedAt: new Date().toISOString(),
    totalTestCases: RESULT.cases.length,
    testCases: RESULT.cases.map(c => ({
      id: c.id, operationId: c.operationId, tag: c.tag, category: c.category, name: c.name,
      method: c.method, path: c.path, request: c.request,
      expectedStatus: c.expected.status,
      responseSchema: c.expected.responseSchema || undefined
    }))
  };
}
function render(){
  $("#empty").hidden = true;
  $("#results").hidden = false;
  const by = k => RESULT.cases.filter(c => c.category === k).length;
  $("#stats").innerHTML = [
    ["Total", RESULT.cases.length], ["Positive", by("positive")], ["Negative", by("negative")], ["Boundary", by("boundary")], ["Security", by("security")]
  ].map(([l, v]) => `<div><b>${v}</b>${l}</div>`).join("");
  renderList();
  renderOut();
}
function renderList(){
  const q = $("#q").value.toLowerCase().trim();
  const cat = $("#fcat").value;
  const list = RESULT.cases.filter(c => (!cat || c.category === cat) &&
    (!q || (c.path + " " + c.name + " " + c.expected.status + " " + c.method).toLowerCase().includes(q)));
  const shown = list.slice(0, 400);
  $("#list").innerHTML = shown.length ? shown.map(c => `
    <div class="tc" tabindex="0" role="button" aria-expanded="false">
      <span class="m ${c.method}">${c.method}</span>
      <div><div class="n"><span class="cat ${c.category}">${c.category}</span>${esc(c.name.replace(/^[^:]+:\s*/, ""))}</div><div class="p">${esc(c.path)} · ${c.id}</div></div>
      <span class="st">${c.expected.status}</span>
      <div class="detail"><pre>${esc(JSON.stringify(c.request, null, 2))}</pre></div>
    </div>`).join("") + (list.length > shown.length ? `<div class="empty">Showing 400 of ${list.length}. Narrow the filter to see the rest; the JSON export includes all of them.</div>` : "")
    : `<div class="empty">No test cases match this filter.</div>`;
}
function renderOut(){
  const isPm = currentTab === "postman";
  $("#out").value = JSON.stringify(isPm ? RESULT.collection : exportCases(), null, 2);
  $("#copy").textContent = isPm ? "Copy collection" : "Copy JSON";
  $("#download").textContent = isPm ? "Download collection" : "Download JSON";
  $("#pmhint").hidden = !isPm;
  $("#copied").textContent = "";
}
function setTab(t){
  currentTab = t;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  document.querySelector('[data-panel="browse"]').hidden = t !== "browse";
  document.querySelector('[data-panel="json"]').hidden = t === "browse";
  if (t !== "browse") renderOut();
}
async function copyOut(){
  const ta = $("#out");
  let ok = false;
  try { await navigator.clipboard.writeText(ta.value); ok = true; } catch(e){
    ta.focus(); ta.select();
    try { ok = document.execCommand("copy"); } catch(e2){}
  }
  $("#copied").textContent = ok ? "Copied to clipboard." : "Copy was blocked by the browser. Use Select all, then Ctrl/Cmd+C.";
}

function downloadOut(){
  const isPm = currentTab === "postman";
  const title = ((spec.info && spec.info.title) || "api").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "api";
  const name = `${title}-${isPm ? "postman_collection" : "test-cases"}.json`;
  const url = URL.createObjectURL(new Blob([$("#out").value], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#copied").textContent = `Downloaded ${name}.`;
}
