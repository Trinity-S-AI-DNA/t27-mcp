Module name: BenchSat8

Saturating signed 8-bit arithmetic. Every function takes and returns `i8`; the result must be the mathematically exact value clamped into -128..127 (never wrapped around).

- `fn sat_add(a: i8, b: i8) -> i8`: `a + b`, clamped.
- `fn sat_sub(a: i8, b: i8) -> i8`: `a - b`, clamped.
- `fn sat_neg(a: i8) -> i8`: `-a`, clamped (so `sat_neg(-128)` is 127).
- `fn sat_abs(a: i8) -> i8`: `|a|`, clamped (so `sat_abs(-128)` is 127).
- `fn avg_floor(a: i8, b: i8) -> i8`: `(a + b) / 2` rounded toward negative infinity, computed without overflow (so `avg_floor(-3, 0)` is -2, `avg_floor(127, 127)` is 127, `avg_floor(-128, -127)` is -128).
