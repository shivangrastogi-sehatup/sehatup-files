# Builds full-month training chunks from the raw monthly exports in messages/.
# Reuses auto_clean.py's cleaning + PII-scrubbing so the output matches the
# existing chunks exactly. One chunk per month (not the 15-day windows).
#   python build_month_chunks.py
# Writes chunk-NN_<from>_<to>.jsonl + .meta.json + _report.md into ../raw/.
import json, random
from pathlib import Path
import pandas as pd
import auto_clean as ac

BASE = Path(__file__).parent
MSG_DIR = BASE / "messages"
OUT_DIR = BASE.parent / "raw"
OUT_DIR.mkdir(exist_ok=True)
DECISIONS_FILE = BASE / "decisions.json"

# (csv file, chunk number). Newest first so cross-month de-dup keeps the more
# recent copy (matches auto_clean's newest-first ordering). Date labels are
# derived from each file's actual min/max message date inside build().
#
# Chunk numbers 101-113 = the "new monthly" section (2025-08 .. 2026-08 full-year
# export). They deliberately sit above the legacy chunk-00..25 block so they never
# collide and render as their own section in the review viewer.
# NOTE: legacy chunk-01 (2026-07-01_2026-07-20) and chunk-02 (2026-06-01_2026-06-30)
# were built earlier from an older PARTIAL export; they are frozen/reviewed and are
# NOT regenerated here.
MONTHS = [
    ("message_export_GgbHGAprcvQx26qKL_c_2026-08.csv", 101),
    ("message_export_GgbHGAprcvQx26qKL_c_2026-07.csv", 102),
    ("message_export_GgbHGAprcvQx26qKL_c_2026-06.csv", 103),
    ("message_export_GgbHGAprcvQx26qKL_c_2026-05.csv", 104),
    ("message_export_GgbHGAprcvQx26qKL_c_2026-04.csv", 105),
    ("message_export_GgbHGAprcvQx26qKL_c_2026-03.csv", 106),
    ("message_export_GgbHGAprcvQx26qKL_c_2026-02.csv", 107),
    ("message_export_GgbHGAprcvQx26qKL_c_2026-01.csv", 108),
    ("message_export_GgbHGAprcvQx26qKL_c_2025-12.csv", 109),
    ("message_export_GgbHGAprcvQx26qKL_c_2025-11.csv", 110),
    ("message_export_GgbHGAprcvQx26qKL_c_2025-10.csv", 111),
    ("message_export_GgbHGAprcvQx26qKL_c_2025-09.csv", 112),
    ("message_export_GgbHGAprcvQx26qKL_c_2025-08.csv", 113),
]


def build(csv_name, n, decisions, seen):
    df = pd.read_csv(MSG_DIR / csv_name)
    df['dt'] = pd.to_datetime(df['Date & Time (UTC)'], format='mixed', utc=True)
    # Labels reflect the real first/last message date in this file (handles the
    # partial edge months at the export boundary, e.g. 2025-08-17.. / ..2026-08-17).
    dfrom = df['dt'].min().date().isoformat()
    dto = df['dt'].max().date().isoformat()

    st = {k: 0 for k in ac.stats_keys}
    examples, metas = [], []
    # a conversation = one training example; assemble it from its messages in time order
    for cid, conv in df.groupby('Conversation ID', sort=False):
        st['convs_in'] += 1
        conv = conv.sort_values('dt')
        if (conv['Direction'] == 'Inbound').sum() == 0:
            st['convs_dropped_marketing'] += 1
            st['msgs_in'] += len(conv)
            continue
        turns = ac.clean_conversation(conv.to_dict('records'), decisions, st)
        if not turns:
            st['convs_dropped_too_small'] += 1
            continue
        h = hash(tuple(t for _, t in turns))
        if h in seen:
            st['dup_dropped'] += 1
            continue
        seen.add(h)
        st['convs_kept'] += 1
        examples.append({
            "systemInstruction": {"role": "system", "parts": [{"text": ac.SYSTEM_INSTRUCTION}]},
            "contents": [{"role": r, "parts": [{"text": t}]} for r, t in turns],
        })
        metas.append({'phone': str(conv.iloc[0]['Phone']), 'conv': cid,
                      'date': conv.iloc[0]['dt'].date().isoformat()})

    tag = f"chunk-{n:02d}_{dfrom}_{dto}"
    body = ''.join(json.dumps(ex, ensure_ascii=False) + '\n' for ex in examples)
    (OUT_DIR / f"{tag}.jsonl").write_text(body, encoding='utf-8')
    (OUT_DIR / f"{tag}.meta.json").write_text(json.dumps(metas, ensure_ascii=False), encoding='utf-8')

    report = [f"# {tag}", "",
              f"- Conversations: {st['convs_in']} in -> **{st['convs_kept']} kept** "
              f"(marketing-only dropped: {st['convs_dropped_marketing']}, too small/empty after cleaning: {st['convs_dropped_too_small']})",
              f"- Messages: {st['msgs_in']} in -> {st['msgs_kept']} kept",
              f"- Removed: manual(aapke clicks) {st['manual_removed']}, system {st['system_removed']}, failed {st['failed_removed']}, "
              f"boilerplate {st['boiler_removed']}, short/emoji {st['short_removed']}, call-push {st['callpush_removed']}, "
              f"payment-nag {st['nag_removed']}, tracking {st['tracking_removed']}, auto-flow(healthscore/slot templates) {st['autoflow_removed']}, non-text {st['nontext_removed']}",
              f"- Alterations: names->'{ac.PERSONA}' {st['names_replaced']}, phones scrubbed {st['phones_scrubbed']}, "
              f"links scrubbed {st['links_scrubbed']}, emails {st['emails_scrubbed']}, polite closings added {st['closings_added']}", ""]
    (OUT_DIR / f"{tag}_report.md").write_text('\n'.join(report), encoding='utf-8')
    print(f"{tag}: {st['convs_kept']} training examples ({st['msgs_kept']} msgs) from {csv_name}")
    return st


if __name__ == '__main__':
    random.seed(42)  # deterministic polite-closing choices
    decisions = json.loads(DECISIONS_FILE.read_text(encoding='utf-8')) if DECISIONS_FILE.exists() else {}
    print(f"loaded {len(decisions)} manual decisions")
    seen = set()
    for csv_name, n in MONTHS:
        build(csv_name, n, decisions, seen)
