import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSpecs } from "../core/spec-parser";
import { parseCall } from "./model";
import { SAMPLE_SYSTEM } from "./sample-system";
import { buildSystemDocs, type Contract } from "./system";

const contracts: Contract[] = parseSpecs(SAMPLE_SYSTEM).map((doc, i) => ({ doc, source: `Sample #${i + 1}` }));
const build = (excluded: string[] = []) => buildSystemDocs(contracts, new Set(excluded), "Shop", "DATE");

describe("system documentation", () => {
  it("matches the original implementation's output for the sample system", () => {
    const golden = readFileSync(new URL("../__fixtures__/golden-docs.md", import.meta.url), "utf8");
    expect(build().markdown).toBe(golden.replace(/\r\n/g, "\n"));
  });

  it("finds every link type in the sample", () => {
    expect(build().allLinks.map((l) => l.id)).toEqual([
      "declared:order-service>payment-service",
      "event:order-service>notification-service",
      "event:payment-service>notification-service",
      "inferred:order-service>customer-service",
      "inferred:payment-service>order-service",
      "inferred:notification-service>customer-service",
      "shared:customer-service|order-service",
    ]);
  });

  it("drops a rejected suggestion from the map and marks it in the review table", () => {
    const md = build(["inferred:order-service>customer-service"]).markdown;
    expect(md).not.toContain('s_order_service -.->|"suggested: customerId"| s_customer_service');
    expect(md).toMatch(/\| Order Service \| Customer Service \| .* \| Rejected \|/);
  });

  it("escapes HTML in contract text and keeps it out of Mermaid labels", () => {
    const [doc] = parseSpecs(`openapi: 3.0.0
info: { title: "Evil <script>alert(1)</script>", version: "1", description: "<img src=x onerror=alert(1)>" }
x-calls: [Billing Service]
paths: { /x: { get: { responses: { "200": { description: ok } } } } }`);
    const md = buildSystemDocs([{ doc, source: "evil" }], new Set(), "T", "DATE").markdown;
    expect(md).not.toMatch(/[^\\]<(script|img)/);
    expect(md).toContain('["Billing Service (not loaded)"]:::ext');
  });

  it("parses x-calls in both forms", () => {
    expect(parseCall("Payment Service POST /payments")).toEqual({ service: "Payment Service", method: "POST", path: "/payments", note: "" });
    expect(parseCall({ service: "Customer Service", operation: "GET /customers/{id}", description: "checks" }))
      .toEqual({ service: "Customer Service", method: "GET", path: "/customers/{id}", note: "checks" });
    expect(parseCall("billing")).toEqual({ service: "billing", method: "", path: "", note: "" });
  });
});
