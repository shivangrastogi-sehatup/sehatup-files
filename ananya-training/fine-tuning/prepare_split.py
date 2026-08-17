"""
Split training_ready.jsonl (ChatML {"messages": [...]}) into a train/val set.

Usage:
    python prepare_split.py                       # 90/10 split, seed 42
    python prepare_split.py --val-frac 0.15 --seed 7
"""
import argparse
import json
import os
import random


def load_jsonl(path):
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_jsonl(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="training_ready.jsonl")
    ap.add_argument("--out-dir", default="data")
    ap.add_argument("--val-frac", type=float, default=0.10)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rows = load_jsonl(args.input)
    random.Random(args.seed).shuffle(rows)

    n_val = max(1, round(len(rows) * args.val_frac))
    val, train = rows[:n_val], rows[n_val:]

    write_jsonl(os.path.join(args.out_dir, "train.jsonl"), train)
    write_jsonl(os.path.join(args.out_dir, "val.jsonl"), val)

    print(f"Total {len(rows)} conversations -> train {len(train)} / val {len(val)}")
    print(f"Wrote {args.out_dir}/train.jsonl and {args.out_dir}/val.jsonl")


if __name__ == "__main__":
    main()
