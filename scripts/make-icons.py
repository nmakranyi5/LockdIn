# Draws the LockdIn app icon set into assets/images: a blue lock with a flame
# (the streak) on the app's dark background. Needs Pillow:
#   pip install pillow && python3 scripts/make-icons.py
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "images")
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 3                      # supersampling
N = 1024 * S

def sc(v): return int(round(v * S))

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def vgrad(size, top, bottom, diag=False):
    w, h = size
    g = Image.new("RGBA", size)
    px = g.load()
    # build a 1-D ramp then stretch (fast)
    ramp = Image.new("RGBA", (1, 256))
    for y in range(256):
        ramp.putpixel((0, y), lerp(top, bottom, y / 255) + (255,))
    g = ramp.resize((w, h), Image.BILINEAR)
    return g

def bezier(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n
        a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t ** 2; d = t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out

def flame_polygon(cx, cy, w, h):
    """A flame/teardrop centred on (cx, cy): pointed top, round bottom."""
    top = (cx, cy - h / 2)
    r = w / 2
    bc = (cx, cy + h / 2 - r)              # centre of the round bottom
    left = (cx - r, bc[1]); right = (cx + r, bc[1])
    pts = bezier(top, (cx + w * 0.02, cy - h * 0.18), (right[0], bc[1] - h * 0.22), right)
    # arc around the bottom, right -> left
    for i in range(1, 60):
        a = math.pi * i / 60
        pts.append((bc[0] + r * math.cos(a), bc[1] + r * math.sin(a)))
    pts += list(reversed(bezier(top, (cx - w * 0.02, cy - h * 0.18), (left[0], bc[1] - h * 0.22), left)))
    return [(sc(x), sc(y)) for x, y in pts]

def lock_layers(scale=1.0, cx=512, cy=500):
    """Returns (shackle_mask, body_mask, flame_poly_big, flame_poly_small) in supersampled coordinates."""
    def T(x, y): return (cx + (x - 512) * scale, cy + (y - 500) * scale)
    def box(x0, y0, x1, y1):
        a = T(x0, y0); b = T(x1, y1); return [sc(a[0]), sc(a[1]), sc(b[0]), sc(b[1])]
    shackle = Image.new("L", (N, N), 0); d = ImageDraw.Draw(shackle)
    d.rounded_rectangle(box(350, 150, 674, 470), radius=sc(162 * scale), fill=255)
    d.rounded_rectangle(box(406, 206, 618, 480), radius=sc(106 * scale), fill=0)
    body = Image.new("L", (N, N), 0); d = ImageDraw.Draw(body)
    d.rounded_rectangle(box(302, 425, 722, 780), radius=sc(84 * scale), fill=255)
    fx, fy = T(512, 612)
    big = flame_polygon(fx, fy, 150 * scale, 215 * scale)
    fx2, fy2 = T(512, 650)
    small = flame_polygon(fx2, fy2, 78 * scale, 112 * scale)
    return shackle, body, big, small

def paste_fill(img, mask, fill):
    layer = Image.new("RGBA", img.size, fill) if isinstance(fill, tuple) else fill
    img.paste(layer, (0, 0), mask)

def draw_mark(img, scale=1.0, cy=500, mono=False):
    shackle, body, big, small = lock_layers(scale, cy=cy)
    if mono:
        white = (255, 255, 255, 255)
        paste_fill(img, ImageChops.lighter(shackle, body), white)
        # cut the flame out of the body
        hole = Image.new("L", (N, N), 0); ImageDraw.Draw(hole).polygon(big, fill=255)
        a = img.getchannel("A"); a = ImageChops.subtract(a, hole); img.putalpha(a)
        return
    # soft shadow under the body for depth
    sh = Image.new("L", (N, N), 0)
    sh.paste(ImageChops.lighter(shackle, body), (0, sc(14)))
    sh = sh.filter(ImageFilter.GaussianBlur(sc(22)))
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 150)); img.paste(shadow, (0, 0), sh.point(lambda v: int(v * 0.55)))
    # shackle: light steel
    paste_fill(img, shackle, vgrad((N, N), (236, 244, 255), (176, 202, 240)))
    # body: the app's accent blue, brighter at the top
    paste_fill(img, body, vgrad((N, N), (104, 170, 245), (52, 112, 208)))
    # a thin highlight along the top edge of the body
    hi = Image.new("L", (N, N), 0); d = ImageDraw.Draw(hi)
    bb = body.getbbox(); d.rounded_rectangle([bb[0] + sc(6), bb[1] + sc(5), bb[2] - sc(6), bb[1] + sc(60)], radius=sc(60), fill=70)
    hi = ImageChops.multiply(hi, body)
    paste_fill(img, hi, (255, 255, 255, 255))
    # flame in the keyhole's place: streak orange with a warm core
    fm = Image.new("L", (N, N), 0); ImageDraw.Draw(fm).polygon(big, fill=255)
    fb = fm.getbbox()
    flame = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    g = vgrad((fb[2] - fb[0], fb[3] - fb[1]), (255, 190, 80), (255, 98, 40))
    flame.paste(g, (fb[0], fb[1]))
    img.paste(flame, (0, 0), fm)
    cm = Image.new("L", (N, N), 0); ImageDraw.Draw(cm).polygon(small, fill=255)
    paste_fill(img, cm, (255, 226, 140, 255))

def background():
    bg = vgrad((N, N), (28, 28, 40), (9, 9, 14))
    glow = Image.new("L", (N, N), 0)
    ImageDraw.Draw(glow).ellipse([sc(212), sc(180), sc(812), sc(780)], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(sc(130))).point(lambda v: int(v * 0.30))
    bg.paste(Image.new("RGBA", (N, N), (74, 144, 226, 255)), (0, 0), glow)
    return bg

def out(img, name, size=1024, flatten=False):
    name = os.path.join(OUT, name)
    im = img.resize((size, size), Image.LANCZOS)
    if flatten:
        base = Image.new("RGB", im.size, (9, 9, 14)); base.paste(im, (0, 0), im); im = base
    im.save(name)

# iOS / default icon: full-bleed square, no transparency (the OS rounds the corners)
icon = background(); draw_mark(icon, 1.0, cy=547); out(icon, "lockdin-icon-1024.png", 1024, flatten=True)
# Android adaptive icon: the system masks and zooms it, so keep the mark in the middle ~60%
fg = Image.new("RGBA", (N, N), (0, 0, 0, 0)); draw_mark(fg, 0.8, cy=547 if False else 512 + 35 * 0.8); out(fg, "android-icon-foreground.png")
bgl = background(); out(bgl, "android-icon-background.png", flatten=True)
mono = Image.new("RGBA", (N, N), (0, 0, 0, 0)); draw_mark(mono, 0.8, cy=512 + 35 * 0.8, mono=True); out(mono, "android-icon-monochrome.png")
# splash: just the mark, on the app's background colour
sp = Image.new("RGBA", (N, N), (0, 0, 0, 0)); draw_mark(sp, 1.0, cy=547); out(sp, "splash-icon.png", 1024)
# favicon
out(icon, "favicon.png", 48, flatten=True)
print("done")
