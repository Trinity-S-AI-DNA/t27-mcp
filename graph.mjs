// Host side of t27f_outline and t27f_graph {path}. The exporter and the layout run in wasm/t27f.wasm
// (specs/t27f/spec_graph_export.t27 and spec_graph_view.t27, see wasm/BUILD); this file only moves the
// spec's bytes in, reads the graph out through the gx_* getters and prints it. It decides no node,
// edge, span or verdict. The one derivation it makes is the "is tested by" view, an inversion of the
// exact calls edges that go from a test to a fn, and it says so in the output.
import * as G from './wasm/spec_graph_view.mjs';

// Name of constant `v` among the G constants that start with `prefix` (NODE_FN -> 'fn').
const nm = (prefix, v) => Object.keys(G).find((c) => c.startsWith(prefix) && !c.endsWith('KINDS') && G[c] === v)?.slice(prefix.length).toLowerCase() ?? String(v);

// Write the spec into the wasm input buffer and run the exporter; returns the exporter's verdict.
export function load(R, path, src) {
  const body = Buffer.from(src, 'utf8'), p = Buffer.from(path, 'utf8');
  if (!R.gx_set_len(body.length)) throw new Error(`${path} is ${body.length} bytes; the exporter's input buffer holds ${R.gx_src_cap()}`);
  if (!R.gx_set_path_len(p.length)) throw new Error(`path is ${p.length} bytes; the limit is 512`);
  const mem = new Uint8Array(R.memory.buffer);
  mem.set(body, R.gx_src_ptr());
  mem.set(p, R.gx_path_ptr());
  return R.gx_load();
}

export const nodeName = (R, i) => Buffer.from(R.memory.buffer, R.gx_node_name_ptr(i), R.gx_node_name_len(i)).toString('utf8');

// Why the graph was refused, in the words of the verdict (never a truncated graph).
export function refusal(R, path, v) {
  const why = nm('ERR_', v).replace(/_/g, ' ');
  if (v === G.ERR_TOO_MANY_NODES) return `${path}: refused, ${why}: ${R.gx_node_count()} nodes found, the graph holds at most ${G.MAX_NODES}. No graph is drawn or truncated.`;
  if (v === G.ERR_TOO_MANY_EDGES) return `${path}: refused, ${why}: ${R.gx_edge_count()} edges found, the graph holds at most ${G.MAX_EDGES}. No graph is drawn or truncated.`;
  return `${path}: refused, ${why} (verdict ${v}).`;
}

export function outline(R, path, src) {
  const v = load(R, path, src);
  if (v !== G.GRAPH_OK) return refusal(R, path, v);
  const n = R.gx_node_count(), m = R.gx_edge_count(), lines = [];
  const span = (i) => { const a = R.gx_line_start(i), b = R.gx_line_end(i); return `${a}${b > a ? `-${b}` : ''}`; };
  const ref = (i) => `${nm('NODE_', R.gx_node_kind(i))} ${nodeName(R, i)}`;
  lines.push(`${path}: ${R.gx_line_count()} lines, ${n} nodes, ${m} edges (cap ${G.MAX_NODES} nodes / ${G.MAX_EDGES} edges); exact only, no derived edges`, 'nodes (kind name lines a-b label):');
  for (let i = 0; i < n; i++) lines.push(`  ${i} ${ref(i)} lines ${span(i)} ${nm('LABEL_', R.gx_node_label(i))}`);
  lines.push('edges (kind from -> to, line of first use):');
  const tests = new Map();
  for (let j = 0; j < m; j++) {
    const k = R.gx_edge_kind(j), f = R.gx_edge_from(j), t = R.gx_edge_to(j);
    lines.push(`  ${nm('EDGE_', k)} ${f} ${nodeName(R, f)} -> ${t} ${nodeName(R, t)} line ${R.gx_edge_line(j)}`);
    if (k === G.EDGE_CALLS && R.gx_node_kind(f) === G.NODE_TEST && R.gx_node_kind(t) === G.NODE_FN) tests.set(t, [...(tests.get(t) ?? []), nodeName(R, f)]);
  }
  lines.push('derived (the tested_by view of the exact calls edges from a test to a fn):');
  for (let i = 0; i < n; i++) if (R.gx_node_kind(i) === G.NODE_FN) lines.push(`  fn ${nodeName(R, i)} ${tests.has(i) ? `is tested by: ${tests.get(i).join('; ')}` : 'is called by no test'}`);
  return lines.join('\n');
}
