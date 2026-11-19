// Pulls live Shopify products (active + listed + in stock, plus the free Ashwagandha sample)
// and splits each description by its [tag]...[/tag] blocks.
// Run: node fetch-product-descriptions.mjs  -> PRODUCT_DESCRIPTIONS.json + PRODUCT_DESCRIPTIONS.md
import fs from 'fs';

const H = { 'X-Shopify-Access-Token': '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' };
let url = 'https://0ec320-gj.myshopify.com/admin/api/2026-01/products.json?limit=250';
const all = [];
while (url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()));
  all.push(...(await r.json()).products);
  url = (r.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1];
}

const inStock = p => p.variants.some(v => v.inventory_quantity > 0 || !v.inventory_management || v.inventory_policy === 'continue');
const keep = all.filter(p => /free sample/i.test(p.title) || (p.status === 'active' && p.published_at && inStock(p)));

const text = html => html
  .replace(/<li[^>]*>/gi, '\n- ').replace(/<br\s*\/?>|<\/(p|h\d|ul|ol|div)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
  .split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  // <li><p>text</p></li> leaves a lone "-" line; glue it onto the next line
  .flatMap((l, i, a) => l === '-' ? [] : a[i - 1] === '-' && !l.startsWith('- ') ? ['- ' + l] : [l]).join('\n');

// A block runs from [name] to [/name...] (tolerates typos like [/benefit]) or the next opening tag.
const TAG = /\[([a-z_]+)\]/gi;
function sections(html) {
  const opens = [...html.matchAll(TAG)];
  const out = {};
  opens.forEach((m, i) => {
    const start = m.index + m[0].length;
    const nextOpen = opens[i + 1]?.index ?? html.length;
    const close = html.slice(start, nextOpen).search(new RegExp(`\\[/${m[1].slice(0, 5)}[a-z_]*\\]`, 'i'));
    out[m[1].toLowerCase()] = text(html.slice(start, close >= 0 ? start + close : nextOpen));
  });
  return out;
}

// List items if the block has any, else every line (some kits write benefits as plain paragraphs).
const bullets = b => {
  const l = b.split('\n').filter(x => x && !/^key benefits:?$/i.test(x)), li = l.filter(x => x.startsWith('- '));
  return li.length ? li.map(x => x.slice(2)) : l;
};

const rows = keep.map(p => {
  const body = p.body_html || '';
  const s = sections(body);
  const v = p.variants[0];
  return {
    id: p.id, title: p.title, handle: p.handle, status: p.status, listed: !!p.published_at,
    price: v.price, mrp: v.compare_at_price, stock: p.variants.reduce((a, x) => a + (x.inventory_quantity || 0), 0),
    product_type: p.product_type, shopify_tags: p.tags,
    description_tags: Object.keys(s),
    sections: Object.keys(s).length ? s : { untagged: text(body) },
    benefits: bullets(s.benefits || ''),
  };
});

fs.writeFileSync('PRODUCT_DESCRIPTIONS.json', JSON.stringify(rows, null, 2));
const md = [`# Live product descriptions (${rows.length} products, pulled ${new Date().toISOString().slice(0, 10)})\n`,
  '| # | Product | Price | Stock | Tags in description |', '|---|---|---|---|---|',
  ...rows.map((r, i) => `| ${i + 1} | ${r.title} | ₹${r.price} | ${r.stock} | ${r.description_tags.join(', ') || '(none)'} |`), '',
  ...rows.flatMap(r => [`## ${r.title}`, `\`${r.handle}\` · ₹${r.price}${r.mrp ? ` (MRP ₹${r.mrp})` : ''} · stock ${r.stock}${r.listed ? '' : ' · UNLISTED'}\n`,
    ...Object.entries(r.sections).flatMap(([k, v]) => [`### ${k}`, v, '']), '---\n'])];
fs.writeFileSync('PRODUCT_DESCRIPTIONS.md', md.join('\n'));
console.log(`${all.length} products fetched, ${rows.length} kept`);
rows.forEach(r => console.log(`${r.title.slice(0, 50).padEnd(50)} | ${r.description_tags.join(',') || '(none)'} | ${r.benefits.length} benefits`));
