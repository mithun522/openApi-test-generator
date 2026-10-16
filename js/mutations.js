/* Invalid and boundary values for a schema, and the request-body field walker. */
"use strict";

/* ---------- mutations: invalid & boundary values for one schema ---------- */
function wrongType(t){
  return ({ string: 12345, integer: "not_a_number", number: "not_a_number", boolean: "not_a_boolean", object: "not_an_object", array: "not_an_array" })[t] ?? 12345;
}
function mutations(s, opts, validVal){
  const out = [];
  const t = typeOf(s);
  const neg = (label, value) => out.push({ label, value, valid: false, cat: "negative" });
  const bnd = (label, value, valid) => out.push({ label, value, valid, cat: "boundary" });

  neg(`wrong type (expects ${t})`, wrongType(t));
  if (opts.nulls && !isNullable(s)) neg("null value", null);

  if (Array.isArray(s.enum) && s.enum.length){
    neg("value outside enum", t === "string" ? "INVALID_ENUM_VALUE" : 987654321);
    return out;
  }
  if (t === "string"){
    if (s.minLength > 0){
      bnd(`length ${s.minLength - 1} (below minLength ${s.minLength})`, "a".repeat(s.minLength - 1), false);
      bnd(`length ${s.minLength} (exactly minLength)`, "a".repeat(s.minLength), true);
    } else if (s.minLength === undefined && !s.format && !s.pattern && opts.emptyStrings){
      neg("empty string", "");
    }
    if (s.maxLength !== undefined){
      bnd(`length ${s.maxLength} (exactly maxLength)`, "a".repeat(s.maxLength), true);
      bnd(`length ${s.maxLength + 1} (above maxLength ${s.maxLength})`, "a".repeat(s.maxLength + 1), false);
    }
    const badFormat = { "email":"not-an-email","uuid":"not-a-uuid","date":"2024-13-45","date-time":"not-a-datetime","time":"25:61:00",
      "uri":"not a uri","url":"not a url","ipv4":"999.999.1.1","ipv6":"not-ipv6","hostname":"-bad-host-","byte":"%%%not-base64%%%" };
    if (s.format && badFormat[s.format]) neg(`invalid ${s.format} format`, badFormat[s.format]);
    if (s.pattern) neg(`does not match pattern ${s.pattern}`, "@@@ ~invalid~ @@@");
  }
  if (t === "integer" || t === "number"){
    const isInt = t === "integer";
    const step = isInt ? 1 : 0.01;
    const b = bounds(s);
    if (b.min !== undefined){
      if (b.exMin){ bnd(`${b.min} (equal to exclusiveMinimum)`, b.min, false); bnd(`${+(b.min + step).toFixed(4)} (just above exclusiveMinimum)`, +(b.min + step).toFixed(4), true); }
      else { bnd(`${b.min} (exactly minimum)`, b.min, true); bnd(`${+(b.min - step).toFixed(4)} (below minimum)`, +(b.min - step).toFixed(4), false); }
    }
    if (b.max !== undefined){
      if (b.exMax){ bnd(`${b.max} (equal to exclusiveMaximum)`, b.max, false); bnd(`${+(b.max - step).toFixed(4)} (just below exclusiveMaximum)`, +(b.max - step).toFixed(4), true); }
      else { bnd(`${b.max} (exactly maximum)`, b.max, true); bnd(`${+(b.max + step).toFixed(4)} (above maximum)`, +(b.max + step).toFixed(4), false); }
    }
    if (isInt) neg("decimal instead of integer", 1.5);
  }
  if (t === "array"){
    const item = validVal && validVal.length ? validVal[0] : sample(s.items || {});
    if (s.minItems > 0){
      bnd(`${s.minItems - 1} items (below minItems ${s.minItems})`, Array(s.minItems - 1).fill(item), false);
      bnd(`${s.minItems} items (exactly minItems)`, Array(s.minItems).fill(item), true);
    }
    if (s.maxItems !== undefined){
      bnd(`${s.maxItems} items (exactly maxItems)`, Array(s.maxItems).fill(item), true);
      bnd(`${s.maxItems + 1} items (above maxItems ${s.maxItems})`, Array(s.maxItems + 1).fill(item), false);
    }
    if (s.uniqueItems && item !== undefined) neg("duplicate items (uniqueItems)", [item, item]);
  }
  return out;
}

/* ---------- body field walker ---------- */
function fields(s0, path, d, out){
  path = path || []; d = d || 0; out = out || [];
  if (d > 5) return out;
  const s = mergeAll(s0);
  const t = typeOf(s);
  if (t === "object"){
    const req = new Set(s.required || []);
    for (const [k, v] of Object.entries(s.properties || {})){
      const r = mergeAll(v);
      if (r.readOnly) continue;
      const p = [...path, k];
      out.push({ path: p, schema: r, required: req.has(k) });
      fields(v, p, d + 1, out);
    }
    if (s.additionalProperties === false) out.push({ path, schema: s, closed: true });
  } else if (t === "array" && s.items){
    fields(s.items, [...path, 0], d + 1, out);
  }
  return out;
}
function pathLabel(p){
  return p.map((k, i) => typeof k === "number" ? `[${k}]` : (i ? "." : "") + k).join("") || "request body";
}
function setAt(obj, path, value, del){
  if (!path.length) return value;
  const root = clone(obj);
  let cur = root;
  for (let i = 0; i < path.length - 1; i++){
    if (cur == null || typeof cur !== "object") return root;
    cur = cur[path[i]];
  }
  if (cur == null || typeof cur !== "object") return root;
  const last = path[path.length - 1];
  if (del){ if (Array.isArray(cur)) cur.splice(last, 1); else delete cur[last]; }
  else cur[last] = value;
  return root;
}
