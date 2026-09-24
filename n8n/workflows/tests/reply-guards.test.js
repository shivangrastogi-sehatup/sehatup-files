// Regression harness for the "Extract AI Response" node (check-and-retry design, 2026-09-15).
// Runs the REAL node body from extract-ai-response.txt with the n8n $() calls stubbed.
// The node never writes a reply: it returns route 'retry' (with a rewrite note), 'send' (the
// chatbot's own text, format-cleaned) or 'human' (nothing sent). These tests pin that.
// Run:  node reply-guards.test.js
const fs = require("fs");
const path = require("path");
const body = fs.readFileSync(path.join(__dirname, "../extract-ai-response.txt"), "utf8");

const SYS = "SYSTEM PROMPT";
// One run of the node.
function turn({ model, cust, lastOut, matches = [], name = "Customer", greeted = true, report = {},
                automationReplied = false, history = [], runIndex = 0, displayName = "" }) {
  const hist = [];
  let t = 100;
  for (const h of history) hist.push({ json: { msgTime: t++, senderKind: h.direction === "out" ? "AI" : undefined, ...h } });
  if (lastOut) hist.push({ json: { direction: "out", text: lastOut, msgTime: 1000, senderKind: "AI" } });
  if (greeted && !lastOut && !history.some(h => h.direction === "out")) {
    hist.push({ json: { direction: "out", text: "Hello ji", msgTime: 500, senderKind: "AI" } });
  }
  hist.push({ json: { direction: "in", text: cust, msgTime: 2000 } });
  if (automationReplied) {
    hist.push({ json: { direction: "out", _type: "BOT_PLACEHOLDER", text: "", placeholder: "Bot replied", messageBy: "AUTOMATION", msgTime: 2100 } });
  }
  const nodes = {
    "Build AI Prompt": [{ json: { phone: "+919999999999", name, newMsgText: cust, displayName,
      messages: [{ role: "system", content: SYS }, { role: "user", content: cust }] } }],
    "Decide Process": [{ json: { phone: "+919999999999" } }],
    "Fetch Conversation History": hist,
    "Fetch Customer Context": [{ json: { report } }],
    "Fetch Product Matches": [{ json: { matches } }],
  };
  const $ = (n) => ({ first: () => (nodes[n] || [{ json: {} }])[0], all: () => nodes[n] || [] });
  const parts = model === "" ? [] : [{ text: model }];
  const $input = { first: () => ({ json: { candidates: [{ content: { parts } }] } }) };
  const $execution = { customData: { set: () => {} } };
  const quiet = { log: () => {} };
  return new Function("$", "$input", "$execution", "$runIndex", "console", body)($, $input, $execution, runIndex, quiet)[0].json;
}
// The whole loop: feeds successive drafts until the node stops asking for a retry.
function chat(opts, drafts) {
  let out;
  for (let i = 0; i < drafts.length; i++) {
    out = turn({ ...opts, model: drafts[i], runIndex: i });
    if (out.route !== "retry") return { ...out, calls: i + 1 };
  }
  return { ...out, calls: drafts.length };
}
const same = (d) => [d, d, d];

let pass = 0, fail = 0;
function check(label, cond, detail) {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}`);
  if (!cond && detail !== undefined) console.log("        " + JSON.stringify(detail).slice(0, 400));
}
const noteOf = (r) => (r.messages && r.messages[0].content) || "";

const P = (title, price, opts = {}) => ({
  title, price, url: "https://sehatup.com/products/" + title.toLowerCase().replace(/\W+/g, "-"),
  isRx: !!opts.isRx, inStock: opts.inStock !== false, named: opts.named || 0, isKit: !!opts.isKit,
});
const VAJI = P("Vaji Bati", 849, { named: 2 });
const KERN = P("Kern Drops", 509, { named: 1 });
const KIT = P("Confidence & Performance Booster Kit", 1099, { isKit: true });
const HERMEN = P("Her Menses", 499);
const ENDLESS = P("Dapoxetine Hydrochloride tablets IP 30 mg (Endless)", 171, { isRx: true });

console.log("\n--- the node never writes a reply of its own ---");
check("no hardcoded reply text is assigned anywhere", !/(aiText|finalText)\s*=\s*['"`][A-Za-z]/.test(body));

console.log("\n--- a good reply goes out as written, first time ---");
const good = chat({ cust: "mujhe 2 mahine se periods irregular hain" },
  ["Aap bilkul pareshaan mat hoiye, hum aapke saath hain. Ye kab se ho raha hai?"]);
check("sent on the first call", good.route === "send" && good.calls === 1, good);
check("text is the chatbot's own", /hum aapke saath hain/.test(good.lastAiReply), good.lastAiReply);

console.log("\n--- retry mechanics ---");
const r1 = turn({ cust: "hello", model: "", runIndex: 0 });
check("empty draft asks for a retry", r1.route === "retry" && r1.violations.some(v => /^empty/.test(v)), r1);
check("retry keeps the conversation unchanged", r1.messages.length === 2 && r1.messages[1].content === "hello", r1.messages);
check("the rewrite note goes in the system instruction", noteOf(r1).startsWith(SYS) && /REWRITE NOTE/.test(noteOf(r1)), noteOf(r1));
const r1b = chat({ cust: "hello" }, ["", "Ji bataiye, aapko kis cheez me help chahiye?"]);
check("second draft is sent", r1b.route === "send" && r1b.calls === 2, r1b);
const drafted = turn({ cust: "kya hai ye", model: "ji", lastOut: "ji yah drops hai", runIndex: 0 });
check("the rejected draft is quoted in the note", /"""\nji\n"""/.test(noteOf(drafted)), noteOf(drafted));
const lastTry = turn({ cust: "kya hai ye", model: "ji", lastOut: "Aapko kya problem hai?", runIndex: 2 });
check("no retry after the last attempt", lastTry.route !== "retry", lastTry);

console.log("\n--- introduction: once, and only on the first message ---");
const intro = chat({ cust: "hi", greeted: false },
  ["Ji bataiye kya problem hai?", "Hello ji, mai Ananya baat kar rahi hu SehatUP se. Mai aapki kya help kar sakti hu?"]);
check("missing intro on first contact is retried", intro.calls === 2 && intro.route === "send", intro);
check("intro appears exactly once", (intro.lastAiReply.match(/Ananya/g) || []).length === 1, intro.lastAiReply);
const doubleIntro = chat({ cust: "hi", greeted: false },
  ["Hello ji, mai Ananya baat kar rahi hu SehatUP se. Hi This is Ananya Health Expert From sehatUP. Aap bataiye kya hua?"]);
check("a second (English) intro is removed", (doubleIntro.lastAiReply.match(/Ananya/gi) || []).length === 1, doubleIntro.lastAiReply);
const reIntro = chat({ cust: "aur batao" }, ["Mai Ananya baat kar rahi hu SehatUP se. Aapko kis cheez me help chahiye?"]);
check("a mid-chat re-introduction is stripped", !/Ananya/.test(reIntro.lastAiReply) && /help chahiye/.test(reIntro.lastAiReply), reIntro);

console.log("\n--- formatting only removes ---");
const titles = chat({ cust: "hello" }, ["Ji sir, bataiye kya problem hai?"]);
check("sir removed", !/\bsir\b/i.test(titles.lastAiReply), titles.lastAiReply);
const jis = chat({ cust: "hello" }, ["Ji bilkul ji, bata deti hu ji, aapko kya problem hai ji?"]);
check("one ji kept", (jis.lastAiReply.match(/\bji\b/gi) || []).length === 1, jis.lastAiReply);
const prof = chat({ cust: "hello", name: "My Love My Papa" }, ["Ji My Love My Papa, bataiye kya problem hai?"]);
check("WhatsApp profile name stripped", !/Papa/.test(prof.lastAiReply), prof.lastAiReply);
const okShort = chat({ cust: "Okay", lastOut: "Aapka order ship ho chuka hai." }, ["ji"]);
check('short exchange "Okay" -> "ji" is left alone', okShort.route === "send" && okShort.lastAiReply === "ji", okShort);

console.log("\n--- role reversal (2026-08-05) ---");
const REVERSED = "Good morning Ananya,\nYes, I need to know about PCOS and its treatment."
  + "\nI'm suffering from PCOS, since 2017. I have hair fall, acne, and pigmentation."
  + "\nI used medications before but nothing helped.\nK";
const rev = chat({ cust: "Hello! Can I get more info for PCOD/PCOS?\nK", greeted: false }, same(REVERSED));
check("persistent role reversal is never sent", rev.route === "human" && rev.lastAiReply === "", rev);
const revFixed = chat({ cust: "Hello! Can I get more info for PCOD/PCOS?\nK", greeted: false },
  [REVERSED, "Hello ji, mai Ananya baat kar rahi hu SehatUP se. PCOS ke baare me zaroor bataungi - ye aapko kab se hai?"]);
check("fixed on retry and sent", revFixed.route === "send" && !/2017/.test(revFixed.lastAiReply), revFixed);
check("signal: parrots the customer", turn({ cust: "Mujhe Vaji Bati or Kern Drops Chahiye", matches: [VAJI, KERN],
  model: "Good morning sir mujhe Vaji Bati or Kern Drops chahiye" }).violations.includes("role_reversal"));
check("not a reversal: a normal price reply", !turn({ cust: "vaji bati ka price", matches: [VAJI],
  model: "Vaji Bati ka price Rs 849 hai.\nhttps://sehatup.com/products/vaji-bati\nKoi dawai chal rahi hai?" }).violations.includes("role_reversal"));

console.log("\n--- dose ---");
const dose = chat({ cust: "shilajit kitna lena hai roz" }, same("Shilajit energy ke liye bahut accha hai. Ek chammach roz lijiye."));
check("a dose never ships", !/chammach/i.test(dose.lastAiReply), dose);
check("the safe sentence still goes out", dose.route === "send" && /energy/.test(dose.lastAiReply), dose);
const doseAsk = turn({ cust: "Kese upayog karna hai", model: "Isko roz lena accha rehta hai", lastOut: "ji" });
check("a dose question not deferred to a doctor is retried", doseAsk.violations.includes("dose_not_deferred") && /doctor decides/.test(noteOf(doseAsk)), doseAsk);
const stopMed = turn({ cust: "metformin band kar du kya", model: "Ek goli bhi band karne se pehle doctor se zaroor baat kijiye." });
check("'ek goli bhi band...' is not a dose", !stopMed.violations.includes("dose_given"), stopMed.violations);

console.log("\n--- prices and products ---");
const price = chat({ cust: "vaji bati ka price", matches: [VAJI], lastOut: "ji bataiye" },
  ["ji", "Vaji Bati ka price Rs 849 hai.\nhttps://sehatup.com/products/vaji-bati\nKoi health problem hai ya koi dawai chal rahi hai?"]);
check("missing price is retried and then sent", price.calls === 2 && price.route === "send", price);
const priceNote = turn({ cust: "vaji bati ka price", matches: [VAJI], model: "ji", lastOut: "ji bataiye" });
check("the note carries the live price and link", /Rs 849/.test(noteOf(priceNote)) && /products\/vaji-bati/.test(noteOf(priceNote)), noteOf(priceNote));
check("direct-sale note says no consultation pitch", /Do not pitch a consultation/.test(noteOf(priceNote)));
const consultNote = turn({ cust: "her menses ka price", matches: [HERMEN], model: "ji", lastOut: "ji bataiye" });
check("consult-topic note allows a gentle offer", /gently offer the free consultation/.test(noteOf(consultNote)), noteOf(consultNote));
const both = turn({ cust: "vaji bati aur kern drop dono chahiye", matches: [VAJI, KERN, KIT], model: "ji", lastOut: "ji bataiye" });
check("two named products: note asks for both + combo", /both prices/.test(noteOf(both)) && /1099/.test(noteOf(both)) && /1358/.test(noteOf(both)), noteOf(both));
const wrong = chat({ cust: "vaji bati ka price", matches: [VAJI] }, same("Vaji Bati sirf Rs 499 me mil jayega."));
check("a wrong price never ships", !/499/.test(wrong.lastAiReply), wrong);
const rx = chat({ cust: "endless ka price batao", matches: [ENDLESS] }, same("Endless ka price Rs 171 hai."));
check("an Rx price never ships", !/171/.test(rx.lastAiReply), rx);
const memPrice = chat({ cust: "shilajit ka rate", matches: [] }, same("Shilajit Rs 1200 ka hai."));
check("a price with no live data never ships", !/1200/.test(memPrice.lastAiReply), memPrice);
const orderAmt = chat({ cust: "mera order kaha hai" }, ["Aapka order ship ho chuka hai, aapne Rs 1349 pay kiye the."]);
check("a past order amount is not a price violation", orderAmt.route === "send" && /1349/.test(orderAmt.lastAiReply), orderAmt);
const pitchDirect = turn({ cust: "vaji bati ka price", matches: [VAJI], lastOut: "ji bataiye",
  model: "Vaji Bati ka price Rs 849 hai.\nhttps://sehatup.com/products/vaji-bati\nChahein to free consultation bhi kara deti hu." });
check("consultation pitch on a direct sale is retried", pitchDirect.violations.includes("consultation_on_direct_sale"), pitchDirect.violations);

console.log("\n--- unasked product pitch (2026-08-07) ---");
const PITCH = "Ye ek ayurvedic medicine hai jiska koi side effect nhi hota hai. Ye aapki sex life ko bahter banata hai.";
const pitch = chat({ cust: "Kya help kariyega aap bataiye", lastOut: "Mai aapki kya help kar sakti hu?" }, same(PITCH));
check("never ships", !/sex life|ayurvedic medicine/i.test(pitch.lastAiReply), pitch);
check("no product pitched when the customer asked for one is fine",
  !turn({ cust: "vaji bati ka price kya hai", matches: [VAJI], model: "Vaji Bati ka price Rs 849 hai.\nhttps://sehatup.com/products/vaji-bati" }).violations.includes("unasked_product_pitch"));

console.log("\n--- claims that must never reach a customer ---");
const CLAIM_RE = /(side\s*effects?\s*(nhi|nahi)|no side effects|100% safe|bilkul safe|guarantee result)/i;
for (const [label, model] of [
  ["koi side effect nhi hota hai", "Ye dawa hai, iska koi side effect nhi hota hai."],
  ["no side effects (English)", "This has no side effects at all."],
  ["100% safe", "Ye 100% safe hai ji."],
  ["bilkul safe", "Ye bilkul safe hai, aap le sakte hain."],
  ["guaranteed result", "Iska guarantee result milta hai."],
]) {
  const r = chat({ cust: "iske baare me bataiye", matches: [VAJI] }, same(model));
  check(`never ships: ${label}`, !CLAIM_RE.test(r.lastAiReply), r);
}
const honest = turn({ cust: "iska side effect hai kya", matches: [VAJI], model: "Side effect ke baare me doctor aapki history dekh kar sahi bata payenge." });
check("an honest 'ask the doctor' answer is not a claim", !honest.violations.includes("safety_claim"), honest.violations);
const promise = chat({ cust: "kab call aayega" }, same("Doctor aapko 5 minute me call karenge."));
check("a callback promise never ships", !/5 minute/.test(promise.lastAiReply), promise);
check("'10-15 min consultation' is not a promise",
  !turn({ cust: "ok", model: "10-15 min ki free consultation hoti hai, doctor sab bata denge", lastOut: "ji bataiye" }).violations.includes("callback_promise"));
const disc = chat({ cust: "thoda kam kar do", lastOut: "Vaji Bati ka price Rs 849 hai ji." }, same("Main aapke liye thoda discount karwa deti hu."));
check("a discount never ships", !/discount/i.test(disc.lastAiReply), disc);
const viewed = chat({ cust: "maine photo bheji hai" }, same("Maine dekh liya hai, ye normal hai."));
check("'I saw your photo' never ships", !/dekh/i.test(viewed.lastAiReply), viewed);
const sent = chat({ cust: "link bhejo" }, same("Maine aapko link bhej diya hai."));
check("'I sent the link' with no link never ships", !/bhej diya/i.test(sent.lastAiReply), sent);
const ai = chat({ cust: "aap AI ho kya" }, same("Ji, Mai ek AI Assistant hu."));
check("'I am an AI' never ships", !/AI Assistant/i.test(ai.lastAiReply), ai);
const addr = chat({ cust: "aap kahan se ho" }, same("Hum Delhi se operate karte hain."));
check("a wrong city never ships", !/Delhi/i.test(addr.lastAiReply), addr);
const delhi = turn({ cust: "Ap kha se. Baat kr rahi ho", model: "Hum Delhi se operate karte hain." });
check("'ap kha se' (+918102009381) catches Delhi", delhi.violations.includes("invented_address"), delhi.violations);
const noida = chat({ cust: "aap kahan se ho" }, ["Hamara office Sector 2, Noida me hai. Doctor se baat phone call pe hoti hai, isliye hum har city me help karte hain."]);
check("'Sector 2, Noida' is sent", noida.route === "send" && noida.calls === 1, noida);
check("the full address / other sectors are flagged",
  turn({ cust: "office kahan hai", model: "C-79, Sector 2, Noida 201301." }).violations.includes("invented_address")
  && turn({ cust: "office kahan hai", model: "Sector 62, Noida." }).violations.includes("invented_address"));

console.log("\n--- vulgar words and call denial (2026-09-18) ---");
const lund = turn({ cust: "Mughe apna land ko 9 inch long Krna hai", model: "Lund ki size badhane ke liye doctor se consultation leni hogi." });
check("mirroring 'Lund' (+918102009381) is flagged", lund.violations.includes("vulgar_word"), lund.violations);
check("'ling' is clean", !turn({ cust: "size badhana hai", model: "Ling ki size ke liye doctor sahi salah denge." }).violations.includes("vulgar_word"));
const noCall = turn({ cust: "Call me mam", model: "Maaf kijiye, hum log call par consultation nahi karte." });
check("'call par consultation nahi karte' (+919574932949) is flagged", noCall.violations.includes("denied_phone_call"), noCall.violations);
check("'Call me' counts as asking for the call",
  !turn({ cust: "Call me", model: "Ji bilkul, free consultation me doctor aapko call karenge." }).violations.includes("consultation_too_early"));
check("declining an out-of-hours call is not a denial",
  !turn({ cust: "raat 10 baje call karwa do", model: "Raat 10 baje call nahi ho paayegi, 9:30 AM se 6:30 PM ke beech bataiye." }).violations.includes("denied_phone_call"));
const score = chat({ cust: "mera health score kya hai" },
  ["Aapka score 7 hai.", "Apna free health score yahan check kar sakte hain:\nhttps://www.sehatup.com/pages/health-score-360"]);
check("an invented score is retried; the link reply is sent", score.calls === 2 && /health-score-360/.test(score.lastAiReply), score);
check("the first draft was flagged for score and missing link",
  (v => v.includes("diagnosis_or_score") && v.includes("report_link_missing"))(turn({ cust: "mera health score kya hai", model: "Aapka score 7 hai." }).violations));
check("echoing a condition the customer raised is fine",
  !turn({ cust: "mera PCOD hai", model: "Aapko PCOD hai to hum milkar isko manage karenge. Kab se hai?" }).violations.includes("diagnosis_or_score"));

console.log("\n--- pregnancy question on a male concern (2026-09-11) ---");
const preg = chat({ cust: "mujhe timing ki problem hai, jaldi nikal jata hai" },
  ["Aapko pregnancy ya breastfeeding to nahi hai?", "Aap pareshaan mat hoiye, ye bahut logon ke saath hota hai. Koi dawai abhi chal rahi hai?"]);
check("retried, and the question never ships", preg.calls === 2 && !/pregnan/i.test(preg.lastAiReply), preg);

console.log("\n--- booking ---");
const falseClaim = turn({ cust: "Thik h", lastOut: "Aapka ek free consultation kara deti hu doctor ke saath",
  model: "Okay, aapke liye consultation book kar deti hu, doctor aapko call kar lengi." });
check("a false booking claim is caught", falseClaim.violations.includes("booking_claim"), falseClaim.violations);
const twoTurns = [{ direction: "out", text: "Hello ji, mai Ananya baat kar rahi hu SehatUP se." },
  { direction: "in", text: "periods ki problem hai" }, { direction: "out", text: "Aap pareshaan mat hoiye. Kab se hai?" }];
const gentle = chat({ cust: "2 mahine se", history: twoTurns },
  ["Ji, aap pareshaan mat hoiye, hum aapke saath hain. Aap chahein to main free consultation set kara deti hu."]);
check("a gentle offer after understanding is sent as written", gentle.route === "send" && gentle.calls === 1, gentle);
check("a permission question is not a booking claim",
  !turn({ cust: "haan dikkat hai", history: twoTurns, model: "Ji, kya main aapke liye free consultation set kara du?" }).violations.includes("booking_claim"));
const slot = chat({ cust: "raat 10 baje call karwa do" }, same("Theek hai, 10 baje call aa jayega."));
check("an out-of-hours slot is never accepted", slot.route === "human" && slot.lastAiReply === "", slot);
const slotOk = chat({ cust: "raat 10 baje call karwa do" },
  ["Raat 10 baje consultation nahi ho paayegi, doctor 9:30 AM se 6:30 PM tak available rehte hain. Is beech ka koi time bata dijiye?"]);
check("declining the slot with the right hours is sent", slotOk.route === "send", slotOk);
const timeGiven = turn({ cust: "4 baje", lastOut: "Aapka naam aur kaunsa time aapke liye theek rahega bata dijiye?", model: "ji" });
check("a time they gave, answered with filler, is retried", timeGiven.violations.includes("booking_time_ignored"), timeGiven.violations);
const askedConsult = chat({ cust: "mujhe doctor se baat karni hai" },
  ["Ji bilkul. Aap apna naam aur 9:30 AM se 6:30 PM ke beech kaunsa time theek rahega bata dijiye?"]);
check("when they ask for a consultation, asking name and time is fine", askedConsult.route === "send" && askedConsult.calls === 1, askedConsult);

console.log("\n--- pacing: no early consultation push (2026-09-15) ---");
const early = turn({ cust: "2 mahine se periods irregular hain", model: "Aap chahein to main free consultation set kara deti hu." });
check("consultation in the first replies is retried", early.violations.includes("consultation_too_early") && /too early/.test(noteOf(early)), early);
const unreq = turn({ cust: "haan dard bhi hota hai", history: twoTurns, model: "Aap apna naam aur kaunsa time theek rahega bata dijiye?" });
check("asking name/time nobody asked for is retried", unreq.violations.includes("booking_ask_unrequested"), unreq.violations);
check("a safety condition allows the consultation early",
  !turn({ cust: "weight loss kit chahiye, mujhe thyroid hai", model: "Thyroid me sahi product doctor hi batayenge, aap chahein to main free consultation set kara deti hu." }).violations.includes("consultation_too_early"));

console.log("\n--- filler and repeats ---");
const long = turn({ cust: "mujhe 2 mahine se periods irregular hain aur bahut dard hota hai, weight bhi badh gaya hai aur mood bhi kharab rehta hai",
  model: "ji", lastOut: "Ji bataiye, kya problem hai?" });
check("filler after a detailed message is retried with a comfort note", long.violations.includes("filler_reply") && /not alone/.test(noteOf(long)), long);
const rep = turn({ cust: "hmm", lastOut: "Aapko ye kab se ho raha hai?", model: "Aapko ye kab se ho raha hai?" });
check("a verbatim repeat is retried", rep.violations.includes("repeat"), rep.violations);
const modeQ = turn({ cust: "Offline hi ya online hi", model: "ji", lastOut: "Aap apna naam aur kaunsa time aapke liye theek rahega bata dijiye?" });
check("'online ya offline' without the answer is retried", modeQ.violations.includes("consult_mode_unanswered"), modeQ.violations);
const modeA = chat({ cust: "clinic aana padega kya" },
  ["Nahi, consultation puri tarah online hoti hai - doctor aapko aapke chune time par phone call karte hain."]);
check("the right online answer is sent", modeA.route === "send" && modeA.calls === 1, modeA);

console.log("\n--- health report ---");
const REPORT = { found: true, url: "https://storage.googleapis.com/x/HealthScore360Report.pdf?sig=abc" };
const dup = turn({ cust: "I want my detailed HealthScore360 report", report: REPORT, automationReplied: true,
  model: "Ye rahi aapki report:\nhttps://storage.googleapis.com/x/HealthScore360Report.pdf?sig=abc" });
check("no second copy after the automation sent it", dup.violations.includes("report_duplicate"), dup.violations);
const rep2 = chat({ cust: "mujhe meri report chahiye", report: REPORT },
  ["Ji, ye rahi aapki report:\nhttps://storage.googleapis.com/x/HealthScore360Report.pdf?sig=abc"]);
check("the real report link is sent", rep2.route === "send" && /storage\.googleapis/.test(rep2.lastAiReply), rep2);

console.log("\n--- who is the doctor (2026-09-17) ---");
const docInvented = turn({ cust: "Dr kon h", model: "Dr Priyanka Jo sexual Wellness pe expert h" });
check("an invented doctor name is caught", docInvented.violations.includes("doctor_name_invented"), docInvented.violations);
const docOk = turn({ cust: "Dr kon h", model: "Dr. Ujala" });
check("Dr. Ujala is allowed when they ask", !docOk.violations.some(v => /^doctor_name/.test(v)), docOk.violations);
const docUnasked = turn({ cust: "consultation chahiye", model: "Ji, Dr. Ujala aapse baat karengi." });
check("the name is not volunteered", docUnasked.violations.includes("doctor_name_unasked"), docUnasked.violations);
const docPlain = turn({ cust: "doctor se baat karni hai", model: "Ji, hamare doctor se free baat kara deti hu." });
check("saying 'hamare doctor' stays clean", !docPlain.violations.some(v => /^doctor_name/.test(v)), docPlain.violations);

console.log("\n--- who are you / what is your name (2026-09-17) ---");
const aiNo = turn({ cust: "Aap ai ho", model: "No" });
check("a bare 'No' to 'aap ai ho' is retried", aiNo.violations.includes("identity_unanswered"), aiNo.violations);
const nameEmpty = turn({ cust: "Aapka Naam", model: "" });
check("an empty reply to 'aapka naam' is retried", nameEmpty.violations.includes("identity_unanswered"), nameEmpty.violations);
const nameOk = chat({ cust: "Your name please" }, ["Ji, mai Ananya hu, SehatUP se. Bataiye kya help karu?"]);
check("naming herself is sent", nameOk.route === "send" && nameOk.calls === 1, nameOk);

console.log(`
${pass} passed, ${fail} failed
`);
process.exit(fail ? 1 : 0);
