#!/usr/bin/env python3
"""OKK Novi Pazar / Digital Score TV discovery.

Public channel feed: newest matching video. Optional official YouTube Data API:
validates Serbian availability and active live broadcasts. Never guesses LIVE.
Set YOUTUBE_API_KEY as a GitHub Actions repository secret; never put it in code.
"""
import json
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
GAMES_FILE = ROOT / 'data' / 'rkscs_rezultati.json'
OUTPUT = ROOT / 'data' / 'last-video.json'
CHANNEL_ID = 'UCCowik_MtwVKfLBrkxG5YvQ'
API_KEY = os.environ.get('YOUTUBE_API_KEY', '').strip()
FEED = f'https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}'
ATOM = '{http://www.w3.org/2005/Atom}'
YT = '{http://www.youtube.com/xml/schemas/2015}'
BELGRADE = ZoneInfo('Europe/Belgrade')
# The 25 October Sabac - Novi Pazar video is blocked by an SME claim.
BLOCKED_IDS = {'MzEYki5EZjs'}


def normalize(value):
    # Serbian Cyrillic transliteration; Latin accents removed below.
    table = str.maketrans({
        'а':'a','б':'b','в':'v','г':'g','д':'d','ђ':'dj','е':'e','ж':'z',
        'з':'z','и':'i','ј':'j','к':'k','л':'l','љ':'lj','м':'m','н':'n',
        'њ':'nj','о':'o','п':'p','р':'r','с':'s','т':'t','ћ':'c','у':'u',
        'ф':'f','х':'h','ц':'c','ч':'c','џ':'dz','ш':'s'
    })
    raw = str(value or '').casefold().translate(table)
    raw = ''.join(c for c in unicodedata.normalize('NFKD', raw)
                  if not unicodedata.combining(c))
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', raw).split())


def is_club(name):
    return 'novi pazar' in normalize(name)


def request_json(url, params):
    params = dict(params, key=API_KEY)
    req = Request(url + '?' + urlencode(params), headers={'User-Agent':'OKKNoviPazar/2.0'})
    with urlopen(req, timeout=25) as r:
        return json.load(r)


def feed_entries():
    req = Request(FEED, headers={'User-Agent': 'Mozilla/5.0 OKKNoviPazar/2.0'})
    with urlopen(req, timeout=25) as r:
        xml = r.read(1_500_000)
    root = ET.fromstring(xml)
    channel_title = normalize(root.findtext(f'{ATOM}title') or '')
    if 'digital score' not in channel_title:
        raise RuntimeError('YouTube feed ne pripada očekivanom DIGITAL Score TV kanalu')
    entries = []
    for entry in root.findall(f'{ATOM}entry'):
        vid = entry.findtext(f'{YT}videoId') or ''
        published = entry.findtext(f'{ATOM}published') or ''
        if re.fullmatch(r'[A-Za-z0-9_-]{11}', vid) and published:
            entries.append({'id':vid,'title':entry.findtext(f'{ATOM}title') or '',
                            'published':published})
    return entries


def match_video(video, games):
    title = normalize(video['title'])
    if not is_club(title) or video['id'] in BLOCKED_IDS:
        return None
    if re.search(r'\b(zkk|zenska|zene|kadeti|juniori|pioniri|u14|u16|u18|u19|u20)\b', title):
        return None
    try:
        date = datetime.fromisoformat(video['published'].replace('Z','+00:00')).date()
    except (ValueError, TypeError):
        return None
    options = []
    for game in games:
        rival = game['gost'] if is_club(game['domacin']) else game['domacin']
        if normalize(rival) not in title:
            continue
        gap = abs((date - datetime.strptime(game['datum'], '%Y-%m-%d').date()).days)
        if gap <= 10:
            options.append((gap, game))
    return min(options, key=lambda pair: pair[0])[1] if options else None


def eligible_for_live_check(games, now):
    candidates = []
    for g in games:
        if g.get('status') == 'zavrsena' or g.get('vreme') in (None, '', '00:00'):
            continue
        try:
            start = datetime.fromisoformat(g['datum'] + 'T' + g['vreme']).replace(tzinfo=BELGRADE)
        except ValueError:
            continue
        if -timedelta(hours=6) <= start - now.astimezone(BELGRADE) <= timedelta(hours=5):
            candidates.append(g)
    return candidates


def api_videos(ids):
    if not ids or not API_KEY:
        return {}
    unique = list(dict.fromkeys(ids))[:50]
    result = request_json('https://www.googleapis.com/youtube/v3/videos', {
        'part':'snippet,status,contentDetails,liveStreamingDetails', 'id': ','.join(unique)
    })
    return {item['id']:item for item in result.get('items', [])}


def allowed_in_serbia(item):
    if not item or item.get('status',{}).get('privacyStatus') != 'public':
        return False
    status = item.get('status', {})
    if status.get('embeddable') is not True:
        return False
    restriction = item.get('contentDetails', {}).get('regionRestriction', {})
    if 'allowed' in restriction and 'RS' not in restriction['allowed']:
        return False
    if 'RS' in restriction.get('blocked', []):
        return False
    return True


def currently_live(item):
    details = item.get('liveStreamingDetails', {})
    return (item.get('snippet',{}).get('liveBroadcastContent') == 'live'
            and bool(details.get('actualStartTime'))
            and not details.get('actualEndTime'))


def search_live():
    result = request_json('https://www.googleapis.com/youtube/v3/search', {
        'part':'snippet','channelId':CHANNEL_ID, 'type':'video',
        'eventType':'live','maxResults':'20'
    })
    return [{'id':x.get('id',{}).get('videoId',''),
             'title':x.get('snippet',{}).get('title',''),
             'published':x.get('snippet',{}).get('publishedAt','')}
            for x in result.get('items', [])]


def main():
    now = datetime.now(timezone.utc)
    games_data = json.loads(GAMES_FILE.read_text(encoding='utf-8'))
    games = [g for g in games_data['utakmice']
             if is_club(g.get('domacin')) or is_club(g.get('gost'))]
    if not games:
        raise RuntimeError('U RKSCS rasporedu nema utakmica Novog Pazara')
    old = json.loads(OUTPUT.read_text(encoding='utf-8')) if OUTPUT.exists() else {}
    if not isinstance(old, dict):
        raise RuntimeError('last-video.json nije objekat')

    feed = feed_entries()
    matches = [(entry, match_video(entry, games)) for entry in feed]
    matches = [(v,g) for v,g in matches if g]
    verified = {}
    if API_KEY:
        try:
            verified = api_videos([v['id'] for v,g in matches])
            matches = [(v,g) for v,g in matches if allowed_in_serbia(verified.get(v['id']))]
        except Exception as e:
            print('YouTube API nije dostupan, ne potvrđujemo status: ' + str(e))
            verified = {}
            # Sa API ključem ne objavljujemo nov video bez provere.
            matches = []

    live_candidates = []
    if API_KEY and eligible_for_live_check(games, now):
        try:
            live_feed = search_live()
            live_videos = api_videos([v['id'] for v in live_feed])
            for video in live_feed:
                game = match_video(video, games)
                if not game or game not in eligible_for_live_check(games, now):
                    continue
                item = live_videos.get(video['id'])
                if allowed_in_serbia(item) and currently_live(item):
                    live_candidates.append((video, game))
        except Exception as e:
            print('Nije uspela potvrda uživo: ' + str(e))

    if live_candidates:
        # Date-based sorting of YouTube results; choose most recently published valid live.
        video, game = max(live_candidates, key=lambda pair: pair[0]['published'])
        selected = (video, game, True)
    elif matches:
        video, game = max(matches, key=lambda pair: pair[0]['published'])
        selected = (video, game, False)
    else:
        selected = None

    out = dict(old)
    if selected:
        video, game, is_live = selected
        # Do not regress from a newer recorded fixture to an older one.
        if not out.get('date') or game['datum'] >= out['date'] or is_live:
            score = (f"{game['poeni_domacin']}:{game['poeni_gost']}"
                     if game.get('status') == 'zavrsena' and
                     game.get('poeni_domacin') is not None and
                     game.get('poeni_gost') is not None else '')
            out.update({
                'title':video['title'],'date':game['datum'],'score':score,
                'youtube_url':'https://www.youtube.com/watch?v=' + video['id'],
                'video_published_at':video['published'],
                'source':'DIGITAL Score TV',
                'is_live':is_live,
                'live_verified_at':now.isoformat() if is_live else '',
                'embeddable': True if (API_KEY and video['id'] in verified) or is_live else None
            })
            print('Pronađen video: ' + video['title'] + (' [POTVRĐENO UŽIVO]' if is_live else ''))
    else:
        # Do not falsely keep a stale live badge. Frontend also uses 45-minute TTL.
        out.update({'is_live':False, 'live_verified_at':''})
        print('Nema novog potvrđenog snimka/prenosa. Zadržan prethodni zapis.')
    if out.get('is_live') and not live_candidates:
        out.update({'is_live':False, 'live_verified_at':''})
    out['checked_at'] = now.isoformat()
    # Prevent writing on every empty run: allow visible check timestamp only when other fields change.
    previous = dict(old); previous.pop('checked_at', None)
    current = dict(out); current.pop('checked_at', None)
    if current == previous:
        print('Bez promene fajla.')
        return
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Sačuvan novi video status.')


if __name__ == '__main__':
    main()
