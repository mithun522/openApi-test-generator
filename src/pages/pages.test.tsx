// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DocsPage } from "./DocsPage";
import { TestsPage } from "./TestsPage";

// diagrams need a real layout engine; the docs pipeline's Mermaid output is checked in docs/mermaid.test.ts
vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), run: vi.fn(async () => undefined) } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => undefined;
window.matchMedia ||= (() => ({ matches: false })) as unknown as typeof window.matchMedia;

let host: HTMLDivElement, root: Root;
const render = (page: ReactNode) => act(() => root.render(page));
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const button = (label: string) => {
  const b = [...host.querySelectorAll<HTMLButtonElement>("main button")].find((x) => x.textContent!.includes(label));
  if (!b) throw new Error(`no button "${label}"`);
  return b;
};
const click = (label: string) => act(() => button(label).click());
const visible = () => host.querySelector("main")!;

describe("test-case page", () => {
  beforeEach(() => render(<TestsPage />));

  it("links to the documentation page", () => {
    const docs = [...host.querySelectorAll<HTMLAnchorElement>("nav a")].filter((a) => a.textContent!.includes("Docs"));
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((a) => a.getAttribute("href") === "./docs.html")).toBe(true);
    expect(host.querySelector('nav a[aria-current="page"]')!.textContent).toContain("Test Cases");
  });

  it("generates from the sample contract and filters by endpoint", () => {
    click("Load sample contract");
    const stats = visible().querySelector(".stats")!.textContent;
    expect(stats).toContain("58Total");
    expect(host.querySelector('[role="status"]')!.textContent).toContain("Generated 58 test cases across 4 operations.");
    expect(visible().querySelectorAll(".tc").length).toBe(50); // first page
    click("Load next 8 →");
    expect(visible().querySelectorAll(".tc").length).toBe(58);

    // untick every endpoint but one: results regenerate for it alone
    click("Select none");
    const del = [...visible().querySelectorAll<HTMLLabelElement>("#opsBox label")].find((l) => l.textContent!.includes("DELETE"))!;
    act(() => del.querySelector("input")!.click());
    expect([...visible().querySelectorAll(".tc .m")].every((m) => m.textContent === "DELETE")).toBe(true);

    click("JSON payload");
    expect(JSON.parse(visible().querySelector("#out")!.textContent!).api.title).toBe("Pet Store");
    click("Postman config");
    expect(visible().textContent).toContain("Pet Store — generated tests");
  });

  it("reports parse errors", () => {
    click("Generate test cases");
    expect(visible().querySelector('[role="alert"]')!.textContent).toMatch(/empty/);
  });
});

describe("documentation page", () => {
  beforeEach(() => render(<DocsPage />));

  it("links back to the test-case page", () => {
    expect([...host.querySelectorAll<HTMLAnchorElement>("nav a")].some((a) => a.getAttribute("href") === "./" && a.textContent!.includes("Test Cases"))).toBe(true);
    expect(host.querySelector('nav a[aria-current="page"]')!.textContent).toContain("Docs");
  });

  it("documents the sample system and applies link review", async () => {
    await act(async () => button("Load sample system").click());
    const v = visible();
    click("Manage");
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
