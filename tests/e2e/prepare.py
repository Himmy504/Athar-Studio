"""Generate synthetic test audio locally; no lecture or FFmpeg download is needed."""
from array import array
from math import pi, sin
from pathlib import Path
import sys
import wave

output = Path(__file__).resolve().parents[2] / "test-results" / "source.wav"
output.parent.mkdir(exist_ok=True)
samples = array("h", (int(4096 * sin(2 * pi * 220 * i / 16000)) for i in range(12 * 16000)))
if sys.byteorder != "little":
    samples.byteswap()
with wave.open(str(output), "wb") as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(16000)
    audio.writeframes(samples.tobytes())
print("Prepared test-results/source.wav (12-second synthetic tone)")
