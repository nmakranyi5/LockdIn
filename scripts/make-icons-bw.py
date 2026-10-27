# Black-and-white version of the original LockdIn icon (a lock in a circle),
# written into assets/images for iOS, the Android adaptive icon, the splash
# screen and the favicon. It is cut out of the original artwork, so the lock
# keeps its exact shape. Needs Pillow:  pip install pillow && python3 scripts/make-icons-bw.py
# (scripts/make-icons.py makes the blue lock-and-flame version instead.)
import os
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "..", "assets", "images")
SRC = os.path.join(IMG, "lockdin-transparent-1024x1024.png")
S = 1024

src = Image.open(SRC).convert("RGBA")
r, g, b, a = src.split()

# 1) "whiteness": 1 on the lock, 0 on the purple circle (min channel is ~100 on
#    the circle and 255 on the lock), with the soft edges kept.
lo = ImageChops.darker(ImageChops.darker(r, g), b)
white = lo.point(lambda v: max(0, min(255, int((v - 100) * 255 / 155))))
white = ImageChops.multiply(white, a)          # nothing outside the circle

# the grey gradient used behind everything
bg = Image.new("RGB", (S, S))
bpx = bg.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S - 2)
        v = int(58 - 40 * t)
        bpx[x, y] = (v, v, v)

# iOS / default icon: the gradient fills the whole square (the OS rounds it)
icon = bg.convert("RGBA")
icon.paste(Image.new("RGBA", (S, S), (255, 255, 255, 255)), (0, 0), white)
icon.convert("RGB").save(os.path.join(IMG, "lockdin-icon-1024.png"))

# Android adaptive icon: a grey gradient behind, the white lock in front
# (its keyhole is see-through, so it shows the gradient), plus a mono version.
bg.save(os.path.join(IMG, "android-icon-background.png"))
fg = Image.new("RGBA", (S, S), (255, 255, 255, 0))
fg.paste(Image.new("RGBA", (S, S), (255, 255, 255, 255)), (0, 0), white)
fg.save(os.path.join(IMG, "android-icon-foreground.png"))
fg.save(os.path.join(IMG, "android-icon-monochrome.png"))

# splash: just the white lock on the splash colour (black)
fg.save(os.path.join(IMG, "splash-icon.png"))

# favicon
icon.convert("RGB").resize((48, 48), Image.LANCZOS).save(os.path.join(IMG, "favicon.png"))
print("done")
