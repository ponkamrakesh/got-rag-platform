"""
03_chunk_embed_upsert.py
Chunk text (no word unturned). Embed with Jina AI (free tier). Upsert to Pinecone.
Uses recursive character chunking with overlap.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any

from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec
from tqdm import tqdm

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# Jina AI embeddings — OpenAI-compatible endpoint, free tier
JINA_CLIENT = OpenAI(
    base_url="https://api.jina.ai/v1",
    api_key=os.getenv("JINA_API_KEY", ""),  # works without key for low volume
)

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "got-rag-platform")

TARGET_CHARS = 1500
OVERLAP_CHARS = 300
BATCH_SIZE = 100
EMBED_MODEL = "jina-embeddings-v3"
EMBED_DIM = 768


def ensure_index():
    existing = [i["name"] for i in pc.list_indexes()]
    if INDEX_NAME not in existing:
        print(f"🏗️  Creating Pinecone index: {INDEX_NAME} (dim={EMBED_DIM})")
        pc.create_index(
            name=INDEX_NAME,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        time.sleep(20)
    else:
        print(f"✅ Index {INDEX_NAME} exists.")


def recursive_split(text: str, target: int, overlap: int) -> List[str]:
    separators = ["\n\n", "\n", ". ", " "]
    chunks: List[str] = []
    remaining = text
    while len(remaining) > target:
        split_at = -1
        for sep in separators:
            idx = remaining.rfind(sep, target - overlap, target + overlap)
            if idx != -1:
                split_at = idx + len(sep)
                break
        if split_at == -1:
            split_at = target
        chunk = remaining[:split_at].strip()
        if chunk:
            chunks.append(chunk)
        remaining = remaining[split_at - overlap:].strip() if overlap < split_at else remaining[split_at:].strip()
    if remaining.strip():
        chunks.append(remaining.strip())
    return chunks


def build_chunks(records: List[Dict[str, Any]], book_name: str) -> List[Dict[str, Any]]:
    runs: List[List[Dict]] = []
    current_run: List[Dict] = []
    current_key = None
    for r in records:
        key = (r["book"], r.get("chapter"))
        if key != current_key and current_run:
            runs.append(current_run)
            current_run = []
        current_key = key
        current_run.append(r)
    if current_run:
        runs.append(current_run)

    chunks: List[Dict] = []
    global_idx = 0
    for run in tqdm(runs, desc=f"Chunking {book_name}"):
        texts = [r for r in run if r["type"] == "text"]
        images = [r for r in run if r["type"] == "image"]
        if texts:
            full_text = "\n\n".join(r["text"] for r in texts)
            pages = [r["page"] for r in texts]
            start_page, end_page = min(pages), max(pages)
            chapter = texts[0].get("chapter")
            splits = recursive_split(full_text, TARGET_CHARS, OVERLAP_CHARS)
            for i, split in enumerate(splits):
                chunks.append({
                    "id": f"{to_id(book_name)}-txt-{global_idx}",
                    "text": split,
                    "book": book_name,
                    "chapter": chapter,
                    "start_page": start_page,
                    "end_page": end_page,
                    "type": "text",
                    "image_path": None,
                    "chunk_index": i,
                })
                global_idx += 1
        for img in images:
            if not img.get("text"):
                continue
            chunks.append({
                "id": f"{to_id(book_name)}-img-{global_idx}",
                "text": img["text"],
                "book": book_name,
                "chapter": img.get("chapter"),
                "start_page": img["page"],
                "end_page": img["page"],
                "type": "image",
                "image_path": img.get("image_path"),
                "chunk_index": 0,
            })
            global_idx += 1
    return chunks


def to_id(name: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in name).lower()[:40]


def embed_batch(texts: List[str]) -> List[List[float]]:
    resp = JINA_CLIENT.embeddings.create(input=texts, model=EMBED_MODEL)
    return [d.embedding for d in resp.data]


def upsert_chunks(all_chunks: List[Dict]):
    ensure_index()
    index = pc.Index(INDEX_NAME)
    print(f"\n🚀 Upserting {len(all_chunks)} chunks to Pinecone...")
    for i in tqdm(range(0, len(all_chunks), BATCH_SIZE), desc="Upsert batches"):
        batch = all_chunks[i:i + BATCH_SIZE]
        texts = [c["text"] for c in batch]
        vectors = embed_batch(texts)
        upserts = []
        for c, vec in zip(batch, vectors):
            metadata = {
                "text": c["text"][:8000],
                "book": c["book"],
                "chapter": c["chapter"] or "",
                "start_page": c["start_page"],
                "end_page": c["end_page"],
                "type": c["type"],
                "image_path": c["image_path"] or "",
                "chunk_index": c["chunk_index"],
            }
            upserts.append({"id": c["id"], "values": vec, "metadata": metadata})
        index.upsert(vectors=upserts, namespace="")
    print("✅ Upsert complete.")


def main():
    if not os.getenv("PINECONE_API_KEY"):
        print("❌ Set PINECONE_API_KEY.")
        sys.exit(1)

    jsonls = sorted(PROCESSED_DIR.glob("*_raw.jsonl"))
    if not jsonls:
        print(f"❌ No JSONL files in {PROCESSED_DIR}. Run 02 first.")
        sys.exit(1)

    all_chunks: List[Dict] = []
    for j in jsonls:
        book_name = j.stem.replace("_raw", "").replace("_", " ").title()
        records = []
        with open(j, "r", encoding="utf-8") as f:
            for line in f:
                records.append(json.loads(line))
        chunks = build_chunks(records, book_name)
        print(f"📚 {book_name}: {len(chunks)} chunks")
        all_chunks.extend(chunks)

    print(f"\n📦 Total chunks: {len(all_chunks)}")
    upsert_chunks(all_chunks)
    print("\n🎉 Stage 03 complete! Vector index is live.")


if __name__ == "__main__":
    main()
