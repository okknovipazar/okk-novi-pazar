#!/usr/bin/env python3
"""Best-effort DScore YouTube video discovery for OKK Novi Pazar.

Reads the public YouTube Atom feed and matches recent videos to league fixtures.
Never marks a video as 'live' without verification; never overwrites old data
if feed fetch/parse fails or no newer matching video is found.
"""
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCCowik_MtwVKfLBrkxG5YvQ"
MATCHES = ROOT / "data" / "rkscs_rezultati.json"
OUTPUT = ROOT / "data" / "last-video.json"
AT = "{http://www.w3.org/2005/Atom}"
YT = "{http://www.youtube.com/xml/schemas/2015}"


def latin(s):
    # Serbian Cyrillic to Latin, if used in a title.
    chars = "абвгдђежзијклљмнњопрстћуфхцчџш"
    subs = ["a", "b", "v", "g", "d", "dj", "e", "z", "z", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p", "r", "s", "t", "c", "u", "f", "h", "c", "c", "dz", "s"]
    table = dict(zip(chars, subs))
    return "".join(table.get(ch, ch) for ch in str(s).casefold())


def normalized(s):
    s = unicodedata.normalize("NFKD", latin(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s).split())


def is_club(s):
    return "novi pazar" in normalized(s)


def feed_entries():
    request = Request(FEED_URL, headers={"User-Agent": "Mozilla/5.0 OKKNoviPazar/1.0"})
    with urlopen(request, timeout=30) as response:
        xml_bytes = response.read(1_500_000)
    root = ET.fromstring(xml_bytes)
    label = (root.findtext(f"{AT}title") or "").casefold()
    if "digital score" not in label:
        raise RuntimeError(f"Nepoznat YouTube kanal: {label!r}")
    result = []
    for entry in root.findall(f"{AT}entry"):
        video_id = entry.findtext(f"{YT}videoId") or ""
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            continue
        published = entry.findtext(f"{AT}published") or ""
        if not published:
            continue
        result.append({
            "id": video_id,
            "title": entry.findtext(f"{AT}title") or "",
            "published": published,
        })
    return result


def main():
    data = json.loads(MATCHES.read_text(encoding="utf-8"))
    games = [g for g in data["utakmice"] if is_club(g.get("domacin")) or is_club(g.get("gost"))]
    if not games:
        raise RuntimeError("Nisu pronadjene utakmice Novog Pazara u rasporedu.")

    found = []
    for video in feed_entries():
        title_norm = normalized(video["title"])
        if not is_club(video["title"]):
            continue
        # Exclude women's/youth teams: this schedule is for the senior men's league.
        if re.search(r"\b(zkk|zene|zenska|kadeti|juniori|pioniri|u1[24689]|u20)\b", title_norm):
            continue
        try:
            published = datetime.fromisoformat(video["published"].replace("Z", "+00:00"))
            pub_date = published.date()
        except ValueError:
            continue
        candidates = []
        for game in games:
            rival = game["gost"] if is_club(game["domacin"]) else game["domacin"]
            # Require both team names, to avoid attaching unrelated matches.
            if normalized(rival) not in title_norm:
                continue
            date = datetime.strptime(game["datum"], "%Y-%m-%d").date()
            distance = abs((date - pub_date).days)
            if distance <= 10:
                candidates.append((distance, game))
        if not candidates:
            continue
        candidates.sort(key=lambda item: item[0])
        found.append((published, video, candidates[0][1]))

    if not found:
        print("U najnovijim DScore objavama nema potvrđenog para OKK Novi Pazar. Stari video ostaje.")
        return

    found.sort(key=lambda item: item[0], reverse=True)
    published, video, game = found[0]
    old = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    url = f"https://www.youtube.com/watch?v={video['id']}"
    if old.get("youtube_url", "").endswith(video["id"]):
        print("Najnoviji pronađeni video je već objavljen.")
        return
    # Avoid replacing a newer linked fixture with an older one.
    if old.get("date", "") > game["datum"]:
        print("Pronađeni snimak je sa starije utakmice. Sačuvan postojeći video.")
        return
    # Do not overwrite a newer video with a stale feed item.
    if old.get("video_published_at", "") > video["published"]:
        print("Pronađena objava je starija od već sačuvane. Bez izmene.")
        return

    score = (f"{game['poeni_domacin']}:{game['poeni_gost']}"
             if game.get("status") == "zavrsena" and
             game.get("poeni_domacin") is not None and
             game.get("poeni_gost") is not None else "")
    latest = dict(old)
    latest.update({
        "title": video["title"],
        "date": game["datum"],
        "score": score,
        "youtube_url": url,
        "video_published_at": video["published"],
        "source": "DIGITAL Score TV YouTube feed",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    })
    OUTPUT.write_text(json.dumps(latest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Pronađen odgovarajući video: {latest['title']} ({video['id']})")
    print("Napomena: YouTube feed NE potvrđuje da je video trenutno uživo.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Preuzimanje nije uspelo, stari video nije promenjen: {exc}", file=sys.stderr)
        raise
