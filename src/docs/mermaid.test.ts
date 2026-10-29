// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseSpecs } from "../core/spec-parser";
import { SAMPLE_SYSTEM } from "./sample-system";
import { buildSystemDocs } from "./system";

describe("Mermaid diagrams", () => {
  it("every generated diagram parses", async () => {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({ startOnLoad: false });
    const contracts = parseSpecs(SAMPLE_SYSTEM).map((doc, i) => ({ doc, source: `#${i}` }));
    const { markdown } = buildSystemDocs(contracts, new Set(), "Shop");
    const blocks = [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
    expect(blocks.length).toBe(11);
    for (const b of blocks) await expect(mermaid.parse(b)).resolves.toBeTruthy();
  }, 60000);
});
