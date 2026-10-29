/* Core generator: turns operations into test cases. */
import { authFor, authJson } from "./auth";
import { opKey } from "./endpoints";
import { fields, mutations, pathLabel, setAt } from "./mutations";
import { typeOf, type Spec } from "./refs";
import { toJsonSchema } from "./response-schema";
import { sample } from "./sampling";
import { METHODS, type AuthSettings, type Category, type Cred, type Options, type Schema, type TestCase, type VarNames } from "./types";
import { clone } from "./util";

export interface GenerateInput {
  spec: Spec;
  opts: Options;
  selected: Set<string> | null; // null = every operation
  auth: AuthSettings;
  vars: VarNames;
}

type ParamIn = "path" | "query" | "header" | "cookie";
interface Req {
  pathParams: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  cookies: Record<string, unknown>;
  body: unknown;
  rawBody: string | null;
  contentType: string | null;
  cred: Cred;
}

export function generate({ spec, opts, selected, auth: authSettings, vars }: GenerateInput): TestCase[] {
  const cases: TestCase[] = [];
  let n = 0;
  const doc = spec.doc;
  for (const [path, item0] of Object.entries<Schema>(doc.paths || {})) {
    const item = spec.resolve(item0);
    const commonParams: Schema[] = (item.parameters || []).map((p: Schema) => spec.resolve(p));
    for (const method of METHODS) {
      if (!item[method]) continue;
      const op: Schema = item[method];
      if (selected && !selected.has(opKey(method, path))) continue;
      const opParams: Schema[] = (op.parameters || []).map((p: Schema) => spec.resolve(p));
      const params = [...commonParams.filter((cp) => !opParams.some((p) => p.name === cp.name && p.in === cp.in)), ...opParams];
      const responses: Schema = op.responses || {};
      const codes = Object.keys(responses);
      const success = +(codes.find((c) => /^2/.test(c)) || (method === "post" ? 201 : 200));
      const errCode = codes.find((c) => c === "400") || codes.find((c) => c === "422") || codes.find((c) => /^4/.test(c) && !["401", "403", "404", "405", "415"].includes(c));
      const negStatus = errCode ? +errCode : 400;
      const has = (c: number) => codes.includes(String(c));
      const auth = authFor(spec, op, authSettings);
      const tag: string = (op.tags && op.tags[0]) || "default";
      const opName: string = op.operationId || `${method.toUpperCase()} ${path}`;

      // request body
      let bodySchema: Schema | null = null, contentType: string | null = null, bodyRequired = false;
      if (op.requestBody) {
        const rb = spec.resolve(op.requestBody);
        bodyRequired = !!rb.required;
        const content: Schema = rb.content || {};
        contentType = Object.keys(content).find((c) => /json/i.test(c)) || Object.keys(content)[0] || null;
        if (contentType && content[contentType]) {
          const media = content[contentType];
          bodySchema = media.schema || {};
          if (media.example !== undefined) bodySchema = Object.assign({}, spec.resolve(bodySchema), { example: media.example });
        }
      } else {
        const bp = params.find((p) => p.in === "body");
        if (bp) { bodySchema = bp.schema || {}; bodyRequired = !!bp.required; contentType = (op.consumes || doc.consumes || ["application/json"])[0]; }
        const fp = params.filter((p) => p.in === "formData");
        if (fp.length && !bp) {
          bodySchema = { type: "object", properties: Object.fromEntries(fp.map((p) => [p.name, p])), required: fp.filter((p) => p.required).map((p) => p.name) };
          contentType = "application/json";
        }
      }
      const reqParams = params.filter((p) => ["path", "query", "header", "cookie"].includes(p.in));
      const pSchema = (p: Schema) => spec.mergeAll(p.schema || p); // v2 params carry type inline
      const validParams: Record<ParamIn, Record<string, unknown>> = { path: {}, query: {}, header: {}, cookie: {} };
      for (const p of reqParams) {
        const v = p.example !== undefined ? p.example : sample(spec, pSchema(p), 0, p.name);
        if (p.in === "path" || p.required) validParams[p.in as ParamIn][p.name] = v;
      }
      const validBody = bodySchema ? sample(spec, bodySchema) : undefined;

      // response schema for a given status (used for AJV validation in Postman)
      const respInfo = (code: number): { json: boolean; schema: Schema | null } => {
        const r = responses[String(code)] && spec.resolve(responses[String(code)]);
        if (!r) return { json: false, schema: null };
        if (r.content) {
          const ct = Object.keys(r.content).find((c) => /json/i.test(c));
          if (!ct) return { json: false, schema: null };
          return { json: true, schema: r.content[ct].schema ? toJsonSchema(spec, r.content[ct].schema) : null };
        }
        if (r.schema) return { json: true, schema: toJsonSchema(spec, r.schema) };
        return { json: false, schema: null };
      };

      const make = (cat: Category, name: string, mod: ((r: Req) => void) | null, expected: number, explicit: boolean) => {
        const req: Req = {
          pathParams: clone(validParams.path), query: clone(validParams.query),
          headers: Object.assign({}, validParams.header), cookies: clone(validParams.cookie),
          body: clone(validBody), rawBody: null, contentType,
          cred: auth ? "valid" : null,
        };
        if (mod) mod(req);
        const ri = explicit !== false ? respInfo(expected) : { json: false, schema: null };
        if (req.contentType && (req.body !== undefined || req.rawBody !== null)) req.headers["Content-Type"] = req.contentType;
        n++;
        cases.push({
          id: "TC_" + String(n).padStart(4, "0"),
          operationId: op.operationId || null,
          tag, category: cat, name,
          method: method.toUpperCase(), path,
          request: {
            auth: authJson(req.cred ? auth : null, req.cred, vars),
            pathParams: req.pathParams, queryParams: req.query, headers: req.headers,
            cookies: Object.keys(req.cookies).length ? req.cookies : undefined,
            body: req.rawBody !== null ? req.rawBody : req.body,
          },
          expected: { status: expected, strict: explicit !== false, responseSchema: ri.schema && Object.keys(ri.schema).length ? ri.schema : null, json: ri.json },
        });
      };
      const negExplicit = !!errCode;

      // 1. Happy path
      if (opts.positive) {
        make("positive", `${opName}: valid request with all required fields`, null, success, true);
        const optional = reqParams.filter((p) => p.in !== "path" && !p.required);
        const optBody = bodySchema && fields(spec, bodySchema).some((f) => !f.required && !f.closed);
        if (optional.length) {
          make("positive", `${opName}: valid request including optional parameters`, (r) => {
            for (const p of optional) {
              const v = p.example !== undefined ? p.example : sample(spec, pSchema(p), 0, p.name);
              (p.in === "query" ? r.query : p.in === "header" ? r.headers : r.cookies)[p.name] = v;
            }
          }, success, true);
        }
        if (optBody && bodySchema) {
          const minimal = minimalBody(spec, bodySchema);
          if (JSON.stringify(minimal) !== JSON.stringify(validBody))
            make("positive", `${opName}: valid request with only required body fields`, (r) => { r.body = minimal; }, success, true);
        }
      }

      // 2. Parameters
      for (const p of reqParams) {
        const s = pSchema(p);
        const bucket = (r: Req) => (p.in === "path" ? r.pathParams : p.in === "query" ? r.query : p.in === "header" ? r.headers : r.cookies);
        if (p.required && p.in !== "path" && opts.negative) {
          make("negative", `${opName}: missing required ${p.in} parameter "${p.name}"`, (r) => { delete bucket(r)[p.name]; }, negStatus, negExplicit);
        }
        if (p.in === "path" && has(404) && opts.negative) {
          const t = typeOf(s);
          const v = t === "integer" || t === "number" ? 999999999 : s.format === "uuid" ? "00000000-0000-0000-0000-000000000000" : "nonexistent-id-999";
          make("negative", `${opName}: non-existent resource (${p.name}=${v})`, (r) => { r.pathParams[p.name] = v; }, 404, true);
        }
        for (const m of mutations(spec, s, opts)) {
          if (!opts[m.cat]) continue;
          if (p.in !== "query" && m.value === null) continue;
          if (p.in !== "path" && !p.required && m.valid) {
            make(m.cat, `${opName}: ${p.in} "${p.name}" ${m.label}`, (r) => { bucket(r)[p.name] = m.value; }, success, true);
            continue;
          }
          make(m.cat, `${opName}: ${p.in} "${p.name}" ${m.label}`, (r) => { bucket(r)[p.name] = m.value; }, m.valid ? success : negStatus, m.valid ? true : negExplicit);
        }
      }

      // 3. Body
      if (bodySchema) {
        const bodyFields = fields(spec, bodySchema);
        if (opts.negative) {
          if (bodyRequired) make("negative", `${opName}: request body missing`, (r) => { r.body = undefined; }, negStatus, negExplicit);
          if (bodyFields.some((f) => f.required && f.path.length === 1))
            make("negative", `${opName}: empty JSON object as body`, (r) => { r.body = {}; }, negStatus, negExplicit);
          if (/json/i.test(contentType || ""))
            make("negative", `${opName}: malformed JSON body`, (r) => { r.rawBody = '{"malformed": '; }, 400, has(400));
        }
        if (opts.contentType && opts.negative && contentType) {
          make("negative", `${opName}: unsupported Content-Type text/plain`, (r) => { r.contentType = "text/plain"; r.rawBody = "plain text body"; }, 415, has(415));
        }
        for (const f of bodyFields) {
          const lbl = pathLabel(f.path);
          if (f.closed) {
            if (opts.negative)
              make("negative", `${opName}: unknown field on ${lbl} (additionalProperties: false)`, (r) => {
                r.body = f.path.length ? setAt(r.body, [...f.path, "unexpectedField"], "x") : Object.assign({}, r.body, { unexpectedField: "x" });
              }, negStatus, negExplicit);
            continue;
          }
          if (f.required && opts.negative)
            make("negative", `${opName}: missing required field "${lbl}"`, (r) => { r.body = setAt(r.body, f.path, null, true); }, negStatus, negExplicit);
          let validVal: unknown;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            validVal = f.path.reduce<any>((o, k) => o[k], validBody);
          } catch { /* path not present in the sample */ }
          for (const m of mutations(spec, f.schema, opts, validVal)) {
            if (!opts[m.cat]) continue;
            make(m.cat, `${opName}: field "${lbl}" ${m.label}`, (r) => { r.body = setAt(r.body, f.path, m.value); }, m.valid ? success : negStatus, m.valid ? true : negExplicit);
          }
        }
      }

      // 4. Security
      if (auth && opts.security) {
        make("security", `${opName}: no credentials`, (r) => { r.cred = null; }, 401, has(401));
        make("security", `${opName}: invalid credentials`, (r) => { r.cred = "invalid"; }, 401, has(401));
        if (has(403)) make("security", `${opName}: credentials without required permission`, (r) => { r.cred = "lowPrivilege"; }, 403, true);
      }
    }
  }
  return cases;
}

function minimalBody(spec: Spec, s0: Schema, d = 0): unknown {
  const s = spec.mergeAll(s0);
  if (d > 6) return null;
  if (typeOf(s) === "object" && s.properties) {
    const o: Record<string, unknown> = {};
    for (const k of s.required || []) if (s.properties[k]) o[k] = minimalBody(spec, s.properties[k], d + 1);
    return o;
  }
  return sample(spec, s, d);
}
