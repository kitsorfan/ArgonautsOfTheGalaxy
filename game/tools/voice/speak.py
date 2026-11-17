"""Records spoken lines with Kyutai's Pocket TTS or Resemble AI's Chatterbox. `npm run voice` runs it
(see game/tools/voice.ts), in the Python that has the job's engine.

Reads a job as JSON on stdin:

    {"engine": "pocket-tts" | "chatterbox", "lines": [{"id", "text", "voice", "fx"?, "file"}], "report": "<path>"}

and writes each line to its file (a .wav, 24 kHz mono, or a .mp3): run through its ffmpeg filters
(`fx`) if it has any, trimmed, with long pauses inside it shortened, and every line at the same
loudness. The report gets each line's length in seconds, rewritten after every take, so a long run that
stops partway still says which lines it made.

When faster-whisper is installed it then listens to every take and names the ones that do not say their
line: a speech model now and then swallows or swaps a word, and nobody listens to every take.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import warnings
from difflib import SequenceMatcher
from typing import Callable

import numpy as np
import soundfile as sf

warnings.filterwarnings("ignore")

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
#: Every take is set to this loudness (RMS of its speech, dBFS).
LOUDNESS = -19.0
#: Pauses inside a line longer than this are cut down to KEEP seconds.
LONGEST, KEEP = 0.6, 0.45


def trim(x: np.ndarray, sr: int, thresh: float = 0.02, margin: float = 0.03) -> np.ndarray:
    loud = np.flatnonzero(np.abs(x) > thresh * np.abs(x).max())
    a, b = max(loud[0] - int(margin * sr), 0), min(loud[-1] + int(margin * sr), len(x))
    return x[a:b]


def tighten(x: np.ndarray, sr: int) -> np.ndarray:
    w = sr // 100
    n = len(x) // w
    rms = np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1))
    quiet = rms < rms.max() * 0.03
    out, i = [], 0
    while i < n:
        j = i
        while j < n and quiet[j] == quiet[i]:
            j += 1
        seg = x[i * w : j * w]
        if quiet[i] and (j - i) * w > LONGEST * sr:
            half = int(KEEP * sr) // 2
            seg = np.concatenate([seg[:half], seg[-half:]])
        out.append(seg)
        i = j
    out.append(x[n * w :])
    return np.concatenate(out)


def level(x: np.ndarray, sr: int) -> np.ndarray:
    w = sr // 100
    frames = x[: len(x) // w * w].reshape(-1, w)
    rms = np.sqrt((frames**2).mean(axis=1))
    active = rms[rms > rms.max() * 0.1]
    y = x * (10 ** (LOUDNESS / 20) / max(float(np.sqrt((active**2).mean())), 1e-6))
    peak = float(np.abs(y).max())
    return y * (0.89 / peak) if peak > 0.89 else y


def finish(x: np.ndarray, sr: int) -> np.ndarray:
    """A raw take, ready to use."""
    return level(tighten(trim(x.astype(np.float32), sr), sr), sr).astype(np.float32)


def ffmpeg(x: np.ndarray, sr: int, args: list[str], out: str) -> None:
    """Runs a take through ffmpeg into `out`."""
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "take.wav")
        sf.write(src, x, sr, subtype="FLOAT")
        subprocess.run([FFMPEG, "-y", "-v", "error", "-i", src, *args, out], check=True)


def effect(x: np.ndarray, sr: int, fx: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "fx.wav")
        ffmpeg(x, sr, ["-af", fx, "-ar", str(sr), "-ac", "1", "-c:a", "pcm_f32le"], out)
        y, _ = sf.read(out, dtype="float32")
        return y


def save(x: np.ndarray, sr: int, file: str) -> None:
    if file.endswith(".mp3"):
        # Speech at 24 kHz, mono: 48 kbps is plenty, and keeps a whole game's worth small.
        ffmpeg(x, sr, ["-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k"], file)
    else:
        sf.write(file, x, sr, subtype="PCM_16")


Say = Callable[[str, str], np.ndarray]


def pocket() -> tuple[Say, int]:
    """Kyutai's Pocket TTS, speaking in one of its own voices."""
    from pocket_tts.models.tts_model import TTSModel

    model = TTSModel.load_model()
    states: dict = {}

    def say(text: str, voice: str) -> np.ndarray:
        if voice not in states:
            states[voice] = model.get_state_for_audio_prompt(voice)
        return np.concatenate([np.asarray(c).reshape(-1) for c in model.generate_audio_stream(model_state=states[voice], text_to_generate=text)])

    return say, model.config.mimi.sample_rate


#: The voice collection Chatterbox copies from (a voice is a file's path there), at the version the cast
#: was chosen from.
VOICES, VOICES_AT = "kyutai/tts-voices", "323332d33f997de8394f24a193e1a76df720e01a"
#: How Chatterbox reads: with more feeling than its default (0.5), and, for a guidance weight below its
#: default (0.5), slower and more deliberately. The way a general gives orders.
EXAGGERATION, CFG_WEIGHT = 0.7, 0.3


def chatterbox() -> tuple[Say, int]:
    """Resemble AI's Chatterbox, copying the voice of a recording in Kyutai's collection."""
    os.environ.setdefault("TQDM_DISABLE", "1")
    from chatterbox.tts import ChatterboxTTS
    from huggingface_hub import hf_hub_download

    model = ChatterboxTTS.from_pretrained(device="cpu")

    def say(text: str, voice: str) -> np.ndarray:
        ref = hf_hub_download(VOICES, voice, revision=VOICES_AT)
        return model.generate(text, audio_prompt_path=ref, exaggeration=EXAGGERATION, cfg_weight=CFG_WEIGHT).squeeze(0).numpy()

    return say, model.sr


ENGINES: dict[str, Callable[[], tuple[Say, int]]] = {"pocket-tts": pocket, "chatterbox": chatterbox}


def speak(engine: str, lines: list[dict], report: str) -> None:
    say, sr = ENGINES[engine]()
    seconds: dict[str, float] = {}
    for i, line in enumerate(lines):
        raw = np.asarray(say(line["text"], line["voice"]), dtype=np.float32).reshape(-1)
        take = finish(effect(raw, sr, line["fx"]) if line.get("fx") else raw, sr)
        save(take, sr, line["file"])
        seconds[line["id"]] = round(len(take) / sr, 3)
        with open(report, "w", encoding="utf-8") as f:
            json.dump(seconds, f)
        print(f"  [{i + 1}/{len(lines)}] {line['id']} ({os.path.basename(line['voice'])}, {len(take) / sr:.1f}s): {line['text']}", flush=True)


def check(lines: list[dict]) -> None:
    """Names the takes Whisper hears saying something else. It runs once all are recorded, reading them
    back from their files: loaded next to the speech engine, Whisper takes most of its CPU threads."""
    whisper = listener()
    if not whisper:
        return
    doubtful: list[str] = []
    for line in lines:
        said = heard(whisper, line["file"])
        if differs(line["text"], said):
            doubtful.append(line["id"])
            print(f'  CHECK {line["id"]}: it says "{line["text"]}", Whisper heard "{said}"', flush=True)
    if doubtful:
        print(f"  {len(doubtful)} takes to listen to: {','.join(doubtful)}")


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
SHORT = {"dr": "doctor", "mr": "mister", "mrs": "missus", "ok": "okay"}


def number(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + number(n % 100))
    if n < 1_000_000:
        return number(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + number(n % 1000))
    return str(n)


def words(s: str) -> list[str]:
    # "2,000" is one number.
    s = re.sub(r"(?<=\d),(?=\d{3})", "", s.lower().replace("-", " "))
    s = re.sub(r"\d+", lambda m: f" {number(int(m.group()))} ", s)
    # "One hundred and twenty" is 120 too.
    s = re.sub(r"\b(hundred|thousand) and\b", r"\1", s)
    # A lone letter is a stutter ("w-w-worry"), which Whisper leaves out.
    return [SHORT.get(w, w) for w in re.sub(r"[^a-z ]", "", s).split() if len(w) > 1 or w in ("a", "i")]


def differs(said: str, heard: str) -> bool:
    """Whether a take says something else: a word missing, added or swapped for another. Spellings
    Whisper guesses at (the story's made-up names) do not count, so long as they sound alike."""
    a, b = words(said), words(heard)
    # A hard c and a k sound the same ("Gas-koo" heard as "gas-coo").
    sound = lambda ws: "".join(ws).replace("c", "k")
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, a, b).get_opcodes():
        if tag != "equal" and SequenceMatcher(None, sound(a[i1:i2]), sound(b[j1:j2])).ratio() < 0.75:
            return True
    return False


def listener():
    """Whisper, to hear what each take says; None when faster-whisper is not installed."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("  (faster-whisper is not installed: nobody checks what the takes say)")
        return None
    return WhisperModel("small.en", device="cpu", compute_type="int8")


def heard(whisper, file: str) -> str:
    """What Whisper hears a recording say."""
    # Whisper listens at 16 kHz.
    pcm = subprocess.run([FFMPEG, "-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    segments, _ = whisper.transcribe(np.frombuffer(pcm, np.float32), beam_size=5, language="en")
    return " ".join(s.text for s in segments).strip()


if __name__ == "__main__":
    job = json.load(sys.stdin)
    speak(job["engine"], job["lines"], job["report"])
    check(job["lines"])
