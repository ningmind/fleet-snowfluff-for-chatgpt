from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "assets"
SOURCE = ROOT / "spritesheet.webp"
OUTPUT = ROOT / "spritesheet-crisp.png"
LIGHT_OUTPUT = ROOT / "spritesheet-crisp-light.png"

source = Image.open(SOURCE).convert("RGBA")
if source.size != (1536, 3120):
    raise SystemExit(f"Unexpected source size: {source.size}")

cell_width, cell_height = 192, 208
target_width, target_height = 144, 156
atlas = Image.new("RGBA", (target_width * 8, target_height * 15), (0, 0, 0, 0))

for row in range(15):
    for column in range(8):
        frame = source.crop((
            column * cell_width,
            row * cell_height,
            (column + 1) * cell_width,
            (row + 1) * cell_height,
        ))
        if row in (5, 6):
            # Failed/waiting use the same source artwork, rendered a little
            # smaller at a simple 2/3 source ratio for cleaner pixel edges.
            render_width, render_height = 128, 139
        elif row == 7:
            # The working track is visually undersized inside its source cell.
            # Enlarge it slightly while preserving the original artwork.
            render_width, render_height = 152, 165
        else:
            render_width, render_height = target_width, target_height

        frame = frame.resize((render_width, render_height), Image.Resampling.NEAREST)
        cell = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
        offset_x = (target_width - render_width) // 2
        offset_y = target_height - render_height
        cell.paste(frame, (offset_x, offset_y))
        atlas.paste(cell, (column * target_width, row * target_height))

atlas.save(OUTPUT, "PNG", optimize=True)
print(f"Wrote {OUTPUT} ({atlas.width}x{atlas.height})")

# Light-theme variant: soften only very dark exterior edge pixels. Interior
# details such as eyes remain untouched because they are not next to transparency.
alpha = atlas.getchannel("A")
opaque = alpha.point(lambda value: 255 if value > 32 else 0)
transparent = alpha.point(lambda value: 255 if value <= 32 else 0)
near_transparent = transparent.filter(ImageFilter.MaxFilter(11))
exterior_edge = ImageChops.multiply(opaque, near_transparent)
dark_pixels = atlas.convert("RGB").convert("L").point(lambda value: 255 if value < 155 else 0)
soften_mask = ImageChops.multiply(exterior_edge, dark_pixels)
soft_tint = Image.new("RGBA", atlas.size, (148, 138, 172, 255))
softened = Image.blend(atlas, soft_tint, 0.90)
softened.putalpha(alpha)
light_atlas = Image.composite(softened, atlas, soften_mask)
light_atlas.save(LIGHT_OUTPUT, "PNG", optimize=True)
print(f"Wrote {LIGHT_OUTPUT} ({light_atlas.width}x{light_atlas.height})")
