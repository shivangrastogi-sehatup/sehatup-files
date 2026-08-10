# Ananya (SehatUP) — Hinglish LoRA fine-tune with MLflow tracking

Fine-tunes a small instruct model to sound like **Ananya**, the SehatUP WhatsApp
health advisor, from ~144 real Hinglish conversations — with every training run
tracked in **MLflow**.

## Pipeline

```
sehatup_raw.jsonl            (Gemini format, your raw export)
      │  convert_to_chatml.py
      ▼
training_ready.jsonl         (ChatML  {"messages":[system,user,assistant,...]})
      │  prepare_split.py
      ▼
data/train.jsonl + data/val.jsonl
      │  train.py   ──────────────►  MLflow  (params, loss curves, adapter, samples)
      ▼
outputs/ananya-lora          (LoRA adapter)
      │  eval_generate.py
      ▼
vibe-check generations
```

## Setup

```bash
cd "Custom model fine tuning"
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
# Install torch matched to YOUR CUDA first, e.g. CUDA 12.1:
pip install torch --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

> **GPU note.** QLoRA (`quantization.load_in_4bit: true`) needs an NVIDIA GPU with
> `bitsandbytes`. No GPU locally? Run this folder on **Google Colab** (free T4 works
> for a 3B model — set `bf16:false`, `fp16:true` in `config.yaml`).

## Run

```bash
python prepare_split.py                 # 90/10 train/val split
python train.py --config config.yaml    # trains + logs everything to MLflow
mlflow ui --backend-store-uri ./mlruns  # open http://127.0.0.1:5000
python eval_generate.py --n 8           # chat with the trained adapter
```

## What MLflow captures per run

| Kind | Logged |
|------|--------|
| **Params** | full `config.yaml` (base model, LoRA r/alpha, LR, epochs…) + dataset token-length stats |
| **Metrics** | `train/loss`, `learning_rate` per step; `eval/loss` per eval step |
| **Artifacts** | `config.yaml`, the LoRA adapter (`lora_adapter/`), `eval_samples.json` (held-out generations vs gold) |
| **Tags** | `task=sft`, `persona=ananya`, `method=qlora` |
| **Model** *(optional)* | merged, loadable `transformers` model registered as `ananya-hinglish` — set `mlflow.register_model: true` |

Because every hyperparameter lives in `config.yaml` and is logged, comparing two
runs = changing one value, re-running `train.py`, and diffing the runs in the
MLflow UI. Loss curves, eval loss, and sample outputs sit side by side.

## Knobs you'll actually touch (`config.yaml`)

- `base_model` — swap to `Qwen/Qwen2.5-1.5B-Instruct` (lighter) or a Llama-3.2 base.
- `train.epochs` / `train.learning_rate` — the two you'll sweep most.
- `mlflow.tracking_uri` — `file:./mlruns` (local) or `http://<server>:5000` (shared/team).
- `mlflow.register_model` — flip to `true` once a run is good, to promote it to the registry.

## Notes / possible next steps

- Loss is computed over the **full** conversation (standard SFT). Assistant-only
  loss masking is a reasonable future upgrade for a small persona dataset.
- 144 convos is small — watch `eval/loss` for overfitting; 2–3 epochs is usually right.
- To go multi-run automatically (a sweep over LR/epochs), wrap `train.py` in a loop
  that overrides config values — each iteration is already its own MLflow run.
```
