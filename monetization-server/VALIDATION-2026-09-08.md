# Local commerce receiver validation — September 8, 2026

These tests use synthetic events, localhost HTTP, temporary SQLite databases and local provider fixtures. They do not validate live provider checkout, merchant configuration, deployed service capacity or real payments. No deployment or Cloudflare access was performed.

## Reproduce

From the repository root:

```sh
node --test monetization-server/tests/*.test.js
node tests/monetization.test.cjs
node --expose-gc monetization-server/tests/commerce-benchmark.js
node --expose-gc monetization-server/tests/receiver-soak.js
```

The two manual benchmarks are intentionally outside the automatic `*.test.js` suite. The soak removes only its own new temporary directory and needs no credentials. Its signed synthetic HTTP requests target `127.0.0.1`; its account lookup is stubbed. It runs receiver plugins without the production rate limiter to measure receiver work, so its throughput is not a public API rate recommendation.

## Correctness and fixes

- Seed `0x53534e`: 10,000 deterministic JSON inputs through commerce, configuration, wishlist, tip, gift, product-import and order normalizers. Added focused malformed-price/currency/type cases and public catalog API regressions.
- Null Ko-fi/BMAC/Fourthwall line items no longer crash normalization. Public summary work is capped at 100 items. Null Fourthwall variants/images degrade gracefully.
- Throne accepts only its documented own event names; inherited names such as `constructor`, `toString` and `__proto__` are rejected.
- Arrays, booleans and JSON coercion objects cannot become prices or currency fields. Numeric strings remain supported in saved configuration. Malformed eBay prices cannot turn into a displayed free listing.
- Malformed eBay orders/line items no longer abort neighboring valid sales. Invalid or absent quantities no longer invent a sale of one item.
- NinjaBacker and Shopify retention now use an index on creation time instead of scanning every retained receipt on each webhook and poll. Existing databases acquire the index during normal initialization.
- Both receivers tested at 1,000 pending deliveries: duplicate retry still succeeds, overflow returns 503, a valid acknowledgment frees capacity, simultaneous new arrivals cannot exceed the cap, and another channel cannot acknowledge the delivery.

## CPU and retention benchmark

Windows, Node v22.14.0, AMD Ryzen 9 3950X. Measurements were taken while other application checks could be running. SQLite comparison uses 100,000 retained rows in memory and 200 no-op expiry deletions; it isolates query cost, not disk or end-to-end latency.

| Measurement | Result |
| --- | --- |
| 50,000 tip normalizations after 2,000 warmup calls | 2,161.62 ms summed call time |
| Normalization p50 / p95 | 0.0356 / 0.0755 ms |
| Retained JS heap delta after explicit GC | 19,584 bytes |
| Retention deletion without creation-time index, p50 / p95 | 6.1842 / 7.9288 ms |
| Retention deletion with creation-time index, p50 / p95 | 0.0019 / 0.0025 ms |

Query-plan regression tests assert index use and correct removal while preserving newer pending and acknowledged receipts. They avoid machine-dependent timing thresholds.

## Sustained localhost HTTP workload

20,000 signed deliveries, 30,084 HTTP operations, 126.51 seconds total. Each provider used a separate temporary file database with WAL and `synchronous=FULL`. Payloads carried synthetic private fields to verify removal. Each run included 1,000 ordinary retries, five receiver/database close-and-reopen cycles, retries after restart, ten stale-lease/re-lease cycles and simulated expiry after eight days. All assertions passed; payload columns were empty after acknowledgment and all expired receipts were removed.

| Provider | Deliveries | HTTP operations | Elapsed | GC heap at 4k / 10k deliveries | RSS at 4k / 10k |
| --- | ---: | ---: | ---: | --- | --- |
| NinjaBacker | 10,000 | 15,042 | 60.88 s | 13.03 / 13.46 MiB | 115.25 / 118.13 MiB |
| Shopify | 10,000 | 15,042 | 65.63 s | 13.73 / 13.94 MiB | 116.89 / 119.91 MiB |

NinjaBacker began at 11.06 MiB heap / 67.20 MiB RSS before HTTP warmup. Shopify ran afterward in the same process. Most RSS increase occurred during warmup; later retained heap growth was small and slowing. This bounded run did not show runaway memory growth, but it is not an overnight soak or a guarantee against production leaks. It measures the test process, including its HTTP client and the receiver, not an isolated production server process.
