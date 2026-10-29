/* Builds valid sample values from a schema. */
import { typeOf, type Spec } from "./refs";
import type { Schema } from "./types";
import { clone } from "./util";

export interface Bounds {
  min?: number;
  max?: number;
  exMin: boolean;
  exMax: boolean;
}

export function bounds(s: Schema): Bounds {
  let min = s.minimum, max = s.maximum, exMin = false, exMax = false;
  if (typeof s.exclusiveMinimum === "number") { min = s.exclusiveMinimum; exMin = true; }
  else if (s.exclusiveMinimum === true) exMin = true;
  if (typeof s.exclusiveMaximum === "number") { max = s.exclusiveMaximum; exMax = true; }
  else if (s.exclusiveMaximum === true) exMax = true;
  return { min, max, exMin, exMax };
}

function validNum(s: Schema, isInt: boolean): number {
  const b = bounds(s);
  const step = isInt ? 1 : 0.5;
  const lo = b.min !== undefined ? b.min + (b.exMin ? step : 0) : undefined;
  const hi = b.max !== undefined ? b.max - (b.exMax ? step : 0) : undefined;
  let v: number;
  if (lo !== undefined && hi !== undefined) v = (lo + hi) / 2;
  else if (lo !== undefined) v = lo + (isInt ? 1 : 1.5);
  else if (hi !== undefined) v = hi > 1 ? Math.min(1, hi) : hi;
  else v = isInt ? 1 : 1.5;
  if (isInt) v = Math.round(v);
  if (s.multipleOf) v = Math.ceil(v / s.multipleOf) * s.multipleOf;
  return v;
}

const BY_FORMAT: Record<string, string> = {
  email: "user@example.com", uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6", date: "2024-01-15",
  "date-time": "2024-01-15T10:30:00Z", time: "10:30:00", uri: "https://example.com/resource", url: "https://example.com/resource",
  hostname: "example.com", ipv4: "192.168.1.10", ipv6: "2001:db8::1", byte: "aGVsbG8=", password: "P@ssw0rd123", phone: "+14155550123",
};

function sampleString(s: Schema, name?: string): string {
  const f = s.format;
  let v = (f && BY_FORMAT[f]) || (name ? String(name).replace(/[^a-zA-Z0-9]/g, "") + "_value" : "string");
  if (s.minLength && v.length < s.minLength) v = v + "a".repeat(s.minLength - v.length);
  if (s.maxLength !== undefined && v.length > s.maxLength) v = v.slice(0, Math.max(s.maxLength, 0));
  return v;
}

export function sample(spec: Spec, s0: Schema | undefined, d = 0, name?: string): unknown {
  const s = spec.mergeAll(s0);
  if (d > 7) return null;
  if (s.example !== undefined) return clone(s.example);
  if (Array.isArray(s.examples) && s.examples.length) return clone(s.examples[0]);
  if (s.default !== undefined) return clone(s.default);
  if (s.const !== undefined) return clone(s.const);
  if (Array.isArray(s.enum) && s.enum.length) return clone(s.enum.find((e: unknown) => e !== null) ?? s.enum[0]);
  switch (typeOf(s)) {
    case "object": {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries<Schema>(s.properties || {})) {
        if (spec.mergeAll(v).readOnly) continue;
        o[k] = sample(spec, v, d + 1, k);
      }
      return o;
    }
    case "array": {
      const n = Math.max(1, s.minItems || 1);
      return Array.from({ length: n }, () => sample(spec, s.items || {}, d + 1, name));
    }
    case "integer": return validNum(s, true);
    case "number": return validNum(s, false);
    case "boolean": return true;
    default: return sampleString(s, name);
  }
}
