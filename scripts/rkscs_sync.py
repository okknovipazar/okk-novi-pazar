
import json
import re
from pathlib import Path
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

URL = "https://rkscs.rs/takmicenja?izvor=dscore&liga=283&tab=tabela"

response = requests.get(
    URL,
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=30
)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")

table = None
for candidate in soup.find_all("table"):
    content = candidate.get_text(" ", strip=True).upper()
    if all(x in content for x in ("POB", "POR", "PTS")):
        table = candidate
        break

if table is None:
    raise RuntimeError("Tabela RKSCS nije pronadjena.")

standings = []

for row in table.find_all("tr"):
    cells = row.find_all("td")
    if len(cells) != 8:
        continue

    values = [cell.get_text(" ", strip=True) for cell in cells]
    position = re.search(r"\d+", values[0])

    if not position:
        continue

    standings.append({
        "pozicija": int(position.group()),
        "tim": values[1],
        "odigrano": int(values[2]),
        "pobede": int(values[3]),
        "porazi": int(values[4]),
        "kosevi": values[5],
        "razlika": int(values[6].replace("+", "")),
        "bodovi": int(values[7])
    })

if len(standings) != 14 or not any(
    "novi pazar" in team["tim"].lower()
    for team in standings
):
    raise RuntimeError("Podaci nisu potpuni. Stari podaci su sacuvani.")

output = Path("data/rkscs.json")
output.parent.mkdir(parents=True, exist_ok=True)

new_data = {
    "liga": "1. MRL Zapad",
    "izvor": URL,
    "tabela": standings
}

if output.exists():
    old_data = json.loads(output.read_text(encoding="utf-8"))
    if old_data.get("tabela") == standings:
        print("Tabela nije promenjena.")
        raise SystemExit(0)

new_data["azurirano"] = datetime.now(
    timezone.utc
).isoformat()

output.write_text(
    json.dumps(new_data, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

print("Tabela je uspesno preuzeta!")
