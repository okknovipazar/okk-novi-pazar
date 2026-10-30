#!/usr/bin/env python3
"""OKK Novi Pazar: snimci utakmica sa YouTube kanala RKS Centralna Srbija.

Koristi YouTube Data API v3 preko GitHub Actions tajne YOUTUBE_API_KEY.
Ne preuzima same video datoteke. Ne dira DScore prenos uživo.
"""
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "data" / "rks-snimci.json"
API = "https://www.googleapis.com/youtube/v3/"
HANDLE = "@rkscentralnasrbija9558"
CHANNEL_LINK = "https://www.youtube.com/" + HANDLE
PAGE_LIMIT = 6  # do 300 poslednjih videa sa kanala po proveri
MAX_SAVED = 36
KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()


def api_get(endpoint, **params):
    if not KEY:
        raise RuntimeError("Nedostaje GitHub Secret YOUTUBE_API_KEY")
    query = urlencode({**params, "key": KEY})
    req = Request(API + endpoint + "?" + query, headers={"User-Agent": "OKK-Novi-Pazar-Archive/1.0"})
    try:
        with urlopen(req, timeout=25) as response:
            return json.load(response)
    except HTTPError as exc:
        # Ne ispisujemo URL jer sadrzi tajni API kljuc.
        raise RuntimeError(f"YouTube API nije odgovorio uspešno (HTTP {exc.code}).") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("Trenutno nema veze sa YouTube API-jem.") from exc


def norm(text):
    translit = str.maketrans({
        "а":"a","б":"b","в":"v","г":"g","д":"d","ђ":"dj","е":"e","ж":"z",
        "з":"z","и":"i","ј":"j","к":"k","л":"l","љ":"lj","м":"m","н":"n",
        "њ":"nj","о":"o","п":"p","р":"r","с":"s","т":"t","ћ":"c","у":"u",
        "ф":"f","х":"h","ц":"c","ч":"c","џ":"dz","ш":"s",
    })
    t = (text or "").lower().translate(translit)
    t = "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", t).split())


def about_pazar(title):
    t = norm(title)
    if not ("novi pazar" in t or "okk pazar" in t):
        return False
    words = set(t.split())
    # Ne mesamo utakmice seniorskog tima sa zenskim i mladjim kategorijama.
    excluded = {"zenska", "zenske", "zene", "pioniri", "pionirke", "kadeti",
                "kadetkinje", "juniori", "juniorke", "junior", "pionir", "mladje", "mladi"}
    if excluded.intersection(words) or re.search(r"\bu\s?(?:12|13|14|15|16|17|18|19|20)\b", t):
        return False
    return True


def duration_seconds(iso):
    m = re.fullmatch(r"P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)", iso or "")
    if not m:
        return 0
    h, mi, se = (int(v or 0) for v in m.groups())
    return h * 3600 + mi * 60 + se


def discover_channel():
    data = api_get("channels", part="snippet,contentDetails", forHandle=HANDLE)
    channels = data.get("items") or []
    if not channels:
        raise RuntimeError("Nije pronađen YouTube kanal RKS Centralna Srbija za navedeni @handle.")
    channel = channels[0]
    playlist = channel.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    if not playlist:
        raise RuntimeError("YouTube kanal nema dostupnu listu objavljenih snimaka.")
    return channel.get("snippet", {}).get("title", "RKS Centralna Srbija"), playlist


def latest_uploads(playlist):
    videos = []
    page = None
    for _ in range(PAGE_LIMIT):
        args = {"part": "snippet,contentDetails", "playlistId": playlist, "maxResults": 50}
        if page:
            args["pageToken"] = page
        payload = api_get("playlistItems", **args)
        for it in payload.get("items", []):
            snippet = it.get("snippet", {})
            title = snippet.get("title", "")
            video_id = it.get("contentDetails", {}).get("videoId", "")
            if about_pazar(title) and re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
                videos.append({"id": video_id, "title": title, "published": snippet.get("publishedAt", "")})
        page = payload.get("nextPageToken")
        if not page:
            break
    # Izbegavamo duplikate (playlist može sadržati ponavljanja).
    return list({v["id"]: v for v in videos}.values())


def video_details(uploaded):
    chosen = []
    for start in range(0, len(uploaded), 50):
        batch = uploaded[start:start + 50]
        data = api_get("videos", part="snippet,contentDetails,status,liveStreamingDetails",
                       id=",".join(v["id"] for v in batch))
        for v in data.get("items", []):
            sid = v.get("id", "")
            info = v.get("snippet", {})
            status = v.get("status", {})
            content = v.get("contentDetails", {})
            if status.get("privacyStatus") != "public" or status.get("embeddable") is not True:
                continue
            if info.get("liveBroadcastContent") in ("live", "upcoming"):
                continue
            region = content.get("regionRestriction") or {}
            if "RS" in region.get("blocked", []):
                continue
            if "allowed" in region and "RS" not in region["allowed"]:
                continue
            seconds = duration_seconds(content.get("duration", ""))
            if seconds < 15 * 60:  # samo duži snimci utakmica, ne kratki klipovi
                continue
            chosen.append({
                "id": sid,
                "title": info.get("title", "Utakmica OKK Novi Pazar")[:180],
                "date": (info.get("publishedAt") or "")[:10],
                "published_at": info.get("publishedAt", ""),
                "duration_seconds": seconds,
                "youtube_url": "https://www.youtube.com/watch?v=" + sid,
                "thumbnail_url": "https://i.ytimg.com/vi/" + sid + "/hqdefault.jpg",
                "source": "RKS Centralna Srbija",
            })
    return chosen


def main():
    channel_name, playlist = discover_channel()
    print(f"RKS kanal: {channel_name}")
    uploads = latest_uploads(playlist)
    print(f"Kandidati sa Novi Pazar u naslovu: {len(uploads)}")
    fresh = video_details(uploads)
    try:
        existing = json.loads(DEST.read_text(encoding="utf-8"))
        old_videos = existing.get("videos", [])
    except (FileNotFoundError, json.JSONDecodeError, AttributeError):
        existing, old_videos = {}, []
    combined = {}
    # Ostaviti prethodno sačuvane snimke i kada izađu iz poslednjih 300 objava.
    for item in old_videos + fresh:
        vid = item.get("id", "") if isinstance(item, dict) else ""
        if re.fullmatch(r"[A-Za-z0-9_-]{11}", vid):
            combined[vid] = item
    videos = sorted(combined.values(), key=lambda x: x.get("published_at", ""), reverse=True)[:MAX_SAVED]
    result = {"channel": CHANNEL_LINK, "channel_name": channel_name, "videos": videos}
    if result == {k: existing.get(k) for k in ("channel", "channel_name", "videos")}:
        print(f"Bez promene. U arhivi: {len(videos)} snimaka.")
        return
    result["updated_at"] = datetime.now(timezone.utc).isoformat()
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Upisano: {len(videos)} snimaka. Novi na ovoj proveri: {len(fresh)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("GREŠKA: " + str(e), file=sys.stderr)
        sys.exit(1)
