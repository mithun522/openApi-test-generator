/* Converts a response schema into a Postman-safe JSON schema. */
import { isNullable, type Spec } from "./refs";
import type { Schema } from "./types";
import { clone } from "./util";

const KEEP = ["type", "properties", "required", "items", "enum", "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "additionalProperties", "pattern"];

export function toJsonSchema(spec: Spec, s0: Schema | undefined, d = 0, seen: Set<string> = new Set()): Schema {
  if (d > 6 || !s0) return {};
  if (s0.$ref) {
    if (seen.has(s0.$ref)) return {};
    seen = new Set(seen);
    seen.add(s0.$ref);
  }
  const s = spec.mergeAll(s0);
  const o: Schema = {};
  for (const k of KEEP) if (s[k] !== undefined) o[k] = clone(s[k]);
  if (o.properties) {
    const p: Schema = {};
    for (const [k, v] of Object.entries<Schema>(s.properties)) p[k] = toJsonSchema(spec, v, d + 1, seen);
    o.properties = p;
  }
  if (s.items) o.items = toJsonSchema(spec, s.items, d + 1, seen);
  if (typeof s.additionalProperties === "object") o.additionalProperties = toJsonSchema(spec, s.additionalProperties, d + 1, seen);
  if (o.required && o.properties) {
    o.required = o.required.filter((r: string) => o.properties[r]);
    if (!o.required.length) delete o.required;
  }
  if (isNullable(s) && o.type && !Array.isArray(o.type)) o.type = [o.type, "null"];
  if (o.enum && isNullable(s) && !o.enum.includes(null)) o.enum.push(null);
  return o;
}
