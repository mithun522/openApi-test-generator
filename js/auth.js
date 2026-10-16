/* Security scheme detection, auth JSON for test cases, and Postman variable names. */
"use strict";

/* ---------- auth ---------- */
function securitySchemes(){
  return (spec.components && spec.components.securitySchemes) || spec.securityDefinitions || {};
}
function schemeToAuth(sc){
  if (!sc || !sc.type) return null;
  if (sc.type === "apiKey") return { type: "apikey", key: sc.name || "X-API-Key", in: sc.in === "query" ? "query" : sc.in === "cookie" ? "cookie" : "header" };
  if (sc.type === "basic" || (sc.type === "http" && /basic/i.test(sc.scheme || ""))) return { type: "basic" };
  if (sc.type === "oauth2" || sc.type === "openIdConnect") return { type: "oauth2" };
  return { type: "bearer" };
}
function authOverride(){
  const mode = $("#authMode").value;
  if (mode === "contract" || mode === "none") return { mode };
  if (mode === "apikey") return { mode, auth: { type: "apikey", key: $("#apiKeyName").value.trim() || "X-API-Key", in: $("#apiKeyIn").value } };
  return { mode, auth: { type: mode } };
}
function authFor(op){
  const o = authOverride();
  if (o.mode === "none") return null;
  if (Array.isArray(op.security) && !op.security.length) return null; // operation explicitly public
  if (o.mode !== "contract") return Object.assign({ scheme: "manual" }, o.auth);
  const schemes = securitySchemes();
  let reqs = op.security !== undefined ? op.security : spec.security;
  if (reqs === undefined){
    // schemes defined but never applied: assume the first one protects the API
    const names = Object.keys(schemes);
    if (!names.length) return null;
    reqs = [{ [names[0]]: [] }];
  }
  if (!reqs.length || reqs.some(r => !Object.keys(r).length)) return null;
  const name = Object.keys(reqs[0])[0];
  const a = schemeToAuth(resolve(schemes[name] || {}));
  if (a) a.scheme = name;
  return a;
}
/* Postman variable names; the inputs override the defaults */
function varName(key){
  const el = document.querySelector(`[data-var="${key}"]`);
  const v = el ? el.value.trim().replace(/[^A-Za-z0-9_]/g, "_") : "";
  return v || key;
}
// {{name}} placeholder; the low-privilege twin keeps its old name unless the base name was customised
function pv(key, low){
  const n = varName(key);
  return `{{${low ? (n === key ? "lowPrivilege" + key[0].toUpperCase() + key.slice(1) : n + "_lowPrivilege") : n}}}`;
}
/* auth as it appears in the test-case JSON, for valid / invalid / lowPrivilege credentials */
function authJson(a, cred){
  if (!a) return { type: "noauth" };
  const pick = (valid, invalid, low) => cred === "invalid" ? invalid : cred === "lowPrivilege" ? low : valid;
  switch (a.type){
    case "apikey": return { type: "apikey", key: a.key, in: a.in, value: pick(pv("apiKey"), "invalid-api-key", pv("apiKey", true)) };
    case "basic": return { type: "basic", username: pick(pv("username"), "invalid_user", pv("username", true)), password: pick(pv("password"), "invalid_password", pv("password", true)) };
    case "oauth2": return { type: "oauth2", accessToken: pick(pv("token"), "invalid.token.value", pv("token", true)), headerPrefix: "Bearer" };
    default: return { type: "bearer", token: pick(pv("token"), "invalid.token.value", pv("token", true)) };
  }
}
/* test-case auth JSON -> Postman collection v2.1 auth object */
function pmAuth(j){
  const kv = (k, v) => ({ key: k, value: v, type: "string" });
  switch (j.type){
    case "bearer": return { type: "bearer", bearer: [kv("token", j.token)] };
    case "basic": return { type: "basic", basic: [kv("username", j.username), kv("password", j.password)] };
    case "oauth2": return { type: "oauth2", oauth2: [kv("accessToken", j.accessToken), kv("headerPrefix", "Bearer"), kv("addTokenTo", "header")] };
    case "apikey":
      if (j.in === "cookie") return { type: "noauth" }; // Postman apikey auth has no cookie option; sent as Cookie header instead
      return { type: "apikey", apikey: [kv("key", j.key), kv("value", j.value), kv("in", j.in)] };
    default: return { type: "noauth" };
  }
}
