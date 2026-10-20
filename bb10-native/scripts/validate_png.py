#!/usr/bin/env python3
from __future__ import annotations

import binascii
import struct
import sys
import zlib
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def validate(path: Path, expected_width: int, expected_height: int) -> None:
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("bad_png_signature")

    pos = len(PNG_SIGNATURE)
    width = height = None
    idat = bytearray()
    saw_iend = False

    while pos + 12 <= len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        start = pos + 8
        end = start + length
        crc_end = end + 4
        if crc_end > len(data):
            raise ValueError("truncated_png_chunk")

        payload = data[start:end]
        expected_crc = struct.unpack(">I", data[end:crc_end])[0]
        actual_crc = binascii.crc32(kind + payload) & 0xFFFFFFFF
        if expected_crc != actual_crc:
            raise ValueError(f"bad_png_crc:{kind.decode('latin1')}")

        if kind == b"IHDR":
            width, height = struct.unpack(">II", payload[:8])
        elif kind == b"IDAT":
            idat.extend(payload)
        elif kind == b"IEND":
            saw_iend = True
            break

        pos = crc_end

    if not saw_iend:
        raise ValueError("missing_png_iend")
    if (width, height) != (expected_width, expected_height):
        raise ValueError(f"bad_png_size:{width}x{height}")
    if not idat:
        raise ValueError("missing_png_idat")
    zlib.decompress(bytes(idat))


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: validate_png.py PATH WIDTH HEIGHT", file=sys.stderr)
        return 2
    validate(Path(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]))
    print(f"PASS: valid PNG {sys.argv[2]}x{sys.argv[3]}: {sys.argv[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
