"""
Convert Markdown report to LaTeX. Handles only what the report uses:
#/##/### headings, paragraphs, '-' lists, pipe tables, **bold**, `code`.

Default src and out:
  docs/final_report.md -> report/project_proposal_report/final_report.tex

Usage:
  python scripts/report_md_to_tex.py [--src SRC] [--out OUT]
"""
import argparse
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = REPO_ROOT / "docs" / "final_report.md"
DEFAULT_OUT = REPO_ROOT / "report" / "project_proposal_report" / "final_report.tex"

SRC, OUT = DEFAULT_SRC, DEFAULT_OUT
SPECIAL = {'\\': r'\textbackslash{}', '&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#', '_': r'\_',
           '{': r'\{', '}': r'\}', '~': r'\textasciitilde{}', '^': r'\textasciicircum{}'}


def esc(s):
    return ''.join(SPECIAL.get(ch, ch) for ch in s)


def inline(s):
    parts = re.split(r'(`[^`]*`)', s)
    out = []
    for p in parts:
        if p.startswith('`') and p.endswith('`') and len(p) > 1:
            out.append(r'\texttt{' + esc(p[1:-1]) + '}')
        else:
            t = esc(p)
            t = re.sub(r'\*\*(.+?)\*\*', r'\\textbf{\1}', t)
            out.append(t.replace('->', r'$\rightarrow$'))
    return ''.join(out)


def table(rows):
    cells = [[c.strip() for c in r.strip().strip('|').split('|')] for r in rows]
    head, body = cells[0], [r for r in cells[2:]]
    spec = 'p{0.%02d\\linewidth}' % max(8, 90 // len(head))
    lines = [r'\begin{center}\scriptsize', r'\begin{longtable}{' + (spec * len(head)) + '}', r'\toprule',
             ' & '.join(inline(h) for h in head) + r' \\', r'\midrule']
    lines += [' & '.join(inline(c) for c in r) + r' \\' for r in body]
    lines += [r'\bottomrule', r'\end{longtable}', r'\end{center}']
    return lines


def main():
    parser = argparse.ArgumentParser(description="Convert Markdown report to LaTeX")
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC, help="Source markdown file")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output LaTeX file")
    args = parser.parse_args()

    src_path = args.src if args.src.is_absolute() else Path(args.src)
    out_path = args.out if args.out.is_absolute() else Path(args.out)

    md = src_path.read_text(encoding='utf-8').splitlines()
    out = [r'\documentclass[11pt]{article}', r'\usepackage[margin=2cm]{geometry}',
           r'\usepackage{booktabs,longtable,hyperref}', r'\usepackage[T1]{fontenc}']
    i, title = 0, None
    body = []
    while i < len(md):
        line = md[i]
        if line.startswith('|'):
            block = []
            while i < len(md) and md[i].startswith('|'):
                block.append(md[i])
                i += 1
            body += table(block)
            continue
        if line.startswith('- '):
            body.append(r'\begin{itemize}')
            while i < len(md) and (md[i].startswith('- ') or md[i].startswith('  ')):
                if md[i].startswith('- '):
                    body.append(r'\item ' + inline(md[i][2:]))
                else:
                    body.append(inline(md[i].strip()))
                i += 1
            body.append(r'\end{itemize}')
            continue
        if line.startswith('# '):
            title = inline(line[2:])
        elif line.startswith('### '):
            body.append(r'\subsection{' + inline(line[4:]) + '}')
        elif line.startswith('## '):
            body.append(r'\section{' + inline(line[3:]) + '}')
        else:
            body.append(inline(line))
        i += 1
    out += [r'\title{' + (title or 'Report') + '}', r'\date{}', r'\begin{document}', r'\maketitle']
    out += body
    out += [r'\section*{Background}',
            r'Related work: Quoridor agents \cite{jose2022quoridor}, Markov games \cite{littman1994markov}, '
            r'multi-agent RL surveys \cite{busoniu2008comprehensive,zhang2021selective}, '
            r'reinforcement learning \cite{sutton2018reinforcement} and self-play \cite{silver2018alphazero}.',
            r'\bibliographystyle{plain}', r'\bibliography{references}', r'\end{document}']
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text('\n'.join(out) + '\n', encoding='utf-8')
    print(f"wrote {out_path}")


if __name__ == '__main__':
    main()
