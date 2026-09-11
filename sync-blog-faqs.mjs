/**
 * Push the scraped FAQs onto each blog post's `custom.faqs` metafield.
 *
 *   node sync-blog-faqs.mjs              # dry run - shows exactly what would change
 *   node sync-blog-faqs.mjs --write      # actually writes
 *   node sync-blog-faqs.mjs --verify     # read back and compare, no writes
 *   node sync-blog-faqs.mjs --write --limit 10
 *
 * It does NOT create or edit blog posts. It only sets one metafield on posts that
 * already exist, matched by handle.
 *
 * Run `node scrape-blog-faqs.mjs` first to refresh blog-faqs.xlsx from the sitemap;
 * this reads that workbook, so a new post flows through both steps automatically.
 *
 * Needs the CRM dev server running (npm start in sehatup-analytics) - it borrows that
 * proxy so the Shopify token stays server-side and never appears here.
 */
import fs from 'fs';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const XLSX = require_('./sehatup-analytics/node_modules/xlsx');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };

const WRITE = has('--write');
const VERIFY_ONLY = has('--verify');
const LIMIT = Number(argOf('--limit', 0)) || Infinity;
const PROXY = argOf('--proxy', 'http://localhost:3000') + '/shopify-v2/graphql.json';
const WORKBOOK = argOf('--xlsx', 'blog-faqs.xlsx');
const NAMESPACE = 'custom';
const KEY = 'faqs';

async function gql(query, variables) {
  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  }).catch(e => { throw new Error(`cannot reach ${PROXY} — is the CRM dev server running? (${e.message})`); });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

// ── what Shopify currently holds ───────────────────────────────────────────
// Articles are paged: 250 is the per-page cap, so follow the cursor rather than
// assuming one page covers the blog.
async function fetchArticles() {
  const out = [];
  let after = null;
  do {
    const d = await gql(`query($after: String) {
      articles(first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id handle title metafield(namespace: "${NAMESPACE}", key: "${KEY}") { type value } } }
      }
    }`, { after });
    out.push(...d.articles.edges.map(e => e.node));
    after = d.articles.pageInfo.hasNextPage ? d.articles.pageInfo.endCursor : null;
  } while (after);
  return out;
}

// ── what we want it to hold ────────────────────────────────────────────────
function desiredFromWorkbook() {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(WORKBOOK).Sheets['FAQ JSON']);
  return rows.map(r => ({
    handle: String(r.URL || '').split('/').pop(),
    title: r['Blog Title'],
    faqs: JSON.parse(r['FAQ JSON'] || '[]'),
  })).filter(x => x.handle && x.faqs.length);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const parse = (v) => { try { return JSON.parse(v); } catch { return null; } };

const articles = await fetchArticles();
const byHandle = new Map(articles.map(a => [a.handle, a]));
const desired = desiredFromWorkbook();

// ── plan ───────────────────────────────────────────────────────────────────
const plan = { create: [], overwrite: [], unchanged: [], missing: [] };
for (const d of desired) {
  const a = byHandle.get(d.handle);
  if (!a) { plan.missing.push(d); continue; }
  const current = a.metafield ? parse(a.metafield.value) : null;
  const entry = { ...d, id: a.id, current };
  if (current && same(current, d.faqs)) plan.unchanged.push(entry);
  else if (current) plan.overwrite.push(entry);
  else plan.create.push(entry);
}

console.log(`${articles.length} articles in Shopify, ${desired.length} with FAQs in ${WORKBOOK}\n`);
console.log(`  new       ${plan.create.length}`);
console.log(`  overwrite ${plan.overwrite.length}`);
console.log(`  unchanged ${plan.unchanged.length}`);
console.log(`  no matching article ${plan.missing.length}`);
for (const m of plan.missing) console.log(`      ${m.handle}`);
for (const o of plan.overwrite) {
  console.log(`  OVERWRITE ${o.handle}: ${Array.isArray(o.current) ? o.current.length : '?'} → ${o.faqs.length} FAQs`);
}

if (VERIFY_ONLY) {
  const wrong = [...plan.create, ...plan.overwrite];
  console.log(wrong.length ? `\n${wrong.length} article(s) do not match the workbook` : '\nEverything matches the workbook');
  process.exit(wrong.length ? 1 : 0);
}

const todo = [...plan.create, ...plan.overwrite].slice(0, LIMIT);
if (!todo.length) { console.log('\nNothing to do.'); process.exit(0); }

if (!WRITE) {
  console.log(`\nDry run. ${todo.length} article(s) would be written. Re-run with --write to apply.`);
  process.exit(0);
}

// Keep whatever we are about to replace, so a bad run can be undone.
if (plan.overwrite.length) {
  fs.mkdirSync('blog-faqs-json', { recursive: true });
  fs.writeFileSync('blog-faqs-json/_overwritten-backup.json',
    JSON.stringify(plan.overwrite.map(o => ({ handle: o.handle, previousValue: o.current })), null, 2));
  console.log('\nPrevious values saved to blog-faqs-json/_overwritten-backup.json');
}

// ── write ──────────────────────────────────────────────────────────────────
// One article per call rather than a batch: a batch that trips a userError tells
// you the set failed, not which post, and 30 posts is not worth the ambiguity.
const SET = `mutation($m: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $m) { metafields { id } userErrors { field message code } }
}`;

let ok = 0, failed = 0;
console.log('');
for (const t of todo) {
  try {
    const d = await gql(SET, {
      m: [{ ownerId: t.id, namespace: NAMESPACE, key: KEY, type: 'json', value: JSON.stringify(t.faqs) }],
    });
    const ue = d.metafieldsSet.userErrors || [];
    if (ue.length) throw new Error(ue.map(e => `${e.code}: ${e.message}`).join('; '));
    ok++;
    console.log(`PASS  ${t.handle}  (${t.faqs.length} FAQs)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${t.handle}  ${e.message}`);
  }
}
console.log(`\n${ok} written, ${failed} failed`);

// ── verify by reading back ─────────────────────────────────────────────────
// A successful mutation is not proof the stored value has the right SHAPE. The
// bug this catches is a value saved as a quoted string instead of an array —
// which is what pasting from Excel produces, and which Shopify accepts happily.
const after = new Map((await fetchArticles()).map(a => [a.handle, a]));
const bad = [];
let faqCount = 0;
for (const t of todo) {
  const mf = after.get(t.handle)?.metafield;
  const v = mf ? parse(mf.value) : null;
  const good = mf && mf.type === 'json' && Array.isArray(v) && same(v, t.faqs)
    && v.every(o => typeof o.question === 'string' && o.question && typeof o.answer === 'string' && o.answer);
  if (good) faqCount += v.length;
  else bad.push(`${t.handle} (${mf ? `type ${mf.type}, ${Array.isArray(v) ? v.length + ' items' : 'not an array'}` : 'no metafield'})`);
}
console.log(`verified: ${todo.length - bad.length} article(s), ${faqCount} FAQs stored as real JSON arrays`);
if (bad.length) { console.log('PROBLEMS:'); bad.forEach(b => console.log('  ' + b)); }
process.exit(bad.length || failed ? 1 : 0);
