#!/usr/bin/env python3
"""Rewrite exported Netlify published content onto static files in git."""
from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXPORTED = json.loads((ROOT / ".tmp-export" / "published.json").read_text(encoding="utf-8"))
MEDIA = ROOT / ".tmp-export" / "media"
MENU = ROOT / "assets" / "menu"
DATA = ROOT / "js" / "data.js"
I18N = ROOT / "js" / "i18n.js"
PUB_OUT = ROOT / "content" / "published.json"
KEY_RE = re.compile(r"get-media\?key=([^\"'\s]+)")


def dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1)


def save_responsive(src: Path, dest_base: Path) -> tuple[int, int]:
    img = Image.open(src)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    elif img.mode == "L":
        img = img.convert("RGB")
    w, h = img.size
    dest_base.parent.mkdir(parents=True, exist_ok=True)
    for width in (960, 480):
        if w <= width:
            out = img
        else:
            nh = max(1, int(h * (width / w)))
            out = img.resize((width, nh), Image.LANCZOS)
        out.save(dest_base.parent / f"{dest_base.name}-{width}.webp", "WEBP", quality=82, method=6)
    return w, h


def rewrite_item(item: dict) -> dict:
    item = json.loads(json.dumps(item))
    img = item.get("image") or ""
    m = KEY_RE.search(img)
    if not m:
        return item
    src = MEDIA / m.group(1)
    if not src.exists():
        print("missing media", m.group(1), item.get("id"))
        return item
    iid = item.get("id") or src.stem
    w, h = save_responsive(src, MENU / iid)
    item["base"] = f"assets/menu/{iid}"
    item["widths"] = [480, 960]
    item["w"] = w
    item["h"] = h
    item["image"] = f"assets/menu/{iid}-960.webp"
    return item


def replace_assign(text: str, name: str, value) -> str:
    pat = rf"window\.{name} = [\s\S]*?^];"
    repl = f"window.{name} = " + dump(value) + ";"
    new, n = re.subn(pat, repl, text, count=1, flags=re.M)
    if n != 1:
        raise SystemExit(f"failed to replace window.{name}")
    return new


def main():
    items = [rewrite_item(m) for m in EXPORTED.get("menuItems") or []]
    cats = EXPORTED.get("menuCategories") or []
    gallery = EXPORTED.get("gallery") or []
    reviews = EXPORTED.get("reviews") or []

    text = DATA.read_text(encoding="utf-8")
    text = replace_assign(text, "MENU_CATEGORIES", cats)
    text = replace_assign(text, "MENU_ITEMS", items)
    text = replace_assign(text, "GALLERY", gallery)
    text = replace_assign(text, "REVIEWS", reviews)
    DATA.write_text(text, encoding="utf-8")

    translations = EXPORTED.get("translations")
    if translations:
        i18n = I18N.read_text(encoding="utf-8")
        i18n, n = re.subn(
            r"window\.TRANSLATIONS = \{[\s\S]*?\n\};",
            "window.TRANSLATIONS = " + dump(translations) + ";",
            i18n,
            count=1,
        )
        if n != 1:
            raise SystemExit("failed to replace TRANSLATIONS")
        I18N.write_text(i18n, encoding="utf-8")

    published = json.loads(json.dumps(EXPORTED))
    published["menuItems"] = items
    PUB_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUB_OUT.write_text(json.dumps(published, ensure_ascii=False, indent=2), encoding="utf-8")

    blob_left = sum(1 for m in items if m.get("image") and "get-media" in m["image"])
    print(f"baked items={len(items)} gallery={len(gallery)} reviews={len(reviews)} remaining-blob-urls={blob_left}")


if __name__ == "__main__":
    main()
