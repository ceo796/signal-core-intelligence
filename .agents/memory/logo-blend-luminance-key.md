---
name: Blend light-on-dark logos into a dark page background
description: How to make light-gray logos (on a dark boxed image) blend seamlessly onto a dark page, and which image tools exist in this environment.
---

# Blending light-on-dark logos into a dark background

When a logo strip is a baked PNG of light-gray logos on a near-black box (with
border/divider lines) and it needs to "blend" into a dark page background:

**Do NOT use the AI background-removal tool.** It treats low-contrast
gray-on-black as ambiguous and eats away the logos (mangled output).

**Use ImageMagick luminance keying instead.** The trick that makes it clean:
the box background, frame border, and center divider sit in a *separate, lower*
luminance band than the logos. Measure both first:
- Sample max gray of pure-frame regions (image edges/divider, where no logo
  reaches): e.g. `magick src -colorspace Gray -crop WxH+X+Y +repage -format "%[fx:round(maxima*255)]" info:`
- Sample max gray of logo regions.
If frame-max (e.g. ~55) is well below logo-max (e.g. ~196), pick a black point
*just above* the frame max so every frame/divider line goes fully transparent
while the logos survive:

```
magick src.png \( +clone -colorspace Gray -level 24%,36% \) \
  -alpha off -compose CopyOpacity -composite out.png
```

(`-level black%,white%`: below black→alpha 0, above white→opaque, linear ramp
gives anti-aliased edges. Bright=opaque because we did NOT negate.)

**Verify, don't eyeball.** Spot-samples can land on transparent gaps and miss
thin frame lines. Scan whole edge/divider *bands* for max alpha:
`magick out.png -alpha extract -crop 1949x6+0+391 +repage -format "%[fx:round(maxima*255)]" info:`
Expect 0 on top/bottom/left/right/center bands.

**Then control on-page scale:** `magick out.png -trim +repage -bordercolor none
-border 44x34 out.png` to drop excess transparent padding and re-add a symmetric
margin, so CSS `max-width` maps predictably to the visible logo size. Re-check on
the real page bg by compositing: `magick -size WxH xc:'#PAGEBG' out.png -gravity center -composite preview.png`.

**Why:** AI bg-removal needs contrast it doesn't have here; luminance keying
exploits the real signal (frame is darker than logos). Trimming matters because
a full-canvas transparent strip adds uneven vertical gap when scaled.

## Environment note
This container has **ImageMagick 7 (`magick`/`convert`) and `ffmpeg`** on PATH,
but **no `python3`, and no node `sharp`/`jimp`/`pngjs`/`canvas`**. Reach for
`magick` for any one-off raster image transform.
