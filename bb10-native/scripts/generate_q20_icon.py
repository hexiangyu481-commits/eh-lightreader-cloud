#!/usr/bin/env python3
from __future__ import annotations

import binascii
import struct
import sys
import zlib
from pathlib import Path


SIZE = 114
BG = (28, 31, 36, 255)
FG = (244, 246, 248, 255)
ACCENTS = {
    "status": (80, 200, 120, 255),
    "files": (70, 160, 245, 255),
    "reader": (240, 180, 70, 255),
    "books": (170, 120, 245, 255),
    "chat": (60, 205, 190, 255),
    "r": (235, 95, 125, 255),
    "x": (235, 235, 235, 255),
    "term": (120, 220, 105, 255),
    "home": (106, 194, 215, 255),
}


def blank() -> list[list[tuple[int, int, int, int]]]:
    return [[BG for _ in range(SIZE)] for _ in range(SIZE)]


def rect(px, x0, y0, x1, y1, color):
    x0, x1 = sorted((max(0, x0), min(SIZE - 1, x1)))
    y0, y1 = sorted((max(0, y0), min(SIZE - 1, y1)))
    for y in range(y0, y1 + 1):
        row = px[y]
        for x in range(x0, x1 + 1):
            row[x] = color


def line(px, x0, y0, x1, y1, color, width=5):
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    radius = max(0, width // 2)
    while True:
        rect(px, x0 - radius, y0 - radius, x0 + radius, y0 + radius, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def border(px, color):
    rect(px, 7, 7, SIZE - 8, 11, color)
    rect(px, 7, SIZE - 12, SIZE - 8, SIZE - 8, color)
    rect(px, 7, 7, 11, SIZE - 8, color)
    rect(px, SIZE - 12, 7, SIZE - 8, SIZE - 8, color)


def draw_status(px, a):
    line(px, 20, 62, 37, 62, FG, 5)
    line(px, 37, 62, 47, 39, a, 6)
    line(px, 47, 39, 58, 80, a, 6)
    line(px, 58, 80, 69, 53, a, 6)
    line(px, 69, 53, 79, 62, a, 6)
    line(px, 79, 62, 94, 62, FG, 5)


def draw_files(px, a):
    rect(px, 20, 39, 94, 82, a)
    rect(px, 20, 31, 53, 45, a)
    rect(px, 25, 47, 89, 77, (38, 44, 52, 255))


def draw_reader(px, a):
    rect(px, 28, 22, 85, 91, FG)
    rect(px, 69, 22, 85, 38, a)
    for y in (47, 58, 69, 80):
        rect(px, 38, y, 75, y + 3, (55, 61, 68, 255))


def draw_books(px, a):
    line(px, 56, 33, 56, 86, FG, 4)
    line(px, 55, 37, 39, 31, a, 5)
    line(px, 39, 31, 22, 35, a, 5)
    line(px, 22, 35, 22, 78, a, 5)
    line(px, 22, 78, 41, 75, a, 5)
    line(px, 41, 75, 55, 82, a, 5)
    line(px, 58, 37, 75, 31, FG, 5)
    line(px, 75, 31, 92, 35, FG, 5)
    line(px, 92, 35, 92, 78, FG, 5)
    line(px, 92, 78, 73, 75, FG, 5)
    line(px, 73, 75, 58, 82, FG, 5)


def draw_chat(px, a):
    rect(px, 20, 27, 94, 75, a)
    rect(px, 28, 35, 86, 67, (38, 44, 52, 255))
    line(px, 41, 73, 31, 90, a, 8)
    for x in (42, 57, 72):
        rect(px, x, 49, x + 5, 54, FG)


def draw_r(px, a):
    rect(px, 29, 24, 38, 91, FG)
    rect(px, 38, 24, 72, 32, a)
    rect(px, 69, 31, 79, 58, a)
    rect(px, 38, 55, 72, 63, a)
    line(px, 56, 62, 84, 91, FG, 8)


def draw_x(px, a):
    line(px, 28, 27, 86, 87, a, 9)
    line(px, 86, 27, 28, 87, FG, 9)


def draw_term(px, a):
    line(px, 27, 39, 49, 57, a, 7)
    line(px, 49, 57, 27, 75, a, 7)
    rect(px, 56, 73, 87, 80, FG)


def draw_home(px, a):
    line(px, 22, 55, 57, 27, a, 7)
    line(px, 57, 27, 92, 55, a, 7)
    rect(px, 30, 53, 84, 88, FG)
    rect(px, 51, 66, 63, 88, (38, 44, 52, 255))
    rect(px, 36, 62, 46, 72, a)
    rect(px, 68, 62, 78, 72, a)


DRAWERS = {
    "status": draw_status,
    "files": draw_files,
    "reader": draw_reader,
    "books": draw_books,
    "chat": draw_chat,
    "r": draw_r,
    "x": draw_x,
    "term": draw_term,
    "home": draw_home,
}


def png_bytes(px) -> bytes:
    raw = bytearray()
    for row in px:
        raw.append(0)
        for rgba in row:
            raw.extend(rgba)

    def chunk(kind: bytes, payload: bytes) -> bytes:
        crc = binascii.crc32(kind + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc)

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    return (
        signature
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in DRAWERS:
        print("usage: generate_q20_icon.py {status|files|reader|books|chat|r|x|term|home} OUTPUT", file=sys.stderr)
        return 2

    app_id = sys.argv[1]
    out = Path(sys.argv[2])
    px = blank()
    accent = ACCENTS[app_id]
    border(px, accent)
    DRAWERS[app_id](px, accent)
    out.write_bytes(png_bytes(px))
    print(f"PASS: generated {app_id} icon: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
