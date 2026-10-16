/* Postman collection v2.1 builder. */
"use strict";

/* ---------- Postman collection ---------- */
function toPostman(cases){
  const title = (spec.info && spec.info.title) || "API";
  const folders = {};
  for (const c of cases){
    const f = folders[c.tag] = folders[c.tag] || {};
    const key = `${c.method} ${c.path}`;
    (f[key] = f[key] || []).push(c);
  }
  const bu = varName("baseUrl");
  const vars = new Set([bu]);
  const item = Object.entries(folders).map(([tag, ops]) => ({
    name: tag,
    item: Object.entries(ops).map(([opKey, list]) => ({
      name: opKey,
      item: list.map(c => pmItem(c, vars))
    }))
  }));
  const variable = [{ key: bu, value: baseUrl() }];
  for (const v of vars) if (v !== bu) variable.push({ key: v, value: "" });
  const primary = cases.find(c => c.request.auth.type !== "noauth" && c.category === "positive");
  const col = {
    info: {
      name: `${title} — generated tests`,
      description: `Generated from ${spec.openapi ? "OpenAPI " + spec.openapi : "Swagger " + (spec.swagger || "")} contract. ${cases.length} test cases. Set ${bu} and the auth variables on this collection before running.`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item, variable
  };
  if (primary) col.auth = pmAuth(primary.request.auth);
  return col;
}
function pmItem(c, vars){
  let p = c.path.replace(/\{([^}]+)\}/g, (m, k) => c.request.pathParams[k] !== undefined ? encodeURIComponent(strVal(c.request.pathParams[k])) : `:${k}`);
  const query = Object.entries(c.request.queryParams || {}).map(([k, v]) => ({ key: k, value: strVal(v) }));
  const qs = query.length ? "?" + query.map(q => `${encodeURIComponent(q.key)}=${q.value.startsWith("{{") ? q.value : encodeURIComponent(q.value)}`).join("&") : "";
  const headers = Object.entries(c.request.headers || {}).map(([k, v]) => ({ key: k, value: strVal(v) }));
  if (c.request.cookies) headers.push({ key: "Cookie", value: Object.entries(c.request.cookies).map(([k, v]) => `${k}=${strVal(v)}`).join("; ") });
  const a = c.request.auth;
  if (a.type === "apikey" && a.in === "cookie"){
    const ck = headers.find(h => h.key === "Cookie");
    if (ck) ck.value += `; ${a.key}=${a.value}`; else headers.push({ key: "Cookie", value: `${a.key}=${a.value}` });
  }
  const all = JSON.stringify([headers, query, a]);
  (all.match(/\{\{(\w+)\}\}/g) || []).forEach(m => vars.add(m.slice(2, -2)));
  const req = {
    auth: pmAuth(a),
    method: c.method,
    header: headers,
    url: { raw: `{{${varName("baseUrl")}}}${p}${qs}`, host: [`{{${varName("baseUrl")}}}`], path: p.split("/").filter(Boolean), query }
  };
  const b = c.request.body;
  if (b !== undefined){
    req.body = { mode: "raw", raw: typeof b === "string" && !/json/i.test(c.request.headers["Content-Type"] || "") ? b : (typeof b === "string" && b.startsWith('{"malformed') ? b : JSON.stringify(b, null, 2)) };
    if (/json/i.test(c.request.headers["Content-Type"] || "")) req.body.options = { raw: { language: "json" } };
  }
  const exec = [];
  const st = c.expected.status;
  if (c.expected.strict){
    exec.push(`pm.test("Status code is ${st}", function () {`, `    pm.response.to.have.status(${st});`, `});`);
  } else {
    const lo = Math.floor(st / 100) * 100;
    exec.push(`pm.test("Status code is ${lo / 100}xx (expected ~${st})", function () {`, `    pm.expect(pm.response.code).to.be.within(${lo}, ${lo + 99});`, `});`);
  }
  exec.push(`pm.test("Response time is under 2000ms", function () {`, `    pm.expect(pm.response.responseTime).to.be.below(2000);`, `});`);
  if (c.expected.json){
    exec.push(`pm.test("Response is JSON", function () {`, `    pm.response.to.be.json;`, `});`);
  }
  if (c.expected.responseSchema){
    exec.push(
      `// Contract schema for ${st} response, validated with AJV (bundled in the Postman sandbox)`,
      `const Ajv = require("ajv");`,
      `const ajv = new Ajv({ allErrors: true, logger: false });`,
      `const schema = ${JSON.stringify(c.expected.responseSchema, null, 2).split("\n").join("\n")};`,
      `pm.test("Response body matches contract schema (AJV)", function () {`,
      `    const body = pm.response.json();`,
      `    const validate = ajv.compile(schema);`,
      `    const valid = validate(body);`,
      `    pm.expect(valid, valid ? "" : ajv.errorsText(validate.errors, { separator: "\\n" })).to.be.true;`,
      `});`
    );
  }
  return {
    name: `[${c.category}] ${c.name.replace(/^[^:]+:\s*/, "")}`,
    description: `${c.id} · expected ${st}`,
    request: req,
    event: [{ listen: "test", script: { type: "text/javascript", exec } }]
  };
}
