Module name: BenchMat2

2x2 integer matrices as a struct.

- Declare `pub struct Mat2` with exactly four `i16` fields `a`, `b`, `c`, `d`, standing for the matrix [[a, b], [c, d]]. Tests build values with `Mat2 { a: 1, b: 1, c: 1, d: 0 }`.
- `fn identity() -> Mat2`: [[1, 0], [0, 1]].
- `fn mul(m: Mat2, n: Mat2) -> Mat2`: the matrix product `m * n` (row times column; the order matters).
- `fn det(m: Mat2) -> i16`: `a*d - b*c`.
- `fn trace(m: Mat2) -> i16`: `a + d`.
- `fn transpose(m: Mat2) -> Mat2`: swap `b` and `c`.
- `fn pow(m: Mat2, n: u8) -> Mat2`: `m` multiplied by itself `n` times; `pow(m, 0)` is the identity. Assume all entries stay within `i16`.
