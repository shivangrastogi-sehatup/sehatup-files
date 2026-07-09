# Auto-cleans WhatsApp message log into Gemini fine-tuning JSONL.
# Chunk 1 = latest 15 days, counting backwards (same numbering as serve.py).
# Respects manual decisions in decisions.json (user's 'remove' clicks always win).
# Usage: python auto_clean.py [chunk_no | all]
import json, re, sys, random
from datetime import timedelta
from pathlib import Path
import pandas as pd

BASE = Path(__file__).parent
MASTER = BASE.parent / "static_messages.csv"
DECISIONS_FILE = BASE / "decisions.json"
OUT_DIR = BASE.parent / "training-data"
OUT_DIR.mkdir(exist_ok=True)

PERSONA = "Ananya"
SYSTEM_INSTRUCTION = (
    "You are Ananya, a friendly and caring health advisor from SehatUP, an Indian wellness brand. "
    "You chat with customers on WhatsApp in natural Hinglish (Roman script). You help them with health "
    "concerns like PCOD, stamina, weight, liver and general wellness, guide them to the free Health Score 360 "
    "check, recommend suitable SehatUP products, and answer order-related queries. You are warm, respectful "
    "(use 'aap'), never pushy, and always try to solve the customer's problem in the chat itself. "
    "Product details, prices, links, and contact numbers are always provided to you in the prompt context. "
    "Never invent them yourself. Placeholders like [PRICE], [PHONE] or [LINK] in past chats mean the real "
    "value comes from the current context."
)

SYSTEM_TYPES = {'SYSTEM_TEXT', 'SYSTEM_WARNING_TEXT', 'NOTE', 'AGENT_TRIGGER_QUESTION'}
NONTEXT_TYPES = {'USER_FILE', 'USER_LOCATION'}
RE_EMOJI_ONLY = re.compile(r'^[\W\d_\s\U0001F000-\U0001FAFF☀-➿]+$')
RE_BOILER = re.compile(r'Thanks for reaching out|message from \*?sehatUP\*? is in queue', re.I)
RE_TRACKING = re.compile(r'shiprocket\.co/tracking|Track Shipment http', re.I)
RE_CALL = re.compile(r'\b(call|phone|awa+z|aavaz|awaj)\b', re.I)
RE_NAG = re.compile(r'payment kab tak|kab tak payment|kab tak buy kar|aap kab tak payment|kindly reply|reply please|waiting for (your|ur) (reply|response)|hello\?+$', re.I)
RE_DECLINE = re.compile(r'nahi lena|nhi lena|nahi chahiye|nhi chahiye|not interested|cancel kar|mat (karo|bhejo)|no need|nahi karna|nhi karna|rehne do|rhne do|abhi nahi|abhi nhi', re.I)
RE_NAMES = re.compile(r'\b(Riya|Rhea|Mohit|Jaya)\b', re.I)
RE_AUTOFLOW = re.compile(
    r"I want (to check )?my (detailed )?(free )?health\s?score"
    r"|I want to Check My Free Health Score"
    r"|We'?re processing your HealthScore"
    r"|Thanks for taking the first step"
    r"|Congrats For Taking First Step"
    r"|Slot choose karein"
    r"|Please choose your preferred date"
    r"|Kindly choose the time slot"
    r"|Thank you so much slot choose karne ke liye"
    r"|Aapko in numbers me se kisi ek se call aayega"
    r"|you will receive the call from"
    r"|Ab aap soch rahe honge aage kya"
    r"|^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{4}$"
    r"|^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)?$"
    r"|^Receive Message$"
    r"|^Tap to confirm$"
    r"|I want to che?ck my\s+(fre\w*|detailed|health|periods)"
    r"|^I want to che?ck my\s*$"
    r"|You will no longer receive messages from us"
    r"|your order is confirmed"
    r"|Please confirm your order so we can ship it",
    re.I)
MARKETING_SOURCES = {'BROADCAST', 'JOURNEY', 'CAMPAIGN'}
RE_PHONE = re.compile(r'(\+?91[\s-]?)?[6-9]\d{9}\b')
RE_PRICE = re.compile(
    r'(₹|\brs\.?\s*|\binr\s*)\s*\d[\d,]*(\.\d+)?'      # ₹1,299 / Rs 999 / INR 499
    r'|\b\d[\d,]{2,7}\s*/-'                             # 999/-
    r'|\b\d[\d,]*\s*(rupay\w*|rupees|rupaye)\b'         # 999 rupaye
    r'|\bprice\s*[-–:]*\s*\d[\d,]*'                     # Price - 1249
    r'|\b\d{3,5}\s*(?=(ka|ki|wali|wala)\s+(aapki|aapko|medication|medicine|kit|course|dawa))', re.I)
RE_DOCTOR = re.compile(r'\bDr\.?\s+[A-Z][a-zA-Z]+(\s+[A-Z][a-zA-Z]+)?')
RE_CUSTNAME = re.compile(r'((?:Good\s+(?:morning|afternoon|evening)|Namaste|Hello|Hi),?\s+)\*?[A-Z][A-Za-z]+\*?\s+[Jj]i\b,?')
RE_GENDER = [(re.compile(p, re.I), r_) for p, r_ in [
    (r'\bkar sakta hu\b', 'kar sakti hu'), (r'\bsakta hu\b', 'sakti hu'),
    (r'\bkar raha hu\b', 'kar rahi hu'), (r'\bkara raha hu\b', 'kara rahi hu'),
    (r'\braha hu\b', 'rahi hu'), (r'\bkarta hu\b', 'karti hu'),
    (r'\bkarunga\b', 'karungi'), (r'\bdunga\b', 'dungi'), (r'\bkar dunga\b', 'kar dungi'),
]]
RE_ADDRESS = re.compile(r'\b\d{6}\b')
ADDRESS_WORDS = re.compile(r'address|post office|pin ?code|district|nagar|colony|road|\brd\b|street|gali', re.I)
RE_EMAIL = re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.]+\b')
RE_URL = re.compile(r'https?://\S+')

POLITE_CLOSINGS = [
    "Koi baat nahi 😊 Jab bhi aapko apni sehat se judi koi bhi madad chahiye ho, hum yahin hain. Apna khayal rakhiye!",
    "Bilkul theek hai 😊 Aap jab chahein humein message kar sakte hain. SehatUP hamesha aapki sehat ke liye yahin hai. Dhanyawad!",
    "Thik hai, koi pressure nahi 😊 Future mein koi bhi health query ho to zaroor batayein. Take care!",
]

stats_keys = ['prices_scrubbed','doctors_scrubbed','custnames_scrubbed','gender_fixed',
              'address_removed','dup_dropped','convs_in','convs_kept','convs_dropped_marketing','convs_dropped_too_small',
              'msgs_in','msgs_kept','manual_removed','system_removed','failed_removed','boiler_removed',
              'nontext_removed','short_removed','callpush_removed','nag_removed','tracking_removed','autoflow_removed',
              'names_replaced','phones_scrubbed','links_scrubbed','emails_scrubbed','closings_added']

def template_text(raw):
    s = str(raw).strip()
    if s.lower() == 'nan': return ''
    if s.startswith('{'):
        try:
            j = json.loads(s)
            if isinstance(j, dict) and 'text' in j: return j['text']
        except Exception: pass
    return s

def scrub(text, st):
    n = len(RE_NAMES.findall(text))
    if n: st['names_replaced'] += n; text = RE_NAMES.sub(PERSONA, text)
    n = len(RE_PHONE.findall(text))
    if n: st['phones_scrubbed'] += n; text = RE_PHONE.sub('[PHONE]', text)
    n = len(RE_PRICE.findall(text))
    if n: st['prices_scrubbed'] += n; text = RE_PRICE.sub('[PRICE]', text)
    n = len(RE_DOCTOR.findall(text))
    if n: st['doctors_scrubbed'] += n; text = RE_DOCTOR.sub('[DOCTOR]', text)
    n = len(RE_CUSTNAME.findall(text))
    if n: st['custnames_scrubbed'] += n; text = RE_CUSTNAME.sub(r'\1ji', text)
    n = len(RE_EMAIL.findall(text))
    if n: st['emails_scrubbed'] += n; text = RE_EMAIL.sub('[EMAIL]', text)
    def url_sub(m):
        u = m.group(0)
        if 'sehatup.com' in u: return u.split('?')[0]
        st['links_scrubbed'] += 1
        return '[LINK]'
    text = RE_URL.sub(url_sub, text)
    return text

def clean_conversation(msgs, decisions, st):
    """msgs: list of row dicts sorted by time. Returns list of (role, text) turns or None."""
    kept = []
    for r in msgs:
        st['msgs_in'] += 1
        mid = r['Message ID']
        text = template_text(r['Message Content'])
        t = text.strip()
        if decisions.get(mid) == 'remove': st['manual_removed'] += 1; continue
        if r['Delivery Status'] == 'FAILED': st['failed_removed'] += 1; continue
        if r['Message Type'] in SYSTEM_TYPES or t.lower() == 'takeover': st['system_removed'] += 1; continue
        if r['Message Type'] in NONTEXT_TYPES: st['nontext_removed'] += 1; continue
        letters = re.sub(r'[^A-Za-zऀ-ॿ]', '', t)
        if (letters == '' and not re.fullmatch(r'\d{2,4}', t)) or len(letters) == 1:
            # no real words (emoji/punct-only) or single stray letter; bare 2-4 digit
            # numbers stay (weight/age answers)
            st['short_removed'] += 1; continue
        if RE_BOILER.search(t): st['boiler_removed'] += 1; continue
        if RE_TRACKING.search(t): st['tracking_removed'] += 1; continue
        if RE_AUTOFLOW.search(t): st['autoflow_removed'] += 1; continue
        if r['Direction'] == 'Outbound' and r['Automation Source Type'] in MARKETING_SOURCES:
            st['autoflow_removed'] += 1; continue
        if RE_CALL.search(t) and len(t) < 140: st['callpush_removed'] += 1; continue
        if r['Direction'] == 'Outbound' and RE_NAG.search(t) and len(t) < 90: st['nag_removed'] += 1; continue
        role = 'user' if r['Direction'] == 'Inbound' else 'model'
        text_clean = scrub(t, st)
        if role == 'model':
            if RE_ADDRESS.search(text_clean) and ADDRESS_WORDS.search(text_clean):
                st['address_removed'] += 1; continue
            if text_clean.strip().lower() in ('ok', 'okay', 'yes', 'ji', 'haan', 'hmm'):
                st['short_removed'] += 1; continue
            for rex, rep in RE_GENDER:
                text_clean, k = rex.subn(rep, text_clean)
                st['gender_fixed'] += k
        kept.append((role, text_clean))
        st['msgs_kept'] += 1

    # conversation must start with user: move leading model msgs (e.g. Ananya's
    # greeting after chatbot takeover) down to merge with the first model reply
    leading = []
    while kept and kept[0][0] == 'model': leading.append(kept.pop(0)[1])
    if leading:
        for i, (role, text) in enumerate(kept):
            if role == 'model':
                kept[i] = ('model', '\n'.join(leading) + '\n' + text)
                break
    # merge consecutive same-role messages
    turns = []
    for role, text in kept:
        if turns and turns[-1][0] == role: turns[-1][1] += '\n' + text
        else: turns.append([role, text])
    # ending: must end on model turn
    if turns and turns[-1][0] == 'user':
        if RE_DECLINE.search(turns[-1][1]):
            turns.append(['model', random.choice(POLITE_CLOSINGS)])
            st['closings_added'] += 1
        else:
            turns.pop()  # drop dangling user question with no answer
            while turns and turns[-1][0] == 'user': turns.pop()
    if len(turns) < 2:  # need at least 1 real exchange (user -> model)
        return None
    return turns

def process_chunk(df, END, n, decisions, seen_hashes):
    hi = END - timedelta(days=15 * (n - 1))
    lo = hi - timedelta(days=15)
    # a conversation belongs to the chunk of its FIRST message (never split across chunks)
    part = df[df['conv_start'].ge(lo) & df['conv_start'].lt(hi)]
    st = {k: 0 for k in stats_keys}
    examples = []
    metas = []
    for cid, conv in part.groupby('Conversation ID', sort=False):
        st['convs_in'] += 1
        conv = conv.sort_values('dt')
        if (conv['Direction'] == 'Inbound').sum() == 0:
            st['convs_dropped_marketing'] += 1
            st['msgs_in'] += len(conv)
            continue
        turns = clean_conversation(conv.to_dict('records'), decisions, st)
        if not turns:
            st['convs_dropped_too_small'] += 1
            continue
        h = hash(tuple(t for _, t in turns))
        if h in seen_hashes:
            st['dup_dropped'] += 1
            continue
        seen_hashes.add(h)
        st['convs_kept'] += 1
        examples.append({
            "systemInstruction": {"role": "system", "parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{"role": r, "parts": [{"text": t}]} for r, t in turns],
        })
        metas.append({'phone': str(conv.iloc[0]['Phone']), 'conv': cid,
                      'date': conv.iloc[0]['dt'].date().isoformat()})
    tag = f"chunk-{n:02d}_{lo.date()}_{(hi - timedelta(days=1)).date()}"
    out = OUT_DIR / f"{tag}.jsonl"
    with open(out, 'w', encoding='utf-8') as f:
        for ex in examples:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    (OUT_DIR / f"{tag}.meta.json").write_text(json.dumps(metas, ensure_ascii=False), encoding='utf-8')
    report = [f"# {tag}", "",
              f"- Conversations: {st['convs_in']} in -> **{st['convs_kept']} kept** "
              f"(marketing-only dropped: {st['convs_dropped_marketing']}, too small/empty after cleaning: {st['convs_dropped_too_small']})",
              f"- Messages: {st['msgs_in']} in -> {st['msgs_kept']} kept",
              f"- Removed: manual(aapke clicks) {st['manual_removed']}, system {st['system_removed']}, failed {st['failed_removed']}, "
              f"boilerplate {st['boiler_removed']}, short/emoji {st['short_removed']}, call-push {st['callpush_removed']}, "
              f"payment-nag {st['nag_removed']}, tracking {st['tracking_removed']}, auto-flow(healthscore/slot templates) {st['autoflow_removed']}, non-text {st['nontext_removed']}",
              f"- Alterations: names->'{PERSONA}' {st['names_replaced']}, phones scrubbed {st['phones_scrubbed']}, "
              f"links scrubbed {st['links_scrubbed']}, emails {st['emails_scrubbed']}, polite closings added {st['closings_added']}", ""]
    (OUT_DIR / f"{tag}_report.md").write_text('\n'.join(report), encoding='utf-8')
    print(f"{tag}: {st['convs_kept']} training examples ({st['msgs_kept']} msgs)")
    return st

if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else 'all'
    random.seed(42)
    print("loading master csv...")
    df = pd.read_csv(MASTER)
    df['dt'] = pd.to_datetime(df['Date & Time (UTC)'], format='mixed', utc=True)
    df['conv_start'] = df.groupby('Conversation ID')['dt'].transform('min')
    END = df['dt'].max() + timedelta(seconds=1)
    TOTAL = -(-((END - df['dt'].min()).days + 1) // 15)
    decisions = json.loads(DECISIONS_FILE.read_text(encoding='utf-8')) if DECISIONS_FILE.exists() else {}
    chunks = range(1, TOTAL + 1) if arg == 'all' else [int(arg)]
    total = {k: 0 for k in stats_keys}
    seen_hashes = set()
    for n in chunks:
        st = process_chunk(df, END, n, decisions, seen_hashes)
        for k in stats_keys: total[k] += st[k]
    print("\n=== TOTAL ===")
    for k in stats_keys: print(f"{k}: {total[k]}")
