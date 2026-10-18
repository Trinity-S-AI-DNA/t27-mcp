// Host I/O of t27f_outline and t27f_graph {path}. The exporter, the layout and every decision about the
// outline run in wasm/t27f.wasm: specs/t27f/spec_graph_export.t27 (nodes and edges),
// spec_graph_view.t27 (layout) and spec_graph_outline.t27 (the wording, which facts print, how a span
// prints, which refusal text a verdict takes, the tests of a fn). See wasm/BUILD. This file moves bytes in,
// reads values out through the gx_* exports and fills the `{}` marks of the spec's templates, left to
// right. It chooses no template, filters no fact and computes no span.
import * as G from './wasm/spec_graph_view.mjs';
import * as O from './wasm/spec_graph_outline.mjs';

// Name of constant `v` among the G constants that start with `prefix` (NODE_FN -> 'fn').
const nm = (prefix, v) => Object.keys(G).find((c) => c.startsWith(prefix) && !c.endsWith('KINDS') && G[c] === v)?.slice(prefix.length).toLowerCase() ?? String(v);

// Fill the `{}` marks of a spec template with `vals`, in order.
const fill = (tpl, ...vals) => { let i = 0; return tpl.replace(/\{\}/g, () => String(vals[i++])); };

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

// The text of a refused graph: the spec picks the template, the host fills in the numbers.
export function refusal(R, path, v) {
  const t = O.REFUSAL_TEXT[R.refusal_index(v)];
  if (v === G.ERR_TOO_MANY_NODES) return fill(t, path, R.gx_node_count(), G.MAX_NODES);
  if (v === G.ERR_TOO_MANY_EDGES) return fill(t, path, R.gx_edge_count(), G.MAX_EDGES);
  return fill(t, path, nm('ERR_', v).replace(/_/g, ' '), v);
}

export function outline(R, path, src) {
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
}
