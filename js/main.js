/* Event wiring. Loaded last. */
"use strict";

$("#gen").addEventListener("click", run);
let previewTimer;
$("#spec").addEventListener("input", () => { clearTimeout(previewTimer); previewTimer = setTimeout(previewOps, 400); });
$("#opsFilter").addEventListener("input", renderOps);
$("#opsAll").addEventListener("click", () => { allOps.forEach(o => selectedOps.add(o.key)); renderOps(); if (RESULT.cases.length) run(); });
$("#opsNone").addEventListener("click", () => { selectedOps.clear(); renderOps(); });
$("#opsBox").addEventListener("change", e => {
  const k = e.target.dataset.op; if (k === undefined) return;
  e.target.checked ? selectedOps.add(k) : selectedOps.delete(k);
  $("#opsCount").textContent = `${selectedOps.size} of ${allOps.length} selected`;
  if (RESULT.cases.length && selectedOps.size) run();
});
$("#sample").addEventListener("click", () => { $("#spec").value = SAMPLE; run(); });
$("#file").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("#spec").value = r.result; run(); };
  r.onerror = () => showMsg("Couldn't read that file. Try pasting its contents instead.", "err");
  r.readAsText(f);
  e.target.value = "";
});
document.querySelectorAll("[data-opt],[data-var]").forEach(el => el.addEventListener("change", () => { if (spec) run(); }));
["#authMode", "#apiKeyName", "#apiKeyIn"].forEach(id => $(id).addEventListener("change", () => {
  $("#apiKeyOpts").hidden = $("#authMode").value !== "apikey";
  if (spec) run();
}));
document.querySelectorAll(".tabs button[data-tab]").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
$("#q").addEventListener("input", renderList);
$("#fcat").addEventListener("change", renderList);
$("#copy").addEventListener("click", copyOut);
$("#download").addEventListener("click", downloadOut);
$("#selectall").addEventListener("click", () => { $("#out").focus(); $("#out").select(); });
$("#list").addEventListener("click", e => {
  const tc = e.target.closest(".tc"); if (!tc || e.target.closest(".detail")) return;
  tc.classList.toggle("open"); tc.setAttribute("aria-expanded", tc.classList.contains("open"));
});
$("#list").addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("tc")){ e.preventDefault(); e.target.click(); }
});

/* docs mode */
document.querySelectorAll(".modes button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
$("#docsAdd").addEventListener("click", addFromPaste);
$("#docsFile").addEventListener("change", addFromFiles);
$("#docsSample").addEventListener("click", loadSampleSystem);
$("#docsClear").addEventListener("click", clearContracts);
$("#docsList").addEventListener("click", e => { const i = e.target.dataset.rm; if (i !== undefined) removeContract(+i); });
$("#linksBox").addEventListener("change", toggleLink);
$("#sysName").addEventListener("change", () => buildDocs(""));
document.querySelectorAll("[data-dtab]").forEach(b => b.addEventListener("click", () => setDocsView(b.dataset.dtab)));
$("#docsCopy").addEventListener("click", copyDocs);
$("#docsDownload").addEventListener("click", downloadDocs);
