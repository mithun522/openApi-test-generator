/* Docs mode: rule-based flows (Mermaid sequence diagrams) and the plain-English system summary. */
import type { EventInfo, External, Link } from "./links";
import type { Operation, Service } from "./model";

export interface Flow { kind: "chain" | "event" | "lifecycle"; title: string; summary: string; mermaid: string }
export interface Narrative { intro: string; lines: string[] }

export const mid = (id: string) => "s_" + String(id).replace(/[^A-Za-z0-9_]/g, "_");
export const mtext = (s: string) => String(s).replace(/[;#<>]/g, "").replace(/\s+/g, " ").trim();
const tmplPath = (p: string) => String(p).replace(/\{[^}]+\}/g, "{}");
const opTitle = (o: Operation) => o.summary || o.operationId || o.key;

function findOp(svc: Service | undefined, method?: string, path?: string): Operation | undefined {
  return svc?.operations.find((o) => o.method === method && tmplPath(o.path) === tmplPath(path || ""));
}

/* a sequence diagram builder that declares each participant once, in order of first use */
function seq() {
  const parts = new Map<string, string>(), lines: string[] = [];
  return {
    part(id: string, label: string) { if (!parts.has(id)) parts.set(id, label); return id; },
    line(l: string) { lines.push("    " + l); },
    text() { return ["sequenceDiagram", ...[...parts].map(([id, label]) => `    participant ${id} as ${mtext(label)}`), ...lines].join("\n"); },
  };
}

export function buildFlows(services: Service[], links: Link[], events: EventInfo[]): Flow[] {
  const byId = new Map(services.map((s) => [s.id, s]));
  const svcName = (id: string) => byId.get(id)!.name;
  const evByName = new Map(events.map((e) => [e.name, e]));
  const flows: Flow[] = [];

  // 1. declared call chains, from operations nobody else calls
  const called = new Set<string>();
  for (const l of links.filter((l) => l.kind === "declared"))
    for (const it of l.items) { const op = findOp(byId.get(l.to), it.method, it.path); if (op) called.add(`${l.to} ${op.key}`); }
  const starts = services.flatMap((s) => s.operations.filter((o) => (o.calls.length || o.publishes.length) && !called.has(`${s.id} ${o.key}`)).map((o) => [s, o] as const));
  for (const [s, o] of starts) {
    const d = seq();
    const visited = new Set<string>();
    const walk = (svc: Service, op: Operation, caller: string, depth: number) => {
      const me = d.part(mid(svc.id), svc.name);
      d.line(`${caller}->>${me}: ${mtext(op.key)}`);
      visited.add(`${svc.id} ${op.key}`);
      for (const c of op.calls) {
        const call = [c.method, c.path].filter(Boolean).join(" ");
        const t = links.find((l) => l.kind === "declared" && l.from === svc.id && l.items.some((it) => it.fromOp === op.key && it.call === call));
        if (!t) continue;
        const ts = byId.get(t.to);
        const top = findOp(ts, c.method, c.path);
        if (ts && top && depth < 4 && !visited.has(`${ts.id} ${top.key}`)) walk(ts, top, me, depth + 1);
        else {
          const tid = d.part(mid(t.to), ts ? ts.name : c.service + " (not loaded)");
          d.line(`${me}->>${tid}: ${mtext(call || "call")}`);
          d.line(`${tid}-->>${me}: response`);
        }
      }
      for (const e of op.publishes) {
        d.line(`${me}-)${d.part("events", "Event bus")}: publish ${mtext(e)}`);
        for (const sub of evByName.get(e)?.subscribers || [])
          d.line(`events-)${d.part(mid(sub.svc), svcName(sub.svc))}: ${mtext(e)}${sub.op ? " to " + mtext(sub.op) : ""}`);
      }
      d.line(`${me}-->>${caller}: ${op.success}`);
    };
    d.part("client", "Client");
    walk(s, o, "client", 0);
    flows.push({ kind: "chain", title: `${opTitle(o)} (${s.name})`, summary: `Starts with ${o.key} on ${s.name} and follows the calls and events its contract declares.`, mermaid: d.text() });
  }

  // 2. one diagram per event: who publishes it, who consumes it
  for (const e of events) {
    const d = seq();
    for (const p of e.publishers) {
      const pid = d.part(mid(p.svc), svcName(p.svc));
      d.line(`${pid}-)${d.part("events", "Event bus")}: ${mtext(e.name)}${p.op ? " after " + mtext(p.op) : ""}`);
    }
    d.part("events", "Event bus");
    if (!e.subscribers.length) d.line(`Note over events: no subscriber in these contracts`);
    for (const sub of e.subscribers) d.line(`events-)${d.part(mid(sub.svc), svcName(sub.svc))}: ${mtext(e.name)}${sub.op ? " to " + mtext(sub.op) : ""}`);
    const names = (ends: { svc: string }[]) => [...new Set(ends.map((x) => svcName(x.svc)))].join(", ") || "nobody";
    flows.push({ kind: "event", title: `Event: ${e.name}`, summary: `Published by ${names(e.publishers)}. Consumed by ${names(e.subscribers)}.`, mermaid: d.text() });
  }

  // 3. resource lifecycle per service: /orders and /orders/{id} together, create -> read -> update -> delete
  const rank = (o: Operation) => ({ POST: 0, GET: 1, PUT: 3, PATCH: 4, DELETE: 6 } as Record<string, number>)[o.method] ?? 5;
  for (const s of services) {
    const groups = new Map<string, Operation[]>();
    for (const o of s.operations) {
      const base = o.path.replace(/(\/\{[^}]+\})+$/, "") || "/";
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(o);
    }
    for (const [base, ops] of groups) {
      if (ops.length < 2) continue;
      ops.sort((a, b) => rank(a) - rank(b) || a.path.length - b.path.length);
      const d = seq();
      d.part("client", "Client");
      const me = d.part(mid(s.id), s.name);
      for (const o of ops) {
        d.line(`client->>${me}: ${mtext(o.key)}`);
        for (const l of links.filter((l) => l.kind === "inferred" && l.from === s.id))
          for (const it of l.items.filter((it) => it.where!.includes(o.key)))
            d.line(`Note over ${me},${d.part(mid(l.to), svcName(l.to))}: ${mtext(it.field!)} refers to ${mtext(svcName(l.to))} (suggested)`);
        d.line(`${me}-->>client: ${o.success}`);
      }
      flows.push({
        kind: "lifecycle", title: `Resource ${base} (${s.name})`,
        summary: "Typical order of calls: " + ops.map((o) => (o.summary ? `${o.summary} (${o.key})` : o.key)).join(", then ") + ".", mermaid: d.text(),
      });
    }
  }
  return flows;
}

/* ---------- system summary in sentences ---------- */
const listWords = (xs: string[]) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function systemNarrative(services: Service[], links: Link[], events: EventInfo[], externals: External[]): Narrative {
  const name = (id: string) => (services.find((s) => s.id === id) || externals.find((x) => x.id === id) || { name: id }).name;
  const ops = services.reduce((n, s) => n + s.operations.length, 0);
  const count = (k: Link["kind"]) => links.filter((l) => l.kind === k).length;
  const intro = `The system has ${plural(services.length, "service")} exposing ${plural(ops, "operation")}. ` +
    `The contracts declare ${plural(count("declared"), "service-to-service call link")} and ${plural(events.length, "event")}; ` +
    `${count("inferred")} more link${count("inferred") === 1 ? " is" : "s are"} suggested from shared IDs.`;
  const lines = services.map((s) => {
    const out: string[] = [];
    const resources = [...new Set(s.operations.map((o) => o.path.split("/").filter((x) => x && !x.startsWith("{") && !/^v\d+$/i.test(x))[0]).filter(Boolean))];
    out.push(`**${s.name}**${s.version ? ` (v${s.version})` : ""} exposes ${plural(s.operations.length, "operation")}${resources.length ? " on " + listWords(resources) : ""}.`);
    if (s.description) out.push(s.description.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim().replace(/([^.])$/, "$1."));
    out.push(s.auth.length ? `Callers authenticate with ${listWords(s.auth)}.` : "No authentication is defined.");
    const outCalls = links.filter((l) => l.kind === "declared" && l.from === s.id);
    if (outCalls.length) out.push(`It calls ${listWords(outCalls.map((l) => `${name(l.to)} (${l.items.map((i) => i.call || "unspecified operation").join(", ")})`))}.`);
    const inCalls = links.filter((l) => l.kind === "declared" && l.to === s.id);
    if (inCalls.length) out.push(`It is called by ${listWords(inCalls.map((l) => name(l.from)))}.`);
    for (const e of s.publishes) {
      const subs = [...new Set((events.find((x) => x.name === e)?.subscribers || []).map((x) => name(x.svc)))];
      out.push(`It publishes \`${e}\`, ${subs.length ? "consumed by " + listWords(subs) : "with no subscriber in these contracts"}.`);
    }
    for (const e of s.subscribes) {
      const pubs = [...new Set((events.find((x) => x.name === e)?.publishers || []).map((x) => name(x.svc)))];
      out.push(`It consumes \`${e}\`${pubs.length ? " from " + listWords(pubs) : ", which no loaded contract publishes"}.`);
    }
    const inf = links.filter((l) => l.kind === "inferred" && l.from === s.id);
    if (inf.length) out.push(`It appears to reference ${listWords(inf.map((l) => `${name(l.to)} via \`${l.items.map((i) => i.field).join("`, `")}\``))} (suggested).`);
    return out.join(" ");
  });
  return { intro, lines };
}
