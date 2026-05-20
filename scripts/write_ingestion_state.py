"""
write_ingestion_state.py
Run AFTER a successful pipeline to record the current PDF hashes.
This prevents future runs from re-ingesting unchanged books.
"""

import hashlib
import json
import sys
from pathlib import Path

STATE_FILE = Path("data/.ingestion_state.json")


def md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def main():
    pdf_dir = Path("data/pdfs")
    if not pdf_dir.exists():
        print("❌ No PDFs found.")
        sys.exit(1)

    pdfs = sorted(pdf_dir.glob("*.pdf"))
    if not pdfs:
        print("❌ No PDFs found.")
        sys.exit(1)

    current = {p.name: md5(p) for p in pdfs}
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(current, indent=2))
    print(f"✅ State written to {STATE_FILE}")
    print(f"   Books recorded: {list(current.keys())}")


if __name__ == "__main__":
    main()
