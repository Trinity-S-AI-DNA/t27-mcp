// t27f_view, deck look: one demo-reel still as a presentation slide. Every region, size, colour,
// opacity and map position comes from specs/t27f/deck.t27 (bodies in wasm/t27f.wasm, constants in
// wasm/deck.mjs); the camera is reel.t27's. This glue only breaks lines and writes SVG. The ribbon
// shapes under the aurora colours are the one thing it chooses: deck.t27 fixes their colours only.
import * as D from './wasm/deck.mjs';
import * as reel from './wasm/reel.mjs';

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const esc = (v) => String(v).replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
const wrap = (t, n) => String(t).split(/\s+/).filter(Boolean).reduce((a, w) => (a.length && `${a.at(-1)} ${w}`.length <= n ? (a[a.length - 1] += ` ${w}`) : a.push(w), a), []);
const lines = (ls, x, y, size, lead, fill, weight = 400) => ls.map((l, i) => `<text x="${x}" y="${y + i * lead + Math.round(lead * 0.78)}" font-size="${size}" font-weight="${weight}" fill="${hex(fill)}">${esc(l)}</text>`).join('');

export function slide(R, { f, s, preset: p, status, labels, kicker, title, subtitle = '', rows = [] }) {
  const L = R.layout_for(R.demo_kind(s)), W = reel.PRESET_W[p], H = reel.PRESET_H[p];
  const box = (r) => [0, 1, 2, 3].map((j) => R.region_px(L, p, r, j));
  const [cx, cy, hw] = [R.demo_cx(f), R.demo_cy(f), R.demo_hw(f)], sr = R.slide_r(hw, L, p);
  const big = L === D.LAYOUT_COVER ? D.COVER_PX[p] : D.HEADLINE_PX[p], tb = box(L === D.LAYOUT_SPLIT ? D.REGION_CARD : D.REGION_TITLE);
  const head = wrap(title, R.chars_per_line(L === D.LAYOUT_SPLIT ? R.card_inner_w(p) : tb[2] - tb[0], big, D.HEADLINE_EM_PERMILLE));
  const body = rows.flatMap((t) => wrap(t, R.chars_per_line(R.card_inner_w(p), D.BODY_PX[p], D.BODY_EM_PERMILLE)));
  if (!R.text_fits(head.length, body.length, L, p)) throw new Error(`this text does not fit one ${['cover', 'stage', 'split'][L]} slide (${head.length} headline lines, ${body.length} rows): split it into a second slide`);
  const out = [`<defs><filter id="aurora"><feGaussianBlur stdDeviation="${Math.min(W, H) / 10}"/></filter><clipPath id="hero">${((h) => `<rect x="${h[0]}" y="${h[1]}" width="${h[2] - h[0]}" height="${h[3] - h[1]}"/>`)(box(D.REGION_HERO))}</clipPath></defs><rect width="${W}" height="${H}" fill="${hex(D.BACKDROP)}"/>`];
  out.push(`<g filter="url(#aurora)" opacity="${(L === D.LAYOUT_COVER ? D.AURORA_UNDER_COVER_PERMILLE : D.AURORA_UNDER_CARD_PERMILLE) / 1000}">${D.AURORA.map((c, i) => `<ellipse cx="${W * (0.1 + 0.27 * i)}" cy="${H * (0.25 + 0.5 * (i % 2))}" rx="${W * 0.32}" ry="${H * 0.16}" fill="${hex(c)}" transform="rotate(-14 ${W / 2} ${H / 2})"/>`).join('')}</g>`);
  out.push(`<g clip-path="url(#hero)" opacity="${L === D.LAYOUT_COVER ? D.COVER_MAP_PERMILLE / 1000 : 1}">`);
  for (let k = 0; R.valid_cell(k); k++) {
    const st = R.cell_style(status[k] ?? 0), c = hex(R.style_colour(st)), dash = R.style_dashed(st), on = k === reel.DEMO_CELL[s];
    const pts = [0, 1, 2, 3, 4, 5].map((i) => `${R.slide_x(cx, hw, L, p, R.cell_x(k) + R.corner_dx(i))},${R.slide_y(cy, hw, L, p, R.cell_y(k) + R.corner_dy(i))}`).join(' ');
    out.push(`<polygon points="${pts}" fill="${c}" fill-opacity="${dash ? 0.18 : 1}" stroke="${on ? hex(D.WHITE) : dash ? c : hex(D.BACKDROP)}" stroke-width="${on ? 4 : 2}"${dash ? ' stroke-dasharray="6 5"' : ''}/>`,
      `<text x="${R.slide_x(cx, hw, L, p, R.cell_x(k))}" y="${R.slide_y(cy, hw, L, p, R.cell_y(k))}" font-size="${Math.max(10, Math.round(sr / 3))}" fill="${hex(D.TEXT)}" text-anchor="middle" dominant-baseline="middle">${esc(labels[k] ?? k)}</text>`);
  }
  out.push('</g>');
  const lead = R.leading_px(big, L === D.LAYOUT_COVER ? D.COVER_LEADING_PERMILLE : D.HEADLINE_LEADING_PERMILLE), pad = D.PAD_PX[p];
  if (L === D.LAYOUT_SPLIT) {
    const a = R.card_alpha(f - R.demo_scene_start(s), reel.DEMO_FRAMES[s]) / 1000, rx = Math.round(D.GLASS_RADIUS_PERMILLE * Math.min(W, H) / 1000);
    out.push(`<g opacity="${a}"><rect x="${tb[0]}" y="${tb[1]}" width="${tb[2] - tb[0]}" height="${tb[3] - tb[1]}" rx="${rx}" fill="${hex(D.WHITE)}" fill-opacity="${D.GLASS_FILL_PERMILLE / 1000}" stroke="${hex(D.WHITE)}" stroke-opacity="${D.GLASS_BORDER_PERMILLE / 1000}"/>`,
      lines(head, tb[0] + pad, tb[1] + pad, big, lead, D.TEXT, 700), lines(body, tb[0] + pad, tb[1] + pad + head.length * lead + D.HEADLINE_GAP_PX, D.BODY_PX[p], R.leading_px(D.BODY_PX[p], D.ROW_LEADING_PERMILLE), D.TEXT_DIM), '</g>');
  } else out.push(lines(head, tb[0], tb[1] + Math.round((tb[3] - tb[1] - head.length * lead) / 2), big, lead, D.TEXT, 700));
  if (subtitle && R.has_region(L, p, D.REGION_SUBTITLE)) { const b = box(D.REGION_SUBTITLE); out.push(lines([subtitle], b[0], b[1], D.BODY_PX[p], R.leading_px(D.BODY_PX[p], D.ROW_LEADING_PERMILLE), D.TEXT_DIM)); }
  const kb = box(D.REGION_KICKER);
  return out.concat(lines([kicker], kb[0], kb[1], D.CAPTION_PX[p], R.leading_px(D.CAPTION_PX[p], D.ROW_LEADING_PERMILLE), D.KICKER)).join('');
}
