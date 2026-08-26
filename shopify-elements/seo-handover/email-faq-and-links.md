**Subject:** Blog FAQs and link attributes - how to add both

---

Hi [Name],

Two things now set up on the site, with instructions for each.

---

## 1. Blog FAQs

Each blog post can now carry its own FAQ list. It renders as an accordion at the bottom
of the post and automatically produces the FAQPage schema for Google, so you do not
need to add any schema code yourself.

**Where to add it:** Shopify admin → Content → Blog posts → open the post → scroll past
the content editor to the **Metafields** panel at the bottom → **FAQs**

Paste the FAQs in this format:

```json
[
  {
    "question": "What is a male sexual performance booster?",
    "answer": "It is a combination of factors rather than a single product: stamina, libido and erection quality. Ayurvedic formulations work on the underlying causes such as stress, sleep and hormonal balance."
  },
  {
    "question": "How long does it take to see results?",
    "answer": "Most people notice improvements within 4 to 6 weeks of consistent daily use, alongside better sleep and reduced stress."
  },
  {
    "question": "Do I need a doctor consultation before starting?",
    "answer": "A free consultation is included with every order. Our doctors review your concerns and medical history before recommending a plan."
  }
]
```

**Formatting rules:**

- The whole list sits inside square brackets `[ ]`
- Each FAQ is a `{ }` pair with `question` and `answer`
- Comma after every FAQ except the last one
- Double quotes only, never single quotes
- Add as many FAQs as the post needs

If you need a double quote inside the text, escape it with a backslash: `\"like this\"`.
Easier to use single quotes in the copy and avoid it.

If you need a link or bold inside an answer, HTML works:

```json
{
  "question": "Where can I read your return policy?",
  "answer": "<p>See our <a href=\"/policies/refund-policy\">refund policy</a> for details.</p>"
}
```

Shopify checks the JSON when you hit Save, so if anything is malformed it will refuse
to save and show an error rather than breaking the live page.

**Blank starter to copy:**

```json
[
  { "question": "", "answer": "" },
  { "question": "", "answer": "" },
  { "question": "", "answer": "" }
]
```

---

## 2. Nofollow and dofollow on blog links

Shopify's link dialog has no rel option, so this has to be done in the HTML view.

**Steps:**

1. Shopify admin → **Content → Blog posts** → open the post
2. In the content editor toolbar, click the **`</>`** button on the far right (Show HTML)
3. Find the link you want to change, it will look like
   `<a href="https://example.com/page">anchor text</a>`
4. Add the attribute inside the opening tag
5. Save, then reopen the HTML view once to confirm the attribute is still there

**For nofollow**, add `rel="nofollow"`:

```html
<a href="https://www.sehatup.com/pages/for-him" rel="nofollow">anchor text</a>
```

**For dofollow**, there is nothing to add. A link is dofollow by default when it has no
`rel` attribute. If a link already has `rel="nofollow"` and you want it followed, delete
that attribute:

```html
<a href="https://www.sehatup.com/pages/for-him">anchor text</a>
```

`rel="dofollow"` is not a real attribute and is ignored, so please do not add it.

**Other values available:**

| Value | Use for |
| --- | --- |
| `rel="nofollow"` | Links we do not want to vouch for |
| `rel="sponsored"` | Paid, affiliate or advertising links |
| `rel="ugc"` | Links inside user comments |

One request: please keep **internal links dofollow**. Links pointing to our own pages,
products and collections should have no `rel` attribute, so authority keeps moving
around the site. Nofollow is for outbound links we do not want to endorse.

---

Let me know if anything is unclear or if you would like me to walk through the first
one together.

Thanks,
Shivang
