"""
run_eval.py
Batch evaluation using Groq (free-tier LLM) and Jina AI (free-tier embeddings).
"""
import json
import os
import time
from pathlib import Path
from typing import List, Dict
import numpy as np
from openai import OpenAI
from pinecone import Pinecone

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
EVAL_DATASET = PROJECT_ROOT / "eval" / "eval_dataset.json"
RESULTS_PATH = PROJECT_ROOT / "eval" / "results.json"

# Jina AI — free embeddings
jina_client = OpenAI(
    base_url="https://api.jina.ai/v1",
    api_key=os.getenv("JINA_API_KEY", ""),
)

# Groq — free-tier fast LLM
groq_client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
)

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "got-rag-platform")
32| index = pc.Index(INDEX_NAME)
33| 
34| EMBED_MODEL = "jina-embeddings-v2-base-en"  # Changed from v3-base to v2-base-en
35| LLM_MODEL = "llama-3.1-8b-instant"
36| TOP_K = 8


def embed(text: str) -> List[float]:
    return jina_client.embeddings.create(input=[text], model=EMBED_MODEL).data[0].embedding


def retrieve(query: str) -> List[Dict]:
    qv = embed(query)
    res = index.query(vector=qv, top_k=TOP_K, include_metadata=True)
    return [m.metadata for m in res.matches]


def generate_answer(question: str, contexts: List[str]) -> str:
    ctx_block = "\n\n---\n\n".join(contexts)
    prompt = (
        "You are the Maester of the Citadel, an expert on A Song of Ice and Fire.\n"
        "Use ONLY the provided context to answer the question. Cite books and pages when possible.\n\n"
        f"Context:\n{ctx_block}\n\n"
        f"Question: {question}\n\nAnswer concisely and accurately:"
    )
    resp = groq_client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=500,
    )
    return resp.choices[0].message.content.strip()


def llm_judge(metric: str, question: str, answer: str, contexts: List[str], ground_truth: str) -> float:
    ctx_block = "\n".join(contexts)[:4000]
    rubrics = {
        "faithfulness": (
            f"Rate whether the ANSWER is fully supported by the CONTEXT.\n"
            f"Context:\n{ctx_block}\n\nAnswer: {answer}\n\n"
            "Return ONLY a number from 0.0 to 1.0."
        ),
        "relevancy": (
            f"Rate how well the ANSWER addresses the QUESTION.\n"
            f"Question: {question}\n\nAnswer: {answer}\n\n"
            "Return ONLY a number from 0.0 to 1.0."
        ),
        "precision": (
            f"Rate what fraction of the CONTEXT sentences are relevant to answering the QUESTION.\n"
            f"Question: {question}\n\nContext:\n{ctx_block}\n\n"
            "Return ONLY a number from 0.0 to 1.0."
        ),
        "recall": (
            f"Rate what fraction of information in the GROUND TRUTH appears in the CONTEXT.\n"
            f"Ground Truth: {ground_truth}\n\nContext:\n{ctx_block}\n\n"
            "Return ONLY a number from 0.0 to 1.0."
        ),
    }
    prompt = rubrics[metric]
    resp = groq_client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=10,
    )
    raw = resp.choices[0].message.content.strip()
    try:
        val = float(raw.split()[0])
        return max(0.0, min(1.0, val))
    except Exception:
        return 0.5


def run():
    if not os.getenv("GROQ_API_KEY"):
        print("❌ Set GROQ_API_KEY to run evaluation.")
        return

    with open(EVAL_DATASET, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    results = []
    print(f"🔍 Evaluating {len(dataset)} questions via Groq + Jina...")
    for item in dataset:
        q = item["question"]
        gt = item["ground_truth"]

        t0 = time.time()
        chunks = retrieve(q)
        lat = round(time.time() - t0, 3)

        contexts = [c["text"] for c in chunks]
        answer = generate_answer(q, contexts)

        faith = llm_judge("faithfulness", q, answer, contexts, gt)
        relev = llm_judge("relevancy", q, answer, contexts, gt)
        prec = llm_judge("precision", q, answer, contexts, gt)
        rec = llm_judge("recall", q, answer, contexts, gt)

        results.append({
            "question": q,
            "ground_truth": gt,
            "answer": answer,
            "contexts": contexts,
            "latency_seconds": lat,
            "faithfulness": faith,
            "relevancy": relev,
            "context_precision": prec,
            "context_recall": rec,
            "books_hit": list(set(c.get("book", "") for c in chunks)),
        })
        print(f"  ✅ {q[:60]}... F={faith:.2f} R={relev:.2f} L={lat:.2f}s")

    avg_faith = float(np.mean([r["faithfulness"] for r in results]))
    avg_relev = float(np.mean([r["relevancy"] for r in results]))
    avg_prec = float(np.mean([r["context_precision"] for r in results]))
    avg_rec = float(np.mean([r["context_recall"] for r in results]))
    avg_lat = float(np.mean([r["latency_seconds"] for r in results]))

    summary = {
        "run_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_questions": len(results),
        "avg_faithfulness": round(avg_faith, 3),
        "avg_relevancy": round(avg_relev, 3),
        "avg_context_precision": round(avg_prec, 3),
        "avg_context_recall": round(avg_rec, 3),
        "avg_latency_seconds": round(avg_lat, 3),
        "details": results,
    }

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n📊 Evaluation complete. Results saved to {RESULTS_PATH}")
    print(f"   Faithfulness: {avg_faith:.2f} | Relevancy: {avg_relev:.2f}")
    print(f"   Precision:    {avg_prec:.2f} | Recall:    {avg_rec:.2f}")
    print(f"   Avg Latency:  {avg_lat:.2f}s")


if __name__ == "__main__":
    run()
