wasm/ -- how the t27f_view tool's numbers are built

Every number t27f_view draws comes from two specs in gHashTag/t27:
specs/t27f/reel.t27 (module T27fReel: the map, the camera, the timeline) and
specs/t27f/deck.t27 (module T27fDeck: the default slide look). Nothing in this
directory is a second home for that math:

  reel.zig    generated: t27c gen specs/t27f/reel.t27          (do not edit)
  deck.zig    generated: t27c gen specs/t27f/deck.t27          (do not edit)
  reel.mjs    generated: t27c gen-js specs/t27f/reel.t27       (do not edit)
  deck.mjs    generated: t27c gen-js specs/t27f/deck.t27       (do not edit)
  export.zig  hand glue, 40 lines: exports every scalar pub fn of reel.zig
              and deck.zig (up to five parameters) under its own name with
              the C calling convention. deck.zig inlines what it imports from
              reel (half_height), so a name reel.zig already has is exported
              once, from reel. It names no spec function and holds no number.
  t27f.wasm   built from export.zig + reel.zig + deck.zig

The bodies run as t27f.wasm, because gen-js emits constants only. reel.mjs and
deck.mjs supply the constants (presets, regions, type sizes, palette, scene
names, demo reel tables, style codes). ../deck-view.mjs draws the slide and
../server.mjs the plain map; both only write SVG.

Rebuild (on the Railway lab, never on the owner's Mac), from specs/t27f/:

  t27c gen    reel.t27 > reel.zig
  t27c gen    deck.t27 > deck.zig
  t27c gen-js reel.t27 > reel.mjs
  t27c gen-js deck.t27 > deck.mjs
  zig build-exe export.zig -target wasm32-freestanding -fno-entry -rdynamic \
      -O ReleaseSmall -femit-bin=t27f.wasm

-rdynamic is required: without it a -fno-entry wasm exports nothing.

Built with t27c 0.5.2 at gHashTag/t27 57474a4f1 and zig 0.16.0, from
reel.t27 as of gHashTag/t27 master (PR #9984) and deck.t27 as of PR #10036
(the backdrop is brand black: BACKDROP 0x000000, aurora at zero strength;
before it, #9992 STILL_CARD_ALPHA). deck.t27 at #10036: 16/16 tests pass,
0 vacuous, on the lab; t27b 16 passed.

sha256
  c47b21cea1d7169da6528e321cf2d2c513d3f552c0cd04fe9d37bbd5314ccacf  reel.t27 (source)
  bd8ef9fc155365c805ba716d97155bed1e4017c378dbc335e252bcb244512147  deck.t27 (source)
  997f3fc1d04e78ef3c8681c7b0b726d75341cc96928710771bca279cbd1184ba  reel.zig
  b7e1efaba309134633cd13cafe5515c0eab1ae403c229d0fca6ae3ea1dafe00c  deck.zig
  4dc1a0db9968c7a74495b499c480c2093425f653d49265d2f21c83f24e1835ac  reel.mjs
  5a060aa5777ae6f7ff0317da0c86551410a1ab87e179ad2f8bc75ba08c2c2f7c  deck.mjs
  f4ed689c93229f486184bfc6293ae6ad466b6a885d3f1bf993f9adab67aaa418  export.zig
  8399d733aebb0e8c9b34a8770b7bfa958cfbbc1feb70ad320221922fe057c791  t27f.wasm
