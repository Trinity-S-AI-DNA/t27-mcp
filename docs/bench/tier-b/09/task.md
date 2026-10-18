Module name: BenchHist

A saturating histogram of 8-bit samples with 8 buckets.

- module-level state: 8 counters of type `u8`, all 0 at the start.
- `fn reset()`: set all counters to 0.
- `fn add(s: u8)`: the sample goes into bucket `s / 32` (so 0..31 -> bucket 0, 32..63 -> bucket 1, ..., 224..255 -> bucket 7). That bucket's counter increases by 1 but never beyond 255 (it saturates, it does not wrap to 0).
- `fn count(b: u8) -> u8`: the counter of bucket `b` (assume `b < 8`).
- `fn total() -> u16`: the sum of all 8 counters.
- `fn peak() -> u8`: the index of the bucket with the highest counter, the lowest index winning a tie; 0 when every counter is 0.
- `fn nonempty() -> u8`: how many buckets have a counter above 0.
