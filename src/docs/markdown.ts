/* Docs mode: the whole system as one Markdown document (Mermaid for diagrams), laid out like a Confluence page.
   Angle brackets in contract text are backslash-escaped so a hostile description can't inject HTML into the rendered view. */
import { mid, type Flow, type Narrative } from "./flows";
import type { EventInfo, External, Link } from "./links";
import type { Check, FieldRow, Operation, Service, SharedModel } from "./model";

const txt = (s: unknown) => String(s == null ? "" : s).replace(/[<>]/g, "\\$&");
const cell = (v: unknown) => (v === undefined || v === null || v === "" ? " " : txt(v).replace(/\|/g, "\\|").replace(/\s*\r?\n\s*/g, " "));
const code = (v: unknown) => "`" + String(v).replace(/`/g, "'").replace(/\|/g, "\\|") + "`";
const mq = (s: string) => String(s).replace(/"/g, "'").replace(/[<>]/g, "");

function mdTable(head: string[], rows: string[][]): string {
  if (!rows.length) return "";
  return ["| " + head.join(" | ") + " |", "|" + head.map(() => " --- ").join("|") + "|", ...rows.map((r) => "| " + r.join(" | ") + " |")].join("\n");
}
function jsonBlock(v: unknown): string {
  if (v === undefined) return "";
  let s = JSON.stringify(v, null, 2);
  const lines = s.split("\n");
  if (lines.length > 60) s = lines.slice(0, 60).join("\n") + "\n…";
  return "```json\n" + s + "\n```";
}
const authText = (a: string[] | null) => (a === null ? "Not specified" : a.length ? a.join(" or ") : "Public");
const fieldTable = (fields: FieldRow[]) =>
  mdTable(["Field", "Type", "Required", "Rules", "Description"], fields.map((f) => [code(f.name), cell(f.type), f.required ? "Yes" : "No", cell(f.rules), cell(f.description)]));

/* GitHub-style heading anchor */
export function ghSlug(s: string): string {
  return String(s).toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

function systemMap(services: Service[], links: Link[], events: EventInfo[], externals: External[]): string {
  const L = ["flowchart LR"];
  for (const s of services) L.push(`    ${mid(s.id)}["${mq(s.name)}"]`);
  for (const x of externals) L.push(`    ${mid(x.id)}["${mq(x.name)} (not loaded)"]:::ext`);
  const evId = (n: string) => "e_" + n.replace(/[^A-Za-z0-9_]/g, "_");
  for (const e of events) L.push(`    ${evId(e.name)}(["${mq(e.name)}"]):::evt`);
  const short = (items: string[]) => {
    const xs = [...new Set(items)];
    return xs.length > 2 ? `${xs.slice(0, 2).join(", ")} +${xs.length - 2}` : xs.join(", ");
  };
  for (const l of links) {
    if (l.kind === "declared") L.push(`    ${mid(l.from)} -->|"${mq(short(l.items.map((i) => i.call || "calls")))}"| ${mid(l.to)}`);
    else if (l.kind === "inferred") L.push(`    ${mid(l.from)} -.->|"suggested: ${mq(short(l.items.map((i) => i.field!)))}"| ${mid(l.to)}`);
    else if (l.kind === "shared") L.push(`    ${mid(l.from)} -.-|"shares ${mq(short(l.items.map((i) => i.model!)))}"| ${mid(l.to)}`);
  }
  for (const e of events) {
    for (const svc of new Set(e.publishers.map((p) => p.svc))) L.push(`    ${mid(svc)} -->|"publishes"| ${evId(e.name)}`);
    for (const svc of new Set(e.subscribers.map((p) => p.svc))) L.push(`    ${evId(e.name)} -->|"consumed by"| ${mid(svc)}`);
  }
  L.push("    classDef ext stroke-dasharray: 5 4", "    classDef evt stroke-width:2px");
  return "```mermaid\n" + L.join("\n") + "\n```";
}

function endpointSection(o: Operation, events: EventInfo[], name: (id: string) => string): string {
  const out = [`#### ${o.method} ${txt(o.path)}${o.summary ? " · " + txt(o.summary) : ""}`];
  const meta = [o.operationId && code(o.operationId), `Auth: ${txt(authText(o.auth))}`, o.tags.length && `Tags: ${txt(o.tags.join(", "))}`, o.deprecated && "**Deprecated**"].filter(Boolean);
  out.push(meta.join(" · "));
  if (o.description) out.push(txt(o.description));
  const rel: string[] = [];
  if (o.calls.length) rel.push("**Calls:** " + o.calls.map((c) => `${txt(c.service)} ${c.method ? code(c.method + " " + c.path) : ""}${c.note ? " (" + txt(c.note) + ")" : ""}`).join("; "));
  if (o.publishes.length)
    rel.push("**Publishes:** " + o.publishes.map((e) => {
      const subs = [...new Set((events.find((x) => x.name === e)?.subscribers || []).map((x) => x.svc))];
      return code(e) + (subs.length ? ` (consumed by ${txt(subs.map(name).join(", "))})` : "");
    }).join(", "));
  if (o.subscribes.length) rel.push("**Consumes:** " + o.subscribes.map(code).join(", "));
  if (rel.length) out.push(rel.join("  \n"));
  if (o.params.length)
    out.push("**Parameters**", mdTable(["Name", "In", "Type", "Required", "Rules", "Description"],
      o.params.map((p) => [code(p.name), p.in, cell(p.type), p.required ? "Yes" : "No", cell(p.rules), cell(p.description)])));
  if (o.body) {
    out.push(`**Request body** (${code(o.body.contentType)}${o.body.required ? ", required" : ", optional"})${o.body.type ? ": " + txt(o.body.type) : ""}`);
    if (o.body.fields.length) out.push(fieldTable(o.body.fields));
    if (o.body.example !== undefined) out.push("Example request:", jsonBlock(o.body.example));
  }
  if (o.responses.length) {
    out.push("**Responses**", mdTable(["Status", "Description", "Body"],
      o.responses.map((r) => [code(r.code), cell(r.description), r.type ? cell(r.type) + (r.contentType && !/json/i.test(r.contentType) ? ` (${cell(r.contentType)})` : "") : "None"])));
    const ok = o.responses.find((r) => /^2/.test(r.code) && r.example !== undefined);
    if (ok) out.push(`Example ${ok.code} response:`, jsonBlock(ok.example));
  }
  return out.join("\n\n");
}

export interface DocInput {
  title: string;
  date: string; // YYYY-MM-DD
  services: Service[];
  links: Link[]; // accepted links
  allLinks: Link[];
  events: EventInfo[];
  externals: External[];
  shared: SharedModel[];
  flows: Flow[];
  narrative: Narrative;
  checks: Check[];
}

export function toMarkdown(d: DocInput): string {
  const { title, date, services, links, allLinks, events, externals, shared, flows, narrative, checks } = d;
  const name = (id: string) => (services.find((s) => s.id === id) || externals.find((x) => x.id === id) || { name: id }).name;
  const L: string[] = [];
  L.push(`# ${txt(title)}: system documentation`,
    `Generated ${date} from ${services.length} OpenAPI contract${services.length === 1 ? "" : "s"}. Links marked *suggested* are inferred from shared IDs and model names; confirm them, or declare real calls with \`x-calls\` (see the appendix).`,
    "**Contents:** [Overview](#overview) · [System map](#system-map) · [How the system fits together](#how-the-system-fits-together) · [Flows](#flows) · [Services](#services) · [Data models](#data-models) · [Consistency checks](#consistency-checks) · [Appendix: declaring links](#appendix-declaring-links)");

  L.push("## Overview", mdTable(["Service", "Version", "Spec", "Base URL", "Auth", "Operations", "Tags"],
    services.map((s) => [`[${txt(s.name)}](#${ghSlug(s.name)})`, cell(s.version), cell(s.spec), s.baseUrl ? code(s.baseUrl) : "Not specified",
      cell(s.auth.join(", ") || "None"), String(s.operations.length), cell(s.tags.join(", "))])));

  L.push("## System map",
    "Solid arrows are calls declared with `x-calls`. Rounded nodes are events. Dashed arrows are suggested references; dotted lines join services that share a model name. Grey dashed boxes are services named in `x-calls` whose contract wasn't loaded.",
    systemMap(services, links, events, externals));

  L.push("## How the system fits together", txt(narrative.intro), narrative.lines.map((l) => "- " + txt(l)).join("\n"));
  if (events.length) {
    const ends = (xs: { svc: string; op: string }[]) => cell([...new Set(xs.map((p) => name(p.svc) + (p.op ? ` (${p.op})` : "")))].join(", ") || "None");
    L.push("### Events", mdTable(["Event", "Published by", "Consumed by"], events.map((e) => [code(e.name), ends(e.publishers), ends(e.subscribers)])));
  }
  const toConfirm = allLinks.filter((l) => l.kind === "inferred");
  if (toConfirm.length) {
    L.push("### Links to confirm",
      "Contracts say what a service offers, not what it calls, so these links are guesses. Each one is a field that looks like the ID of a resource another service owns.",
      mdTable(["From", "To", "Evidence", "Status"], toConfirm.map((l) => [cell(name(l.from)), cell(name(l.to)),
        cell(l.items.map((i) => `${i.field} in ${i.where!.join(", ")}`).join("; ")), links.some((x) => x.id === l.id) ? "Suggested" : "Rejected"])));
  }

  L.push("## Flows");
  if (!flows.length) L.push("No flows could be derived. Add `x-calls`, `x-publishes` or `x-subscribes` to the contracts to describe how services work together.");
  for (const f of flows) L.push(`### ${txt(f.title)}`, txt(f.summary), f.mermaid ? "```mermaid\n" + f.mermaid + "\n```" : "");

  L.push("## Services");
  for (const s of services) {
    L.push(`### ${txt(s.name)}`);
    const facts = [s.version && `Version ${txt(s.version)}`, txt(s.spec), s.baseUrl ? `Base URL ${code(s.baseUrl)}` : "No base URL", `Auth: ${txt(s.auth.join(", ") || "none")}`].filter(Boolean);
    L.push(facts.join(" · "));
    if (s.description) L.push(txt(s.description));
    L.push(mdTable(["Method", "Path", "Summary", "Auth", "Success"],
      s.operations.map((o) => [code(o.method), code(o.path), cell(o.summary || o.operationId), cell(authText(o.auth)), code(o.success)])));
    for (const o of s.operations) L.push(endpointSection(o, events, name));
  }

  L.push("## Data models");
  for (const s of services) {
    const entries = Object.entries(s.schemas);
    if (!entries.length) continue;
    L.push(`### ${txt(s.name)} models`);
    for (const [n, m] of entries) {
      L.push(`#### ${txt(n)}`);
      if (m.description) L.push(txt(m.description));
      L.push(m.fields.length ? fieldTable(m.fields) : `Type: ${txt(m.type)}${m.rules ? "; " + txt(m.rules) : ""}`);
    }
  }
  if (shared.length)
    L.push("### Shared models", "The same model name appears in more than one contract.",
      mdTable(["Model", "Services", "Same fields?"], shared.map((m) => [code(m.name), cell(m.services.map(name).join(", ")), m.differs ? "No: " + cell(m.diff) : "Yes"])));

  L.push("## Consistency checks");
  L.push(checks.length ? mdTable(["Service", "Issue", "Detail"], checks.map((c) => [cell(c.service), cell(c.issue), cell(c.detail)])) : "No issues found.");

  L.push("## Appendix: declaring links",
    "Add these extensions to a contract to turn suggested links into confirmed ones. Unknown keys are ignored by OpenAPI tooling, so they are safe to add.",
    "```yaml\n" + [
      "x-service-name: Order Service        # optional: name used to match services",
      "x-subscribes: [payment.refunded]     # events this service consumes",
      "paths:",
      "  /orders:",
      "    post:",
      "      x-calls:                       # services this operation calls",
      "        - Payment Service POST /payments",
      "        - service: Customer Service",
      "          operation: GET /customers/{customerId}",
      "      x-publishes: [order.created]   # events this operation emits",
    ].join("\n") + "\n```");

  return L.filter((x) => x !== "").join("\n\n") + "\n";
}
