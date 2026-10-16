#!/usr/bin/env python3
"""Export live Netlify published JSON and every get-media image."""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".tmp-export"
MEDIA_DIR = OUT / "media"
BASE = "https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app"
KEY_RE = re.compile(r"get-media\?key=([^\"'\s]+)")


def collect_keys(obj, keys: set[str]):
    if isinstance(obj, dict):
        for v in obj.values():
            collect_keys(v, keys)
    elif isinstance(obj, list):
        for v in obj:
            collect_keys(v, keys)
    elif isinstance(obj, str):
        for m in KEY_RE.finditer(obj):
            keys.add(m.group(1))


def download(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as r:
        dest.write_bytes(r.read())
        return r.headers.get("Content-Type"), dest.stat().st_size


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(BASE + "/.netlify/functions/get-content", timeout=60) as r:
        published = json.loads(r.read().decode("utf-8"))
    (OUT / "published.json").write_text(json.dumps(published, ensure_ascii=False, indent=2), encoding="utf-8")

    keys: set[str] = set()
    collect_keys(published, keys)
    print(f"published items={len(published.get('menuItems') or [])} media_keys={len(keys)}")

    manifest = []
    for key in sorted(keys):
        dest = MEDIA_DIR / key
        url = BASE + "/.netlify/functions/get-media?key=" + key
        ctype, size = download(url, dest)
        print(f"saved {key} {size} {ctype}")
        manifest.append({"key": key, "file": str(dest.relative_to(ROOT)), "bytes": size, "type": ctype})

    (OUT / "media-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("done", OUT)


if __name__ == "__main__":
    main()
