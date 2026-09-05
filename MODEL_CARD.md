# Flux local positive-v2

Frozen wallpaper prompt-expansion adapter merged into Qwen/Qwen3-4B-Instruct-2507 (revision `cdbee75f17c01a7cc42f958dc650907174af0554`), converted with llama.cpp b10819 and quantized to GGUF Q4_K_M. This is a text model, not an image model. No further training is part of this release.

## Training and provenance

119 cleaned Imageory prompt sources after one exact duplicate was excluded from 120 collected records. Related scene groups were assigned to train/validation/test before augmentation (85/17/17 sources, seed 42). Three locally drafted, Codex-reviewed short inputs per target and 24 authored constraint examples were used. Positive-v2 removes unnecessary negative clauses and weights those same authored examples three times; 327 training rows do not represent 327 independent sources. Source corpus and private review records are not distributed.

Attention-projection LoRA rank 8, alpha 16, dropout 0.05; NF4 double quantization with BF16 computation; sequence length 1024; batch 1, accumulation 16; learning rate 1e-5 for two epochs; cosine schedule, 10% warmup; gradient checkpointing; assistant response loss only. Checkpoint 42 was selected by validation loss.

## Evaluation and limitations

On 30 fresh ideas, the adapter received 36.7% blind editorial preference credit against the instructed base model, counting ties as half. The target was 60%. One dedicated constraint case added red to a black-and-white scene. Final format checks passed for all 30, and no unexplained complete training-prompt copying was flagged. Reviews were performed by Codex, not an independent human study. This model did **not** pass its quality-promotion criteria; the maintainer chose to release this frozen version as the local default. It may over-elaborate, drift from subjects, mix styles or violate constraints. No image-quality superiority is claimed.

Ten warm Windows RTX 5070 Laptop CLI requests had median 1.55 seconds and peak total GPU memory 3949 MiB. Initial CUDA compilation can take minutes. CPU and macOS performance are unmeasured. The separate SDXL experiment was prepared but not run. DEAPI remains the image renderer.

## Distribution

Two GGUF shards, approximately 2.50 GB combined, are available under the `model-positive-v2` GitHub release. Keep both shards together. `flux local install` verifies their embedded SHA-256 hashes and downloads the official pinned runtime. Models and runtime are stored under FluxGen's configuration directory in `local/positive-v2`. Downloads need internet; prompt inference uses loopback only and no provider key. The runtime stays in the foreground until stopped.

The base model is Apache-2.0 licensed; the modified weights are distributed under Apache-2.0 with the base license and a modification notice in the model release. llama.cpp runtime is obtained from its official release and retains its included notices. FluxGen CLI source remains MIT licensed.
