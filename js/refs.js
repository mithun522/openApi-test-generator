/* $ref resolution, allOf merging and schema type helpers. */
"use strict";

/* ---------- $ref handling ---------- */
function getRef(ref){
  if (typeof ref !== "string" || !ref.startsWith("#/")) return {};
  return ref.slice(2).split("/").map(p => decodeURIComponent(p).replace(/~1/g,"/").replace(/~0/g,"~"))
    .reduce((o,k) => (o && typeof o === "object") ? o[k] : undefined, spec) || {};
}
function resolve(s){
  let g = 0;
  while (s && s.$ref && g < 30){ s = getRef(s.$ref); g++; }
  return s || {};
}
function mergeAll(s0){
  let s = resolve(s0);
  if (s.allOf){
    const out = Object.assign({}, s, { properties: Object.assign({}, s.properties || {}), required: [...(s.required || [])] });
    delete out.allOf;
    for (const sub of s.allOf){
      const r = mergeAll(sub);
      Object.assign(out.properties, r.properties || {});
      out.required.push(...(r.required || []));
      for (const k of ["type","minLength","maxLength","minimum","maximum","enum","format","items","example"]){
        if (r[k] !== undefined && out[k] === undefined) out[k] = r[k];
      }
    }
    return out;
  }
  if (s.oneOf || s.anyOf){
    const first = (s.oneOf || s.anyOf)[0];
    const rest = Object.assign({}, s); delete rest.oneOf; delete rest.anyOf;
    return mergeAll(Object.assign(rest, mergeAll(first)));
  }
  return s;
}
function typeOf(s){
  let t = s.type;
  if (Array.isArray(t)) t = t.find(x => x !== "null") || t[0];
  if (!t){
    if (s.properties) return "object";
    if (s.items) return "array";
    if (s.enum && s.enum.length) return typeof s.enum[0] === "number" ? "number" : "string";
    return "string";
  }
  return t;
}
function isNullable(s){
  return s.nullable === true || s["x-nullable"] === true || (Array.isArray(s.type) && s.type.includes("null"));
}
