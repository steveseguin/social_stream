"""Create gallery WebP images from Electron captures. Requires Pillow.

Run after capture-overlay-gallery.cjs. PNG captures remain available for QA;
pass --clean to remove only those catalogued PNGs after successful conversion.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent.parent
catalog = json.loads((root / 'docs/data/overlay-gallery.json').read_text(encoding='utf8'))
output = root / 'docs/images/overlay-gallery'
missing = []
for entry in catalog:
    source = output / (entry['id'] + '.png')
    if not source.exists():
        if not (root / 'docs' / entry['image']).exists():
            missing.append(entry['id'])
        continue
    with Image.open(source) as original:
        image = original.convert('RGB')
        image.thumbnail((1200, 800))
        image.save(root / 'docs' / entry['image'], 'WEBP', quality=86)
        # Trim the empty preview canvas, never the rendered overlay itself.
        background = image.getpixel((0, 0))
        difference = ImageChops.difference(image, Image.new('RGB', image.size, background))
        mask = difference.convert('L').point(lambda value: 255 if value > 12 else 0)
        box = mask.getbbox()
        if box:
            left, top, right, bottom = box
            image = image.crop((max(0,left-16), max(0,top-16), min(image.width,right+16), min(image.height,bottom+16)))
        image.thumbnail((800,480))
        canvas = Image.new('RGB',(800,480),'#172131')
        canvas.paste(image,((800-image.width)//2,(480-image.height)//2))
        canvas.save(output / (entry['id']+'-thumb.webp'),'WEBP',quality=85)
    if '--clean' in sys.argv:
        source.unlink()
if missing:
    print('Missing captures: ' + ', '.join(missing))
    sys.exit(1)
print('Prepared ' + str(len(catalog)) + ' full screenshots and thumbnails')
