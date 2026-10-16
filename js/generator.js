/* Core generator: turns operations into test cases. */
"use strict";

/* ---------- core generator ---------- */
function generate(opts){
  const cases = [];
  let n = 0;
  const paths = spec.paths || {};
  for (const [path, item0] of Object.entries(paths)){
    const item = resolve(item0);
    const commonParams = (item.parameters || []).map(resolve);
    for (const method of METHODS){
      if (!item[method]) continue;
      const op = item[method];
      if (selectedOps && !selectedOps.has(opKey(method, path))) continue;
      const opParams = (op.parameters || []).map(resolve);
      const params = [...commonParams.filter(cp => !opParams.some(p => p.name === cp.name && p.in === cp.in)), ...opParams];
      const responses = op.responses || {};
      const codes = Object.keys(responses);
      const success = +(codes.find(c => /^2/.test(c)) || (method === "post" ? 201 : 200));
      const errCode = codes.find(c => c === "400") || codes.find(c => c === "422") || codes.find(c => /^4/.test(c) && !["401","403","404","405","415"].includes(c));
      const negStatus = errCode ? +errCode : 400;
      const has = c => codes.includes(String(c));
      const auth = authFor(op);
      const tag = (op.tags && op.tags[0]) || "default";
      const opName = op.operationId || `${method.toUpperCase()} ${path}`;

      // request body
      let bodySchema = null, contentType = null, bodyRequired = false;
      if (op.requestBody){
        const rb = resolve(op.requestBody);
        bodyRequired = !!rb.required;
        const content = rb.content || {};
        contentType = Object.keys(content).find(c => /json/i.test(c)) || Object.keys(content)[0] || null;
        if (contentType && content[contentType]) {
          const media = content[contentType];
          bodySchema = media.schema || {};
          if (media.example !== undefined) bodySchema = Object.assign({}, resolve(bodySchema), { example: media.example });
        }
      } else {
        const bp = params.find(p => p.in === "body");
        if (bp){ bodySchema = bp.schema || {}; bodyRequired = !!bp.required; contentType = (op.consumes || spec.consumes || ["application/json"])[0]; }
        const fp = params.filter(p => p.in === "formData");
        if (fp.length && !bp){
          bodySchema = { type: "object", properties: Object.fromEntries(fp.map(p => [p.name, p])), required: fp.filter(p => p.required).map(p => p.name) };
          contentType = "application/json";
        }
      }
      const reqParams = params.filter(p => ["path","query","header","cookie"].includes(p.in));
      const pSchema = p => mergeAll(p.schema || p); // v2 params carry type inline
      const validParams = { path: {}, query: {}, header: {}, cookie: {} };
      for (const p of reqParams){
        const v = p.example !== undefined ? p.example : sample(pSchema(p), 0, p.name);
        if (p.in === "path" || p.required) validParams[p.in][p.name] = v;
      }
      const validBody = bodySchema ? sample(bodySchema) : undefined;

      // response schema for a given status (used for AJV validation in Postman)
      const respInfo = code => {
        const r = responses[String(code)] && resolve(responses[String(code)]);
        if (!r) return { json: false, schema: null };
        if (r.content){
          const ct = Object.keys(r.content).find(c => /json/i.test(c));
          if (!ct) return { json: false, schema: null };
          return { json: true, schema: r.content[ct].schema ? toJsonSchema(r.content[ct].schema) : null };
        }
        if (r.schema) return { json: true, schema: toJsonSchema(r.schema) };
        return { json: false, schema: null };
      };

      const make = (cat, name, mod, expected, explicit) => {
        const req = {
          pathParams: clone(validParams.path), query: clone(validParams.query),
          headers: Object.assign({}, validParams.header), cookies: clone(validParams.cookie),
          body: clone(validBody), rawBody: null, contentType,
          cred: auth ? "valid" : null
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
            auth: authJson(req.cred ? auth : null, req.cred),
            pathParams: req.pathParams, queryParams: req.query, headers: req.headers,
            cookies: Object.keys(req.cookies).length ? req.cookies : undefined,
            body: req.rawBody !== null ? req.rawBody : req.body
          },
          expected: { status: expected, strict: explicit !== false, responseSchema: ri.schema && Object.keys(ri.schema).length ? ri.schema : null, json: ri.json }
        });
      };
      const negExplicit = !!errCode;

      // 1. Happy path
      if (opts.positive){
        make("positive", `${opName}: valid request with all required fields`, null, success, true);
        const optional = reqParams.filter(p => p.in !== "path" && !p.required);
        const optBody = bodySchema && fields(bodySchema).some(f => !f.required && !f.closed);
        if (optional.length){
          make("positive", `${opName}: valid request including optional parameters`, r => {
            for (const p of optional){
              const v = p.example !== undefined ? p.example : sample(pSchema(p), 0, p.name);
              (p.in === "query" ? r.query : p.in === "header" ? r.headers : r.cookies)[p.name] = v;
            }
          }, success, true);
        }
        if (optBody && bodySchema){
          const minimal = minimalBody(bodySchema);
          if (JSON.stringify(minimal) !== JSON.stringify(validBody))
            make("positive", `${opName}: valid request with only required body fields`, r => { r.body = minimal; }, success, true);
        }
      }

      // 2. Parameters
      for (const p of reqParams){
        const s = pSchema(p);
        const bucket = r => p.in === "path" ? r.pathParams : p.in === "query" ? r.query : p.in === "header" ? r.headers : r.cookies;
        if (p.required && p.in !== "path" && opts.negative){
          make("negative", `${opName}: missing required ${p.in} parameter "${p.name}"`, r => { delete bucket(r)[p.name]; }, negStatus, negExplicit);
        }
        if (p.in === "path" && has(404) && opts.negative){
          const t = typeOf(s);
          const v = t === "integer" || t === "number" ? 999999999 : (s.format === "uuid" ? "00000000-0000-0000-0000-000000000000" : "nonexistent-id-999");
          make("negative", `${opName}: non-existent resource (${p.name}=${v})`, r => { r.pathParams[p.name] = v; }, 404, true);
        }
        for (const m of mutations(s, opts)){
          if (!opts[m.cat]) continue;
          if (p.in !== "query" && m.value === null) continue;
          if (p.in !== "path" && !p.required && m.valid) {
            make(m.cat, `${opName}: ${p.in} "${p.name}" ${m.label}`, r => { bucket(r)[p.name] = m.value; }, success, true);
            continue;
          }
          make(m.cat, `${opName}: ${p.in} "${p.name}" ${m.label}`, r => { bucket(r)[p.name] = m.value; }, m.valid ? success : negStatus, m.valid ? true : negExplicit);
        }
      }

      // 3. Body
      if (bodySchema){
        const bodyFields = fields(bodySchema);
        if (opts.negative){
          if (bodyRequired) make("negative", `${opName}: request body missing`, r => { r.body = undefined; }, negStatus, negExplicit);
          if (bodyFields.some(f => f.required && f.path.length === 1))
            make("negative", `${opName}: empty JSON object as body`, r => { r.body = {}; }, negStatus, negExplicit);
          if (/json/i.test(contentType || ""))
            make("negative", `${opName}: malformed JSON body`, r => { r.rawBody = '{"malformed": '; }, 400, has(400));
        }
        if (opts.contentType && opts.negative && contentType){
          make("negative", `${opName}: unsupported Content-Type text/plain`, r => { r.contentType = "text/plain"; r.rawBody = "plain text body"; }, 415, has(415));
        }
        for (const f of bodyFields){
          const lbl = pathLabel(f.path);
          if (f.closed){
            if (opts.negative) make("negative", `${opName}: unknown field on ${lbl} (additionalProperties: false)`, r => {
              r.body = f.path.length ? setAt(r.body, [...f.path, "unexpectedField"], "x") : Object.assign({}, r.body, { unexpectedField: "x" });
            }, negStatus, negExplicit);
            continue;
          }
          if (f.required && opts.negative)
            make("negative", `${opName}: missing required field "${lbl}"`, r => { r.body = setAt(r.body, f.path, null, true); }, negStatus, negExplicit);
          let validVal; try { validVal = f.path.reduce((o, k) => o[k], validBody); } catch(e){}
          for (const m of mutations(f.schema, opts, validVal)){
            if (!opts[m.cat]) continue;
            make(m.cat, `${opName}: field "${lbl}" ${m.label}`, r => { r.body = setAt(r.body, f.path, m.value); }, m.valid ? success : negStatus, m.valid ? true : negExplicit);
          }
        }
      }

      // 4. Security
      if (auth && opts.security){
        make("security", `${opName}: no credentials`, r => { r.cred = null; }, 401, has(401));
        make("security", `${opName}: invalid credentials`, r => { r.cred = "invalid"; }, 401, has(401));
        if (has(403)) make("security", `${opName}: credentials without required permission`, r => { r.cred = "lowPrivilege"; }, 403, true);
      }
    }
  }
  return cases;
}
function minimalBody(s0, d){
  d = d || 0;
  const s = mergeAll(s0);
  if (d > 6) return null;
  if (typeOf(s) === "object" && s.properties){
    const o = {};
    for (const k of s.required || []) if (s.properties[k]) o[k] = minimalBody(s.properties[k], d + 1);
    return o;
  }
  return sample(s, d);
}
