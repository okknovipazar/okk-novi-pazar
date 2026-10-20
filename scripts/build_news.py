import json
import re
import html
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://okknovipazar.github.io/okk-novi-pazar/"
OUTPUT = ROOT / "vesti"

def slug(text):
    text = text.lower().replace("đ", "dj")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(
        c for c in text if not unicodedata.combining(c)
    )
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:100]

def clean(text):
    return html.escape(str(text or ""), quote=True)

def image_url(path):
    path = str(path or "").strip()
    if path.startswith("https://"):
        return path
    if path.startswith("/"):
        path = path[1:]
    return BASE + (path or "assets/logo.png")

def main():
    news = json.loads(
        (ROOT / "data/news.json").read_text(encoding="utf-8")
    )
    OUTPUT.mkdir(exist_ok=True)

    for item in news:
        if item.get("published") is False:
            continue

        title = str(item.get("title") or "Vest")
        date = str(item.get("date") or "")
        folder = slug(date + "-" + title)
        if not folder:
            continue

        url = BASE + "vesti/" + folder + "/"
        photo = image_url(item.get("image"))
        summary = clean(item.get("summary") or "")
        body = str(item.get("body") or "")
        paragraphs = "".join(
            "<p>" + clean(p) + "</p>"
            for p in body.splitlines() if p.strip()
        )

        page = f"""<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{clean(title)} | OKK Novi Pazar</title>
<meta name="description" content="{summary}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="OKK Novi Pazar">
<meta property="og:title" content="{clean(title)}">
<meta property="og:description" content="{summary}">
<meta property="og:image" content="{clean(photo)}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<style>
body {{
  margin: 0;
  background: #f4f6fb;
  color: #142141;
  font: 17px/1.8 Arial, sans-serif;
}}
header {{
  background: #08132e;
  color: white;
  padding: 22px;
  font-weight: bold;
}}
main {{
  max-width: 850px;
  margin: 30px auto;
  padding: 0 20px;
}}
h1 {{
  font-size: clamp(30px, 6vw, 50px);
  line-height: 1.15;
}}
img {{
  width: 100%;
  border-radius: 12px;
}}
a {{ color: #295ce7; }}
</style>
</head>
<body>
<header>OKK NOVI PAZAR</header>
<main>
<a href="{BASE}#vesti">← Sve vesti</a>
<p>{clean(date)} · {clean(item.get("category"))}</p>
<h1>{clean(title)}</h1>
<img src="{clean(photo)}" alt="{clean(title)}">
{paragraphs}
<p><a href="{BASE}#vesti">← Nazad na vesti</a></p>
</main>
</body>
</html>"""

        target = OUTPUT / folder
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(
            page, encoding="utf-8"
        )

    print("Stranice vesti su pripremljene.")

if __name__ == "__main__":
    main()
