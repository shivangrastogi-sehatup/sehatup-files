"""
Load a trained Ananya LoRA adapter and chat with it from held-out prompts,
so you can eyeball tone/quality after training. Optionally logs the results
into an existing MLflow run.

Usage:
    python eval_generate.py                                  # uses config.yaml paths
    python eval_generate.py --n 10
    python eval_generate.py --run-id <mlflow_run_id>         # also log table to that run
"""
import argparse
import json

import torch
import yaml
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def load_jsonl(path):
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--run-id", default=None, help="log generations into this MLflow run")
    args = ap.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    tokenizer = AutoTokenizer.from_pretrained(cfg["output_dir"])
    base = AutoModelForCausalLM.from_pretrained(
        cfg["base_model"], torch_dtype=torch.bfloat16, device_map="auto"
    )
    model = PeftModel.from_pretrained(base, cfg["output_dir"])
    model.eval()

    val = load_jsonl(cfg["data"]["val_file"])[: args.n]
    rows = []
    for row in val:
        msgs = row["messages"]
        last_user = max(i for i, m in enumerate(msgs) if m["role"] == "user")
        prompt_msgs = msgs[: last_user + 1]
        gold = next((m["content"] for m in msgs[last_user + 1:] if m["role"] == "assistant"), "")

        inputs = tokenizer.apply_chat_template(
            prompt_msgs, add_generation_prompt=True, return_tensors="pt"
        ).to(model.device)
        with torch.no_grad():
            out = model.generate(inputs, max_new_tokens=160, do_sample=True,
                                 temperature=0.7, top_p=0.9,
                                 pad_token_id=tokenizer.pad_token_id)
        gen = tokenizer.decode(out[0][inputs.shape[1]:], skip_special_tokens=True).strip()
        rows.append({"user": prompt_msgs[-1]["content"], "generated": gen, "gold": gold})

        print("\n" + "=" * 70)
        print(f"USER : {prompt_msgs[-1]['content']}")
        print(f"ANANYA: {gen}")
        print(f"GOLD : {gold}")

    if args.run_id:
        import mlflow
        import pandas as pd

        mlflow.set_tracking_uri(cfg["mlflow"]["tracking_uri"])
        with mlflow.start_run(run_id=args.run_id):
            mlflow.log_table(data=pd.DataFrame(rows), artifact_file="eval_samples_manual.json")
        print(f"\nLogged {len(rows)} generations to MLflow run {args.run_id}")


if __name__ == "__main__":
    main()
