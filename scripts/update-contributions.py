#!/usr/bin/env python3
"""Refresh data/contributions.js from the GitHub profile contribution graph.

github.com serves the profile calendar as plain server-rendered HTML at
/users/<user>/contributions (no auth). The browser can't read it cross-origin,
so the site uses a committed snapshot instead; this script regenerates it.

Run:  python3 scripts/update-contributions.py
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
import urllib.request

USER = "uidops"
URL = f"https://github.com/users/{USER}/contributions"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "contributions.js"

TD_RE = re.compile(r"<td\b[^>]*>", re.I)
TIP_RE = re.compile(
    r'<tool-tip\b[^>]*\bfor="(contribution-day-component-\d+-\d+)"[^>]*>(.*?)</tool-tip>',
    re.S,
)
TOTAL_RE = re.compile(r"([\d,]+)\s*contributions\s+in the last year")


def attr(tag: str, name: str) -> str | None:
    m = re.search(r'\b%s="([^"]*)"' % name, tag)
    return m.group(1) if m else None


def fetch() -> str:
    req = urllib.request.Request(URL, headers={"User-Agent": f"{USER}-site-build"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def parse(html: str) -> tuple[str, str, int]:
    """Return (start ISO date, levels digit string, total contributions)."""
    cells: dict[str, tuple[str, int]] = {}
    for tag in TD_RE.findall(html):
        if "ContributionCalendar-day" not in tag:
            continue
        date = attr(tag, "data-date")
        cid = attr(tag, "id")
        level = attr(tag, "data-level")
        if date and cid and level in ("0", "1", "2", "3", "4"):
            cells[cid] = (date, int(level))
    if len(cells) < 300:
        raise SystemExit(f"only {len(cells)} calendar cells found — page layout changed?")

    counts: dict[str, int] = {}
    for cid, text in TIP_RE.findall(html):
        flat = " ".join(text.split())
        m = re.match(r"(\d+) contributions?", flat)
        if m:
            counts[cid] = int(m.group(1))
        elif flat.startswith("No contributions"):
            counts[cid] = 0

    rows = sorted((date, level, counts.get(cid)) for cid, (date, level) in cells.items())
    dates = [dt.date.fromisoformat(d) for d, _, _ in rows]

    # the graph must be one contiguous Sunday-anchored window, otherwise the
    # renderer's "row = index % 7" weekday mapping silently shifts every cell
    if dates[0].weekday() != 6:
        raise SystemExit(f"window starts on {dates[0]:%A}, expected Sunday")
    for a, b in zip(dates, dates[1:]):
        if (b - a).days != 1:
            raise SystemExit(f"gap in window between {a} and {b}")
    missing = [d for d, _, c in rows if c is None]
    if missing:
        raise SystemExit(f"{len(missing)} cells have no tooltip count (first: {missing[0]})")

    total = sum(c for _, _, c in rows)
    m = TOTAL_RE.search(html)
    if m:
        stated = int(m.group(1).replace(",", ""))
        if stated != total:
            raise SystemExit(f"sum of per-day counts {total} != stated total {stated}")

    levels = "".join(str(level) for _, level, _ in rows)
    return rows[0][0], levels, total


def render(start: str, levels: str, total: int) -> str:
    payload = json.dumps(
        {
            "start": start,
            "total": total,
            "levels": levels,
            "generated": dt.date.today().isoformat(),
        },
        separators=(",", ":"),
    )
    return (
        "/* GitHub contribution calendar snapshot for %s.\n"
        "   Regenerate: python3 scripts/update-contributions.py\n"
        "   (auto-refreshed weekly by .github/workflows/update-contributions.yml). */\n"
        "window.__UIDOPS_CONTRIB = %s;\n" % (USER, payload)
    )


def main() -> int:
    start, levels, total = parse(fetch())
    text = render(start, levels, total)
    if OUT.exists() and OUT.read_text(encoding="utf-8") == text:
        print("contributions unchanged")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(OUT.parents[1])}: {len(levels)} days from {start}, {total} contributions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
