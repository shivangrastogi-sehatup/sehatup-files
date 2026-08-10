// AD CONTEXT harness for the "Build AI Prompt" node.
// Runs the REAL node body from build-ai-prompt.txt with the n8n $() calls stubbed, so what is
// tested is exactly what gets pasted into n8n.  Run:  node ad-context.test.js
//
// 2026-08-07, exec 23132/23143: a customer tapped a Meta click-to-WhatsApp ad for WOMEN'S
// menstrual health, wrote "Hello" / "Isme kya hota hai" / "Kya help kariyega aap bataiye", and
// was answered with an invented sexual-performance pitch. The ad rode in on the first inbound
// message's preview.adPreview and nothing read it. These tests pin that it is read now.
const fs = require("fs");
const path = require("path");
const body = fs.readFileSync(path.join(__dirname, "../build-ai-prompt.txt"), "utf8");

// The real payload as Firestore returned it in that execution. Key ORDER differed between the
// two executions in the same incident, which is why the node walks for fields by name.
const REAL_AD = {
  adPreview: {
    meta: { sourceUrl: "https://fb.me/75od9EMd0" },
    body: {
      domain: "fb.me",
      text: "Your health deserves the right attention.\nHave questions about your menstrual wellness? Connect with SehatUP's experts on WhatsApp for personalized guidance in a safe and confidential space.",
      headline: "Chat with Women's Health Experts",
    },
  },
};

function run({ preview, cust = "Kya help kariyega aap bataiye" } = {}) {
  const first = { direction: "in", text: "Hello", msgTime: 1000, createdAt: "2026-08-07T06:29:05.812Z" };
  if (preview) first.preview = preview;
  const history = [
    { json: first },
    { json: { direction: "in", text: cust, msgTime: 5000, createdAt: "2026-08-07T06:31:25.396Z" } },
  ];
  const nodes = {
    "Decide Process": [{ json: { phone: "+917903801499", name: "patelnihal804", myMsgTime: 5000 } }],
    "Extract Message Details": [{ json: { phone: "+917903801499", name: "patelnihal804", text: cust, msgTime: 5000 } }],
    "Fetch Conversation History": history,
    "Fetch Customer Context": [{ json: {} }],
    "Fetch Product Matches": [{ json: { found: false, catalogSize: 36, source: "cache", matches: [] } }],
    // The persona Doc. Only its text content matters here.
    "Get a document": [{ json: { title: "SehatUP AI System Prompt", body: { content: [
      { paragraph: { elements: [{ textRun: { content: "ROLE: You are Ananya, a health advisor at SehatUP. CATALOG - OTC: Vaji Bati. FLOW: (1) greet. STYLE - say like: ji bilkul." } }] } },
    ] } } }],
  };
  const $ = (n) => ({ first: () => (nodes[n] || [{ json: {} }])[0], all: () => nodes[n] || [] });
  const $input = { first: () => ({ json: {} }) };
  const console2 = { log: () => {} };
  const fn = new Function("$", "$input", "$execution", "console", body);
  const out = fn($, $input, {}, console2)[0].json;
  return { system: out.messages[0].content, adDebug: out.adDebug };
}

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}`);
  if (!cond && detail !== undefined) console.log("        " + JSON.stringify(detail).slice(0, 300));
};

console.log("\n--- the real production ad payload ---");
const real = run({ preview: REAL_AD });
check("AD CONTEXT block is added", /AD CONTEXT/.test(real.system), real.adDebug);
check("the headline reaches the model", /Chat with Women's Health Experts/.test(real.system), real.adDebug);
check("the ad body reaches the model", /menstrual wellness/.test(real.system), real.adDebug);
check("the model is told vague openers mean the ad", /isme kya hota hai/i.test(real.system));
check("and told not to drift to sexual wellness", /sexual wellness/i.test(real.system));
check("adDebug reports what was found", /Chat with Women/.test(real.adDebug), real.adDebug);

console.log("\n--- shape tolerance: same fields, different nesting ---");
const shapes = [
  ["flat adPreview", { adPreview: { headline: "Chat with Women's Health Experts", text: "menstrual wellness help" } }],
  ["headline at depth 3", { adPreview: { a: { b: { headline: "Chat with Women's Health Experts", text: "menstrual wellness help" } } } }],
  ["preview IS the ad", { headline: "Chat with Women's Health Experts", body: { text: "menstrual wellness help" } }],
  ["JSON string preview", JSON.stringify(REAL_AD)],
];
for (const [label, preview] of shapes) {
  const r = run({ preview });
  check(`${label} -> ad reaches the model`, /Women's Health Experts/.test(r.system), r.adDebug);
}

console.log("\n--- must never break a normal chat ---");
const noAd = run({});
check("no preview -> no AD CONTEXT block", !/AD CONTEXT/.test(noAd.system), noAd.adDebug);
check("no preview -> adDebug 'none'", noAd.adDebug === "none", noAd.adDebug);
for (const [label, preview] of [["null", null], ["empty object", {}], ["junk string", "not json at all"],
                                ["adPreview with no text", { adPreview: { meta: { sourceUrl: "https://fb.me/x" } } }]]) {
  const r = run({ preview });
  check(`malformed preview (${label}) still builds a prompt`, typeof r.system === "string" && r.system.length > 50, r.adDebug);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
