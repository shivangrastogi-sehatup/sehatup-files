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

// ---------------------------------------------------------------------------------------
// 2026-08-07, exec 23143. Customer tapped a WOMEN'S menstrual-health ad, said only "Hello" /
// "Isme kya hota hai" / "Kya help kariyega aap bataiye", and was sent an invented sexual-
// wellness pitch with a fabricated no-side-effects claim. Nothing had matched the catalog.
// ---------------------------------------------------------------------------------------
console.log("\n--- pitch guard: no catalog match + no product asked = no product in the reply ---");
const PITCH = "Ye ek ayurvedic medicine hai jiska koi side effect nhi hota hai. Ye aapki sex life ko bahter banata hai.";
const pitch = run({ cust: "Kya help kariyega aap bataiye", model: PITCH,
  lastOut: "Mai aapki kya help kar sakti hu?" });
check("the production reply is blocked", !/sex life/i.test(pitch.reply), pitch.reply);
check("no invented medicine survives", !/ayurvedic medicine/i.test(pitch.reply), pitch.reply);
check("asks what the concern actually is", /kya problem ho rahi hai/i.test(pitch.reply), pitch.reply);
check("flagged", /pitch=/.test(pitch.guards), pitch.guards);

const named = run({ cust: "haan bataiye", model: "Aapke liye Vaji Bati sahi rahega, ye stamina badhata hai." });
check("a catalog product named unasked is blocked", !/vaji/i.test(named.reply), named.reply);
check("flagged as named_product", /pitch=named_product/.test(named.guards), named.guards);

console.log("\n--- pitch guard must stay silent when the customer DID ask ---");
const notPitch = [
  ["asked for a product by name", "vaji bati ka price kya hai", [VAJI]],
  ["asked which products exist", "weight loss ke liye konse product hai", [GARC]],
  ["asked for a link", "shilajit ka link bhejo", [VAJI]],
];
for (const [label, cust, matches] of notPitch) {
  const r = run({ cust, matches, model: "Vaji Bati ka price Rs 849 hai ji.\nhttps://sehatup.com/products/vaji-bati" });
  check(`no pitch guard: ${label}`, !/pitch=/.test(r.guards), r.guards);
}
const consult = run({ cust: "mujhe periods ki problem hai", model: "Ji, aap pareshaan mat hoiye - isko manage kiya ja sakta hai. Kab se ho raha hai?" });
check("no pitch guard: a normal empathy + question reply", !/pitch=/.test(consult.guards), consult.guards);

console.log("\n--- safety claim guard: absolute safety / cure claims never ship ---");
const claims = [
  ["koi side effect nhi hota hai", "Ye dawa hai, iska koi side effect nhi hota hai."],
  ["no side effects (English)", "This has no side effects at all."],
  ["100% safe", "Ye 100% safe hai ji."],
  ["bilkul safe", "Ye bilkul safe hai, aap le sakte hain."],
  ["guaranteed result", "Iska guarantee result milta hai."],
];
// The claim must never reach the customer. WHICH guard removes it does not matter - a short
// claim like "Ye 100% safe hai ji" is also filler, so the substance guard may replace it first
// with a better answer; the safety guard then records the attempt instead of overwriting it.
const CLAIM_RE = /(side\s*effects?\s*(nhi|nahi)|no side effects|100% safe|bilkul safe|guarantee result)/i;
for (const [label, model] of claims) {
  const r = run({ cust: "iske baare me bataiye", model, matches: [VAJI] });
  check(`never ships: ${label}`, !CLAIM_RE.test(r.reply), r.reply);
  check(`flagged: ${label}`, /safetyClaim/.test(r.guards), r.guards);
}

console.log("\n--- safety claim guard must not fire on a normal side-effect question ---");
const sideQ = run({ cust: "iska side effect hai kya", matches: [VAJI],
  model: "Ji, side effect ke baare me doctor aapko theek se bata denge - free consultation me sab detail mil jayegi." });
check("an honest 'ask the doctor' answer survives", !/safetyClaim/.test(sideQ.guards), sideQ.guards);

// ---------------------------------------------------------------------------------------
// The same incident's upstream cause: QuickReply's own automation had already written a
// text-less BOT_PLACEHOLDER, which counted as "we greeted", so the intro stripper deleted
// Ananya's introduction and the customer never learned who was talking to them.
// ---------------------------------------------------------------------------------------
console.log("\n--- a QuickReply placeholder is not a greeting ---");
const afterAuto = run({ cust: "Isme kya hota hai", greeted: false, automationReplied: true,
  model: "Hello ji, mai Ananya baat kar rahi hu SehatUP se. Mai aapki kya help kar sakti hu?" });
check("the introduction still goes out", /mai Ananya baat kar rahi hu SehatUP se/.test(afterAuto.reply), afterAuto.reply);
check("and exactly once", afterAuto.reply.match(/Ananya/g).length === 1, afterAuto.reply);

const afterReal = run({ cust: "aur kya", lastOut: "Ji bataiye, kya problem hai?",
  model: "Hello ji, mai Ananya baat kar rahi hu SehatUP se. Ji bataiye." });
check("a real prior reply still suppresses the intro", !/mai Ananya baat kar rahi hu/.test(afterReal.reply), afterReal.reply);

// ---------------------------------------------------------------------------------------
// 2026-08-07: a PCOD customer mid-booking asked "Offline hi ya online hi" and got
// "Ji, note kar liya. Aap apna naam aur kaunsa time..." - her QUESTION was noted down as if it
// were an ANSWER, and never answered. The persona had no statement of how a consultation
// happens, so the model had nothing to reply with in the first place.
// ---------------------------------------------------------------------------------------
console.log("\n--- consultation mode: online vs offline is answered, not noted ---");
const offline = run({ cust: "Offline hi ya online hi", model: "ji",
  lastOut: "Aap apna naam aur kaunsa time aapke liye theek rahega bata dijiye?" });
check("does not note a question down", !/note kar liya/.test(offline.reply), offline.reply);
check("says it is online", /online/i.test(offline.reply), offline.reply);
check("says nobody has to travel", /aana nahi padta/i.test(offline.reply), offline.reply);
check("flagged", /consultMode/.test(offline.guards), offline.guards);

const modeQs = [
  ["clinic aana padega kya", "clinic aana padega kya"],
  ["kahan aana hai", "consultation kahan hoti hai"],
  ["video call hai kya", "video call hai kya"],
  ["kaise hogi", "consultation kaise hoti hai"],
];
for (const [label, cust] of modeQs) {
  const r = run({ cust, model: "ji" });
  check(`answered: ${label}`, /online/i.test(r.reply) && /consultMode/.test(r.guards), r.reply);
}

console.log("\n--- consultation mode must not hijack order or payment questions ---");
const notMode = [
  ["an online ORDER question", "maine online order kiya tha wo kaha hai"],
  ["an online PAYMENT question", "online payment kar sakte hain kya"],
];
for (const [label, cust] of notMode) {
  const r = run({ cust, model: "ji" });
  check(`no consult-mode guard: ${label}`, !/consultMode/.test(r.guards), r.guards);
}

console.log("\n--- substance guard: a question is never 'noted' ---");
const asked = run({ cust: "aapke paas kya kya hai", model: "ji",
  lastOut: "Aap apna naam aur kaunsa time bata dijiye?" });
check("a real question is not noted down", !/note kar liya/.test(asked.reply), asked.reply);
check("flagged unanswered_question", /substance=unanswered_question/.test(asked.guards), asked.guards);

const answeredUs = run({ cust: "24", model: "ji", lastOut: "aapki age kitni h?" });
check("a short factual ANSWER is still acknowledged", /note kar liya/.test(answeredUs.reply), answeredUs.reply);
check("still flagged answered_our_question", /substance=answered_our_question/.test(answeredUs.guards), answeredUs.guards);

console.log("\n--- role reversal: the model PARROTS the customer (2026-08-08, exec 25843) ---");
// Verbatim from production. Single line, never names Ananya, no symptom word — so all three
// earlier signals missed it and this reached a real customer as:
//   "Hello ji, mai Ananya baat kar rahi hu SehatUP se. ji mujhe Vaji Bati or Kern Drops chahiye"
const parrot = run({
  cust: "Mujhe Vaji Bati or Kern Drops Chahiye",
  model: "Good morning sir mujhe Vaji Bati or Kern Drops chahiye",
  greeted: false, matches: [VAJI, KERN],
});
check("role guard fires on the parroted reply", /role=/.test(parrot.guards), parrot.guards);
check("the customer's own words are not sent back",
  !/mujhe Vaji Bati or Kern Drops chahiye/i.test(parrot.reply), parrot.reply);

console.log("\n--- ...but reusing the customer's product name is normal and must pass ---");
const reuse = [
  ["confirms with a link", "Aap Vaji Bati ki baat kar rahe hain? Ye raha link: https://sehatup.com/products/vaji-bati"],
  ["quotes the price", "Vaji Bati ka price Rs 849 hai ji."],
  ["asks a question back", "Vaji Bati ya Kern Drops - aapko kaunsa chahiye?"],
  ["acknowledges and moves on", "Ji bilkul, Vaji Bati aur Kern Drops dono available hain, main detail bata deti hu."],
];
for (const [label, model] of reuse) {
  const r = run({ cust: "Mujhe Vaji Bati or Kern Drops Chahiye", model, matches: [VAJI, KERN] });
  check(`no role guard: ${label}`, !/role=/.test(r.guards), `${r.guards} | ${r.reply}`);
}


console.log("\n--- SALES POLICY: consultation only where a doctor changes the answer (2026-08-08) ---");
const HERMEN = P("Her Menses", 499);
const SHILA = P("Pure Himalayan Shilajit Resin - 20g", 1349);
const THYRO = P("Thyrostatin 3X", 249);

// DIRECT SALE — men's performance / stamina / weight. Price + link, no consultation pitch:
// these do not need a doctor, and the extra step only delays an order already decided on.
for (const c of [
  { label: "vaji bati", cust: "vaji bati ka price", ms: [VAJI] },
  { label: "kern drops", cust: "kern drops ka price kya hai", ms: [KERN] },
  { label: "both + combo", cust: "vaji bati aur kern drop dono chahiye", ms: [VAJI, KERN, KIT] },
  { label: "the combo kit", cust: "confidence performance kit ka price", ms: [KIT] },
  { label: "shilajit", cust: "shilajit resin ka price", ms: [SHILA] },
]) {
  const r = run({ cust: c.cust, model: "ji", lastOut: "ji bataiye", matches: c.ms });
  check("direct sale, no consult pitch: " + c.label,
    !/free consultation/i.test(r.reply) && /Rs\s*\d/.test(r.reply), r.reply);
  check("direct sale still asks the health question: " + c.label,
    /dawai chal rahi ho|health problem/i.test(r.reply), r.reply);
}

// CONSULT TOPICS — women's hormonal range and the condition products keep the pitch.
for (const c of [
  { label: "Her Menses", cust: "her menses ka price", ms: [HERMEN] },
  { label: "Thyrostatin", cust: "thyrostatin ka price", ms: [THYRO] },
  // The TOPIC decides, not just the product: a male product asked about for PCOD still
  // routes to the doctor, because the customer's own words named a consult condition.
  { label: "PCOD named alongside a male product", cust: "PCOD ke liye vaji bati ka price", ms: [VAJI] },
]) {
  const r = run({ cust: c.cust, model: "ji", lastOut: "ji bataiye", matches: c.ms });
  check("consult topic keeps the pitch: " + c.label, /free consultation/i.test(r.reply), r.reply);
}

// Rx is untouched by the sales policy — a prescription requirement, not a sales choice.
const rxSale = run({
  cust: "endless ka price batao", model: "ji", lastOut: "ji bataiye",
  matches: [P("Dapoxetine Hydrochloride tablets IP 30 mg (Endless)", 171, { isRx: true })],
});
check("Rx still refuses the price and routes to a doctor",
  !/171/.test(rxSale.reply) && /doctor/i.test(rxSale.reply), rxSale.reply);

console.log(`
${pass} passed, ${fail} failed
`);
process.exit(fail ? 1 : 0);
