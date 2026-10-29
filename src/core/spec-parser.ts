/* Parses pasted contracts (JSON or YAML) and works out the base URL. */
import yaml from "js-yaml";
import type { OpenApiDoc } from "./types";

export function baseUrl(doc: OpenApiDoc): string {
  if (doc.servers && doc.servers.length) {
    let u: string = doc.servers[0].url || "";
    const vars = doc.servers[0].variables || {};
    u = u.replace(/\{([^}]+)\}/g, (m, k) => (vars[k] ? vars[k].default : m));
    return u.replace(/\/$/, "");
  }
  if (doc.host) {
    const scheme = (doc.schemes && doc.schemes[0]) || "https";
    return `${scheme}://${doc.host}${(doc.basePath || "").replace(/\/$/, "")}`;
  }
  return "http://localhost:8080";
}

function yamlError(e: unknown): string {
  const y = e as { reason?: string; message?: string; mark?: { line: number } };
  return "Invalid YAML: " + (y.reason || y.message) + (y.mark ? ` (line ${y.mark.line + 1})` : "");
}

function checkDoc(doc: unknown): OpenApiDoc {
  const d = doc as OpenApiDoc;
  if (!d || typeof d !== "object" || (!d.openapi && !d.swagger)) throw new Error('This doesn\'t look like an OpenAPI contract. The document needs a top-level "openapi" or "swagger" field.');
  if (!d.paths || !Object.keys(d.paths).length) throw new Error('The contract has no "paths", so there are no endpoints to test.');
  return d;
}

export function parseSpec(text: string): OpenApiDoc {
  text = text.trim();
  if (!text) throw new Error("The contract box is empty. Paste an OpenAPI document or upload a file.");
  let doc: unknown;
  if (text.startsWith("{")) {
    try { doc = JSON.parse(text); } catch (e) { throw new Error("Invalid JSON: " + (e as Error).message); }
  } else {
    try { doc = yaml.load(text); } catch (e) { throw new Error(yamlError(e)); }
  }
  return checkDoc(doc);
}

/* docs mode: one paste may hold several YAML contracts separated by "---" lines */
export function parseSpecs(text: string): OpenApiDoc[] {
  text = text.trim();
  if (!text) throw new Error("The contract box is empty. Paste one or more OpenAPI documents, or upload files.");
  if (text.startsWith("{")) return [parseSpec(text)];
  let docs: unknown[];
  try { docs = yaml.loadAll(text).filter((d) => d != null); } catch (e) { throw new Error(yamlError(e)); }
  return docs.map((d, i) => {
    try { return checkDoc(d); } catch (e) { throw new Error(docs.length > 1 ? `Document ${i + 1}: ${(e as Error).message}` : (e as Error).message); }
  });
}
