"""Lightweight pure-Python PDF text extraction utility for resume analysis."""

import re
import zlib


def extract_text_from_pdf_bytes(pdf_bytes: bytes, max_chars: int = 18000) -> str:
    """
    Extract readable ASCII/UTF-8 text segments from PDF content streams without external packages.
    Works reliably on standard text-based PDFs (FlateDecode or uncompressed content streams).
    """
    if not pdf_bytes or not pdf_bytes.lstrip().startswith(b"%PDF"):
        return ""

    chunks: list[str] = []

    # 1. Inspect uncompressed literal strings
    raw_latin = pdf_bytes.decode("latin-1", errors="ignore")
    chunks.extend(_extract_pdf_text_operators(raw_latin))

    # 2. Decompress FlateDecode streams
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf_bytes, re.DOTALL):
        stream_data = match.group(1)
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
            try:
                decompressed = zlib.decompress(stream_data, wbits)
                text_stream = decompressed.decode("latin-1", errors="ignore")
                extracted = _extract_pdf_text_operators(text_stream)
                if extracted:
                    chunks.extend(extracted)
                break
            except Exception:
                continue

    combined = "\n".join(line for line in chunks if line.strip())
    combined = re.sub(r"[ \t]+", " ", combined)
    combined = re.sub(r"\n{3,}", "\n\n", combined).strip()
    return combined[:max_chars]


def _extract_pdf_text_operators(stream_text: str) -> list[str]:
    """Pull text inside (...) Tj and [...] TJ PDF operators."""
    lines: list[str] = []

    # Handle Tj: (hello) Tj
    for m in re.finditer(r"\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj", stream_text):
        cleaned = _unescape_pdf_string(m.group(1))
        if cleaned.strip():
            lines.append(cleaned)

    # Handle TJ: [(hel) -10 (lo)] TJ
    for m in re.finditer(r"\[(.*?)\]\s*TJ", stream_text, re.DOTALL):
        parts = re.findall(r"\(([^()\\]*(?:\\.[^()\\]*)*)\)", m.group(1))
        joined = "".join(_unescape_pdf_string(p) for p in parts)
        if joined.strip():
            lines.append(joined)

    return lines


def _unescape_pdf_string(val: str) -> str:
    val = (
        val.replace(r"\(", "(")
        .replace(r"\)", ")")
        .replace(r"\\", "\\")
        .replace(r"\n", "\n")
        .replace(r"\r", " ")
        .replace(r"\t", " ")
    )
    # Strip non-printable control chars except newline
    return "".join(ch for ch in val if ch == "\n" or 32 <= ord(ch) <= 126)
