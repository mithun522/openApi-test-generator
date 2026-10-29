/* Docs mode: turns one parsed contract into a service model for documentation. */
"use strict";

/* refs.js, sampling.js and baseUrl() read the global `spec`; point it at `doc` for the duration of fn */
function withSpec(doc, fn){
  const prev = spec;
  spec = doc;
  try { return fn(); } finally { spec = prev; }
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "service";
const asList = v => v == null ? [] : Array.isArray(v) ? v : [v];

/* ---------- schema descriptions ---------- */
function schemaName(s){ // { $ref: "#/components/schemas/Order" } -> "Order"
  return s && typeof s.$ref === "string" ? s.$ref.split("/").pop() : null;
}
function typeLabel(s0){
  const name = schemaName(s0);
  if (name && !s0.$ref.startsWith("#/")) return `${name} (external reference)`;
  const s = mergeAll(s0);
  let t = typeOf(s);
  if (t === "array"){
    const it = s.items || {};
    t = `array<${schemaName(it) || typeOf(mergeAll(it))}>`;
  } else if (name) t = name;
  else if (s.format) t += ` (${s.format})`;
  if (isNullable(s)) t += ", nullable";
  return t;
}
function constraints(s){
  const out = [];
  if (Array.isArray(s.enum)) out.push("one of " + s.enum.map(v => JSON.stringify(v)).join(", "));
  const b = bounds(s);
  if (b.min !== undefined) out.push((b.exMin ? "> " : "≥ ") + b.min);
  if (b.max !== undefined) out.push((b.exMax ? "< " : "≤ ") + b.max);
  if (s.minLength !== undefined) out.push(`min length ${s.minLength}`);
  if (s.maxLength !== undefined) out.push(`max length ${s.maxLength}`);
  if (s.pattern) out.push(`pattern ${s.pattern}`);
  if (s.minItems !== undefined) out.push(`min ${s.minItems} items`);
  if (s.maxItems !== undefined) out.push(`max ${s.maxItems} items`);
  if (s.uniqueItems) out.push("unique items");
  if (s.multipleOf !== undefined) out.push(`multiple of ${s.multipleOf}`);
  if (s.default !== undefined) out.push(`default ${JSON.stringify(s.default)}`);
  if (s.readOnly) out.push("read-only");
  if (s.writeOnly) out.push("write-only");
  return out.join("; ");
}
/* one row per field; inline objects are expanded with dotted names, named models are left to the Data models section */
function fieldRows(s0, prefix, d, out){
  prefix = prefix || ""; d = d || 0; out = out || [];
  if (d > 4 || !s0) return out;
  const s = mergeAll(s0);
  const t = typeOf(s);
  if (t === "object" && s.properties){
    const req = new Set(s.required || []);
    for (const [k, v] of Object.entries(s.properties)){
      const r = mergeAll(v);
      out.push({ name: prefix + k, type: typeLabel(v), required: req.has(k), rules: constraints(r), description: r.description || "" });
      const inner = typeOf(r) === "array" ? r.items : v;
      if (inner && !schemaName(inner)) fieldRows(inner, prefix + k + (typeOf(r) === "array" ? "[]." : "."), d + 1, out);
    }
  } else if (t === "array" && s.items && !d){
    fieldRows(s.items, prefix + "[].", d + 1, out);
  }
  return out;
}
/* like sample(), but keeps readOnly fields: response examples should show server-set values such as IDs */
function exampleOf(s0, d, name){
  d = d || 0;
  const s = mergeAll(s0);
  if (d > 6) return null;
  if (s.example !== undefined || s.examples || s.default !== undefined || s.const !== undefined || s.enum) return sample(s, d, name);
  const t = typeOf(s);
  if (t === "object") return Object.fromEntries(Object.entries(s.properties || {}).map(([k, v]) => [k, exampleOf(v, d + 1, k)]));
  if (t === "array") return [exampleOf(s.items || {}, d + 1, name)];
  return sample(s, d, name);
}

/* ---------- auth ---------- */
function authLabel(name, sc){
  const a = schemeToAuth(resolve(sc || {}));
  if (!a) return name;
  if (a.type === "apikey") return `API key ${a.key} in ${a.in}`;
  return ({ bearer: "Bearer token", basic: "Basic auth", oauth2: "OAuth 2.0" })[a.type] || name;
}

/* ---------- declared links ---------- */
// "Payment Service POST /payments", "payment-service", or { service, operation: "POST /payments" }
function parseCall(v){
  if (v && typeof v === "object"){
    if (!v.service) return null;
    const c = v.operation ? parseCall(`${v.service} ${v.operation}`) : { service: String(v.service).trim(), method: String(v.method || "").toUpperCase(), path: v.path || "" };
    c.note = v.description || v.note || "";
    return c;
  }
  if (typeof v !== "string" || !v.trim()) return null;
  const m = v.trim().match(/^(.*?):?\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)$/i);
  return m ? { service: m[1].trim(), method: m[2].toUpperCase(), path: m[3], note: "" } : { service: v.trim(), method: "", path: "", note: "" };
}

/* ---------- operations ---------- */
function bodyOf(op, params){
  let schema = null, contentType = null, required = false, example;
  if (op.requestBody){
    const rb = resolve(op.requestBody);
    required = !!rb.required;
    const content = rb.content || {};
    contentType = Object.keys(content).find(c => /json/i.test(c)) || Object.keys(content)[0] || null;
    const media = contentType && content[contentType];
    if (media){ schema = media.schema || null; example = media.example; }
  } else {
    const bp = params.find(p => p.in === "body");
    const fp = params.filter(p => p.in === "formData");
    if (bp){ schema = bp.schema || null; required = !!bp.required; contentType = (op.consumes || spec.consumes || ["application/json"])[0]; }
    else if (fp.length){
      schema = { type: "object", properties: Object.fromEntries(fp.map(p => [p.name, p])), required: fp.filter(p => p.required).map(p => p.name) };
      contentType = (op.consumes || spec.consumes || ["application/x-www-form-urlencoded"])[0];
    }
  }
  if (!contentType) return null;
  return { contentType, required, type: schema ? typeLabel(schema) : "", fields: schema ? fieldRows(schema) : [],
    example: example !== undefined ? example : schema ? sample(schema) : undefined };
}
function responseOf(code, r0){
  const r = resolve(r0);
  let schema = null, contentType = null, example;
  if (r.content){
    contentType = Object.keys(r.content).find(c => /json/i.test(c)) || Object.keys(r.content)[0] || null;
    const media = contentType && r.content[contentType];
    if (media){ schema = media.schema || null; example = media.example; }
  } else if (r.schema){ schema = r.schema; contentType = "application/json"; }
  return { code, description: r.description || "", contentType, type: schema ? typeLabel(schema) : "",
    example: example !== undefined ? example : schema ? exampleOf(schema) : undefined };
}
const successOf = op => (op.responses.find(r => /^2/.test(r.code)) || { code: op.method === "POST" ? "201" : "200" }).code;

/* ---------- service model ---------- */
function serviceModel(doc, source){
  return withSpec(doc, () => {
    const info = doc.info || {};
    const name = String(doc["x-service-name"] || info.title || source || "Service").trim();
    const schemes = securitySchemes();
    // null = not specified, [] = public, else labels
    const authOf = reqs => {
      if (reqs === undefined) reqs = doc.security;
      if (reqs === undefined) return null;
      if (!reqs.length || reqs.some(r => !Object.keys(r).length)) return [];
      return [...new Set(reqs.flatMap(r => Object.keys(r)).map(n => authLabel(n, schemes[n])))];
    };
    const operations = [];
    for (const [path, item0] of Object.entries(doc.paths || {})){
      const item = resolve(item0);
      const common = (item.parameters || []).map(resolve);
      for (const m of METHODS){
        const op = item[m];
        if (!op) continue;
        const own = (op.parameters || []).map(resolve);
        const params = [...common.filter(c => !own.some(p => p.name === c.name && p.in === c.in)), ...own];
        const o = {
          method: m.toUpperCase(), path, summary: op.summary || "", description: op.description || "",
          operationId: op.operationId || "", tags: op.tags || [], deprecated: !!op.deprecated,
          params: params.filter(p => !["body", "formData"].includes(p.in)).map(p => {
            const ps = mergeAll(p.schema || p);
            return { name: p.name, in: p.in, required: !!p.required || p.in === "path", type: typeLabel(p.schema || p), rules: constraints(ps), description: p.description || "" };
          }),
          body: bodyOf(op, params),
          responses: Object.entries(op.responses || {}).map(([code, r]) => responseOf(code, r)),
          auth: authOf(op.security),
          calls: asList(op["x-calls"]).map(parseCall).filter(Boolean),
          publishes: asList(op["x-publishes"]).map(String),
          subscribes: asList(op["x-subscribes"]).map(String)
        };
        o.key = `${o.method} ${path}`;
        o.success = successOf(o);
        operations.push(o);
      }
    }
    const comps = (doc.components && doc.components.schemas) || doc.definitions || {};
    const schemas = Object.fromEntries(Object.entries(comps).map(([n, s0]) => {
      const s = mergeAll(s0);
      return [n, { description: s.description || "", type: typeLabel(s), rules: constraints(s), fields: fieldRows(s0) }];
    }));
    const hasServer = (doc.servers && doc.servers.length) || doc.host;
    return {
      id: slug(name), name, title: info.title || name, version: info.version || "", description: info.description || "", source,
      spec: doc.openapi ? "OpenAPI " + doc.openapi : "Swagger " + doc.swagger,
      baseUrl: hasServer ? baseUrl() : "",
      auth: Object.entries(schemes).map(([n, sc]) => authLabel(n, sc)),
      tags: [...new Set([...(doc.tags || []).map(t => t.name), ...operations.flatMap(o => o.tags)])],
      operations, schemas,
      calls: asList(doc["x-calls"]).map(parseCall).filter(Boolean),
      publishes: [...new Set([...asList(doc["x-publishes"]).map(String), ...operations.flatMap(o => o.publishes)])],
      subscribes: [...new Set([...asList(doc["x-subscribes"]).map(String), ...operations.flatMap(o => o.subscribes)])]
    };
  });
}
/* the same service name twice gets " (2)", " (3)" so ids stay unique */
function dedupeServices(services){
  const seen = new Map();
  for (const s of services){
    const n = (seen.get(s.id) || 0) + 1;
    seen.set(s.id, n);
    if (n > 1){ s.name += ` (${n})`; s.id += `-${n}`; }
  }
  return services;
}

/* ---------- consistency checks ---------- */
function consistencyChecks(services, shared){
  const out = [];
  const opList = ops => ops.map(o => o.key).join(", ");
  for (const s of services){
    const noSummary = s.operations.filter(o => !o.summary);
    const noId = s.operations.filter(o => !o.operationId);
    const noErr = s.operations.filter(o => !o.responses.some(r => /^4/.test(r.code)));
    if (!s.baseUrl) out.push({ service: s.name, issue: "No server URL", detail: "Add `servers` (OpenAPI 3) or `host` (Swagger 2)." });
    if (!s.auth.length) out.push({ service: s.name, issue: "No security schemes", detail: "Every endpoint is documented as unauthenticated." });
    if (noSummary.length) out.push({ service: s.name, issue: `${noSummary.length} operation(s) without a summary`, detail: opList(noSummary) });
    if (noId.length) out.push({ service: s.name, issue: `${noId.length} operation(s) without an operationId`, detail: opList(noId) });
    if (noErr.length) out.push({ service: s.name, issue: `${noErr.length} operation(s) document no 4xx response`, detail: opList(noErr) });
  }
  for (const m of shared.filter(m => m.differs))
    out.push({ service: m.services.map(id => services.find(s => s.id === id).name).join(", "), issue: `Model "${m.name}" differs between services`, detail: m.diff });
  const auths = [...new Set(services.flatMap(s => s.auth))];
  if (auths.length > 1) out.push({ service: "All", issue: "Services use different auth types", detail: auths.join(", ") });
  const specs = [...new Set(services.map(s => s.spec.split(" ")[0]))];
  if (specs.length > 1) out.push({ service: "All", issue: "Mixed OpenAPI and Swagger versions", detail: services.map(s => `${s.name}: ${s.spec}`).join(", ") });
  return out;
}
