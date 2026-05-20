"""
02_describe_images.py
Use GPT-4o-mini vision to decode maps, heraldry, family trees, and illustrations.
Generates rich searchable captions for every extracted image.
"""

import json
import os
import sys
from pathlib import Path
from tqdm import tqdm
from openai import OpenAI

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def describe_image(image_path: str) -> str:
    """Call OpenAI vision to get a detailed, searchable caption."""
    try:
        with open(image_path, "rb") as f:
            # We need base64 for the API
            import base64
            b64 = base64.b64encode(f.read()).decode("utf-8")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert archivist for the world of A Song of Ice and Fire. "
                        "Describe images from the books with extreme detail so a search engine can find them. "
                        "If it is a map, list every region, city, castle, river, and mountain shown. "
                        "If it is a family tree, list every person and relationship. "
                        "If it is heraldry, describe the sigil and house words if visible. "
                        "If it is an illustration, describe the scene, characters, clothing, and setting."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
            max_tokens=600,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"[Description failed: {e}]"


def process_book(jsonl_path: Path):
    print(f"\n🖼️  Describing images in {jsonl_path.name}")
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
        if local and os.path.exists(local):
            r["text"] = describe_image(local)
        else:
            r["text"] = "[Image file missing]"

    # Write back all records (text + updated image)
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"✅ Described {len(image_records)} images in {jsonl_path.name}")


def main():
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Set OPENAI_API_KEY in your environment.")
        sys.exit(1)

    jsonls = sorted(PROCESSED_DIR.glob("*_raw.jsonl"))
    if not jsonls:
        print(f"❌ No raw JSONL files in {PROCESSED_DIR}. Run 01_parse_pdfs.py first.")
        sys.exit(1)

    for j in jsonls:
        process_book(j)

    print("\n🚀 Stage 02 complete. Run 03_chunk_embed_upsert.py next.")


if __name__ == "__main__":
    main()
