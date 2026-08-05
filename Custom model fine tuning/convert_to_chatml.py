import json


def convert_gemini_to_chatml(input_file, output_file):
    converted = []
    skipped = 0

    with open(input_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                system_text = row['systemInstruction']['parts'][0]['text']
                messages = [{"role": "system", "content": system_text}]

                for turn in row['contents']:
                    # ONLY change: "model" -> "assistant". "user" stays "user".
                    role = "assistant" if turn['role'] == "model" else "user"
                    text = turn['parts'][0]['text']
                    messages.append({"role": role, "content": text})

                converted.append({"messages": messages})
            except (KeyError, json.JSONDecodeError) as e:
                skipped += 1
                print(f"Skipped line {line_num}: {e}")

    with open(output_file, 'w', encoding='utf-8') as f:
        for row in converted:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')

    print(f"\nConverted {len(converted)} conversations, skipped {skipped}")


convert_gemini_to_chatml('sehatup_raw.jsonl', 'training_ready.jsonl')
