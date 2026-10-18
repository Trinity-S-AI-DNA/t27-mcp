Module name: BenchVec2

Two-dimensional integer vectors as a struct.

- Declare `pub struct Vec2` with exactly two fields, `x: i16` and `y: i16`. Tests that use your module build values with `Vec2 { x: 3, y: -4 }`.
- `fn add(a: Vec2, b: Vec2) -> Vec2`: component-wise sum.
- `fn sub(a: Vec2, b: Vec2) -> Vec2`: component-wise difference `a - b`.
- `fn scale(a: Vec2, k: i16) -> Vec2`: both components multiplied by `k`.
- `fn dot(a: Vec2, b: Vec2) -> i16`: `a.x*b.x + a.y*b.y`.
- `fn cross(a: Vec2, b: Vec2) -> i16`: `a.x*b.y - a.y*b.x` (can be negative).
- `fn norm1(a: Vec2) -> i16`: the Manhattan length `|x| + |y|`.
- `fn is_zero(a: Vec2) -> bool`: true when both components are 0.
Assume all results fit in `i16`.
