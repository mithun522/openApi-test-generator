/* Docs mode pipeline: contracts -> service models -> links -> flows -> one Markdown document. */
import type { OpenApiDoc } from "../core/types";
import { buildFlows, systemNarrative } from "./flows";
import { findLinks, type Link } from "./links";
import { toMarkdown } from "./markdown";
import { consistencyChecks, dedupeServices, serviceModel, type Service } from "./model";

export interface Contract { doc: OpenApiDoc; source: string }
export interface SystemDocs { services: Service[]; allLinks: Link[]; markdown: string }

export function buildSystemDocs(contracts: Contract[], excluded: ReadonlySet<string>, title: string, date = new Date().toISOString().slice(0, 10)): SystemDocs {
  const services = dedupeServices(contracts.map((c) => serviceModel(c.doc, c.source)));
  const { links: allLinks, events, externals, shared } = findLinks(services);
  const links = allLinks.filter((l) => !excluded.has(l.id));
  const markdown = toMarkdown({
    title: title.trim() || "System", date, services, links, allLinks, events, externals, shared,
    flows: buildFlows(services, links, events),
    narrative: systemNarrative(services, links, events, externals),
    checks: consistencyChecks(services, shared),
  });
  return { services, allLinks, markdown };
}
