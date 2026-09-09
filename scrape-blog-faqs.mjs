/**
 * Pull every FAQ that has been hand-coded into a sehatUP blog article and write
 * them to an Excel workbook.
 *
 *   node scrape-blog-faqs.mjs [--out blog-faqs.xlsx] [--limit N]
 *
 * Articles come from the public sitemap, so nothing has to be listed by hand;
 * a new post is picked up on the next run.
 *
 * Three FAQ shapes are recognised, because the articles were not all written
 * the same way:
 *   A. <div class="faq-tab"> with a <label class="faq-label-title"> question and
 *      a <div class="faq-tab-content"> answer  — the house style
 *   B. <details><summary>question</summary> answer </details>
 *   C. JSON-LD "@type": "FAQPage"
 * Only the <main> element is searched, so the theme's own <details> menu
 * drawers in the header are never mistaken for an FAQ.
 *
 * Two sheets:
 *   "FAQ JSON"  one row per article: the title, and its Q&A as a JSON array
 *   "FAQ Table" one row per question: title, number, question, answer
 */
import fs from 'fs';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const XLSX = require_('./sehatup-analytics/node_modules/xlsx');

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const OUT = argOf('--out', 'blog-faqs.xlsx');
const LIMIT = Number(argOf('--limit', 0)) || Infinity;
const SITEMAP = 'https://www.sehatup.com/sitemap_blogs_1.xml';

// ── html → text ────────────────────────────────────────────────────────────
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…', deg: '°', trade: '™',
};
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m));
}
function text(html) {
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      // Block ends become line breaks, so paragraphs and list items stay apart.
      .replace(/<\/(p|div|li|h[1-6]|tr|br)\s*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n *\n+ */g, '\n')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Content of the element opening at `open`, counting nested <tag> to find its close. */
function inner(html, open, tag) {
  const start = html.indexOf('>', open) + 1;
  const re = new RegExp(`<${tag}\\b|</${tag}\\s*>`, 'gi');
  re.lastIndex = start;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  return html.slice(start);
}

// ── FAQ extraction ─────────────────────────────────────────────────────────
const cleanQ = (q) => q.replace(/^\s*(?:Q\s*[.:)]?\s*)?\d+\s*[.):]\s*/i, '').trim();

function faqsFrom(main, whole) {
  const out = [];

  // A. the house accordion
  for (const m of main.matchAll(/<label[^>]*class="[^"]*faq-label-title[^"]*"[^>]*>([\s\S]*?)<\/label>/gi)) {
    const q = cleanQ(text(m[1]));
    const at = main.indexOf('faq-tab-content', m.index);
    if (!q || at < 0) continue;
    const open = main.lastIndexOf('<div', at);
    out.push({ question: q, answer: text(inner(main, open, 'div')) });
  }

  // B. <details><summary>
  for (const m of main.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)) {
    const s = m[1].match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    if (!s) continue;
    const q = cleanQ(text(s[1]));
    const a = text(m[1].replace(s[0], ''));
    if (q && a) out.push({ question: q, answer: a });
  }

  // C. JSON-LD FAQPage
  for (const m of whole.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    for (const node of [].concat(data, data['@graph'] || [])) {
      if (!node || node['@type'] !== 'FAQPage') continue;
      for (const e of node.mainEntity || []) {
        const q = cleanQ(text(String(e.name || '')));
        const a = text(String((e.acceptedAnswer && e.acceptedAnswer.text) || ''));
        if (q && a) out.push({ question: q, answer: a });
      }
    }
  }

  // Same question picked up by two shapes: keep the fullest answer.
  const seen = new Map();
  for (const f of out) {
    const k = f.question.toLowerCase().replace(/\W+/g, '');
    if (!k || !f.answer) continue;
    const prev = seen.get(k);
    if (!prev || f.answer.length > prev.answer.length) seen.set(k, f);
  }
  return [...seen.values()];
}

function titleOf(html, main) {
  // A couple of headings are double-encoded in the theme ("&amp;amp;"), so one
  // decode pass leaves a visible "&amp;" in the title. Decode until it settles.
  const settle = (s) => { for (let i = 0; i < 3; i++) { const n = decode(s); if (n === s) break; s = n; } return s; };
  const h1 = main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1 && text(h1[1])) return settle(text(h1[1]));
  const og = html.match(/property="og:title"\s+content="([^"]*)"/i);
  if (og) return decode(og[1]).trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? decode(t[1]).split('–')[0].trim() : '(untitled)';
}

// ── run ────────────────────────────────────────────────────────────────────
async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'sehatup-faq-export/1.0' } });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
      throw new Error('HTTP ' + r.status);
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 800 * attempt));
    }
  }
}

const sitemap = await get(SITEMAP);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(m => m[1].replace(/&amp;/g, '&'))
  // /blogs/news is the listing page, not an article
  .filter(u => (u.match(/\/blogs\//) && u.split('/blogs/')[1].includes('/')))
  .slice(0, LIMIT);

console.log(`${urls.length} articles`);

const rows = [];
for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  const html = await get(url);
  if (!html) { console.log(`  ${i + 1}/${urls.length} MISSING ${url}`); continue; }
  const mainAt = html.search(/<main\b/i);
  const main = mainAt < 0 ? html : inner(html, mainAt, 'main');
  const title = titleOf(html, main);
  const faqs = faqsFrom(main, html);
  rows.push({ title, url, faqs });
  console.log(`  ${String(i + 1).padStart(2)}/${urls.length}  ${String(faqs.length).padStart(2)} FAQ  ${title.slice(0, 62)}`);
  await new Promise(r => setTimeout(r, 250));   // polite
}

const jsonSheet = rows.map(r => ({
  'Blog Title': r.title,
  'URL': r.url,
  'FAQ Count': r.faqs.length,
  'FAQ JSON': JSON.stringify(r.faqs, null, 2),
}));

const tableSheet = [];
for (const r of rows) {
  if (!r.faqs.length) { tableSheet.push({ 'Blog Title': r.title, '#': '', 'Question': '(no FAQ found)', 'Answer': '' }); continue; }
  r.faqs.forEach((f, i) => tableSheet.push({
    'Blog Title': i === 0 ? r.title : '',   // repeated only once, so the sheet reads as grouped
    '#': i + 1,
    'Question': f.question,
    'Answer': f.answer,
  }));
}

const wb = XLSX.utils.book_new();
const s1 = XLSX.utils.json_to_sheet(jsonSheet);
s1['!cols'] = [{ wch: 60 }, { wch: 70 }, { wch: 10 }, { wch: 120 }];
const s2 = XLSX.utils.json_to_sheet(tableSheet);
s2['!cols'] = [{ wch: 50 }, { wch: 5 }, { wch: 70 }, { wch: 120 }];
XLSX.utils.book_append_sheet(wb, s1, 'FAQ JSON');
XLSX.utils.book_append_sheet(wb, s2, 'FAQ Table');
XLSX.writeFile(wb, OUT);

const total = rows.reduce((n, r) => n + r.faqs.length, 0);
const empty = rows.filter(r => !r.faqs.length);
console.log(`\n${OUT}: ${rows.length} articles, ${total} FAQs`);
if (empty.length) {
  console.log(`no FAQ block in ${empty.length}:`);
  for (const r of empty) console.log('  - ' + r.title);
}
