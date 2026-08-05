// Product-matcher regression harness.
// Extracts the real functions out of functions/index.js so it can never drift from what
// ships. Run:  node matcher-test.js
const fs = require("fs");
const path = require("path");

const IDX = path.join(__dirname, "../../../sehatup-firebase/functions/index.js");
const src = fs.readFileSync(IDX, "utf8");

function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a < 0) throw new Error("start marker not found: " + startMarker);
  const b = src.indexOf(endMarker, a);
  if (b < 0) throw new Error("end marker not found: " + endMarker);
  return src.slice(a, b);
}

const code = [
  slice("function qrCleanTitle(t) {", "\n// Shopify's financial_status"),
  slice("const QR_RX_PATTERNS = [", "\n// ── Product description condensing"),
  slice("function qrNamedHits(", "\nexports.qrProductLookup"),
].join("\n");

const sandbox = {};
new Function("g", code + "\nObject.assign(g, {qrCleanTitle,qrIsRx,qrTokens,qrNormalise,qrMatchScore,qrSearchCatalog,QR_WEAK_MATCH_WORDS,QR_KITS,qrKitHandles});")(sandbox);
const { qrCleanTitle, qrIsRx, qrTokens, qrSearchCatalog } = sandbox;

// Real catalog: title, price, stock, handle (from SHOPIFY_PRODUCTS.md, 32 active products)
const RAW = [
  ["Aloezy ( Intimate Foam Wash) - Best intimate wash for Womens", 349, 9997, "aloezy-intimate-foam-wash"],
  ["Ashwagandha 30 Tablets (Free sample)", 399, 487, "ashwagandha-30-tablets-free-sample"],
  ["Ashwagandha Tablets", 499, 182, "ashwagandha-tablets"],
  ["Boombatti- Stay up late, dominate fate", 1499, 0, "boombatti"],
  ["Confidence & Performance Booster Kit", 1099, 965, "p-e-e-d-integrated-kit"],
  ["Control Tantra- Stretch the moment", 1899, 0, "control-tantra"],
  ["Daily Energy & Stamina Support Kit", 1699, 193, "daily-energy-stamina-support-kit"],
  ["Dapoxetine Hydrochloride tablets IP 30 mg (Endless)", 171, 0, "dapoxetine-endless"],
  ["Diaboglob", 934, 9999, "diaboglob"],
  ["FourPlay Formula- Delay right, delight night", 1399, 0, "fourplay-formula"],
  ["Garcinia Cambogia Drops - sehatUP", 499, 9984, "garcenia-cambogia-drops"],
  ["Hard Yatra- No more tricks & just kick", 1999, 0, "hard-yatra"],
  ["Her Menses (For Rhythmic Relief & Hormonal Harmony)", 499, 62, "her-menses"],
  ["HormoniHerb - Herbal Blue Tea - Your All in One Tea", 399, 19975, "hormoniherb"],
  ["Kern Drops", 509, 88, "kern-drops"],
  ["LeanRoutine", 399, 1000, "leanroutine"],
  ["Lovelinga- Power meets control", 1499, 0, "lovelinga"],
  ["Max Drive- When average won't do", 1899, 0, "max-drive"],
  ["Orlistat 60 mg (Smart Science for a Leaner You)", 599, 99, "orlistat-60mg"],
  ["Pure Himalayan Shilajit Resin - 20g - SehatUP", 1349, 199902, "shilajit-resin-20g"],
  ["Rocket Ras- No delay, just play-rocket your way", 1399, 0, "rocket-ras"],
  ["Slimtox Energy Tea", 399, 2889, "slimtox-energy-tea"],
  ["Tadala + Dapox (Mighty)", 400, 0, "tadala-dapox-mighty"],
  ["Tadalafil 5 Mg (Hard 5)", 217, -1, "tadalafil-5mg-hard-5"],
  ["Tadalafil IP 10 mg (Hard 10)", 230, 0, "tadalafil-10mg-hard-10"],
  ["Thrill Drill- No Flop, Just Pop", 1449, 0, "thrill-drill"],
  ["ThrustRx- Fuel your drive, rule the night", 1999, 0, "thrustrx"],
  ["Thyrostatin 3X", 249, 998, "thyrostatin-3x"],
  ["Vaji Bati", 849, 77, "vaji-bati"],
  ["Weight Management Kit - Female", 799, 995, "weight-management-kit-female"],
  ["Weight Management Kit - Male", 799, 999, "weight-management-kit-male"],
  ["Zencal D3K2", 499, 9980, "zencal-d3k2"],
];
const catalog = RAW.map(([t, p, s, h]) => ({
  title: qrCleanTitle(t), rawTitle: t, price: p, inStock: s > 0, handle: h, isRx: qrIsRx(t),
}));

// What the price guard in Extract AI Response would actually put in the message.
const sellable = (q) => qrSearchCatalog(q, catalog).filter((p) => !p.isRx && p.inStock);
// what the current 2-option reply would list
const offered = (q) => sellable(q).filter((p) => !p.isKit).slice(0, 2).map((p) => p.title);
// everything the lookup surfaced, kit included
const all_offered = (q) => sellable(q).map((p) => p.title);

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
}

console.log("\n--- the reported bug: named two products, got Garcinia ---");
check('"Mujhe vaji bati or kern drop chahiye"', offered("Mujhe vaji bati or kern drop chahiye"), ["Vaji Bati", "Kern Drops"]);
check('"kern drop and vaji bati"', offered("kern drop and vaji bati"), ["Vaji Bati", "Kern Drops"]);
check('"vaji bati kern drops"', offered("vaji bati kern drops"), ["Vaji Bati", "Kern Drops"]);
check('"kern drop chahiye" (no Garcinia)', offered("kern drop chahiye"), ["Kern Drops"]);
check('"kern drops ka price"', offered("kern drops ka price"), ["Kern Drops"]);

console.log("\n--- the combo kit: OTC and findable ---");
check("kit is no longer Rx", qrIsRx("Confidence & Performance Booster Kit"), false);
check('"vaji bati kern drop combo" surfaces the kit', all_offered("vaji bati kern drop combo").includes("Confidence & Performance Booster Kit"), true);
check('"vaji bati aur kern drop dono chahiye" surfaces the kit', all_offered("vaji bati aur kern drop dono chahiye").includes("Confidence & Performance Booster Kit"), true);
check('"confidence performance kit" by its real name', all_offered("confidence performance kit"), ["Confidence & Performance Booster Kit"]);
check('"vaji bati ka price" does NOT drag in the kit', all_offered("vaji bati ka price"), ["Vaji Bati"]);
check('"kern drops ka price" does NOT drag in the kit', all_offered("kern drops ka price"), ["Kern Drops"]);
check("Rx list still catches the drug combos", [
  qrIsRx("Vaji Bati + Kern Drop + Tadalafil Tablets 5mg"),
  qrIsRx("Vaji Bati Kern Drop Dapoxetine 30mg"),
  qrIsRx("Tadala + Dapox (Mighty)"),
  qrIsRx("Tadalafil 5 Mg (Hard 5)"),
  qrIsRx("Dapoxetine Hydrochloride tablets IP 30 mg (Endless)"),
  qrIsRx("Orlistat 60 mg (Smart Science for a Leaner You)"),
], [true, true, true, true, true, true]);

console.log("\n--- README regression cases (must not regress) ---");
check('"Shilajit ki price kya h?" -> ambiguous', offered("Shilajit ki price kya h?").length >= 1, true);
check('"vaji bati kitne ka hai" -> one', offered("vaji bati kitne ka hai"), ["Vaji Bati"]);
check('"endless ka price batao" -> Rx, not offered', offered("endless ka price batao"), []);
check('"aloezy ka price" -> in stock, offered', offered("aloezy ka price"), ["Aloezy ( Intimate Foam Wash) - Best intimate wash for Womens"]);
check('"XYZ kit ka price" -> no match', qrSearchCatalog("XYZ kit ka price", catalog).length, 0);
check('"mujhe PCOD hai" -> no match', qrSearchCatalog("mujhe PCOD hai", catalog).length, 0);

console.log("\n--- other named products still resolve (weak-word change must not break these) ---");
check('"ashwagandha tablets ka price"', offered("ashwagandha tablets ka price").length >= 1, true);
check('"blue tea"', offered("blue tea"), ["HormoniHerb - Herbal Blue Tea - Your All in One Tea"]);
check('"shilajit resin"', offered("shilajit resin"), ["Pure Himalayan Shilajit Resin - 20g - SehatUP"]);
check('"thyrostatin"', offered("thyrostatin"), ["Thyrostatin 3X"]);
check('"garcinia drops ka price"', offered("garcinia drops ka price"), ["Garcinia Cambogia Drops - sehatUP"]);
check('"intimate wash"', offered("intimate wash"), ["Aloezy ( Intimate Foam Wash) - Best intimate wash for Womens"]);
check('"weight management kit"', offered("weight management kit").length >= 1, true);
check('"slimtox tea"', offered("slimtox tea"), ["Slimtox Energy Tea"]);
check('"her menses"', offered("her menses"), ["Her Menses (For Rhythmic Relief & Hormonal Harmony)"]);
check('"vajji bati" (misspelt)', offered("vajji bati"), ["Vaji Bati"]);
check('"zencal d3k2"', offered("zencal d3k2"), ["Zencal D3K2"]);
check('"diaboglob"', offered("diaboglob"), ["Diaboglob"]);

console.log("\n--- a bare form word must not confidently name a product ---");
check('"Yah kaun sa drops hai" -> no match', qrSearchCatalog("Yah kaun sa drops hai", catalog).length, 0);
check('"Watsapp pr msg" -> no match', qrSearchCatalog("Watsapp pr msg", catalog).length, 0);

console.log("\n--- a common ENGLISH word must not name a product either (2026-08-05) ---");
// Production: "Hello! Can I get more info for PCOD/PCOS?" put Hard Yatra (Rs1999, Rx, out of
// stock) into a women's-health chat. "more" is an exact token hit on the marketing tail
// "No more tricks & just kick" and earned the full 0.85 "one distinctive word" boost.
// Document frequency would NOT have caught this - "more" appears in exactly one title. The
// word is common in English, not in the catalog, so it has to be listed as a stopword.
check('the production query -> no match', qrSearchCatalog("Hello! Can I get more info for PCOD/PCOS? K", catalog).length, 0);
check('"can I get more info" alone -> no match', qrSearchCatalog("can I get more info", catalog).length, 0);
check('"I need help with something" -> no match', qrSearchCatalog("I need help with something", catalog).length, 0);
check('"tell me more about your products" -> no match', qrSearchCatalog("tell me more about your products", catalog).length, 0);
check('"best product batao" -> no match', qrSearchCatalog("best product batao", catalog).length, 0);
// The words above are still allowed to DESCRIBE a product the customer also named.
check('"pure himalayan shilajit" still resolves', offered("pure himalayan shilajit"), ["Pure Himalayan Shilajit Resin - 20g - SehatUP"]);
// Ranked first, not alone: "energy" legitimately also hits Slimtox Energy Tea, both before
// and after this change. The prompt shows at most 2, most relevant first, so first is the
// assertion that matters.
check('"daily energy stamina kit" still ranks first', offered("daily energy stamina kit")[0], "Daily Energy & Stamina Support Kit");

console.log("\n--- conditions map to products ONLY on purchase intent (persona rule 3) ---");
// Naming a condition is a disclosure, not a request to buy. Rule 3 requires the safety check
// and the free-consultation offer first, so a bare mention must still surface nothing -
// putting two priced products in the prompt is what invites the pitch rule 3 forbids.
check('"mujhe PCOD hai" -> still no match', qrSearchCatalog("mujhe PCOD hai", catalog).length, 0);
check('"PCOD hai mera" -> still no match', qrSearchCatalog("PCOD hai mera", catalog).length, 0);
check('"periods irregular hain" -> still no match', qrSearchCatalog("periods irregular hain", catalog).length, 0);
// ...but once they ask for something to take, the lookup must not come back empty.
check('"PCOD ke liye kaunsa product lu"', offered("PCOD ke liye kaunsa product lu"),
  ["Her Menses (For Rhythmic Relief & Hormonal Harmony)", "HormoniHerb - Herbal Blue Tea - Your All in One Tea"]);
check('"pcos ki dawa chahiye"', offered("pcos ki dawa chahiye").length, 2);
check('"periods ke liye koi tea batao"', offered("periods ke liye koi tea batao").length, 2);
// A product the customer NAMED always wins - condition products never dilute a real match.
check('"PCOD me vaji bati chalegi" -> only Vaji Bati', offered("PCOD me vaji bati chalegi"), ["Vaji Bati"]);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
