"""Render public/og.png (1200x630 share card). Run: python3 scripts/make-og.py. Text only, no prices."""
import colorsys, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
G = "/usr/share/fonts/truetype/sand-box/google"

def font(name, size, wght):
    f = ImageFont.truetype(f"{G}/{name}/{name}-VariableFont_wght.ttf", size)
    try:
        f.set_variation_by_axes([wght])
    except Exception:
        pass
    return f

def hsl(h, s, l, a=255):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, l, s)
    return (int(r * 255), int(g * 255), int(b * 255), a)

img = Image.new("RGBA", (W, H), (6, 6, 15, 255))
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(glow)
d.ellipse((620, -80, 1260, 560), fill=hsl(250, 0.9, 0.55, 140))
d.ellipse((-200, 330, 420, 900), fill=hsl(330, 0.9, 0.55, 90))
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(120)))

cx, cy, r = 975, 330, 175
orb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(orb)
for i in range(r, 0, -1):
    t = i / r
    od.ellipse((cx - i - int((1 - t) * 50), cy - i - int((1 - t) * 60), cx + i - int((1 - t) * 50), cy + i - int((1 - t) * 60)),
               fill=hsl(250 + 40 * t, 0.85, 0.30 + 0.55 * (1 - t) ** 1.4))
img = Image.alpha_composite(img, orb)
d = ImageDraw.Draw(img)
num = font("Syne", 130, 800)
d.text((cx, cy), "7", font=num, fill=(255, 255, 255, 235), anchor="mm")

d.text((80, 88), "Huecount", font=font("Syne", 44, 800), fill=(244, 245, 255, 255))
head = font("Syne", 58, 800)
d.text((80, 230), "Tap the count.", font=head, fill=(244, 245, 255, 255))
d.text((80, 320), "Lock the color.", font=head, fill=hsl(250, 0.95, 0.75))
d.text((80, 440), "A one-thumb color fidget. Free, offline,", font=font("Manrope", 30, 600), fill=(196, 199, 220, 255))
d.text((80, 482), "no account, no ads.", font=font("Manrope", 30, 600), fill=(196, 199, 220, 255))
img.convert("RGB").save("public/og.png", optimize=True)
print("wrote public/og.png")
