"""
run_all.py
Master orchestrator that runs the entire Citadel pipeline in order.
Safe to run locally or inside CI.
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.resolve()


def run(cmd: str) -> None:
    print(f"\n{'='*60}")
    print(f"🔥 {cmd}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, shell=True, cwd=ROOT, env=os.environ)
    if result.returncode != 0:
        print(f"❌ Pipeline failed at: {cmd}")
        sys.exit(result.returncode)


def main() -> None:
    # Ensure output directories exist
    (ROOT / "data" / "processed").mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "extracted").mkdir(parents=True, exist_ok=True)
    (ROOT / "eval").mkdir(parents=True, exist_ok=True)

    run("python scripts/04_setup_pinecone.py")
    run("python scripts/01_parse_pdfs.py")
    run("python scripts/02_describe_images.py")
    run("python scripts/03_chunk_embed_upsert.py")
    run("python scripts/run_eval.py")

    print("\n" + "=" * 60)
    print("🎉 CITADEL PIPELINE COMPLETE")
    print("   Pinecone index populated.")
    print("   Eval metrics written to eval/results.json")
    print("   Artifacts ready for commit & deploy.")
    print("=" * 60)


if __name__ == "__main__":
    main()
