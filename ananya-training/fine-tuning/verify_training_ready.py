import json

with open('training_ready.jsonl', 'r', encoding='utf-8') as f:
    first_line = f.readline()
    sample = json.loads(first_line)
    for msg in sample['messages']:
        print(f"[{msg['role']}]: {msg['content'][:80]}...")
