"""
02_describe_images.py
Use Google Gemini 1.5 Flash (free tier) to decode maps, heraldry, family trees.
Falls back to OCR-only metadata if GEMINI_API_KEY is absent.
"""

import json
import os
import sys
from pathlib import Path
from tqdm import tqdm

# Try Gemini; if key missing, skip AI vision and keep image metadata only
HAS_GEMINI = False
try:
    import google.generativeai as genai
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        genai.configure(api_key=gemini_key)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        HAS_GEMINI = True
        print("🟢 Google Gemini vision enabled.")
    else:
        print("🟡 GEMINI_API_KEY not set. Vision captions will be skipped (images still render in UI).")
except ImportError:
    print("🟡 google-generativeai not installed. Skipping vision captions.")

from PIL import Image

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"


def describe_image(image_path: str) -> str:
    if not HAS_GEMINI:
        return "[Vision captioning skipped — no GEMINI_API_KEY]"
    try:
        img = Image.open(image_path)
        prompt = (
            "You are the Citadel archivist for A Song of Ice and Fire. "
            "Describe this image from the books with extreme detail so a search engine can find it. "
            "If it is a map, list every region, city, castle, river, and mountain shown. "
            "If it is a family tree or heraldry, describe every person, relationship, and sigil. "
            "If it is a scene illustration, describe characters, clothing, and setting."
        )
        response = gemini_model.generate_content([prompt, img])
        return response.text.strip()
    except Exception as e:
        return f"[Vision description failed: {e}]"


def process_book(jsonl_path: Path):
    print(f"\n🖼️  Processing images in {jsonl_path.name}")
    records = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            records.append(json.loads(line))

    image_records = [r for r in records if r["type"] == "image" and not r.get("text")]
    if not image_records:
        print("   No images need captions.")
        return

    for r in tqdm(image_records, desc="Vision captions"):
        local = r.get("local_path")
        if local and Path(local).exists():
            r["text"] = describe_image(local)
        else:
            r["text"] = "[Image file missing]"

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"✅ Described {len(image_records)} images in {jsonl_path.name}")


def main():
    jsonls = sorted(PROCESSED_DIR.glob("*_raw.jsonl"))
    if not jsonls:
        print(f"❌ No raw JSONL files in {PROCESSED_DIR}. Run 01 first.")
        sys.exit(1)

    for j in jsonls:
        process_book(j)

    print("\n🚀 Stage 02 complete. Run 03_chunk_embed_upsert.py next.")


if __name__ == "__main__":
    main()
