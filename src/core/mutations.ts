/* Invalid and boundary values for a schema, and the request-body field walker. */
import { isNullable, typeOf, type Spec } from "./refs";
import { bounds, sample } from "./sampling";
import type { Options, Schema } from "./types";
import { clone } from "./util";

export interface Mutation {
  label: string;
  value: unknown;
  valid: boolean;
  cat: "negative" | "boundary";
}

function wrongType(t: string): unknown {
  return ({ string: 12345, integer: "not_a_number", number: "not_a_number", boolean: "not_a_boolean", object: "not_an_object", array: "not_an_array" } as Record<string, unknown>)[t] ?? 12345;
}

const BAD_FORMAT: Record<string, string> = {
  email: "not-an-email", uuid: "not-a-uuid", date: "2024-13-45", "date-time": "not-a-datetime", time: "25:61:00",
  uri: "not a uri", url: "not a url", ipv4: "999.999.1.1", ipv6: "not-ipv6", hostname: "-bad-host-", byte: "%%%not-base64%%%",
};

export function mutations(spec: Spec, s: Schema, opts: Options, validVal?: unknown): Mutation[] {
  const out: Mutation[] = [];
  const t = typeOf(s);
  const neg = (label: string, value: unknown) => out.push({ label, value, valid: false, cat: "negative" });
  const bnd = (label: string, value: unknown, valid: boolean) => out.push({ label, value, valid, cat: "boundary" });

  neg(`wrong type (expects ${t})`, wrongType(t));
  if (opts.nulls && !isNullable(s)) neg("null value", null);

  if (Array.isArray(s.enum) && s.enum.length) {
    neg("value outside enum", t === "string" ? "INVALID_ENUM_VALUE" : 987654321);
    return out;
  }
  if (t === "string") {
    if (s.minLength > 0) {
      bnd(`length ${s.minLength - 1} (below minLength ${s.minLength})`, "a".repeat(s.minLength - 1), false);
      bnd(`length ${s.minLength} (exactly minLength)`, "a".repeat(s.minLength), true);
    } else if (s.minLength === undefined && !s.format && !s.pattern && opts.emptyStrings) {
      neg("empty string", "");
    }
    if (s.maxLength !== undefined) {
      bnd(`length ${s.maxLength} (exactly maxLength)`, "a".repeat(s.maxLength), true);
      bnd(`length ${s.maxLength + 1} (above maxLength ${s.maxLength})`, "a".repeat(s.maxLength + 1), false);
    }
    if (s.format && BAD_FORMAT[s.format]) neg(`invalid ${s.format} format`, BAD_FORMAT[s.format]);
    if (s.pattern) neg(`does not match pattern ${s.pattern}`, "@@@ ~invalid~ @@@");
  }
  if (t === "integer" || t === "number") {
    const isInt = t === "integer";
    const step = isInt ? 1 : 0.01;
    const b = bounds(s);
    const r = (n: number) => +n.toFixed(4);
    if (b.min !== undefined) {
      if (b.exMin) { bnd(`${b.min} (equal to exclusiveMinimum)`, b.min, false); bnd(`${r(b.min + step)} (just above exclusiveMinimum)`, r(b.min + step), true); }
      else { bnd(`${b.min} (exactly minimum)`, b.min, true); bnd(`${r(b.min - step)} (below minimum)`, r(b.min - step), false); }
    }
    if (b.max !== undefined) {
      if (b.exMax) { bnd(`${b.max} (equal to exclusiveMaximum)`, b.max, false); bnd(`${r(b.max - step)} (just below exclusiveMaximum)`, r(b.max - step), true); }
      else { bnd(`${b.max} (exactly maximum)`, b.max, true); bnd(`${r(b.max + step)} (above maximum)`, r(b.max + step), false); }
    }
    if (isInt) neg("decimal instead of integer", 1.5);
  }
  if (t === "array") {
    const item = Array.isArray(validVal) && validVal.length ? validVal[0] : sample(spec, s.items || {});
    if (s.minItems > 0) {
      bnd(`${s.minItems - 1} items (below minItems ${s.minItems})`, Array(s.minItems - 1).fill(item), false);
      bnd(`${s.minItems} items (exactly minItems)`, Array(s.minItems).fill(item), true);
    }
    if (s.maxItems !== undefined) {
      bnd(`${s.maxItems} items (exactly maxItems)`, Array(s.maxItems).fill(item), true);
      bnd(`${s.maxItems + 1} items (above maxItems ${s.maxItems})`, Array(s.maxItems + 1).fill(item), false);
    }
    if (s.uniqueItems && item !== undefined) neg("duplicate items (uniqueItems)", [item, item]);
  }
  return out;
}

/* ---------- body field walker ---------- */
export type FieldPath = (string | number)[];
export interface BodyField {
  path: FieldPath;
  schema: Schema;
  required?: boolean;
  closed?: boolean;
}

export function fields(spec: Spec, s0: Schema, path: FieldPath = [], d = 0, out: BodyField[] = []): BodyField[] {
  if (d > 5) return out;
  const s = spec.mergeAll(s0);
  const t = typeOf(s);
  if (t === "object") {
    const req = new Set<string>(s.required || []);
    for (const [k, v] of Object.entries<Schema>(s.properties || {})) {
      const r = spec.mergeAll(v);
      if (r.readOnly) continue;
      const p = [...path, k];
      out.push({ path: p, schema: r, required: req.has(k) });
      fields(spec, v, p, d + 1, out);
    }
    if (s.additionalProperties === false) out.push({ path, schema: s, closed: true });
  } else if (t === "array" && s.items) {
    fields(spec, s.items, [...path, 0], d + 1, out);
  }
  return out;
}

export function pathLabel(p: FieldPath): string {
  return p.map((k, i) => (typeof k === "number" ? `[${k}]` : (i ? "." : "") + k)).join("") || "request body";
}

export function setAt(obj: unknown, path: FieldPath, value: unknown, del?: boolean): unknown {
  if (!path.length) return value;
  const root = clone(obj);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = root;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return root;
    cur = cur[path[i]];
  }
  if (cur == null || typeof cur !== "object") return root;
  const last = path[path.length - 1];
  if (del) {
    if (Array.isArray(cur)) cur.splice(last as number, 1);
    else delete cur[last];
  } else cur[last] = value;
  return root;
}
