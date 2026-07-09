# Review server for message cleaning.
# Run: python serve.py   → open http://localhost:8765
# - Serves review.html and 15-day chunks (chunk 1 = LATEST 15 days, counting backwards)
# - Every toggle on the page auto-syncs here; decisions saved in decisions.json
# - static_messages_cleaned.csv is regenerated automatically (original CSV never touched)
import json, re, threading
from datetime import timedelta
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import pandas as pd

BASE = Path(__file__).parent
MASTER = BASE.parent / "static_messages.csv"
CLEANED = BASE.parent / "static_messages_cleaned.csv"
DECISIONS_FILE = BASE / "decisions.json"
TRAIN_DIR = BASE.parent / "training-data"
EXCLUSIONS_FILE = BASE / "training-exclusions.json"
PORT = 8765

print("loading master csv...")
df = pd.read_csv(MASTER)
df['dt'] = pd.to_datetime(df['Date & Time (UTC)'], format='mixed', utc=True)
df = df.sort_values('dt')
END = df['dt'].max() + timedelta(seconds=1)
START = df['dt'].min()
TOTAL_CHUNKS = -(-((END - START).days + 1) // 15)
print(f"{len(df)} rows, {START.date()} -> {END.date()}, {TOTAL_CHUNKS} chunks (chunk 1 = latest)")

decisions = {}
if DECISIONS_FILE.exists():
    decisions = json.loads(DECISIONS_FILE.read_text(encoding='utf-8'))

# ---- suggestion rules ----
SYSTEM_TYPES = {'SYSTEM_TEXT', 'SYSTEM_WARNING_TEXT', 'NOTE', 'AGENT_TRIGGER_QUESTION'}
NONTEXT_TYPES = {'USER_FILE', 'USER_LOCATION'}
BOILERPLATE = ["Thanks for reaching out", "message from *sehatUP* is in queue"]
EMOJI_ONLY = re.compile(r'^[\W\d_\s\U0001F000-\U0001FAFF☀-➿]+$')

def template_text(raw):
    s = str(raw).strip()
    if s.startswith('{'):
        try:
            j = json.loads(s)
            if isinstance(j, dict) and 'text' in j:
                return j['text']
        except Exception:
            pass
    return s

def suggest(row, text):
    t = text.strip()
    if row['Delivery Status'] == 'FAILED': return 'failed-delivery'
    if row['Message Type'] in SYSTEM_TYPES or t.lower() == 'takeover': return 'system-internal'
    if row['Message Type'] in NONTEXT_TYPES: return 'non-text'
    if t == '': return 'empty'
    if len(t) <= 2 or EMOJI_ONLY.match(t): return 'too-short'
    for snip in BOILERPLATE:
        if snip in t: return 'chatbot-boilerplate'
    if 'shiprocket.co/tracking' in t or 'Track Shipment http' in t: return 'tracking-auto'
    if row['Message Type'] == 'WA_TEMPLATE' and row['Automation Source Type'] in ('BROADCAST', 'JOURNEY', 'CAMPAIGN'):
        return 'marketing-template'
    return None

def build_chunk(n):
    hi = END - timedelta(days=15 * (n - 1))
    lo = hi - timedelta(days=15)
    part = df[(df['dt'] >= lo) & (df['dt'] < hi)]
    convs = {}
    for _, r in part.iterrows():
        cid = r['Conversation ID'] if pd.notna(r['Conversation ID']) else 'no-conv-' + str(r['Phone'])
        text = template_text(r['Message Content'] if pd.notna(r['Message Content']) else '')
        msg = {
            'id': r['Message ID'], 'ts': r['dt'].isoformat(),
            'dir': r['Direction'], 'type': r['Message Type'],
            'source': r['Automation Source Type'] if pd.notna(r['Automation Source Type']) else '',
            'status': r['Delivery Status'] if pd.notna(r['Delivery Status']) else '',
            'text': text, 'suggest': suggest(r, text),
        }
        convs.setdefault(cid, {'id': cid, 'phone': str(r['Phone']), 'messages': []})
        convs[cid]['messages'].append(msg)
    conv_list = sorted(convs.values(), key=lambda c: c['messages'][0]['ts'], reverse=True)
    return {'chunk': n, 'totalChunks': TOTAL_CHUNKS,
            'from': lo.date().isoformat(), 'to': (hi - timedelta(days=1)).date().isoformat(),
            'conversations': conv_list}

# ---- cleaned csv regeneration (debounced) ----
_regen_timer = None
_lock = threading.Lock()

def regen_cleaned():
    remove_ids = {k for k, v in decisions.items() if v == 'remove'}
    out = df[~df['Message ID'].isin(remove_ids)].drop(columns=['dt'])
    out.to_csv(CLEANED, index=False)
    print(f"cleaned csv written: kept {len(out)} / {len(df)} rows (removed {len(df) - len(out)})")

def schedule_regen(delay=1.5):
    global _regen_timer
    with _lock:
        if _regen_timer: _regen_timer.cancel()
        _regen_timer = threading.Timer(delay, regen_cleaned)
        _regen_timer.daemon = True
        _regen_timer.start()

def save_decisions():
    DECISIONS_FILE.write_text(json.dumps(decisions), encoding='utf-8')

# ---- training-data viewer ----
exclusions = {}
if EXCLUSIONS_FILE.exists():
    exclusions = json.loads(EXCLUSIONS_FILE.read_text(encoding='utf-8'))

REVIEWS_FILE = BASE / "training-reviews.json"
reviews = {}   # {file: {str(idx): [{"name":..,"color":..}, ...]}}
if REVIEWS_FILE.exists():
    reviews = json.loads(REVIEWS_FILE.read_text(encoding='utf-8'))

def train_files():
    files = sorted(TRAIN_DIR.glob("chunk-*.jsonl"))
    out = []
    for f in files:
        m = re.match(r'chunk-(\d+)_(.+)_(.+)\.jsonl', f.name)
        if not m: continue
        count = sum(1 for line in f.open(encoding='utf-8') if line.strip())
        out.append({'file': f.name, 'chunk': int(m.group(1)), 'from': m.group(2), 'to': m.group(3), 'count': count})
    return sorted(out, key=lambda x: x['chunk'])

def load_train_chunk(n):
    for meta in train_files():
        if meta['chunk'] == n:
            f = TRAIN_DIR / meta['file']
            metafile = TRAIN_DIR / (f.stem + '.meta.json')
            metas = json.loads(metafile.read_text(encoding='utf-8')) if metafile.exists() else []
            examples = []
            for i, line in enumerate(f.open(encoding='utf-8')):
                if not line.strip(): continue
                ex = json.loads(line)
                m = metas[i] if i < len(metas) else {}
                examples.append({'idx': i, 'phone': m.get('phone', ''), 'date': m.get('date', ''),
                    'synthetic': m.get('synthetic', False),
                    'turns': [{'role': c['role'], 'text': c['parts'][0]['text']} for c in ex['contents']]})
            meta['examples'] = examples
            meta['excluded'] = exclusions.get(meta['file'], [])
            meta['reviews'] = reviews.get(meta['file'], {})
            meta['system'] = json.loads(next(iter(f.open(encoding='utf-8'))))['systemInstruction']['parts'][0]['text'] if examples else ''
            return meta
    return None

class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.path = self.path.split('?')[0]
        if self.path in ('/', '/review.html'):
            body = (BASE / 'review.html').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith('/chunk/'):
            n = max(1, min(TOTAL_CHUNKS, int(self.path.split('/')[-1])))
            self._json(build_chunk(n))
        elif self.path == '/decisions':
            self._json(decisions)
        elif self.path in ('/train', '/trainview.html'):
            body = (BASE / 'trainview.html').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == '/training/list':
            self._json(train_files())
        elif self.path.startswith('/training/'):
            data = load_train_chunk(int(self.path.split('/')[-1]))
            if data: self._json(data)
            else: self.send_error(404)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/decisions':
            length = int(self.headers.get('Content-Length', 0))
            updates = json.loads(self.rfile.read(length).decode('utf-8'))
            decisions.update(updates)
            save_decisions()
            schedule_regen()
            removed = sum(1 for v in decisions.values() if v == 'remove')
            self._json({'ok': True, 'decided': len(decisions), 'removed': removed})
        elif self.path == '/training/exclude':
            length = int(self.headers.get('Content-Length', 0))
            req = json.loads(self.rfile.read(length).decode('utf-8'))
            lst = set(exclusions.get(req['file'], []))
            if req['excluded']: lst.add(req['idx'])
            else: lst.discard(req['idx'])
            exclusions[req['file']] = sorted(lst)
            EXCLUSIONS_FILE.write_text(json.dumps(exclusions), encoding='utf-8')
            self._json({'ok': True, 'excludedCount': len(lst)})
        elif self.path == '/training/review':
            length = int(self.headers.get('Content-Length', 0))
            req = json.loads(self.rfile.read(length).decode('utf-8'))
            fr = reviews.setdefault(req['file'], {})
            lst = [r for r in fr.get(str(req['idx']), []) if r['name'] != req['name']]
            if req['reviewed']:
                lst.append({'name': req['name'], 'color': req['color']})
            fr[str(req['idx'])] = lst
            REVIEWS_FILE.write_text(json.dumps(reviews, ensure_ascii=False), encoding='utf-8')
            self._json({'ok': True, 'reviewers': lst})
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        pass

if __name__ == '__main__':
    regen_cleaned()
    print(f"serving on http://localhost:{PORT}")
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
