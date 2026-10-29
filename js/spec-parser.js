/* Parses the pasted contract (JSON or YAML) and works out the base URL. */
"use strict";

/* ---------- base URL ---------- */
function baseUrl(){
  if (spec.servers && spec.servers.length){
    let u = spec.servers[0].url || "";
    const vars = spec.servers[0].variables || {};
    u = u.replace(/\{([^}]+)\}/g, (m, k) => vars[k] ? vars[k].default : m);
    return u.replace(/\/$/, "");
  }
  if (spec.host){
    const scheme = (spec.schemes && spec.schemes[0]) || "https";
    return `${scheme}://${spec.host}${(spec.basePath || "").replace(/\/$/, "")}`;
  }
  return "http://localhost:8080";
}

function parseSpec(text){
  text = text.trim();
  if (!text) throw new Error("The contract box is empty. Paste an OpenAPI document or upload a file.");
  let doc;
  if (text.startsWith("{")){
    try { doc = JSON.parse(text); } catch(e){ throw new Error("Invalid JSON: " + e.message); }
  } else {
    if (!window.jsyaml) throw new Error("YAML support could not load. Paste the contract as JSON instead.");
    try { doc = window.jsyaml.load(text); } catch(e){ throw new Error(yamlError(e)); }
  }
  return checkDoc(doc);
}
function yamlError(e){
  return "Invalid YAML: " + (e.reason || e.message) + (e.mark ? ` (line ${e.mark.line + 1})` : "");
}
function checkDoc(doc){
  if (!doc || typeof doc !== "object" || (!doc.openapi && !doc.swagger)) throw new Error('This doesn\'t look like an OpenAPI contract. The document needs a top-level "openapi" or "swagger" field.');
  if (!doc.paths || !Object.keys(doc.paths).length) throw new Error('The contract has no "paths", so there are no endpoints to test.');
  return doc;
}

/* docs mode: one paste may hold several YAML contracts separated by "---" lines */
function parseSpecs(text){
  text = text.trim();
  if (!text) throw new Error("The contract box is empty. Paste one or more OpenAPI documents, or upload files.");
  if (text.startsWith("{") || !window.jsyaml) return [parseSpec(text)];
  let docs;
  try { docs = window.jsyaml.loadAll(text).filter(d => d != null); } catch(e){ throw new Error(yamlError(e)); }
  return docs.map((d, i) => {
    try { return checkDoc(d); } catch(e){ throw new Error(docs.length > 1 ? `Document ${i + 1}: ${e.message}` : e.message); }
  });
}
