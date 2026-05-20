"""
generate_eval_questions.py
LLM-generated synthetic evaluation questions sampled from the processed corpus.
Run this to expand your eval dataset beyond the hand-crafted golden set.
"""

import json
import os
import random
import sys
from pathlib import Path
from openai import OpenAI

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
OUT_PATH = PROJECT_ROOT / "eval" / "generated_questions.json"

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_question(chunk_text: str, book: str, chapter: str | None) -> dict | None:
    meta = f"{book}" + (f" — {chapter}" if chapter else "")
    prompt = (
        f"Given this excerpt from {meta}, write ONE factual question that can be answered "
        f"ONLY from the provided text, plus a concise ground-truth answer.\n\n"
        f"Excerpt:\n{chunk_text[:1000]}\n\n"
        f'Return strictly JSON: {{"question": "...", "ground_truth": "...", '
        f'"expected_books": ["{book}"], "difficulty": "easy|medium|hard"}}'
    )
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=350,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content)
        if "question" in data and "ground_truth" in data:
            return data
    except Exception as e:
        print(f"  ⚠️ generation failed: {e}")
    return None


def main():
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Set OPENAI_API_KEY")
        sys.exit(1)

    jsonls = list(PROCESSED_DIR.glob("*_raw.jsonl"))
    if not jsonls:
        print(f"❌ No raw JSONL in {PROCESSED_DIR}. Run 01 first.")
        sys.exit(1)

    all_text_records = []
    for j in jsonls:
        with open(j, "r", encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                if r["type"] == "text" and len(r.get("text", "")) > 500:
                    all_text_records.append(r)

    if not all_text_records:
        print("❌ No long enough text records found.")
        sys.exit(1)

    sample = random.sample(all_text_records, min(25, len(all_text_records)))
    generated = []
    print(f"🎲 Sampling {len(sample)} chunks for synthetic questions...")
    for r in sample:
        q = generate_question(r["text"], r["book"], r.get("chapter"))
        if q:
            generated.append(q)
            print(f"  ✅ {q['question'][:70]}...")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(generated, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Generated {len(generated)} questions -> {OUT_PATH}")
    print("   Merge the best ones into eval/eval_dataset.json manually.")


if __name__ == "__main__":
    main()
