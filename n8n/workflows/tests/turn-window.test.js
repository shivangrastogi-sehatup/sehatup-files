// Age window for "the current turn", in BOTH nodes that decide it.
// Runs the REAL bodies from decide-process.txt and build-ai-prompt.txt with the n8n $() calls
// stubbed, so what is tested is exactly what gets pasted into n8n.  Run: node turn-window.test.js
//
// The bug this pins (2026-09-16 and 2026-09-17, live):
//   +918827870579 wrote "Mujhe Vaji Bati or Kern Drops Chahiye" on 29 Jul via an ad. QuickReply's
//   own template replied - text-less, so it never counted as an answer. Seven weeks later he sent
//   "Hi" and was answered with the July product request.
//   +917300978845 asked for a report on 11 Sep, same text-less template. On 17 Sep "doctor kon h ?"
//   came back with the report link instead of an answer.
// Old unanswered messages must stay in the history and never become the question being asked now.
const fs = require("fs");
const path = require("path");
const decideBody = fs.readFileSync(path.join(__dirname, "../decide-process.txt"), "utf8");
const buildBody = fs.readFileSync(path.join(__dirname, "../build-ai-prompt.txt"), "utf8");

const NOW = Date.now();
const H = (hours) => NOW - hours * 60 * 60 * 1000;
const PHONE = "+919999999999";

// A chat where an old inbound was only ever "answered" by a text-less QuickReply template.
const staleChat = (freshText, freshAt) => [
  { json: { direction: "in", text: "Mujhe Vaji Bati or Kern Drops Chahiye", msgTime: H(24 * 49) } },
  { json: { direction: "out", _type: "BOT_PLACEHOLDER", text: "", placeholder: "Bot replied", messageBy: "AUTOMATION", msgTime: H(24 * 49) + 60000 } },
  { json: { direction: "in", text: freshText, msgTime: freshAt } },
];

function decide(history, { msgTime, text }) {
  const nodes = {
    "Extract Message Details": [{ json: { phone: PHONE, name: "Customer", text, msgTime } }],
    "Get AI Config": [{ json: { mode: "on" } }],
    "Fetch Conversation History": history,
  };
  const $ = (n) => ({ first: () => (nodes[n] || [{ json: {} }])[0], all: () => nodes[n] || [] });
  const $execution = { customData: { set: () => {} } };
  const quiet = { log: () => {} };
  return new Function("$", "$input", "$execution", "console", decideBody)($, { first: () => ({ json: {} }) }, $execution, quiet)[0].json;
}

function build(history, { msgTime, text }) {
  const nodes = {
    "Decide Process": [{ json: { phone: PHONE, name: "Customer", myMsgTime: msgTime } }],
    "Extract Message Details": [{ json: { phone: PHONE, name: "Customer", text, msgTime } }],
    "Fetch Conversation History": history,
    "Fetch Customer Context": [{ json: {} }],
    "Fetch Product Matches": [{ json: { found: false, matches: [] } }],
    "Get a document": [{ json: { title: "SehatUP AI System Prompt", body: { content: [
      { paragraph: { elements: [{ textRun: { content: "ROLE: You are Ananya, a health advisor at SehatUP. CATALOG - OTC: Vaji Bati. FLOW: (1) greet. STYLE - say like: ji bilkul." } }] } },
    ] } } }],
  };
  const $ = (n) => ({ first: () => (nodes[n] || [{ json: {} }])[0], all: () => nodes[n] || [] });
  const quiet = { log: () => {} };
  return new Function("$", "$input", "$execution", "console", buildBody)($, { first: () => ({ json: {} }) }, { customData: { set: () => {} } }, quiet)[0].json;
}

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}`);
  if (!cond && detail !== undefined) console.log("        " + JSON.stringify(detail).slice(0, 300));
};

console.log("\n--- Decide Process: what counts as the current turn ---");
const freshAt = H(0.02);
const d1 = decide(staleChat("Hi", freshAt), { msgTime: freshAt, text: "Hi" });
check("a 7-week-old message is not part of this turn", d1.recentUserText === "Hi", d1.recentUserText);
check("and the turn is still processed", d1.shouldProcess === true && d1.reason === "process", d1.reason);

const batch = [
  { json: { direction: "in", text: "vaji bati", msgTime: H(0.2) } },
  { json: { direction: "in", text: "price?", msgTime: H(0.01) } },
];
const d2 = decide(batch, { msgTime: H(0.01), text: "price?" });
check("two messages minutes apart are still batched", d2.recentUserText === "vaji bati price?", d2.recentUserText);

const d3 = decide(staleChat("Hi", freshAt), { msgTime: freshAt, text: "Hi" });
check("the old text is nowhere in the product lookup text", !/vaji bati/i.test(d3.recentUserText), d3.recentUserText);

console.log("\n--- Build AI Prompt: what the model is asked ---");
const b1 = build(staleChat("doctor kon h ?", freshAt), { msgTime: freshAt, text: "doctor kon h ?" });
check("the question is only the fresh message", b1.newMsgText === "doctor kon h ?", b1.newMsgText);
const userTurns = (b1.messages || []).filter((m) => m.role === "user").map((m) => m.content);
check("the old message is kept as history, not dropped", userTurns.some((t) => /Vaji Bati or Kern Drops/i.test(t)), userTurns);
check("the old message is not the last user turn", !/Vaji Bati or Kern Drops/i.test(String(userTurns[userTurns.length - 1])), userTurns[userTurns.length - 1]);

const b2 = build(batch, { msgTime: H(0.01), text: "price?" });
check("recent messages are still joined into one turn", /vaji bati/i.test(b2.newMsgText) && /price\?/.test(b2.newMsgText), b2.newMsgText);

console.log(`
${pass} passed, ${fail} failed
`);
process.exit(fail ? 1 : 0);
