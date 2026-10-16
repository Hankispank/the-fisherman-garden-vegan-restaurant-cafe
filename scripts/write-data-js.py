#!/usr/bin/env python3
"""Write js/data.js from content/published.json as valid JS."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
pub = json.loads((ROOT / "content" / "published.json").read_text(encoding="utf-8"))
header = """/*
 * ============================================================
 * EDITABLE FILE — menu, gallery & review content
 * ------------------------------------------------------------
 * Filled by Researcher apply step. See Researcher/runs/<slug>/research.json
 * ============================================================
 */
"""

def dump(name, value):
    return f"window.{name} = " + json.dumps(value, ensure_ascii=False, indent=1) + ";\n\n"

text = (
    header
    + dump("MENU_CATEGORIES", pub.get("menuCategories") or [])
    + dump("MENU_ITEMS", pub.get("menuItems") or [])
    + dump("GALLERY", pub.get("gallery") or [])
    + dump("REVIEWS", pub.get("reviews") or [])
)
(ROOT / "js" / "data.js").write_text(text, encoding="utf-8")
print("wrote js/data.js", len(pub.get("menuItems") or []), "items")
