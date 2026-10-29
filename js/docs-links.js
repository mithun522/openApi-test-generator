/* Docs mode: how services connect. Declared links come from x-calls / x-publishes / x-subscribes;
   inferred ones are guesses from ID fields and shared model names, for a person to confirm. */
"use strict";

function singular(w){
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (/(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
const norm = w => singular(String(w).toLowerCase().replace(/[^a-z0-9]/g, ""));
const coreName = n => norm(String(n).replace(/[-_\s]*(micro)?(service|svc|api)$/i, ""));
const NOISE_MODELS = /^(errors?|problem(details)?|errorresponse|apierror|page|pageable|pagination|links?|meta)$/i;

/* resource nouns a service owns: "/orders/{id}" -> order, "POST /payments" -> payment, plus its own name */
function ownedNouns(svc){
  const out = new Set();
  for (const o of svc.operations){
    const segs = o.path.split("/").filter(Boolean);
    segs.forEach((seg, i) => {
      if (seg.startsWith("{") || /^(v\d+|api)$/i.test(seg)) return;
      const next = segs[i + 1];
      if ((next && next.startsWith("{")) || (i === segs.length - 1 && o.method === "POST")) out.add(norm(seg));
    });
  }
  const own = coreName(svc.name);
  if (own.length >= 3) out.add(own);
  return out;
}
/* fields and params that look like references: customerId, payment_id, itemIds -> noun */
function idRefs(svc){
  const refs = new Map();
  const add = (field, where) => {
    const leaf = String(field).split(".").pop().replace(/\[\]$/, "");
    const m = leaf.match(/^(.+?)(?:Ids?|IDs?|_ids?|-ids?)$/);
    if (!m) return;
    const noun = norm(m[1]);
    if (noun.length < 3) return;
    if (!refs.has(noun)) refs.set(noun, { field: leaf, where: new Set() });
    refs.get(noun).where.add(where);
  };
  for (const o of svc.operations){
    o.params.forEach(p => add(p.name, o.key));
    if (o.body) o.body.fields.forEach(f => add(f.name, o.key));
  }
  for (const [n, m] of Object.entries(svc.schemas)) m.fields.forEach(f => add(f.name, `model ${n}`));
  return refs;
}

function findLinks(services){
  const links = new Map();
  const externals = new Map();
  const target = name => services.find(s => s.id === slug(name))
    || services.find(s => coreName(s.name) === coreName(name) || coreName(s.title) === coreName(name));
  const link = (kind, from, to, item) => {
    const id = kind === "shared" ? `shared:${[from, to].sort().join("|")}` : `${kind}:${from}>${to}`;
    if (!links.has(id)) links.set(id, { id, kind, from, to, items: [] });
    links.get(id).items.push(item);
  };

  // declared calls
  for (const s of services){
    const calls = [...s.calls.map(c => ({ c, fromOp: "" })), ...s.operations.flatMap(o => o.calls.map(c => ({ c, fromOp: o.key })))];
    for (const { c, fromOp } of calls){
      let t = target(c.service);
      if (!t){
        const id = "ext-" + slug(c.service);
        if (!externals.has(id)) externals.set(id, { id, name: c.service, external: true });
        t = externals.get(id);
      }
      link("declared", s.id, t.id, { fromOp, call: [c.method, c.path].filter(Boolean).join(" "), method: c.method, path: c.path, note: c.note });
    }
  }

  // events: publisher -> subscriber
  const events = new Map();
  const ev = n => { if (!events.has(n)) events.set(n, { name: n, publishers: [], subscribers: [] }); return events.get(n); };
  for (const s of services){
    const opPub = new Set(), opSub = new Set();
    for (const o of s.operations){
      o.publishes.forEach(e => { ev(e).publishers.push({ svc: s.id, op: o.key }); opPub.add(e); });
      o.subscribes.forEach(e => { ev(e).subscribers.push({ svc: s.id, op: o.key }); opSub.add(e); });
    }
    s.publishes.filter(e => !opPub.has(e)).forEach(e => ev(e).publishers.push({ svc: s.id, op: "" }));
    s.subscribes.filter(e => !opSub.has(e)).forEach(e => ev(e).subscribers.push({ svc: s.id, op: "" }));
  }
  for (const e of events.values())
    for (const p of e.publishers) for (const sub of e.subscribers)
      if (p.svc !== sub.svc) link("event", p.svc, sub.svc, { event: e.name });

  // inferred: A holds an ID of a resource that B owns
  const owned = new Map(services.map(s => [s.id, ownedNouns(s)]));
  for (const a of services){
    for (const [noun, ref] of idRefs(a)){
      if (owned.get(a.id).has(noun)) continue;
      const owners = services.filter(b => b.id !== a.id && owned.get(b.id).has(noun));
      if (owners.length !== 1 || links.has(`declared:${a.id}>${owners[0].id}`)) continue;
      link("inferred", a.id, owners[0].id, { field: ref.field, where: [...ref.where] });
    }
  }

  // shared model names
  const shared = sharedModels(services);
  for (const m of shared){
    if (NOISE_MODELS.test(m.name)) continue;
    for (let i = 0; i < m.services.length; i++)
      for (let j = i + 1; j < m.services.length; j++) link("shared", m.services[i], m.services[j], { model: m.name });
  }

  const order = { declared: 0, event: 1, inferred: 2, shared: 3 };
  return {
    links: [...links.values()].sort((x, y) => order[x.kind] - order[y.kind]),
    events: [...events.values()],
    externals: [...externals.values()],
    shared
  };
}

function sharedModels(services){
  const name = id => services.find(s => s.id === id).name;
  const by = new Map();
  for (const s of services)
    for (const [n, m] of Object.entries(s.schemas)){
      if (!by.has(n)) by.set(n, []);
      by.get(n).push({ svc: s.id, fields: m.fields.map(f => f.name) });
    }
  return [...by].filter(([, l]) => l.length > 1).map(([n, l]) => {
    const all = [...new Set(l.flatMap(x => x.fields))];
    const lacking = l.map(x => ({ svc: x.svc, lacks: all.filter(f => !x.fields.includes(f)) })).filter(x => x.lacks.length);
    return { name: n, services: l.map(x => x.svc), differs: lacking.length > 0,
      diff: lacking.map(x => `${name(x.svc)} lacks ${x.lacks.join(", ")}`).join("; ") };
  });
}
