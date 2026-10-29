/* Postman collection v2.1 builder, and the plain test-case JSON export. */
import { pmAuth, varName } from "./auth";
import { baseUrl } from "./spec-parser";
import type { Spec } from "./refs";
import type { Schema, TestCase, VarNames } from "./types";
import { strVal } from "./util";

export function toPostman(spec: Spec, cases: TestCase[], vars: VarNames): Schema {
  const doc = spec.doc;
  const title = (doc.info && doc.info.title) || "API";
  const folders: Record<string, Record<string, TestCase[]>> = {};
  for (const c of cases) {
    const f = (folders[c.tag] = folders[c.tag] || {});
    const key = `${c.method} ${c.path}`;
    (f[key] = f[key] || []).push(c);
  }
  const bu = varName(vars, "baseUrl");
  const used = new Set([bu]);
  const item = Object.entries(folders).map(([tag, ops]) => ({
    name: tag,
    item: Object.entries(ops).map(([key, list]) => ({ name: key, item: list.map((c) => pmItem(c, used, vars)) })),
  }));
  const variable = [{ key: bu, value: baseUrl(doc) }];
  for (const v of used) if (v !== bu) variable.push({ key: v, value: "" });
  const primary = cases.find((c) => c.request.auth.type !== "noauth" && c.category === "positive");
  const col: Schema = {
    info: {
      name: `${title} — generated tests`,
      description: `Generated from ${doc.openapi ? "OpenAPI " + doc.openapi : "Swagger " + (doc.swagger || "")} contract. ${cases.length} test cases. Set ${bu} and the auth variables on this collection before running.`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item,
    variable,
  };
  if (primary) col.auth = pmAuth(primary.request.auth);
  return col;
}

function pmItem(c: TestCase, used: Set<string>, vars: VarNames): Schema {
  const p = c.path.replace(/\{([^}]+)\}/g, (_m, k) => (c.request.pathParams[k] !== undefined ? encodeURIComponent(strVal(c.request.pathParams[k])) : `:${k}`));
  const query = Object.entries(c.request.queryParams || {}).map(([k, v]) => ({ key: k, value: strVal(v) }));
  const qs = query.length ? "?" + query.map((q) => `${encodeURIComponent(q.key)}=${q.value.startsWith("{{") ? q.value : encodeURIComponent(q.value)}`).join("&") : "";
  const headers = Object.entries(c.request.headers || {}).map(([k, v]) => ({ key: k, value: strVal(v) }));
  if (c.request.cookies) headers.push({ key: "Cookie", value: Object.entries(c.request.cookies).map(([k, v]) => `${k}=${strVal(v)}`).join("; ") });
  const a = c.request.auth;
  if (a.type === "apikey" && a.in === "cookie") {
    const ck = headers.find((h) => h.key === "Cookie");
    if (ck) ck.value += `; ${a.key}=${a.value}`;
    else headers.push({ key: "Cookie", value: `${a.key}=${a.value}` });
  }
  const all = JSON.stringify([headers, query, a]);
  (all.match(/\{\{(\w+)\}\}/g) || []).forEach((m) => used.add(m.slice(2, -2)));
  const host = `{{${varName(vars, "baseUrl")}}}`;
  const req: Schema = {
    auth: pmAuth(a),
    method: c.method,
    header: headers,
    url: { raw: `${host}${p}${qs}`, host: [host], path: p.split("/").filter(Boolean), query },
  };
  const b = c.request.body;
  const ct = String(c.request.headers["Content-Type"] || "");
  if (b !== undefined) {
    req.body = { mode: "raw", raw: typeof b === "string" && !/json/i.test(ct) ? b : typeof b === "string" && b.startsWith('{"malformed') ? b : JSON.stringify(b, null, 2) };
    if (/json/i.test(ct)) req.body.options = { raw: { language: "json" } };
  }
  const exec: string[] = [];
  const st = c.expected.status;
  if (c.expected.strict) {
    exec.push(`pm.test("Status code is ${st}", function () {`, `    pm.response.to.have.status(${st});`, `});`);
  } else {
    const lo = Math.floor(st / 100) * 100;
    exec.push(`pm.test("Status code is ${lo / 100}xx (expected ~${st})", function () {`, `    pm.expect(pm.response.code).to.be.within(${lo}, ${lo + 99});`, `});`);
  }
  exec.push(`pm.test("Response time is under 2000ms", function () {`, `    pm.expect(pm.response.responseTime).to.be.below(2000);`, `});`);
  if (c.expected.json) exec.push(`pm.test("Response is JSON", function () {`, `    pm.response.to.be.json;`, `});`);
  if (c.expected.responseSchema) {
    exec.push(
      `// Contract schema for ${st} response, validated with AJV (bundled in the Postman sandbox)`,
      `const Ajv = require("ajv");`,
      `const ajv = new Ajv({ allErrors: true, logger: false });`,
      `const schema = ${JSON.stringify(c.expected.responseSchema, null, 2)};`,
      `pm.test("Response body matches contract schema (AJV)", function () {`,
      `    const body = pm.response.json();`,
      `    const validate = ajv.compile(schema);`,
      `    const valid = validate(body);`,
      `    pm.expect(valid, valid ? "" : ajv.errorsText(validate.errors, { separator: "\\n" })).to.be.true;`,
      `});`,
    );
  }
  return {
    name: `[${c.category}] ${c.name.replace(/^[^:]+:\s*/, "")}`,
    description: `${c.id} · expected ${st}`,
    request: req,
    event: [{ listen: "test", script: { type: "text/javascript", exec } }],
  };
}

export function exportCases(spec: Spec, cases: TestCase[], generatedAt = new Date().toISOString()): Schema {
  const doc = spec.doc;
  return {
    api: { title: doc.info && doc.info.title, version: doc.info && doc.info.version, baseUrl: baseUrl(doc) },
    generatedAt,
    totalTestCases: cases.length,
    testCases: cases.map((c) => ({
      id: c.id, operationId: c.operationId, tag: c.tag, category: c.category, name: c.name,
      method: c.method, path: c.path, request: c.request,
      expectedStatus: c.expected.status,
      responseSchema: c.expected.responseSchema || undefined,
    })),
  };
}
