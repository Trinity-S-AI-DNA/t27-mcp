Module name: BenchSort6

A six-slot signed array that can sort itself.

- module-level state: storage for 6 `i16` values, all 0 at the start.
- `fn reset()`: set all six slots to 0.
- `fn set(i: u8, v: i16)`: store `v` in slot `i` (assume `i < 6`).
- `fn get(i: u8) -> i16`: the value in slot `i`.
- `fn sort()`: reorder the six slots in place into ascending order (smallest in slot 0); equal values may be in any order; negative values sort below positive ones.
- `fn is_sorted() -> bool`: true exactly when slot 0 <= slot 1 <= ... <= slot 5.
- `fn median_low() -> i16`: the 3rd smallest of the six values (the lower median) WITHOUT changing the stored order.
