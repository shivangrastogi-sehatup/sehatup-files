# Tests

Four harnesses, no dependencies. Run from anywhere:

```
node n8n/workflows/tests/product-matcher.test.js
node n8n/workflows/tests/reply-guards.test.js
node n8n/workflows/tests/automation-triggers.test.js
node n8n/workflows/tests/ad-context.test.js
```

All of them **extract the real shipping code** rather than copying it, so they cannot drift:

| Harness | Reads | Covers |
|---|---|---|
| `product-matcher.test.js` | `sehatup-firebase/functions/index.js` | `qrIsRx`, `qrTokens`, `qrMatchScore`, `qrKitHandles`, `qrSearchCatalog`, against the real 32-product catalog |
| `reply-guards.test.js` | `n8n/workflows/extract-ai-response.txt` | the whole guard chain, with the n8n `$()` calls stubbed — what is tested is exactly what gets pasted into n8n |
| `automation-triggers.test.js` | `n8n/workflows/extract-message-details.txt` | which inbound messages skip the AI (health-score triggers, button/list replies, media) |
| `ad-context.test.js` | `n8n/workflows/build-ai-prompt.txt` | the click-to-WhatsApp **AD CONTEXT** block, against the real 2026-08-07 `adPreview` payload plus four malformed ones |

`reply-guards.test.js` and `ad-context.test.js` run the node body through
`new Function($, $input, $execution, console)`. If you add a new `$('Some Node')` call to either
node, add it to the `nodes` map in `run()` or the harness will throw rather than silently test
the wrong thing.

The product catalog in `product-matcher.test.js` is a snapshot of `SHOPIFY_PRODUCTS.md`
(title / price / stock / handle). It is not fetched live, so a new product needs adding by hand —
that is deliberate: these tests must give the same answer today and in six months.
