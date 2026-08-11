// Which messages must NOT reach the AI at all.
// Runs the real "Extract Message Details" node body from extract-message-details.txt.
// Run:  node automation-triggers.test.js
const fs = require("fs");
const path = require("path");
const body = fs.readFileSync(path.join(__dirname, "../extract-message-details.txt"), "utf8");

function classify(text, payloadType = "USER_TEXT") {
  const nodes = {
    "QuickReply Webhook": [{ json: { body: {
      phone: "+919999999999", name: "Simran Shastri", id: "m1", msg_time: Date.now(),
      payload: { _type: payloadType, text },
    } } }],
  };
  const $ = (n) => ({ first: () => (nodes[n] || [{ json: {} }])[0], all: () => nodes[n] || [] });
  const $input = { first: () => nodes["QuickReply Webhook"][0] };
  return new Function("$", "$input", body)($, $input)[0].json;
}

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}`);
  if (!cond && detail !== undefined) console.log("        " + JSON.stringify(detail));
};

console.log("\n--- automation buttons: QuickReply answers these itself, AI must stay out ---");
for (const t of [
  "I want my detailed HealthScore360 report",   // the 2026-08-04 duplicate-report report
  "I want my detailed HealthScore360 Report",
  "i want my detailed health score 360 report",
  "I want my detailed healthscore",             // the original button text
  "Check My Free Health Score",
  "check free healthscore",
  "Check My Free HealthScore360",
]) {
  const r = classify(t);
  check(`skips: ${JSON.stringify(t)}`, r.skipAi === true && r.skipReason === "automation_trigger", r);
}

console.log("\n--- these must still REACH the AI ---");
for (const t of [
  "I want to Check My Free PCOD Health Score",  // QuickReply does NOT answer this one
  "Health-Score chahiye",
  "mera health score kya hai",
  "mujhe report chahiye",
  "vaji bati ka price",
  "mera order kaha hai",
  "hello ji",
]) {
  const r = classify(t);
  check(`reaches AI: ${JSON.stringify(t)}`, r.skipAi === false, r);
}

console.log("\n--- human-handoff: AI stays silent so a real agent + calling automation take over ---");
for (const t of [
  "Mujhe Vaji Bati or Kern Drops Chahiye",
  "mujhe vaji bati or kern drop chahiye",
  "mujhe vaji bati aur kern drops chahiye",
  "vaji bati or kern drops chahiye",
]) {
  const r = classify(t);
  check(`handoff: ${JSON.stringify(t)}`, r.skipAi === true && r.skipReason === "human_handoff_trigger", r);
}

console.log("\n--- media and button taps are skipped for their own reasons ---");
check("button tap skipped", classify("YES", "USER_BUTTON_REPLY").skipReason === "button_reply");
check("list reply skipped", classify("1", "USER_LIST_REPLY").skipReason === "list_reply" ||
  classify("1", "USER_LIST_REPLY").skipReason === "button_reply");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
