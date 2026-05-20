"""
01_parse_pdfs.py
Extract every word, paragraph, map, and illustration from the GOT PDFs.
Outputs: data/processed/{book}_raw.jsonl + public/extracted/{book}/images
"""

import fitz  # PyMuPDF
import json
import os
import sys
from pathlib import Path
from tqdm import tqdm

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
PDF_DIR = PROJECT_ROOT / "data" / "pdfs"
OUT_DIR = PROJECT_ROOT / "data" / "processed"
IMG_ROOT = PROJECT_ROOT / "public" / "extracted"

# Known POV chapter titles across A Song of Ice & Fire + Worldbook
POV_NAMES = {
    "PROLOGUE", "EPILOGUE", "ARYA", "SANSA", "BRAN", "JON", "JON SNOW",
    "TYRION", "DAENERYS", "Catelyn", "CATELYN", "EDDARD", "NED", "JAIME",
    "CERSEI", "BRIENNE", "DAVOS", "THEON", "SAMWELL", "SAM", "AREO",
    "ASHA", "VICTARION", "AERON", "ARIANNE", "QUENTYN", "JON CONNINGTON",
    "MELISANDRE", "BARRISTAN", "SER JAIME", "SER", "LADY CATELYN",
    "THE MERCHANT'S MAN", "THE LOST LORD", "THE WINDS OF WINTER",
    "THE PRINCE OF WINTERFELL", "THE DRAGONBANE", "THE QUEENSGUARD",
    "THE SOILED KNIGHT", "THE IRON SUITOR", "THE DISCARDED KNIGHT",
    "THE KINGBREAKER", "THE GRiffin REBORN", "THE SACRIFICE", "VICTARION",
    "THE BLIND GIRL", "THE GIFT", "PRINCE OF CELTIGAR", "THE SPURNED SUITOR",
}


def to_snake(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in name).strip("_").lower()


def detect_chapter(page: fitz.Page) -> str | None:
    """Heuristic: first text blocks on a page that are short & ALL CAPS matching known POVs."""
    blocks = page.get_text("blocks")
    for b in blocks[:6]:
        txt = b[4].strip()
        if not txt:
            continue
        lines = [l.strip() for l in txt.splitlines() if l.strip()]
        for line in lines[:3]:
            if len(line) < 35 and line.isupper() and line in POV_NAMES:
                return line
    # fallback: scan raw text first 400 chars
    raw = page.get_text()[:400]
    for line in raw.splitlines():
        line = line.strip()
        if len(line) < 35 and line.isupper() and line in POV_NAMES:
            return line
    return None


def extract_book(pdf_path: Path, book_name: str):
    print(f"\n🔥 Parsing: {book_name}")
    doc = fitz.open(str(pdf_path))
    book_safe = to_snake(book_name)
    img_dir = IMG_ROOT / book_safe
    img_dir.mkdir(parents=True, exist_ok=True)

    records = []
    current_chapter = None

    for page_num in tqdm(range(len(doc)), desc=f"Pages ({book_name})"):
        page = doc.load_page(page_num)
        p = page_num + 1  # 1-based

        # Detect chapter for this page
        ch = detect_chapter(page)
        if ch:
            current_chapter = ch

        # --- TEXT ---
        text = page.get_text()
        if text.strip():
            records.append({
                "type": "text",
                "book": book_name,
                "page": p,
                "chapter": current_chapter,
                "text": text.strip(),
                "image_path": None,
            })

        # --- IMAGES (maps, heraldry, family trees, illustrations) ---
        images = page.get_images(full=True)
        for img_idx, img in enumerate(images, start=1):
            xref = img[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:  # CMYK -> RGB
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                fname = f"page_{p}_img_{img_idx}.png"
                fpath = img_dir / fname
                pix.save(str(fpath))
                pix = None  # free
                web_path = f"/extracted/{book_safe}/{fname}"
                records.append({
                    "type": "image",
                    "book": book_name,
                    "page": p,
                    "chapter": current_chapter,
                    "text": "",          # populated later by 02
                    "image_path": web_path,
                    "local_path": str(fpath),
                })
            except Exception as e:
                print(f"  ⚠️ Image error on page {p}: {e}")

    doc.close()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUT_DIR / f"{book_safe}_raw.jsonl"
    with open(out_file, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"✅ {book_name}: {len(records)} records -> {out_file}")
    print(f"🖼️  Images saved to {img_dir}")


def main():
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"❌ No PDFs found in {PDF_DIR}. Drop your GOT PDFs there and rerun.")
        sys.exit(1)

    for pdf in pdfs:
        # Book name from filename minus extension
        book_name = pdf.stem.replace("_", " ").replace("-", " ").title()
        extract_book(pdf, book_name)

    print("\n🚀 Stage 01 complete. Run 02_describe_images.py next.")


if __name__ == "__main__":
    main()
