# Blog FAQs - JSON metafield setup

Same format as product FAQs. No metaobjects, no extra lists to manage.

**No theme code change is needed.** `faq-accordion.liquid` already reads
`article.metafields.custom.faqs`, and its loop works with JSON objects exactly as it
does for products.

---

## Step 1 - create the metafield (one time)

**Settings → Custom data → Blog posts → Add definition**

- **Name:** `FAQs`
- **Namespace and key:** must be exactly `custom.faqs`
- **Type:** **JSON**
- **Save**

If you already created a metaobject-based definition, delete it first. Two definitions
cannot share the same key.

Existing keys for reference:

| Resource | Key | Type |
| --- | --- | --- |
| Products | `custom.product_faqs` | JSON |
| Pages | `custom.dynamic_faq` | JSON |
| Collections | `custom.dynamic_faq` | JSON |
| Blog posts | `custom.faqs` | JSON |

---

## Step 2 - add the section to the article template (one time)

**Online Store → Themes → Customize → Blog posts** (pick any post from the top dropdown)

- **Add section → FAQ accordion**
- Drag it below the article content
- Delete the three default **FAQ item** blocks in the left sidebar, they are preset
  placeholders
- Leave **Output FAQ schema (JSON-LD)** ticked
- **Save**

---

## Step 3 - writing FAQs (every post)

**Content → Blog posts → open a post →** scroll to the **Metafields** panel at the
bottom → **FAQs** → paste the JSON.

### Format

```json
[
  {
    "question": "Question text goes here?",
    "answer": "Answer text goes here."
  },
  {
    "question": "Second question?",
    "answer": "Second answer."
  }
]
```

Rules:

- The whole thing is wrapped in square brackets `[ ]`
- Each FAQ is `{ }` with a `question` and an `answer`
- A comma between every FAQ, but **not after the last one**
- Double quotes only, never single quotes
- Add as many as you like

### Real example

```json
[
  {
    "question": "How much Shilajit resin should I take daily?",
    "answer": "The recommended serving is 250 mg, about the size of a grain of rice, once a day."
  },
  {
    "question": "How should I store Shilajit resin?",
    "answer": "Store at room temperature away from direct sunlight. The resin softens in warmth and hardens when cool. Both are normal."
  },
  {
    "question": "When will I notice a difference?",
    "answer": "Most people notice improvements in energy and focus within 4 to 6 weeks of consistent daily use."
  }
]
```

### Quotes inside an answer

A double quote inside text must be escaped with a backslash:

```json
{ "question": "What does AYUSH mean?", "answer": "It stands for \"Ayurveda, Yoga, Unani, Siddha and Homeopathy\"." }
```

Easier option: use single quotes in the copy itself and avoid the problem.

### Links and bold inside an answer

Plain text is the safe default. If you need formatting, HTML works:

```json
{
  "question": "Where can I read your return policy?",
  "answer": "<p>See our <a href=\"/policies/refund-policy\">refund policy</a> for full details.</p>"
}
```

The section detects HTML and renders it as-is. Plain text gets wrapped in a paragraph
automatically, and line breaks are preserved.

---

## What happens automatically

- The accordion renders on the article, styled exactly like the product FAQ
- `FAQPage` JSON-LD is emitted from the same questions and answers
- Blank questions or answers are skipped rather than rendering empty rows
- A post with no FAQs renders nothing at all, not even the heading

---

## Notes

**Bad JSON cannot go live.** Shopify validates JSON metafields when you save. A missing
comma or a stray quote is rejected in the admin with an error, so a malformed FAQ block
cannot reach the storefront. If Save is refused, paste the JSON into
<https://jsonlint.com> to find the line.

**One FAQPage per page.** If you ever put two FAQ accordions on one article, untick
"Output FAQ schema" on the second. Two FAQPage blocks on a page is invalid.

**Copy-paste starter.** Give your SEO team this to work from:

```json
[
  { "question": "", "answer": "" },
  { "question": "", "answer": "" },
  { "question": "", "answer": "" }
]
```
