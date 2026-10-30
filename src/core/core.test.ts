import { describe, expect, it } from "vitest";
import golden from "../__fixtures__/golden-tests.json";
import { SAMPLE_SYSTEM } from "../docs/sample-system";
import { DEFAULT_VARS } from "./auth";
import { listOps } from "./endpoints";
import { generate } from "./generator";
import { exportCases, toPostman } from "./postman";
import { Spec } from "./refs";
import { SAMPLE_CONTRACT } from "./sample-contract";
import { baseUrl, parseSpec, parseSpecs } from "./spec-parser";
import type { AuthSettings, OpenApiDoc, Options, VarNames } from "./types";

/* golden-tests.json was produced by the pre-React JavaScript implementation; the port must match it exactly */
const contracts: Record<string, OpenApiDoc> = { petstore: parseSpec(SAMPLE_CONTRACT) };
for (const d of parseSpecs(SAMPLE_SYSTEM)) contracts[d.info.title] = d;

const all: Options = { positive: true, negative: true, boundary: true, security: true, nulls: false, contentType: true, emptyStrings: false };
const configs: Record<string, { opts: Options; auth: AuthSettings; vars: VarNames }> = {
  default: { opts: all, auth: { mode: "contract", apiKeyName: "X-API-Key", apiKeyIn: "header" }, vars: DEFAULT_VARS },
  custom: {
    opts: { ...all, boundary: false, nulls: true, contentType: false },
    auth: { mode: "apikey", apiKeyName: "X-Key", apiKeyIn: "query" },
    vars: { ...DEFAULT_VARS, baseUrl: "host", token: "jwt", apiKey: "key-1" },
  },
};
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("test-case generation matches the original implementation", () => {
  for (const [cname, cfg] of Object.entries(configs)) {
    for (const [name, doc] of Object.entries(contracts)) {
      it(`${cname}: ${name}`, () => {
        const spec = new Spec(doc);
        const cases = generate({ spec, opts: cfg.opts, selected: null, auth: cfg.auth, vars: cfg.vars });
        const want = (golden as Record<string, Record<string, { cases: unknown; collection: unknown; baseUrl: string }>>)[cname][name];
        expect(plain(cases)).toEqual(want.cases);
        expect(plain(toPostman(spec, cases, cfg.vars))).toEqual(want.collection);
        expect(baseUrl(doc)).toBe(want.baseUrl);
      });
    }
  }
});

describe("endpoint selection", () => {
  it("only generates for selected operations", () => {
    const spec = new Spec(contracts.petstore);
    const ops = listOps(spec);
    expect(ops.map((o) => o.key)).toEqual(["GET /pets", "POST /pets", "GET /pets/{petId}", "DELETE /pets/{petId}"]);
    const cases = generate({ spec, opts: all, selected: new Set(["DELETE /pets/{petId}"]), auth: configs.default.auth, vars: DEFAULT_VARS });
    expect(new Set(cases.map((c) => `${c.method} ${c.path}`))).toEqual(new Set(["DELETE /pets/{petId}"]));
  });
});

describe("export", () => {
  it("exports every case with the API header", () => {
    const spec = new Spec(contracts.petstore);
    const cases = generate({ spec, ...configs.default, selected: null });
    const out = exportCases(spec, cases, "2026-01-01T00:00:00.000Z");
    expect(out.api).toEqual({ title: "Pet Store", version: "1.0.0", baseUrl: "https://api.petstore.example.com/v1" });
    expect(out.totalTestCases).toBe(cases.length);
  });
});

describe("parsing errors", () => {
  it.each([
    ["", /empty/],
    ["{ bad json", /Invalid JSON/],
    ["a: [1,", /Invalid YAML/],
    ["foo: 1", /top-level "openapi"/],
    ["openapi: 3.0.0\ninfo: {}", /no "paths"/],
  ])("rejects %j", (text, msg) => {
    expect(() => parseSpec(text)).toThrow(msg);
  });
  it("names the failing document in a multi-contract paste", () => {
    expect(() => parseSpecs("openapi: 3.0.0\ninfo: {}\n---\nfoo: 1")).toThrow(/^Document 1: /);
  });
});
