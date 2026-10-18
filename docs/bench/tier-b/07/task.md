Module name: BenchFold

Fold a chosen operation over the first `n` values of a small signed array.

- Declare `pub enum Op` with exactly the cases `Add`, `Max`, `Min`, `AltSum` (written `Op.Add` and so on in tests).
- module-level state: storage for 6 `i16` values, all 0 at the start.
- `fn reset()`: set all six values to 0.
- `fn set(i: u8, v: i16)`: store `v` in slot `i` (assume `i < 6`).
- `fn fold(op: Op, n: u8) -> i16`: apply `op` to the first `n` slots (assume `n <= 6`). `Add` is their sum, `Max` the largest, `Min` the smallest, `AltSum` is `v0 - v1 + v2 - v3 + ...` (signs alternate starting with plus). For `n == 0` every operation returns 0. Assume results fit in `i16`.
- `fn argmax(n: u8) -> u8`: the index of the largest of the first `n` slots, the lowest index winning a tie; 0 when `n == 0`.
