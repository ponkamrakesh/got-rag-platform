"""
check_ingestion_needed.py
Compares MD5 hashes of all PDFs against the last KNOWN GOOD state
(stored only AFTER a successful pipeline run).
Forces a run if extracted images or eval results are missing.
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
    # Also print for human readability in logs
    print(f"::set-output name={name}::{value}")
    print(f"OUTPUT {name}={value}")


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
    reason = "First run or PDFs changed"

    # Compare against LAST SUCCESSFUL state (only written by the commit step)
    if STATE_FILE.exists():
        try:
            previous = json.loads(STATE_FILE.read_text())
            if previous == current:
                needed = False
                reason = "PDFs unchanged"
        except Exception:
            needed = True
            reason = "Corrupt state file"

    # Force-run if required artifacts are missing (fresh clone, CI wipe, etc.)
    if not needed:
        extracted = list(Path("public/extracted").rglob("*.png")) if Path("public/extracted").exists() else []
        if not extracted:
            needed = True
            reason = "PDFs unchanged, but extracted images missing"
        elif not Path("eval/results.json").exists():
            needed = True
            reason = "PDFs unchanged, but eval results missing"
        else:
            reason = "PDFs unchanged & all artifacts present"

    print(f"📊 Ingestion check: {reason}")
    print(f"   PDFs found: {[p.name for p in pdfs]}")

    if needed:
        set_output("needed", "true")
        print("🔥 Ingestion NEEDED.")
    else:
        set_output("needed", "false")
        print("🟢 Ingestion SKIPPED.")

    sys.exit(0)


if __name__ == "__main__":
    main()
