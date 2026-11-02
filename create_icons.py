# -*- coding: utf-8 -*-
"""
RuleCard -- Icon Generator
Creates 192x192 and 512x512 paper-and-ink PNG icons using only Python stdlib.
Run: python create_icons.py
"""
import math
import os
import struct
import sys
import zlib

PAPER = '#f3ede2'
BACK = '#d8cebe'
ACCENT = '#b8492f'
INK = '#211e19'
CREAM = '#f3ede2'
ACCENT_LIGHT = '#e08a6a'


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def smoothstep(edge0, edge1, x):
    t = clamp((x - edge0) / (edge1 - edge0 + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def rounded_rect_sdf(px, py, cx, cy, half_w, half_h, radius, angle=0.0):
    """Signed distance field for a rotated rounded rectangle."""
    dx = px - cx
    dy = py - cy
    if angle != 0.0:
        c, s = math.cos(angle), math.sin(angle)
        dx, dy = dx * c + dy * s, -dx * s + dy * c
    qx = abs(dx) - half_w + radius
    qy = abs(dy) - half_h + radius
    return (math.sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2)
            + min(max(qx, qy), 0) - radius)


def make_pixel(x, y, size):
    """Return (r, g, b) for one pixel. Flat paper, ink cards, one accent."""
    px = (x / size - 0.5) * 2.0
    py = (y / size - 0.5) * 2.0

    r, g, b = hex_to_rgb(PAPER)

    def paint(cx, cy, half_w, half_h, radius, angle, color):
        nonlocal r, g, b
        d = rounded_rect_sdf(px, py, cx, cy, half_w, half_h, radius, angle)
        if d < 0.025:
            blend = smoothstep(0.025, 0.0, d)
            r = lerp(r, color[0], blend)
            g = lerp(g, color[1], blend)
            b = lerp(b, color[2], blend)

    hw, hh, radius = 0.50, 0.15, 0.055

    # Three stacked rule cards: paper edge, accent card, ink card.
    paint(-0.08, 0.16, hw, hh, radius, -0.18, hex_to_rgb(BACK))
    paint(0.04, 0.08, hw, hh, radius, 0.09, hex_to_rgb(ACCENT))
    paint(-0.02, -0.03, hw, hh, radius, 0.0, hex_to_rgb(INK))

    # Text lines on the top card.
    paint(-0.14, -0.085, 0.28, 0.018, 0.009, 0.0, hex_to_rgb(CREAM))
    paint(-0.21, -0.015, 0.21, 0.018, 0.009, 0.0, hex_to_rgb(CREAM))
    paint(-0.05, 0.055, 0.33, 0.018, 0.009, 0.0, hex_to_rgb(ACCENT_LIGHT))

    return (clamp(int(r), 0, 255),
            clamp(int(g), 0, 255),
            clamp(int(b), 0, 255))


def write_png(filename, size):
    """Write a size*size RGB PNG file."""
    sys.stdout.write('Generating ' + filename + ' (' + str(size) + 'x' + str(size) + ')... ')
    sys.stdout.flush()

    def chunk(tag, data):
        payload = tag + data
        crc = struct.pack('>I', zlib.crc32(payload) & 0xffffffff)
        return struct.pack('>I', len(data)) + payload + crc

    # IHDR: width, height, bit depth 8, colour type 2 (RGB), no interlace.
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)

    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            rows.extend(make_pixel(x, y, size))

    idat = zlib.compress(bytes(rows), 6)

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', idat)
           + chunk(b'IEND', b''))

    os.makedirs(os.path.dirname(filename) or '.', exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)
    print('done (' + str(len(png)) + ' bytes)')


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    write_png(os.path.join(base, 'icons', 'icon-192.png'), 192)
    write_png(os.path.join(base, 'icons', 'icon-512.png'), 512)
    print('')
    print('Icons created! Re-upload the icons/ folder to GitHub.')
