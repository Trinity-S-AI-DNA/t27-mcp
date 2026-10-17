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
reel.t27 as of gHashTag/t27 PR #9984 and deck.t27 as of master (PR #9979).

sha256
  c47b21cea1d7169da6528e321cf2d2c513d3f552c0cd04fe9d37bbd5314ccacf  reel.t27 (source)
  efeb6502d78ad250ceeaf573421a31c05514b5aa16f380831af7923c3c413d3c  deck.t27 (source)
  997f3fc1d04e78ef3c8681c7b0b726d75341cc96928710771bca279cbd1184ba  reel.zig
  eb3a6d63a69a95b81726fc3a459bc4fbf0f2156a463dad56c0096abf721a82c9  deck.zig
  4dc1a0db9968c7a74495b499c480c2093425f653d49265d2f21c83f24e1835ac  reel.mjs
  8b59b81388a33552dec6e29033e8f659eccebcd0850dbc173626448ec8153b96  deck.mjs
  f4ed689c93229f486184bfc6293ae6ad466b6a885d3f1bf993f9adab67aaa418  export.zig
  333948e97de54d80db7477ee79d7e55d7aaac8e4b419fe2e7db6809e64cbfb8a  t27f.wasm
