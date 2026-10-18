Module name: BenchWindow

A sliding window over the last 4 samples of a signed 16-bit signal.

- module-level state: storage for 4 `i16` samples, all 0 at the start, and a write position. New samples overwrite the oldest one; a slot that was never written holds 0.
- `fn reset()`: set all four slots back to 0 and the write position back to the start.
- `fn add(x: i16)`: record `x` as the newest sample.
- `fn sum() -> i16`: the sum of the four slots (assume it fits in `i16`).
- `fn max4() -> i16`: the largest of the four slots, slots never written counting as 0.
- `fn min4() -> i16`: the smallest of the four slots, slots never written counting as 0.
