<div align="center">

# Eva

### A journaling companion that *remembers* — and never leaves your laptop.

**Fully offline. Private by construction. Runs a 4B-parameter LLM, speech-to-text, and text-to-speech on an 8 GB MacBook Air.**

`Tauri (Rust)` · `React + Vite` · `Python FastAPI` · `llama.cpp / Gemma 4 E2B` · `ChromaDB` · `SQLite` · `faster-whisper` · `Kokoro TTS`

</div>

---

## Why Eva exists

The AI that understands you best is the one you can trust the least with what it learns. Every "AI companion" worth talking to ships your most private thoughts — your moods, your relationships, your regrets — to someone else's server, where they are logged, mined, and retained.

Eva refuses that trade. It is a warm, listening journaling companion that **gets to know you over time** — your goals, your patterns, the people in your life — and does it **entirely on your own machine, with no network access at runtime.** No account. No sync. No telemetry. No keys. Your journal is plain Markdown files in a folder you own, readable in any text editor whether or not Eva ever runs again.

> The thesis Eva proves: **privacy and understanding are not a trade-off.** A small model on consumer hardware can be genuinely understanding, performant, safe, and auditable — if the engineering does the remembering and the model only does the listening.

---

## What it does

- **Listens first.** Eva is built to let you get things out of your head, not to fix you. It only gives advice when you actually ask. (See the persona contract in [`docs/eva_system.md`](docs/eva_system.md).)
- **Talks, by voice or text.** Hold the mic, speak; Eva transcribes locally and **speaks her reply back** — first words within ~2 seconds of generation starting, streamed sentence-by-sentence.
- **Remembers what matters.** Every entry is distilled into structured memory. Weeks later Eva can reference *"what's been on your mind lately"* and cite the exact entry and date.
- **Grounds answers in your library.** Drop in a PDF/Markdown/text document; Eva answers from it **with a clickable source chip** — and says *"that's not in your library"* rather than inventing a citation.
- **Builds a model of you.** An evolving profile of your stated goals, values, relationships, and recurring patterns — so when you ask *"should I skip the gym today?"*, Eva can answer against the fitness goal **you** told it about.
- **Shows you yourself.** A mood arc over time (gaps where you didn't write — never a fake zero) and a force-directed knowledge graph of the people, themes, and goals that connect your entries.

---

## System architecture

Three processes, one machine, zero network egress.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Tauri shell (Rust)  ·  native macOS window                           │
│  React + Vite UI — chat, journal, library, insights, profile          │
│  push-to-talk mic capture · ordered audio playback                    │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │  HTTP + WebSocket (loopback only)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Python FastAPI backend  (127.0.0.1:8000)                             │
│                                                                        │
│   net_guard ── outbound socket kill-switch (privacy hard law)         │
│                                                                        │
│   intent ──► retrieval ──► prompt assembly ──► llm.client ──► stream   │
│   classifier   (memory +      (persona +         (model lock,          │
│                 corpus,        memory + profile   chat-priority)        │
│                 gated)         + corpus slots)                         │
│                                                                        │
│   voice: faster-whisper (STT) · Kokoro (TTS) · sentence_queue         │
│   memory: vault(L0) · extract(L1) · vector(L2) · profile(L3) · graph  │
│   ingest: PDF/MD/TXT loaders ──► chunker ──► embed                     │
│                                                                        │
│   supervises ▼                                                         │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │  OpenAI-compatible HTTP (loopback)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  llama-server  (native llama.cpp binary, 127.0.0.1:11500)             │
│  gemma-4-E2B-it-qat · Q4_K_XL GGUF · all layers on the Metal GPU      │
└──────────────────────────────────────────────────────────────────────┘

  On disk (the vault — your data, your files):
    journal/YYYY-MM-DD.md   plain-Markdown entries — the source of truth
    eva.db                  derived episode records, mood series (SQLite)
    chroma/                 derived semantic index (journals + corpus)
    profile.json / .md      the evolving model of you (user-editable)
```

**The databases are derived and rebuildable. The Markdown is the truth — it never depends on them.** Delete `chroma/` or `eva.db` and Eva can reconstruct them from your journal files. This is a hard rule, not a convenience.

---

## The memory model — five layers

Eva's memory is the engineering moat, and it rests on one discipline:

> **Code counts, connects, and remembers. The model only extracts one entry at a time, and narrates over evidence that was already assembled for it.**

That division is *why* a 4B model is reliable at features that would make a 70B model hallucinate. No chat turn ever sees raw history; every analysis runs over a small, bounded window prepared by deterministic code.

| Layer | Name | What it is | How it works |
|------:|------|-----------|--------------|
| **L0** | **Raw vault** | Append-only Markdown, one file per day | The irreplaceable store. Each turn is timestamped with its UUID in an HTML comment. A crash can lose at most one in-flight turn. |
| **L1** | **Episode records** | One bounded extraction per entry → SQLite | A single LLM call at `temp 0.3` pulls mood (−5…+5), emotions, entities, themes, events, **stated goals**, **behaviors** (kept distinct from goals), open loops, self-judgments, and a summary. Parse fails retry once, then store `null` without blocking the save. |
| **L2** | **Semantic index** | Two ChromaDB collections (`journals`, `corpus`) | FastEmbed `bge-small-en-v1.5` with **asymmetric** query/passage prefixes, so off-topic passages stay genuinely far away and a distance threshold can actually separate *"in your library"* from *"not in your library."* |
| **L3** | **User model** | Evolving `profile.json` + readable `profile.md` | Goals, patterns, relationships, emotional baseline — updated by **bounded, reversible operations** (`add_goal`, `strengthen`, `note_contradiction`, …), each carrying evidence pointers back to L1. Never a whole-profile rewrite. Confidence **decays** when a belief isn't corroborated. |
| **L4** | **Derived analytics** | Pure SQL + code | Mood time-series, period-over-period deltas, and the knowledge graph (deterministic co-occurrence/temporal/similarity edges, plus a few evidence-gated, clearly-labeled *hypothesis* edges). |

**You are the final authority.** Edit `profile.md` by hand and your corrections become *anchors* — claims the model is forbidden to overwrite or decay.

---

## A single chat turn, end to end

```
message (text or voice)
  └─ STT (faster-whisper, lazy-loaded on first use) ──► text
       └─ intent classifier  (rules first; tiny model fallback only if ambiguous)
            ├─ vent           → corpus retrieval is NOT triggered (listen-first)
            └─ question/advice → corpus retrieval gated ON
       └─ recall (every turn): L2 → top past summaries (recency-weighted)
       └─ profile slices (every turn): L3 → identity, active goals, relevant patterns
       └─ corpus (if gated): L2 corpus → only chunks within 0.38 cosine distance
       └─ prompt assembly: persona + memory + profile + corpus + grounding rule
            └─ llama-server  (temp 1.0 / top_p 0.95 / top_k 64, streaming)
                 └─ tokens stream → sentence_queue splits on real boundaries
                      └─ each finished sentence → Kokoro on a worker thread
                           └─ ordered audio chunks (monotonic seq) over WebSocket
  └─ persist: append to L0 Markdown → L1 extraction → L2 embed → queue consolidation
```

---

## The hard problems, and how they're solved

**Running Gemma 4 E2B + STT + TTS inside 8 GB.**
All model layers offload to the Metal GPU (`--n-gpu-layers -1`); the KV cache is quantized to `q8_0` for both keys and values (which requires flash attention, hence `--flash-attn on`), roughly halving KV RAM. Voice models are **lazy-loaded on first use, never at startup** — so the idle footprint stays small and the budget holds with headroom to spare.

**No fabricated citations — ever.**
Grounding is structural, not a polite request. The intent classifier *gates retrieval*: in `vent` mode the corpus is never fetched, so the model literally cannot reach for a quote. When advice is asked for, code retrieves passages and keeps only those within `MAX_DISTANCE = 0.38` cosine distance (empirically tuned — in-document Q/A landed ~0.24, off-topic ~0.45). No passage clears the bar → no citation rendered → no path to invent one. The persona's honesty contract does the rest.

**Background extraction must never stall a live reply.**
A single `asyncio.Lock` fronts the one shared model server. Chat calls register `priority=True` *before* awaiting the lock; background jobs (`priority=False`) yield first and wait while any chat turn is queued. Your reply is never stuck behind nightly consolidation. (See `backend/llm/client.py`.)

**Speaking before the sentence is finished.**
A stateful character-level scanner (`backend/voice/sentence_queue.py`) — not a batch tokenizer — splits the token stream on *real* sentence boundaries: no split after `Dr.`/`e.g.`, none on `3.50`, none inside open quotes; a 4-word minimum so clips don't sound robotic and an 80-word flush so audio never stalls. One worker synthesizes one sentence at a time and emits chunks with a monotonic `seq` the client plays in order.

**Behavior-vs-goal contradictions on a small model.**
Deterministic code does the counting — *"you said you value fitness but skipped the gym 4 of 7 days"* — and hands the model the finished count to put into warm prose. The model is never asked to "notice" a pattern across history.

**Mood you can trust.**
Days you didn't write are stored as `NULL`, and the chart **draws a gap** — never a zero, never an interpolation. An absent mood is absent, not "neutral."

**Crisis care without becoming a clinical bot.**
A deterministic keyword floor (`backend/safety/crisis_check.py`) appends a care-focused addendum to the persona *for that turn only* when self-harm language appears. It never suppresses Eva's reply, never hands off to a canned hotline responder, never lectures. A false positive costs only extra warmth — the right failure mode.

**Privacy by construction, not by promise.**
`backend/net_guard.py` monkeypatches `socket.connect`/`connect_ex` so any outbound connection to a non-loopback host raises and is logged. Exactly one host is allowlisted (`EVA_ALLOW_HOST`), used **only** during first-run model download. The guard installs the instant the backend is imported. The "Offline ✓" badge isn't a sticker — it reports a verifiable truth.

---

## Quick start

### Prerequisites

- **Python 3.11** · **Node 18+ / npm** · **Rust toolchain** (`cargo`, `rustc` — for the native Tauri window; without it you get the Vite dev server in a browser)
- **llama.cpp** — the native server binary is the only LLM launcher:
  ```sh
  brew install llama.cpp
  ```
- **espeak-ng** (recommended) — Kokoro's grapheme-to-phoneme fallback for unusual words:
  ```sh
  brew install espeak-ng
  ```
  > `ffmpeg` is **not** required — voice-in decodes browser recordings via PyAV's bundled libraries.

### First-run model & voice assets (one time, needs internet)

Eva is offline at runtime, so every weight is downloaded **once** up front via out-of-band scripts (they deliberately skip the net-guard) into the vault:

```sh
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

bash ../scripts/download_model_mac.sh        # 1. Gemma 4 E2B GGUF (the LLM)
python ../scripts/download_embed_model.py     # 2. bge-small embeddings (Library + recall)
python ../scripts/download_whisper_model.py all   # 3. faster-whisper STT (base.en + small.en)
python ../scripts/download_kokoro_model.py    # 4. Kokoro TTS + af_heart voice
```

### Run

```sh
./dev.sh        # backend (:8000) + frontend; native window if Rust is installed, else Vite (:1420)
```

The backend launches and supervises `llama-server` on `:11500` (set `EVA_START_LLAMA=1`). The status dot turns green when `/health` answers; the Offline ✓ badge turns green when the net-guard is live.

### Tests & checks

```sh
cd backend && source .venv/bin/activate && python -m pytest -q   # unit tests
python ../scripts/check_net_guard.py                              # privacy smoke test
```

---

## Repository layout

```
backend/            FastAPI app (Python 3.11) — orchestrates everything
  app.py            HTTP + WebSocket routes (/chat, /journal, /insights, /corpus, …)
  net_guard.py      outbound socket kill-switch (privacy hard law)
  llm/              server.py (spawn/supervise llama-server) · client.py (streaming + lock)
  memory/           vault(L0) · extract(L1) · vector(L2) · profile(L3) · graph · retrieval
  intent/           three-class intent classifier (gates corpus retrieval)
  safety/           crisis-care keyword floor
  voice/            stt (faster-whisper) · tts (Kokoro) · sentence_queue (streaming)
  ingest/           PDF/MD/TXT loaders · chunker · corpus
  prompts/          assembly.py (persona + memory + profile + corpus slots)
ui/                 React + Vite frontend · src-tauri/ (Tauri 2 Rust shell)
scripts/            model/voice downloaders · demo reset & drills · verification
docs/               system design, memory architecture, demo plan & script
local_vault/        the data vault (journal Markdown, SQLite, Chroma, profile)
```

## Deeper docs

- [`docs/eva_system.md`](docs/eva_system.md) — Eva's persona contract (who she is, how she speaks, her honesty and care rules)
- [`docs/EVA_SYSTEM_DESIGN.md`](docs/EVA_SYSTEM_DESIGN.md) — the full system design
- [`docs/EVA_MEMORY_ARCHITECTURE.md`](docs/EVA_MEMORY_ARCHITECTURE.md) — the five-layer memory model in depth
- [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) — the 10-beat walkthrough

---

## Privacy is hard law

No telemetry. No analytics. No outbound network calls at runtime — only the first-run model/voice download, through a single named, pre-resolved host. Your journal is plain Markdown you own and can read or delete without the app. Your profile is plain JSON you can edit by hand. Eva keeps your thoughts where they belong: with you.
