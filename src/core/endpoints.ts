/* The operations in a contract, for the endpoint picker. */
import type { Spec } from "./refs";
import { METHODS, type OpEntry, type Schema } from "./types";

export const opKey = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;

export function listOps(spec: Spec): OpEntry[] {
  const out: OpEntry[] = [];
  for (const [path, item0] of Object.entries<Schema>(spec.doc.paths || {})) {
    const item = spec.resolve(item0);
    for (const m of METHODS)
      if (item[m]) out.push({ key: opKey(m, path), method: m.toUpperCase(), path, summary: item[m].summary || item[m].operationId || "" });
  }
  return out;
}
