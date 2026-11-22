#!/usr/bin/env python3
"""compile_report_pdf.py: build report/final_report/final_report.pdf from final_report.tex.

The .tex file is the only source of the report. The PDF is always produced by a
real LaTeX engine; there is no HTML/LibreOffice fallback (that path kept its own
copy of the text, drifted out of sync and cropped the figures).

Engines tried, in order: latexmk, pdflatex, tectonic (on PATH or $TECTONIC).
With --download-tectonic, a standalone Tectonic binary is fetched into
~/.cache/fai_project/ when no engine is found.

Usage:
    python3 scripts/compile_report_pdf.py [--max-pages 8] [--download-tectonic]
"""

import argparse
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = REPO_ROOT / "report" / "final_report"
TEX_NAME = "final_report.tex"
PDF_NAME = "final_report.pdf"

TECTONIC_VERSION = "0.15.0"
TECTONIC_URL = (
    "https://github.com/tectonic-typesetting/tectonic/releases/download/"
    f"tectonic%40{TECTONIC_VERSION}/tectonic-{TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz"
)
CACHE_DIR = Path.home() / ".cache" / "fai_project"


def find_tectonic() -> str | None:
    env = os.environ.get("TECTONIC")
    if env and Path(env).is_file():
        return env
    cached = CACHE_DIR / "tectonic"
    if cached.is_file():
        return str(cached)
    return shutil.which("tectonic")


def download_tectonic() -> str:
    if platform.system() != "Linux" or platform.machine() != "x86_64":
        sys.exit("[!] --download-tectonic only supports Linux x86_64; install TeX Live or Tectonic manually.")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    archive = CACHE_DIR / "tectonic.tar.gz"
    print(f"[*] Downloading Tectonic {TECTONIC_VERSION} ...")
    urllib.request.urlretrieve(TECTONIC_URL, archive)
    with tarfile.open(archive) as tar:
        member = tar.getmember("tectonic")
        tar.extract(member, CACHE_DIR, filter="data")
    archive.unlink()
    binary = CACHE_DIR / "tectonic"
    binary.chmod(0o755)
    return str(binary)


def build(out_dir: Path, download: bool) -> None:
    """Compile into out_dir; aux files never touch the report folder."""
    tex = REPORT_DIR / TEX_NAME
    if shutil.which("latexmk"):
        cmd = ["latexmk", "-pdf", "-interaction=nonstopmode", "-halt-on-error", f"-outdir={out_dir}", tex.name]
        runs = 1
    elif shutil.which("pdflatex"):
        cmd = ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", f"-output-directory={out_dir}", tex.name]
        runs = 2  # second pass resolves cross-references
    else:
        tectonic = find_tectonic() or (download_tectonic() if download else None)
        if not tectonic:
            sys.exit(
                "[!] No LaTeX engine found (latexmk, pdflatex or tectonic).\n"
                "    Install TeX Live, set $TECTONIC, or rerun with --download-tectonic."
            )
        cmd = [tectonic, "--keep-logs", "-o", str(out_dir), tex.name]
        runs = 1

    print(f"[*] Compiling with {Path(cmd[0]).name} ...")
    for _ in range(runs):
        proc = subprocess.run(cmd, cwd=REPORT_DIR, capture_output=True, text=True)
        if proc.returncode != 0:
            log = out_dir / "final_report.log"
            tail = log.read_text(errors="replace")[-3000:] if log.exists() else proc.stdout[-3000:] + proc.stderr[-3000:]
            sys.exit(f"[!] LaTeX compilation failed:\n{tail}")


def report_warnings(out_dir: Path) -> None:
    log = out_dir / "final_report.log"
    if not log.exists():
        return
    text = log.read_text(errors="replace")
    issues = re.findall(r"^(Overfull \\hbox.*|LaTeX Warning: (?:Reference|Citation).*undefined.*)$", text, re.M)
    for line in issues:
        print(f"[warn] {line}")


def page_count(pdf: Path) -> int | None:
    if not shutil.which("pdfinfo"):
        return None
    out = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
    m = re.search(r"^Pages:\s+(\d+)", out, re.M)
    return int(m.group(1)) if m else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-pages", type=int, default=8, help="fail if the PDF is longer (default: 8)")
    parser.add_argument("--download-tectonic", action="store_true", help="fetch Tectonic if no LaTeX engine exists")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="report_build_") as tmp:
        out_dir = Path(tmp)
        build(out_dir, args.download_tectonic)
        built = out_dir / PDF_NAME
        if not built.exists():
            sys.exit("[!] Compiler finished but produced no PDF.")
        report_warnings(out_dir)

        pages = page_count(built)
        if pages is not None and pages > args.max_pages:
            sys.exit(f"[!] PDF has {pages} pages (limit {args.max_pages}); not copying it into the report folder.")

        target = REPORT_DIR / PDF_NAME
        shutil.copyfile(built, target)

    print(f"[✓] Wrote {target.relative_to(REPO_ROOT)} ({target.stat().st_size:,} bytes"
          + (f", {pages} pages)" if pages is not None else ")"))


if __name__ == "__main__":
    main()
