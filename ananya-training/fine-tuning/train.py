"""
QLoRA supervised fine-tune of an instruct model on the Ananya (SehatUP)
Hinglish WhatsApp conversations, with full MLflow experiment tracking.

What gets tracked in MLflow (one run per training invocation):
  * Params      : every value in config.yaml (base model, LoRA, LR, epochs...)
                  + dataset stats (num train/val convos, token-length percentiles).
  * Metrics     : train loss / learning-rate per logging step, eval loss per
                  eval step  (via the HF Trainer's built-in MLflowCallback).
  * Artifacts   : config.yaml, the trained LoRA adapter, and a table of
                  held-out sample generations for eyeballing tone/quality.
  * Model (opt) : a loadable `transformers` flavor logged + registered in the
                  MLflow Model Registry (config.mlflow.register_model: true).

Usage:
    python prepare_split.py
    python train.py --config config.yaml

Then browse results:
    mlflow ui --backend-store-uri ./mlruns      # http://127.0.0.1:5000
"""
import argparse
import os

import yaml


def load_config(path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def flatten(d, parent=""):
    """Flatten nested config into dotted keys for mlflow.log_params."""
    out = {}
    for k, v in d.items():
        key = f"{parent}.{k}" if parent else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def dataset_stats(dataset, tokenizer, prefix):
    """Token-length percentiles of the rendered chat, logged as params."""
    import numpy as np

    lengths = []
    for row in dataset:
        text = tokenizer.apply_chat_template(row["messages"], tokenize=False)
        lengths.append(len(tokenizer(text, add_special_tokens=False)["input_ids"]))
    lengths = np.array(lengths)
    return {
        f"{prefix}.count": int(lengths.size),
        f"{prefix}.tok_mean": round(float(lengths.mean()), 1),
        f"{prefix}.tok_p50": int(np.percentile(lengths, 50)),
        f"{prefix}.tok_p95": int(np.percentile(lengths, 95)),
        f"{prefix}.tok_max": int(lengths.max()),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config.yaml")
    args = ap.parse_args()
    cfg = load_config(args.config)

    # ---- MLflow env wiring (read by the HF Trainer's MLflowCallback) --------
    mlf = cfg["mlflow"]
    os.environ["MLFLOW_TRACKING_URI"] = mlf["tracking_uri"]
    os.environ["MLFLOW_EXPERIMENT_NAME"] = mlf["experiment"]
    os.environ["HF_MLFLOW_LOG_ARTIFACTS"] = "TRUE" if mlf["log_checkpoints"] else "FALSE"

    # Heavy imports after env is set so the callback sees the right config.
    import mlflow
    import torch
    from datasets import load_dataset
    from peft import LoraConfig, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from trl import SFTConfig, SFTTrainer

    mlflow.set_tracking_uri(mlf["tracking_uri"])
    mlflow.set_experiment(mlf["experiment"])

    # ---- Data ---------------------------------------------------------------
    data = load_dataset(
        "json",
        data_files={"train": cfg["data"]["train_file"], "val": cfg["data"]["val_file"]},
    )

    # ---- Tokenizer / base model --------------------------------------------
    tokenizer = AutoTokenizer.from_pretrained(cfg["base_model"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_cfg = None
    if cfg["quantization"]["load_in_4bit"]:
        quant_cfg = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16 if cfg["train"]["bf16"] else torch.float16,
        )

    model = AutoModelForCausalLM.from_pretrained(
        cfg["base_model"],
        quantization_config=quant_cfg,
        torch_dtype=torch.bfloat16 if cfg["train"]["bf16"] else torch.float16,
        device_map="auto",
    )
    model.config.use_cache = False
    if quant_cfg is not None:
        model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(
        r=cfg["lora"]["r"],
        lora_alpha=cfg["lora"]["alpha"],
        lora_dropout=cfg["lora"]["dropout"],
        target_modules=cfg["lora"]["target_modules"],
        bias="none",
        task_type="CAUSAL_LM",
    )

    # ---- SFT config ---------------------------------------------------------
    tr = cfg["train"]
    sft_config = SFTConfig(
        output_dir=cfg["output_dir"],
        num_train_epochs=tr["epochs"],
        per_device_train_batch_size=tr["per_device_batch_size"],
        per_device_eval_batch_size=tr["per_device_batch_size"],
        gradient_accumulation_steps=tr["grad_accum"],
        learning_rate=float(tr["learning_rate"]),
        warmup_ratio=tr["warmup_ratio"],
        weight_decay=tr["weight_decay"],
        lr_scheduler_type=tr["lr_scheduler"],
        logging_steps=tr["logging_steps"],
        eval_strategy="steps",
        eval_steps=tr["eval_steps"],
        save_strategy="steps",
        save_steps=tr["save_steps"],
        save_total_limit=tr["save_total_limit"],
        seed=tr["seed"],
        bf16=tr["bf16"],
        fp16=tr["fp16"],
        max_seq_length=cfg["data"]["max_seq_length"],
        packing=False,
        gradient_checkpointing=True,
        report_to=["mlflow"],       # <-- HF MLflowCallback logs metrics into the active run
        run_name=mlf["run_name"],
    )

    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=data["train"],
        eval_dataset=data["val"],
        peft_config=lora,
        processing_class=tokenizer,
    )

    # ---- One MLflow run wrapping everything ---------------------------------
    # Starting the run here means the Trainer's MLflowCallback attaches to THIS
    # run instead of creating its own, so params + metrics + our artifacts all
    # land in the same record.
    with mlflow.start_run(run_name=mlf["run_name"]) as run:
        mlflow.log_params(flatten(cfg))
        mlflow.log_params(dataset_stats(data["train"], tokenizer, "data.train"))
        mlflow.log_params(dataset_stats(data["val"], tokenizer, "data.val"))
        mlflow.set_tags({"task": "sft", "persona": "ananya", "brand": "sehatup",
                         "method": "qlora" if quant_cfg else "lora"})
        mlflow.log_artifact(args.config)

        trainer.train()

        # Persist + log the adapter.
        trainer.save_model(cfg["output_dir"])
        tokenizer.save_pretrained(cfg["output_dir"])
        mlflow.log_artifacts(cfg["output_dir"], artifact_path="lora_adapter")

        # Held-out sample generations -> logged as a browsable table.
        try:
            log_sample_generations(trainer, tokenizer, data["val"], mlf["n_eval_samples"])
        except Exception as e:  # never fail a run over vibe-check sampling
            print(f"[warn] sample generation skipped: {e}")

        # Optional: log a loadable model + register it in the Model Registry.
        if mlf["register_model"]:
            register_merged_model(cfg, mlf, model, tokenizer)

        print(f"\nDone. MLflow run_id = {run.info.run_id}")
        print(f"Browse: mlflow ui --backend-store-uri {mlf['tracking_uri'].replace('file:', '')}")


def log_sample_generations(trainer, tokenizer, val_ds, n):
    """Generate assistant replies for held-out prompts, log as an MLflow table."""
    import mlflow
    import pandas as pd
    import torch

    model = trainer.model
    model.eval()
    rows = []
    for row in list(val_ds)[:n]:
        msgs = row["messages"]
        # Cut at the last user turn -> prompt; keep the gold reply for comparison.
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
        gen = tokenizer.decode(out[0][inputs.shape[1]:], skip_special_tokens=True)
        rows.append({"user": prompt_msgs[-1]["content"], "generated": gen.strip(), "gold": gold})

    mlflow.log_table(data=pd.DataFrame(rows), artifact_file="eval_samples.json")
    print("Logged held-out sample generations to MLflow (eval_samples.json).")


def register_merged_model(cfg, mlf, model, tokenizer):
    """Merge LoRA into the base and log a loadable transformers flavor + register."""
    import mlflow

    merged = model.merge_and_unload()
    mlflow.transformers.log_model(
        transformers_model={"model": merged, "tokenizer": tokenizer},
        artifact_path="model",
        task="text-generation",
        registered_model_name=mlf["registered_model_name"],
    )
    print(f"Registered model '{mlf['registered_model_name']}' in the MLflow Model Registry.")


if __name__ == "__main__":
    main()
