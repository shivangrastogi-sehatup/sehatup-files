// Guard-chain regression harness for the "Extract AI Response" node.
// Runs the REAL node body from extract-ai-response.txt with the n8n $() calls stubbed, so
// what is tested is exactly what gets pasted into n8n.  Run:  node guard-test.js
const fs = require("fs");
const path = require("path");
const NODE = path.join(__dirname, "../extract-ai-response.txt");
const body = fs.readFileSync(NODE, "utf8");

// One turn -> what the customer would actually receive.
function run({ model, cust, lastOut, matches = [], name = "Customer", greeted = true, report = {},
              automationReplied = false }) {
  const history = [];
  if (lastOut) history.push({ json: { direction: "out", text: lastOut, msgTime: 1000, senderKind: "AI" } });
  if (greeted && !lastOut) history.push({ json: { direction: "out", text: "Hello ji", msgTime: 500, senderKind: "AI" } });
  // The customer's message, then optionally QuickReply's own automation replying after it.
  history.push({ json: { direction: "in", text: cust, msgTime: 2000 } });
  if (automationReplied) {
    history.push({ json: { direction: "out", _type: "BOT_PLACEHOLDER", text: "",
      placeholder: "Bot replied", messageBy: "AUTOMATION", msgTime: 2100 } });
  }

  const nodes = {
    "Build AI Prompt": [{ json: { phone: "+919999999999", name, newMsgText: cust, displayName: "" } }],
    "Decide Process": [{ json: { phone: "+919999999999" } }],
    "Fetch Conversation History": history,
    "Fetch Customer Context": [{ json: { report } }],
    "Fetch Product Matches": [{ json: { matches } }],
  };
  const $ = (n) => ({
    first: () => (nodes[n] || [{ json: {} }])[0],
    all: () => nodes[n] || [],
  });
  const $input = { first: () => ({ json: { candidates: [{ content: { parts: [{ text: model }] } }] } }) };
  const $execution = { customData: { set: () => {} } };
  const logs = [];
  const console2 = { log: (...a) => logs.push(a.join(" ")) };

  const fn = new Function("$", "$input", "$execution", "console", body);
  const out = fn($, $input, $execution, console2)[0].json;
  return { reply: out.lastAiReply, guards: out.aiGuards, logs };
}

let pass = 0, fail = 0;
function check(label, cond, detail) {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}`);
  if (!cond && detail !== undefined) console.log("        " + JSON.stringify(detail));
}

const P = (title, price, opts = {}) => ({
  title, price, url: "https://sehatup.com/products/" + title.toLowerCase().replace(/\W+/g, "-"),
  isRx: !!opts.isRx, inStock: opts.inStock !== false, named: opts.named || 0, isKit: !!opts.isKit,
});
const VAJI = P("Vaji Bati", 849, { named: 2 });
const KERN = P("Kern Drops", 509, { named: 1 });
const KIT = P("Confidence & Performance Booster Kit", 1099, { isKit: true });
const GARC = P("Garcinia Cambogia Drops - sehatUP", 499);

console.log("\n--- replay of the reported production transcript ---");
const t2 = run({ cust: "Yah kaun sa drops hai", model: "ji yah drops hai", lastOut: "Ji, do options hain:\n\n1) Garcinia Cambogia Drops - sehatUP - Rs 499\nhttps://x\n\n2) Kern Drops - Rs 509\nhttps://y\n\nAapko kaunsa chahiye - 1 ya 2?", matches: [GARC, KERN] });
check("turn 2 no longer sends 'ji yah drops hai'", t2.reply !== "ji yah drops hai", t2);
check("turn 2 answers with the catalog", /Rs\s*\d/.test(t2.reply), t2.reply);

const t3 = run({ cust: "Kya chij ka he", model: "ji yah drops hai", lastOut: "ji yah drops hai", matches: [GARC, KERN] });
check("turn 3 replaced", t3.reply !== "ji yah drops hai", t3);
check("turn 3 flags a guard", !!t3.guards, t3);

const t4 = run({ cust: "Kese upayog karna hai", model: "ji", lastOut: "ji yah drops hai", matches: [KERN] });
check("turn 4 'how to use' -> dose handoff", /dose/i.test(t4.guards) && /Dose doctor hi batate hain/.test(t4.reply), t4);

const t5 = run({ cust: "Batao", model: "ji", lastOut: "ji" });
check("turn 5 bare 'ji' after 'Batao' is replaced", t5.reply !== "ji", t5);
check("turn 5 fires the substance guard", /substance/.test(t5.guards), t5);

console.log("\n--- the self-sustaining loop is broken ---");
check("filler after OUR non-question is caught", /substance/.test(run({ cust: "kya hai ye", model: "ji", lastOut: "ji yah drops hai" }).guards));
check("short non-answer is caught", /substance/.test(run({ cust: "ye kis kaam aata hai", model: "ji ye accha hai", lastOut: "ji" }).guards));
const rep = run({ cust: "hmm", model: "ji yah drops hai", lastOut: "ji yah drops hai" });
check("verbatim repeat is replaced", /repeat|substance/.test(rep.guards) && rep.reply !== "ji yah drops hai", rep);

console.log("\n--- README cases that must NOT regress ---");
const okShort = run({ cust: "Okay", model: "ji", lastOut: "Aapka order ship ho chuka hai." });
check('short exchange "Okay" -> "ji" left alone', okShort.reply === "ji", okShort);
const realAnswer = run({ cust: "vaji bati ka price", model: "Vaji Bati ka price Rs 849 hai ji.\nhttps://sehatup.com/products/vaji-bati", lastOut: "ji bataiye", matches: [VAJI] });
check("a reply that really answers is untouched", /849/.test(realAnswer.reply), realAnswer);
const dose = run({ cust: "shilajit kitna lena hai roz", model: "ek chammach roz", lastOut: "ji" });
check("dose guard still fires", /dose/.test(dose.guards), dose);
const promise = run({ cust: "kab call aayega", model: "They will call you in 5 minutes ji", lastOut: "ji" });
check("promise guard still fires", /promise/.test(promise.guards), promise);
const claim = run({ cust: "mera health score kya hai", model: "ji your score is 7 and you have a PCOD", lastOut: "ji" });
check("health-score responder still fires", /score/.test(claim.guards), claim);
const consult10 = run({ cust: "ok", model: "10-15 min ki free consultation hoti hai ji, doctor sab bata denge", lastOut: "ji bataiye" });
check("'10-15 min consultation' is not a promise", !/promise/.test(consult10.guards), consult10);

console.log("\n--- the combo kit ---");
const both = run({ cust: "vaji bati aur kern drop dono chahiye", model: "ji", lastOut: "ji bataiye", matches: [VAJI, KERN, KIT] });
check("names both -> lists both, no '1 ya 2?'", /Vaji Bati/.test(both.reply) && /Kern Drops/.test(both.reply) && !/1 ya 2/.test(both.reply), both);
check("offers the combo with the saving", /1099/.test(both.reply) && /1358/.test(both.reply), both.reply);
check("flagged both_with_combo", /both_with_combo/.test(both.guards), both.guards);
const kitOnly = run({ cust: "confidence performance kit ka price", model: "ji", lastOut: "ji bataiye", matches: [KIT] });
check("kit asked for by name gets a price + link", /1099/.test(kitOnly.reply) && /http/.test(kitOnly.reply), kitOnly);
const ambiguous = run({ cust: "shilajit ka price", model: "ji", lastOut: "ji bataiye", matches: [P("Shilajit Honey Sticks", 899), P("Pure Himalayan Shilajit Resin - 20g", 1349)] });
check("genuinely ambiguous still asks '1 ya 2?'", /1 ya 2/.test(ambiguous.reply), ambiguous);

console.log("\n--- company / trust questions (2026-08-03 transcript, second report) ---");
const whereFrom = run({ cust: "Recording karke bataiye kahan se aap", model: "ji", lastOut: "Ji, dono ke rate ye hain: ..." });
check("answers where-we-are instead of 'doctor will explain'", /digital clinic/i.test(whereFrom.reply) && !/doctor aapko theek se samjha/.test(whereFrom.reply), whereFrom);
check("says it cannot send a voice note", /voice note nahi bhej sakti/i.test(whereFrom.reply), whereFrom.reply);
check("flagged where_from_voice", /company=where_from_voice/.test(whereFrom.guards), whereFrom.guards);
check("invents no address", !/(gurgaon|noida|delhi|mumbai|bangalore|pune|sector|street|road|pin\s*code)/i.test(whereFrom.reply), whereFrom.reply);
const whereOnly = run({ cust: "aap kahan se ho", model: "ji", lastOut: "ji bataiye" });
check('"aap kahan se ho" answered', /digital clinic/i.test(whereOnly.reply) && /company=where_from\b/.test(whereOnly.guards), whereOnly);
const orderWhere = run({ cust: "mera order kaha hai", model: "ji", lastOut: "ji bataiye" });
check("an ORDER 'kaha hai' is not hijacked", !/company/.test(orderWhere.guards), orderWhere);

console.log("\n--- the generic fallback must not assume a medical question ---");
const nonMedical = run({ cust: "aapka GST number kya hai", model: "ji", lastOut: "Ji, ye rahi jaankari." });
check("non-medical question -> team will confirm", /team se confirm/.test(nonMedical.reply), nonMedical);
const medical = run({ cust: "ye dawa kaise kaam karti hai", model: "ji", lastOut: "Ji, ye rahi jaankari." });
check("medical question -> doctor will explain", /doctor aapko theek se samjha/.test(medical.reply), medical);

console.log("\n--- report guard must not duplicate what the automation already sent ---");
const REPORT = { found: true, url: "https://storage.googleapis.com/x/HealthScore360Report.pdf?sig=abc" };
const dup = run({ cust: "I want my detailed HealthScore360 report", model: "ji", lastOut: "Hello ji",
                  report: REPORT, automationReplied: true });
check("no second copy of the report link", !/storage\.googleapis\.com/.test(dup.reply), dup);
check("report guard did not fire", !/report=/.test(dup.guards), dup.guards);
const normalReport = run({ cust: "mujhe meri report chahiye", model: "ji", lastOut: "Hello ji",
                           report: REPORT, automationReplied: false });
check("still sends the report when no automation replied", /storage\.googleapis\.com/.test(normalReport.reply), normalReport);
check("flagged report=sent", /report=sent/.test(normalReport.guards), normalReport.guards);

console.log("\n--- role reversal: the model wrote the CUSTOMER's turn (2026-08-05, exec 19013) ---");
// Verbatim from production. Note the trailing "K": the customer's own second message, copied.
const REVERSED = "Good morning Ananya,\nYes, I need to know about PCOS and its treatment."
  + "\nI'm suffering from PCOS, since 2017. I have hair fall, acne, and pigmentation."
  + "\nI used medications before but nothing helped.\nK";
const rev = run({ cust: "Hello! Can I get more info for PCOD/PCOS?\nK", model: REVERSED, greeted: false });
check("role guard fires on the production reply", /role=/.test(rev.guards), rev.guards);
check("the invented medical history never goes out",
  !/(2017|hair\s*fall|pigmentation|acne|suffering)/i.test(rev.reply), rev.reply);
check("the reply no longer addresses Ananya", !/^\s*ananya\s*,/i.test(rev.reply), rev.reply);
check("first contact still gets the intro exactly once",
  (rev.reply.match(/mai Ananya baat kar rahi hu/g) || []).length === 1, rev.reply);

// Each signal on its own.
check("signal: addresses Ananya",
  /role=addressed_ananya/.test(run({ cust: "vaji bati", model: "Ananya, please tell me the price of it" }).guards));
check("signal: speaks as the patient",
  /role=patient_voice/.test(run({ cust: "hello", model: "Ji, mujhe pcod hai aur periods irregular hain" }).guards));
check("signal: echoes the customer's own last line",
  /role=echoed_customer/.test(run({ cust: "kern drops", model: "Ji theek hai\nkern drops" }).guards));

console.log("\n--- role reversal: must NOT fire on Ananya's real voice ---");
const notRev = [
  ["a normal price reply", "Vaji Bati ka price Rs 849 hai ji.\nhttps://sehatup.com/products/vaji-bati", "vaji bati ka price"],
  ["her own introduction", "Hello ji, mai Ananya baat kar rahi hu SehatUP se. Mai aapki kya help kar sakti hu?", "hi"],
  ["the identity answer", "Mai Ananya hu ji, SehatUP ki health advisor.", "aap kaun ho"],
  ["first person about helping", "Ji, main aapke liye check kara deti hu aur team se confirm karke bata deti hu.", "order kaha hai"],
  ["echoing a condition the customer raised", "Ji, aapko PCOD hai to doctor se baat karna zaroori hai.", "mera PCOD hai"],
  ["the safety check question", "Ji aapko thyroid, sugar ya BP ki koi problem hai?", "weight loss kit chahiye"],
];
for (const [label, model, cust] of notRev) {
  const r = run({ cust, model });
  check(`no role guard: ${label}`, !/role=/.test(r.guards), r.guards);
}

console.log("\n--- role reversal is a floor, not a ceiling: better guards still win ---");
const revDose = run({ cust: "shilajit kitna lena hai roz", model: "Ananya, kitna lena hai batao?\nI have thyroid" });
check("role guard fires", /role=/.test(revDose.guards), revDose.guards);
check("but the dose handoff is what is sent",
  /Dose doctor hi batate hain/.test(revDose.reply), revDose.reply);
const revScore = run({ cust: "mera health score kya hai", model: "Ananya, mera score kya hai?" });
check("health-score link wins over the role-guard floor",
  /health-score-360/.test(revScore.reply), revScore.reply);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
