/* Converts a response schema into a Postman-safe JSON schema. */
"use strict";

/* ---------- response schema -> Postman-safe JSON schema ---------- */
const KEEP = ["type","properties","required","items","enum","minimum","maximum","minLength","maxLength","minItems","maxItems","additionalProperties","pattern"];
function toJsonSchema(s0, d, seen){
  d = d || 0; seen = seen || new Set();
  if (d > 6 || !s0) return {};
  if (s0.$ref){ if (seen.has(s0.$ref)) return {}; seen = new Set(seen); seen.add(s0.$ref); }
  const s = mergeAll(s0);
  const o = {};
  for (const k of KEEP) if (s[k] !== undefined) o[k] = clone(s[k]);
  if (o.properties){ const p = {}; for (const [k, v] of Object.entries(s.properties)) p[k] = toJsonSchema(v, d + 1, seen); o.properties = p; }
  if (s.items) o.items = toJsonSchema(s.items, d + 1, seen);
  if (typeof s.additionalProperties === "object") o.additionalProperties = toJsonSchema(s.additionalProperties, d + 1, seen);
  if (o.required && o.properties){ o.required = o.required.filter(r => o.properties[r]); if (!o.required.length) delete o.required; }
  if (isNullable(s) && o.type && !Array.isArray(o.type)) o.type = [o.type, "null"];
  if (o.enum && isNullable(s) && !o.enum.includes(null)) o.enum.push(null);
  return o;
}
