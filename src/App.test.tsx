// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// diagrams need a real layout engine; the docs pipeline's Mermaid output is checked in docs/mermaid.test.ts
vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), run: vi.fn(async () => undefined) } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ||= (() => ({ matches: false })) as unknown as typeof window.matchMedia;

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<App />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const button = (label: string) => {
  const b = [...host.querySelectorAll<HTMLButtonElement>("main:not([hidden]) button, nav button")].find((x) => x.textContent === label);
  if (!b) throw new Error(`no button "${label}"`);
  return b;
};
const click = (label: string) => act(() => button(label).click());
const visible = () => host.querySelector("main:not([hidden])")!;

describe("test-case mode", () => {
  it("generates from the sample contract and filters by endpoint", () => {
    click("Load sample contract");
    const stats = visible().querySelector(".stats")!.textContent;
    expect(stats).toContain("58Total");
    expect(visible().querySelector(".msg.ok")!.textContent).toBe("Generated 58 test cases across 4 operations.");
    expect(visible().querySelectorAll(".tc").length).toBe(58);

    // untick every endpoint but one: results regenerate for it alone
    click("Select none");
    const del = [...visible().querySelectorAll<HTMLLabelElement>("#opsBox label")].find((l) => l.textContent!.includes("DELETE"))!;
    act(() => del.querySelector("input")!.click());
    expect([...visible().querySelectorAll(".tc .m")].every((m) => m.textContent === "DELETE")).toBe(true);

    click("Postman collection");
    const out = visible().querySelector<HTMLTextAreaElement>("#out")!.value;
    expect(JSON.parse(out).info.name).toBe("Pet Store — generated tests");
  });

  it("reports parse errors", () => {
    click("Generate test cases");
    expect(visible().querySelector(".msg.err")!.textContent).toMatch(/empty/);
  });
});

describe("documentation mode", () => {
  it("documents the sample system and applies link review", async () => {
    click("System documentation");
    await act(async () => button("Load sample system").click());
    const v = visible();
    expect(v.querySelectorAll(".citem").length).toBe(4);
    expect(v.querySelector(".doc h1")!.textContent).toBe("Shop: system documentation");
    expect(v.querySelector(".doc #order-service")).not.toBeNull();
    const boxes = v.querySelectorAll<HTMLInputElement>("#linksBox input");
    expect(boxes.length).toBe(4);

    const before = v.querySelectorAll(".doc .mermaid")[0].textContent!;
    expect(before).toContain("suggested: customerId");
    await act(async () => boxes[0].click());
    const after = visible().querySelectorAll(".doc .mermaid")[0].textContent!;
    expect(after).not.toContain('s_order_service -.->|"suggested: customerId"|');

    click("Markdown");
    expect(visible().querySelector<HTMLTextAreaElement>("#docsOut")!.value).toMatch(/^# Shop: system documentation/);
  });
});
