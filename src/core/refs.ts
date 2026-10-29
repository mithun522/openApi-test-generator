/* $ref resolution, allOf merging and schema type helpers. */
import type { OpenApiDoc, Schema } from "./types";

/* A parsed contract plus the lookups that need the whole document. */
export class Spec {
  constructor(readonly doc: OpenApiDoc) {}

  getRef(ref: unknown): Schema {
    if (typeof ref !== "string" || !ref.startsWith("#/")) return {};
    return (
      ref
        .slice(2)
        .split("/")
        .map((p) => decodeURIComponent(p).replace(/~1/g, "/").replace(/~0/g, "~"))
        .reduce<Schema | undefined>((o, k) => (o && typeof o === "object" ? o[k] : undefined), this.doc) || {}
    );
  }

  resolve(s: Schema | undefined | null): Schema {
    let g = 0;
    while (s && s.$ref && g < 30) {
      s = this.getRef(s.$ref);
      g++;
    }
    return s || {};
  }

  mergeAll(s0: Schema | undefined | null): Schema {
    const s = this.resolve(s0);
    if (s.allOf) {
      const out: Schema = Object.assign({}, s, { properties: Object.assign({}, s.properties || {}), required: [...(s.required || [])] });
      delete out.allOf;
      for (const sub of s.allOf) {
        const r = this.mergeAll(sub);
        Object.assign(out.properties, r.properties || {});
        out.required.push(...(r.required || []));
        for (const k of ["type", "minLength", "maxLength", "minimum", "maximum", "enum", "format", "items", "example"]) {
          if (r[k] !== undefined && out[k] === undefined) out[k] = r[k];
        }
      }
      return out;
    }
    if (s.oneOf || s.anyOf) {
      const first = (s.oneOf || s.anyOf)[0];
      const rest: Schema = Object.assign({}, s);
      delete rest.oneOf;
      delete rest.anyOf;
      return this.mergeAll(Object.assign(rest, this.mergeAll(first)));
    }
    return s;
  }
}

export function typeOf(s: Schema): string {
  let t = s.type;
  if (Array.isArray(t)) t = t.find((x: string) => x !== "null") || t[0];
  if (!t) {
    if (s.properties) return "object";
    if (s.items) return "array";
    if (s.enum && s.enum.length) return typeof s.enum[0] === "number" ? "number" : "string";
    return "string";
  }
  return t;
}

export function isNullable(s: Schema): boolean {
  return s.nullable === true || s["x-nullable"] === true || (Array.isArray(s.type) && s.type.includes("null"));
}
