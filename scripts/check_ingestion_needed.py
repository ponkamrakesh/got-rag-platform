"""
check_ingestion_needed.py
Compares MD5 hashes of all PDFs against the last known state.
Only triggers a full (expensive) OpenAI pipeline if books actually changed.
Also forces a run if extracted images or eval results are missing (e.g., fresh clone).
Writes GitHub Actions step output if running in CI.
"""

import hashlib
import json
import os
import sys
from pathlib import Path

STATE_FILE = Path("data/.ingestion_state.json")


def md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def set_output(name: str, value: str) -> None:
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
            fh.write(f"{name}={value}\n")


def main():
    pdf_dir = Path("data/pdfs")
    if not pdf_dir.exists():
        print("❌ data/pdfs/ does not exist. Nothing to ingest.")
        set_output("needed", "false")
        sys.exit(0)

    pdfs = sorted(pdf_dir.glob("*.pdf"))
    if not pdfs:
        print("⚠️  No PDFs found in data/pdfs/. Ingestion not needed.")
        set_output("needed", "false")
        sys.exit(0)

    current = {p.name: md5(p) for p in pdfs}
    needed = True

    if STATE_FILE.exists():
        previous = json.loads(STATE_FILE.read_text())
        if previous == current:
            needed = False

    # Force-run if artifacts are missing (fresh clone, partial checkout, etc.)
    if not needed:
        extracted = list(Path("public/extracted").rglob("*.png")) if Path("public/extracted").exists() else []
        if not extracted:
            print("📦 PDFs unchanged, but extracted images missing. Forcing run.")
            needed = True
        elif not Path("eval/results.json").exists():
            print("📊 PDFs unchanged, but eval results missing. Forcing run.")
            needed = True
        else:
            print("🟢 PDFs unchanged & artifacts present. Skipping ingestion.")

    if needed:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(current, indent=2))
        set_output("needed", "true")
        print("🔥 Ingestion NEEDED.")
    else:
        set_output("needed", "false")

    sys.exit(0)


if __name__ == "__main__":
    main()
