"""
04_setup_pinecone.py
One-time setup for the Pinecone serverless index.
Run this before 03_chunk_embed_upsert if the index doesn't exist yet.
"""
import os
import time
from pinecone import Pinecone, ServerlessSpec

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "got-rag")
DIMENSION = 1536  # text-embedding-3-small

pc = Pinecone(api_key=PINECONE_API_KEY)

existing = [i["name"] for i in pc.list_indexes()]
if INDEX_NAME in existing:
    print(f"✅ Index '{INDEX_NAME}' already exists.")
else:
    print(f"🏗️  Creating index '{INDEX_NAME}' ...")
    pc.create_index(
        name=INDEX_NAME,
        dimension=DIMENSION,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )
    while not pc.describe_index(INDEX_NAME).status["ready"]:
        time.sleep(2)
    print(f"🎉 Index '{INDEX_NAME}' is ready.")
