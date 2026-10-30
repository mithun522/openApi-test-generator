/* Docs mode: turns one parsed contract into a service model for documentation. */
import { schemeToAuth, securitySchemes } from "../core/auth";
import { isNullable, Spec, typeOf } from "../core/refs";
import { bounds, sample } from "../core/sampling";
import { baseUrl } from "../core/spec-parser";
import { METHODS, type OpenApiDoc, type Schema } from "../core/types";
import { asList, slug } from "../core/util";

export interface FieldRow { name: string; type: string; required: boolean; rules: string; description: string }
export interface ParamRow extends FieldRow { in: string }
export interface Call { service: string; method: string; path: string; note: string }
export interface Body { contentType: string; required: boolean; type: string; fields: FieldRow[]; example: unknown }
export interface Response { code: string; description: string; contentType: string | null; type: string; example: unknown }
export interface Operation {
  key: string; method: string; path: string; summary: string; description: string; operationId: string;
  tags: string[]; deprecated: boolean; params: ParamRow[]; body: Body | null; responses: Response[];
  auth: string[] | null; // null = not specified, [] = public
  calls: Call[]; publishes: string[]; subscribes: string[]; success: string;
}
export interface ModelInfo { description: string; type: string; rules: string; fields: FieldRow[] }
export interface Service {
  id: string; name: string; title: string; version: string; description: string; source: string; spec: string;
  baseUrl: string; auth: string[]; tags: string[]; operations: Operation[]; schemas: Record<string, ModelInfo>;
  calls: Call[]; publishes: string[]; subscribes: string[];
}
export interface Check { service: string; issue: string; detail: string }
export interface SharedModel { name: string; services: string[]; differs: boolean; diff: string }

/* ---------- schema descriptions ---------- */
function schemaName(s: Schema | undefined): string | null {
  return s && typeof s.$ref === "string" ? s.$ref.split("/").pop()! : null;
}
function typeLabel(spec: Spec, s0: Schema): string {
  const name = schemaName(s0);
  if (name && !s0.$ref.startsWith("#/")) return `${name} (external reference)`;
  const s = spec.mergeAll(s0);
  let t = typeOf(s);
  if (t === "array") {
    const it = s.items || {};
    t = `array<${schemaName(it) || typeOf(spec.mergeAll(it))}>`;
  } else if (name) t = name;
  else if (s.format) t += ` (${s.format})`;
  if (isNullable(s)) t += ", nullable";
  return t;
}
function constraints(s: Schema): string {
  const out: string[] = [];
  if (Array.isArray(s.enum)) out.push("one of " + s.enum.map((v: unknown) => JSON.stringify(v)).join(", "));
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
function fieldRows(spec: Spec, s0: Schema | null | undefined, prefix = "", d = 0, out: FieldRow[] = []): FieldRow[] {
  if (d > 4 || !s0) return out;
  const s = spec.mergeAll(s0);
  const t = typeOf(s);
  if (t === "object" && s.properties) {
    const req = new Set<string>(s.required || []);
    for (const [k, v] of Object.entries<Schema>(s.properties)) {
      const r = spec.mergeAll(v);
      out.push({ name: prefix + k, type: typeLabel(spec, v), required: req.has(k), rules: constraints(r), description: r.description || "" });
      const isArr = typeOf(r) === "array";
      const inner = isArr ? r.items : v;
      if (inner && !schemaName(inner)) fieldRows(spec, inner, prefix + k + (isArr ? "[]." : "."), d + 1, out);
    }
  } else if (t === "array" && s.items && !d) {
    fieldRows(spec, s.items, prefix + "[].", d + 1, out);
  }
  return out;
}
/* like sample(), but keeps readOnly fields: response examples should show server-set values such as IDs */
function exampleOf(spec: Spec, s0: Schema, d = 0, name?: string): unknown {
  const s = spec.mergeAll(s0);
  if (d > 6) return null;
  if (s.example !== undefined || s.examples || s.default !== undefined || s.const !== undefined || s.enum) return sample(spec, s, d, name);
  const t = typeOf(s);
  if (t === "object") return Object.fromEntries(Object.entries<Schema>(s.properties || {}).map(([k, v]) => [k, exampleOf(spec, v, d + 1, k)]));
  if (t === "array") return [exampleOf(spec, s.items || {}, d + 1, name)];
  return sample(spec, s, d, name);
}

/* ---------- auth ---------- */
function authLabel(spec: Spec, name: string, sc: Schema | undefined): string {
  const a = schemeToAuth(spec.resolve(sc || {}));
  if (!a) return name;
  if (a.type === "apikey") return `API key ${a.key} in ${a.in}`;
  return ({ bearer: "Bearer token", basic: "Basic auth", oauth2: "OAuth 2.0" } as Record<string, string>)[a.type] || name;
}

/* ---------- declared links ---------- */
// "Payment Service POST /payments", "payment-service", or { service, operation: "POST /payments" }
export function parseCall(v: unknown): Call | null {
  if (v && typeof v === "object") {
    const o = v as Schema;
    if (!o.service) return null;
    const c = o.operation ? parseCall(`${o.service} ${o.operation}`)! : { service: String(o.service).trim(), method: String(o.method || "").toUpperCase(), path: o.path || "", note: "" };
    c.note = o.description || o.note || "";
    return c;
  }
  if (typeof v !== "string" || !v.trim()) return null;
  const m = v.trim().match(/^(.*?):?\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)$/i);
  return m ? { service: m[1].trim(), method: m[2].toUpperCase(), path: m[3], note: "" } : { service: v.trim(), method: "", path: "", note: "" };
}

/* ---------- operations ---------- */
function bodyOf(spec: Spec, op: Schema, params: Schema[]): Body | null {
  let schema: Schema | null = null, contentType: string | null = null, required = false, example: unknown;
  if (op.requestBody) {
    const rb = spec.resolve(op.requestBody);
    required = !!rb.required;
    const content: Schema = rb.content || {};
    contentType = Object.keys(content).find((c) => /json/i.test(c)) || Object.keys(content)[0] || null;
    const media = contentType && content[contentType];
    if (media) { schema = media.schema || null; example = media.example; }
  } else {
    const bp = params.find((p) => p.in === "body");
    const fp = params.filter((p) => p.in === "formData");
    if (bp) { schema = bp.schema || null; required = !!bp.required; contentType = (op.consumes || spec.doc.consumes || ["application/json"])[0]; }
    else if (fp.length) {
      schema = { type: "object", properties: Object.fromEntries(fp.map((p) => [p.name, p])), required: fp.filter((p) => p.required).map((p) => p.name) };
      contentType = (op.consumes || spec.doc.consumes || ["application/x-www-form-urlencoded"])[0];
    }
  }
  if (!contentType) return null;
  return {
    contentType, required, type: schema ? typeLabel(spec, schema) : "", fields: schema ? fieldRows(spec, schema) : [],
    example: example !== undefined ? example : schema ? sample(spec, schema) : undefined,
  };
}
function responseOf(spec: Spec, code: string, r0: Schema): Response {
  const r = spec.resolve(r0);
  let schema: Schema | null = null, contentType: string | null = null, example: unknown;
  if (r.content) {
    contentType = Object.keys(r.content).find((c) => /json/i.test(c)) || Object.keys(r.content)[0] || null;
    const media = contentType && r.content[contentType];
    if (media) { schema = media.schema || null; example = media.example; }
  } else if (r.schema) { schema = r.schema; contentType = "application/json"; }
  return {
    code, description: r.description || "", contentType, type: schema ? typeLabel(spec, schema) : "",
    example: example !== undefined ? example : schema ? exampleOf(spec, schema) : undefined,
  };
}

/* ---------- service model ---------- */
export function serviceModel(doc: OpenApiDoc, source: string): Service {
  const spec = new Spec(doc);
  const info = doc.info || {};
  const name = String(doc["x-service-name"] || info.title || source || "Service").trim();
  const schemes = securitySchemes(doc);
  const authOf = (reqs: Schema[] | undefined): string[] | null => {
    if (reqs === undefined) reqs = doc.security;
    if (reqs === undefined) return null;
    if (!reqs.length || reqs.some((r) => !Object.keys(r).length)) return [];
    return [...new Set(reqs.flatMap((r) => Object.keys(r)).map((n) => authLabel(spec, n, schemes[n])))];
  };
  const operations: Operation[] = [];
  for (const [path, item0] of Object.entries<Schema>(doc.paths || {})) {
    const item = spec.resolve(item0);
    const common: Schema[] = (item.parameters || []).map((p: Schema) => spec.resolve(p));
    for (const m of METHODS) {
      const op: Schema | undefined = item[m];
      if (!op) continue;
      const own: Schema[] = (op.parameters || []).map((p: Schema) => spec.resolve(p));
      const params = [...common.filter((c) => !own.some((p) => p.name === c.name && p.in === c.in)), ...own];
      const method = m.toUpperCase();
      const responses = Object.entries<Schema>(op.responses || {}).map(([code, r]) => responseOf(spec, code, r));
      operations.push({
        key: `${method} ${path}`, method, path, summary: op.summary || "", description: op.description || "",
        operationId: op.operationId || "", tags: op.tags || [], deprecated: !!op.deprecated,
        params: params.filter((p) => !["body", "formData"].includes(p.in)).map((p) => ({
          name: p.name, in: p.in, required: !!p.required || p.in === "path", type: typeLabel(spec, p.schema || p),
          rules: constraints(spec.mergeAll(p.schema || p)), description: p.description || "",
        })),
        body: bodyOf(spec, op, params),
        responses,
        auth: authOf(op.security),
        calls: asList(op["x-calls"]).map(parseCall).filter((c): c is Call => !!c),
        publishes: asList(op["x-publishes"]).map(String),
        subscribes: asList(op["x-subscribes"]).map(String),
        success: (responses.find((r) => /^2/.test(r.code)) || { code: method === "POST" ? "201" : "200" }).code,
      });
    }
  }
  const comps: Record<string, Schema> = (doc.components && doc.components.schemas) || doc.definitions || {};
  const schemas = Object.fromEntries(Object.entries(comps).map(([n, s0]) => {
    const s = spec.mergeAll(s0);
    return [n, { description: s.description || "", type: typeLabel(spec, s), rules: constraints(s), fields: fieldRows(spec, s0) }];
  }));
  const hasServer = (doc.servers && doc.servers.length) || doc.host;
  return {
    id: slug(name), name, title: info.title || name, version: info.version || "", description: info.description || "", source,
    spec: doc.openapi ? "OpenAPI " + doc.openapi : "Swagger " + doc.swagger,
    baseUrl: hasServer ? baseUrl(doc) : "",
    auth: Object.entries(schemes).map(([n, sc]) => authLabel(spec, n, sc)),
    tags: [...new Set<string>([...(doc.tags || []).map((t: Schema) => t.name), ...operations.flatMap((o) => o.tags)])],
    operations, schemas,
    calls: asList(doc["x-calls"]).map(parseCall).filter((c): c is Call => !!c),
    publishes: [...new Set([...asList(doc["x-publishes"]).map(String), ...operations.flatMap((o) => o.publishes)])],
    subscribes: [...new Set([...asList(doc["x-subscribes"]).map(String), ...operations.flatMap((o) => o.subscribes)])],
  };
}

/* the same service name twice gets " (2)", " (3)" so ids stay unique */
export function dedupeServices(services: Service[]): Service[] {
  const seen = new Map<string, number>();
  for (const s of services) {
    const n = (seen.get(s.id) || 0) + 1;
    seen.set(s.id, n);
    if (n > 1) { s.name += ` (${n})`; s.id += `-${n}`; }
  }
  return services;
}

/* ---------- consistency checks ---------- */
export function consistencyChecks(services: Service[], shared: SharedModel[]): Check[] {
  const out: Check[] = [];
  const opList = (ops: Operation[]) => ops.map((o) => o.key).join(", ");
  for (const s of services) {
    const noSummary = s.operations.filter((o) => !o.summary);
    const noId = s.operations.filter((o) => !o.operationId);
    const noErr = s.operations.filter((o) => !o.responses.some((r) => /^4/.test(r.code)));
    if (!s.baseUrl) out.push({ service: s.name, issue: "No server URL", detail: "Add `servers` (OpenAPI 3) or `host` (Swagger 2)." });
    if (!s.auth.length) out.push({ service: s.name, issue: "No security schemes", detail: "Every endpoint is documented as unauthenticated." });
    if (noSummary.length) out.push({ service: s.name, issue: `${noSummary.length} operation(s) without a summary`, detail: opList(noSummary) });
    if (noId.length) out.push({ service: s.name, issue: `${noId.length} operation(s) without an operationId`, detail: opList(noId) });
    if (noErr.length) out.push({ service: s.name, issue: `${noErr.length} operation(s) document no 4xx response`, detail: opList(noErr) });
  }
  for (const m of shared.filter((m) => m.differs))
    out.push({ service: m.services.map((id) => services.find((s) => s.id === id)!.name).join(", "), issue: `Model "${m.name}" differs between services`, detail: m.diff });
  const auths = [...new Set(services.flatMap((s) => s.auth))];
  if (auths.length > 1) out.push({ service: "All", issue: "Services use different auth types", detail: auths.join(", ") });
  const specs = [...new Set(services.map((s) => s.spec.split(" ")[0]))];
  if (specs.length > 1) out.push({ service: "All", issue: "Mixed OpenAPI and Swagger versions", detail: services.map((s) => `${s.name}: ${s.spec}`).join(", ") });
  return out;
}
