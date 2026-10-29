/* Security scheme detection, auth JSON for test cases, and Postman variable names. */
import type { Spec } from "./refs";
import type { Auth, AuthJson, AuthSettings, Cred, OpenApiDoc, Schema, VarKey, VarNames } from "./types";

export const DEFAULT_VARS: VarNames = { baseUrl: "baseUrl", token: "token", apiKey: "apiKey", username: "username", password: "password" };

export function securitySchemes(doc: OpenApiDoc): Record<string, Schema> {
  return (doc.components && doc.components.securitySchemes) || doc.securityDefinitions || {};
}

export function schemeToAuth(sc: Schema | undefined): Auth | null {
  if (!sc || !sc.type) return null;
  if (sc.type === "apiKey") return { type: "apikey", key: sc.name || "X-API-Key", in: sc.in === "query" ? "query" : sc.in === "cookie" ? "cookie" : "header" };
  if (sc.type === "basic" || (sc.type === "http" && /basic/i.test(sc.scheme || ""))) return { type: "basic" };
  if (sc.type === "oauth2" || sc.type === "openIdConnect") return { type: "oauth2" };
  return { type: "bearer" };
}

function override(settings: AuthSettings): Auth | null {
  if (settings.mode === "apikey") return { type: "apikey", key: settings.apiKeyName.trim() || "X-API-Key", in: settings.apiKeyIn };
  if (settings.mode === "contract" || settings.mode === "none") return null;
  return { type: settings.mode };
}

export function authFor(spec: Spec, op: Schema, settings: AuthSettings): Auth | null {
  if (settings.mode === "none") return null;
  if (Array.isArray(op.security) && !op.security.length) return null; // operation explicitly public
  if (settings.mode !== "contract") return Object.assign({ scheme: "manual" }, override(settings));
  const schemes = securitySchemes(spec.doc);
  let reqs = op.security !== undefined ? op.security : spec.doc.security;
  if (reqs === undefined) {
    // schemes defined but never applied: assume the first one protects the API
    const names = Object.keys(schemes);
    if (!names.length) return null;
    reqs = [{ [names[0]]: [] }];
  }
  if (!reqs.length || reqs.some((r: Schema) => !Object.keys(r).length)) return null;
  const name = Object.keys(reqs[0])[0];
  const a = schemeToAuth(spec.resolve(schemes[name] || {}));
  if (a) a.scheme = name;
  return a;
}

/* Postman variable names; the user's names override the defaults */
export function varName(vars: VarNames, key: VarKey): string {
  const v = (vars[key] || "").trim().replace(/[^A-Za-z0-9_]/g, "_");
  return v || key;
}
// {{name}} placeholder; the low-privilege twin keeps its old name unless the base name was customised
function pv(vars: VarNames, key: VarKey, low?: boolean): string {
  const n = varName(vars, key);
  return `{{${low ? (n === key ? "lowPrivilege" + key[0].toUpperCase() + key.slice(1) : n + "_lowPrivilege") : n}}}`;
}

/* auth as it appears in the test-case JSON, for valid / invalid / lowPrivilege credentials */
export function authJson(a: Auth | null, cred: Cred, vars: VarNames): AuthJson {
  if (!a) return { type: "noauth" };
  const pick = (valid: string, invalid: string, low: string) => (cred === "invalid" ? invalid : cred === "lowPrivilege" ? low : valid);
  switch (a.type) {
    case "apikey": return { type: "apikey", key: a.key!, in: a.in!, value: pick(pv(vars, "apiKey"), "invalid-api-key", pv(vars, "apiKey", true)) };
    case "basic": return { type: "basic", username: pick(pv(vars, "username"), "invalid_user", pv(vars, "username", true)), password: pick(pv(vars, "password"), "invalid_password", pv(vars, "password", true)) };
    case "oauth2": return { type: "oauth2", accessToken: pick(pv(vars, "token"), "invalid.token.value", pv(vars, "token", true)), headerPrefix: "Bearer" };
    default: return { type: "bearer", token: pick(pv(vars, "token"), "invalid.token.value", pv(vars, "token", true)) };
  }
}

/* test-case auth JSON -> Postman collection v2.1 auth object */
export function pmAuth(j: AuthJson): Schema {
  const kv = (k: string, v: string) => ({ key: k, value: v, type: "string" });
  switch (j.type) {
    case "bearer": return { type: "bearer", bearer: [kv("token", j.token)] };
    case "basic": return { type: "basic", basic: [kv("username", j.username), kv("password", j.password)] };
    case "oauth2": return { type: "oauth2", oauth2: [kv("accessToken", j.accessToken), kv("headerPrefix", "Bearer"), kv("addTokenTo", "header")] };
    case "apikey":
      if (j.in === "cookie") return { type: "noauth" }; // Postman apikey auth has no cookie option; sent as Cookie header instead
      return { type: "apikey", apikey: [kv("key", j.key), kv("value", j.value), kv("in", j.in)] };
    default: return { type: "noauth" };
  }
}
