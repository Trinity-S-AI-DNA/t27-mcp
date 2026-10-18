// Host I/O of t27f_outline and t27f_graph {path}. The exporter, the layout and every decision about the
// outline run in wasm/t27f.wasm: specs/t27f/spec_graph_export.t27 (nodes and edges),
// spec_graph_view.t27 (layout) and spec_graph_outline.t27 (the wording, which facts print, how a span
// prints, which refusal text a verdict takes, the tests of a fn). See wasm/BUILD. This file moves bytes in,
// reads values out through the gx_* exports and fills the `{}` marks of the spec's templates, left to
// right. It chooses no template, filters no fact and computes no span.
//
// Hot reload (gHashTag/t27#10232). Whether the last export of a spec may be reused, how long a burst of saves
// waits, which records are sent and what they are called are decided by specs/t27f/hot.t27, run as
// wasm/hot.wasm with its constants in wasm/hot.mjs. This file hashes bytes, keeps the results the key
// admits, and writes the stream; it holds no rule and no time limit.
import { createHash } from 'node:crypto';
import { readFileSync, watch as fsWatch } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, sep } from 'node:path';
import * as G from './wasm/spec_graph_view.mjs';
import * as O from './wasm/spec_graph_outline.mjs';
import * as T from './wasm/hot.mjs';

const H = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(new URL('./wasm/hot.wasm', import.meta.url)))).exports;
H._initialize();
const sha = (b) => createHash('sha256').update(b).digest('hex');
const EXPORTER = sha(readFileSync(new URL('./wasm/t27f.wasm', import.meta.url)));

// Exporter runs since start; the watch loop and the tests read it.
export const runs = { n: 0 };

// Name of constant `v` among the G constants that start with `prefix` (NODE_FN -> 'fn').
const nm = (prefix, v) => Object.keys(G).find((c) => c.startsWith(prefix) && !c.endsWith('KINDS') && G[c] === v)?.slice(prefix.length).toLowerCase() ?? String(v);

// Fill the `{}` marks of a spec template with `vals`, in order.
const fill = (tpl, ...vals) => { let i = 0; return tpl.replace(/\{\}/g, () => String(vals[i++])); };

// Write the spec into the wasm input buffer and run the exporter; returns the exporter's verdict.
export function load(R, path, src) {
  runs.n++;
  const body = Buffer.from(src, 'utf8'), p = Buffer.from(path, 'utf8');
  if (!R.gx_set_len(body.length)) throw new Error(`${path} is ${body.length} bytes; the exporter's input buffer holds ${R.gx_src_cap()}`);
  if (!R.gx_set_path_len(p.length)) throw new Error(`path is ${p.length} bytes; the limit is 512`);
  const mem = new Uint8Array(R.memory.buffer);
  mem.set(body, R.gx_src_ptr());
  mem.set(p, R.gx_path_ptr());
  return R.gx_load();
}

export const nodeName = (R, i) => Buffer.from(R.memory.buffer, R.gx_node_name_ptr(i), R.gx_node_name_len(i)).toString('utf8');

// The text of a refused graph: the spec picks the template, the host fills in the numbers.
export function refusal(R, path, v) {
  const t = O.REFUSAL_TEXT[R.refusal_index(v)];
  if (v === G.ERR_TOO_MANY_NODES) return fill(t, path, R.gx_node_count(), G.MAX_NODES);
  if (v === G.ERR_TOO_MANY_EDGES) return fill(t, path, R.gx_edge_count(), G.MAX_EDGES);
  return fill(t, path, nm('ERR_', v).replace(/_/g, ' '), v);
}

const outlineText = (R, path, src) => {
  const v = load(R, path, src);
  if (v !== G.GRAPH_OK) return refusal(R, path, v);
  const T = O.OUTLINE_TEXT, n = R.gx_node_count(), m = R.gx_edge_count(), out = [];
  const span = (i) => { const a = R.gx_line_start(i), b = R.gx_line_end(i); return R.span_is_range(a, b) ? `${a}-${b}` : String(a); };
  out.push(fill(T[0], path, R.gx_line_count(), n, m, G.MAX_NODES, G.MAX_EDGES), T[1]);
  for (let i = 0; i < n; i++) if (R.shows_in_outline(R.gx_node_label(i))) out.push(fill(T[4], i, nm('NODE_', R.gx_node_kind(i)), nodeName(R, i), span(i), nm('LABEL_', R.gx_node_label(i))));
  out.push(T[2]);
  for (let j = 0; j < m; j++) {
    const f = R.gx_edge_from(j), t = R.gx_edge_to(j);
    if (R.shows_in_outline(R.gx_edge_label(j))) out.push(fill(T[5], nm('EDGE_', R.gx_edge_kind(j)), f, nodeName(R, f), t, nodeName(R, t), R.gx_edge_line(j)));
  }
  out.push(T[3]);
  for (let i = 0; i < n; i++) {
    if (R.gx_node_kind(i) !== G.NODE_FN) continue;
    const names = [];
    for (let k = 0; k < R.gx_o_tested_by_count(i); k++) names.push(nodeName(R, R.gx_o_tested_by_of(i, k)));
    out.push(names.length ? fill(T[6], nodeName(R, i), names.join('; ')) : fill(T[7], nodeName(R, i)));
  }
  return out.join('\n');
};

// ----------------------------------------------------------------------------------- the key cache

const store = new Map(); // corpus path -> { spec, exporter, out: { slot: result } }

// The decision of hot.t27 for `path` whose bytes now hash to `d`, and the entry it judged.
const judge = (path, d) => {
  if (!H.digest_ok(d.length) || !H.digest_ok(EXPORTER.length)) throw new Error('digest is not a sha256 in hex');
  const e = store.get(path);
  return [H.hot_decision(!!e, e?.spec === d, !!e, e?.exporter === EXPORTER), e];
};

// The result of `compute` for this spec, kept while the key (spec bytes, exporter wasm) holds. No clock.
export function memo(path, src, slot, compute) {
  const d = sha(Buffer.from(src, 'utf8'));
  let [dec, e] = judge(path, d);
  if (dec !== T.HOT_REUSE) store.set(path, (e = { spec: d, exporter: EXPORTER, out: {} }));
  if (!(slot in e.out)) e.out[slot] = compute();
  return e.out[slot];
}

export const outline = (R, path, src) => memo(path, src, 'outline', () => outlineText(R, path, src));

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// The loaded graph and its layout as plain data, read through the gx_* exports.
const graphData = (R, path, v) => {
  const d = { verdict: v, node_count: R.gx_node_count(), edge_count: R.gx_edge_count(), nodes: [], edges: [] };
  if (v !== G.GRAPH_OK) return { ...d, refusal: refusal(R, path, v) };
  if (R.gx_view_verdict() !== G.VIEW_OK) return { ...d, refusal: `the view refuses ${path}: verdict ${R.gx_view_verdict()}` };
  d.view = { width: R.gx_view_width(), height: R.gx_view_height() };
  for (let i = 0; i < d.node_count; i++) d.nodes.push({ i, kind: nm('NODE_', R.gx_node_kind(i)), name: nodeName(R, i), label: nm('LABEL_', R.gx_node_label(i)), line_start: R.gx_line_start(i), line_end: R.gx_line_end(i), x: R.gx_view_node_x(i), y: R.gx_view_node_y(i), w: R.gx_view_node_w(i), h: R.gx_view_node_h(i), fill: hex(R.gx_view_node_fill(i)), stroke: hex(R.gx_view_node_stroke(i)), dash: R.gx_view_node_dash(i) });
  for (let j = 0; j < d.edge_count; j++) d.edges.push({ kind: nm('EDGE_', R.gx_edge_kind(j)), label: nm('LABEL_', R.gx_edge_label(j)), from: R.gx_edge_from(j), to: R.gx_edge_to(j), line: R.gx_edge_line(j), x1: R.gx_view_edge_x1(j), y1: R.gx_view_edge_y1(j), x2: R.gx_view_edge_x2(j), y2: R.gx_view_edge_y2(j), stroke: hex(R.gx_view_edge_stroke(j)), dash: R.gx_view_edge_dash(j) });
  return d;
};

// One SSE record, its fields named and ordered by HOT_FIELDS.
const record = (path, e, dec, ms) => {
  const g = e.out.graph, v = { path, digest: e.spec, nodes: g.node_count, edges: g.edge_count, verdict: g.verdict, cache: T.HOT_CACHE_NAMES[H.hot_cache(dec)], export_ms: Math.round(ms * 100) / 100, decision: T.HOT_DECISION_NAMES[dec] };
  return Object.fromEntries(T.HOT_FIELDS.map((k) => [k, v[k]]));
};

// Export one spec through the key cache: the decision, the record and the graph data.
export function exportOne(R, path, src) {
  const t0 = performance.now(), d = sha(Buffer.from(src, 'utf8')), [dec] = judge(path, d);
  const graph = memo(path, src, 'graph', () => graphData(R, path, load(R, path, src)));
  return { decision: dec, graph, record: record(path, store.get(path), dec, performance.now() - t0) };
}

// ------------------------------------------------------------------------------------- watch mode

const ORIGIN_OK = /^(https:\/\/t27\.ai|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const HOST_OK = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

// `dir` is a checkout's specs/ directory; a spec at dir/a/b.t27 is the corpus path specs/a/b.t27.
export function watch(R, dir, port, specPath) {
  const root = resolve(dir), clients = new Set(), pending = new Map();
  let timer;
  const fileOf = (path) => {
    const f = resolve(root, specPath(path).replace(/^specs\//, ''));
    if (!path.startsWith('specs/') || !f.startsWith(root + sep)) throw new Error('path must be under specs/');
    return f;
  };
  const send = (rec) => { for (const c of clients) c.write(`event: ${T.HOT_EVENT}\ndata: ${JSON.stringify(rec)}\n\n`); };
  const look = (path) => {
    const r = exportOne(R, path, readFileSync(fileOf(path), 'utf8'));
    if (H.hot_emits(r.decision, false)) send(r.record);
    return r;
  };
  const arm = () => {
    if (timer || !pending.size) return;
    const now = performance.now();
    let w = Infinity;
    for (const p of pending.values()) w = Math.min(w, H.hot_wait_ms(now - p.last, now - p.first));
    timer = setTimeout(flush, w);
  };
  const flush = () => {
    timer = undefined;
    const now = performance.now(), ready = [...pending].filter(([, p]) => H.hot_ready(now - p.last, now - p.first)).map(([k]) => k).sort();
    for (const path of ready.slice(0, H.hot_take(ready.length))) {
      pending.delete(path);
      try { look(path); } catch (e) { if (e.code === 'ENOENT') store.delete(path); else process.stderr.write(`t27-mcp: ${path}: ${e.message}\n`); }
    }
    arm();
  };
  fsWatch(root, { recursive: true }, (_ev, name) => {
    if (!name) return;
    const path = `specs/${name.split(sep).join('/')}`;
    try { specPath(path); } catch { return; }
    const now = performance.now();
    pending.set(path, { first: pending.get(path)?.first ?? now, last: now });
    clearTimeout(timer);
    timer = undefined;
    arm();
  });
  setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 15000).unref();
  const srv = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1'), o = req.headers.origin;
    const cors = { Vary: 'Origin', ...(o && ORIGIN_OK.test(o) ? { 'Access-Control-Allow-Origin': o } : {}) };
    const end = (code, body, type = 'application/json') => res.writeHead(code, { ...cors, 'Content-Type': type, 'Cache-Control': 'no-cache' }).end(typeof body === 'string' ? body : JSON.stringify(body));
    if (!HOST_OK.test(req.headers.host ?? '')) return end(403, 'host not allowed\n', 'text/plain');
    if (req.method === 'OPTIONS') return res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Last-Event-ID' }).end();
    if (req.method !== 'GET') return end(405, 'GET only\n', 'text/plain');
    if (url.pathname === '/events') {
      res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 1000\n\n');
      for (const [path, e] of store) if (e.out.graph && H.hot_emits(T.HOT_REUSE, true)) res.write(`event: ${T.HOT_EVENT}\ndata: ${JSON.stringify(record(path, e, T.HOT_REUSE, 0))}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/graph') {
      try {
        const r = look(url.searchParams.get('path') ?? '');
        return end(r.graph.refusal ? 422 : 200, { record: r.record, ...r.graph });
      } catch (e) {
        return end(e.code === 'ENOENT' ? 404 : 400, { error: e.message });
      }
    }
    end(404, 'GET /events or GET /graph?path=specs/...t27\n', 'text/plain');
  });
  srv.listen(port, '127.0.0.1', () => process.stderr.write(`t27-mcp: watching ${root} on http://127.0.0.1:${srv.address().port}\n`));
  return srv;
}
