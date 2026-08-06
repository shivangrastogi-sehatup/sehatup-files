# Tests

Two harnesses, no dependencies. Run from anywhere:

```
node n8n/workflows/tests/product-matcher.test.js
node n8n/workflows/tests/reply-guards.test.js
```

Both **extract the real shipping code** rather than copying it, so they cannot drift:

| Harness | Reads | Covers |
|---|---|---|
| `product-matcher.test.js` | `sehatup-firebase/functions/index.js` | `qrIsRx`, `qrTokens`, `qrMatchScore`, `qrKitHandles`, `qrSearchCatalog`, against the real 32-product catalog |
| `reply-guards.test.js` | `n8n/workflows/extract-ai-response.txt` | the whole guard chain, with the n8n `$()` calls stubbed — what is tested is exactly what gets pasted into n8n |

`reply-guards.test.js` runs the node body through `new Function($, $input, $execution, console)`.
If you add a new `$('Some Node')` call to the node, add it to the `nodes` map in `run()` or the
harness will throw rather than silently test the wrong thing.

The product catalog in `product-matcher.test.js` is a snapshot of `SHOPIFY_PRODUCTS.md`
(title / price / stock / handle). It is not fetched live, so a new product needs adding by hand —
that is deliberate: these tests must give the same answer today and in six months.
