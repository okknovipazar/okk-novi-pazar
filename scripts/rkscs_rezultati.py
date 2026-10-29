
import json
import re
from pathlib import Path
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

URL = (
    "https://rkscs.rs/takmicenja"
    "?izvor=dscore&liga=283&tab=raspored"
)

tabela = json.loads(
    Path("data/rkscs.json").read_text(encoding="utf-8")
)

klubovi = [x["tim"] for x in tabela["tabela"]]

response = requests.get(
    URL,
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=30
)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")
tekst = soup.get_text("\n", strip=True)

kola = list(re.finditer(
    r"(?m)^\s*(\d{1,2})\.\s*kolo\s*$",
    tekst,
    flags=re.IGNORECASE
))

datum_re = re.compile(
    r"(\d{2}\.\d{2}\.\d{4})\.?\s*[•·]?\s*(\d{2}:\d{2})"
)

rezultat_re = re.compile(
    r"(?<!\d)(\d{1,3})\s*:\s*(\d{1,3})(?!\d)"
)

utakmice = []

for i, kolo in enumerate(kola):
    pocetak = kolo.end()
    kraj = (
        kola[i + 1].start()
        if i + 1 < len(kola)
        else len(tekst)
    )

    blok = tekst[pocetak:kraj]
    termini = list(datum_re.finditer(blok))

    for j, termin in enumerate(termini):
        start = termin.end()
        end = (
            termini[j + 1].start()
            if j + 1 < len(termini)
            else len(blok)
        )

        opis = blok[start:end]
        pronadjeni = []

        for klub in klubovi:
            for m in re.finditer(
                re.escape(klub),
                opis,
                flags=re.IGNORECASE
            ):
                pronadjeni.append((m.start(), klub))

        pronadjeni.sort()

        timovi = []
        for _, klub in pronadjeni:
            if klub not in timovi:
                timovi.append(klub)
            if len(timovi) == 2:
                break

        if len(timovi) != 2:
            continue

        rezultat = rezultat_re.search(opis)

        domaci_poeni = None
        gosti_poeni = None

        if rezultat:
            domaci_poeni = int(rezultat.group(1))
            gosti_poeni = int(rezultat.group(2))

        zavrsena = (
            rezultat is not None
            and (domaci_poeni, gosti_poeni) != (0, 0)
        )

        datum = datetime.strptime(
            termin.group(1), "%d.%m.%Y"
        ).strftime("%Y-%m-%d")

        utakmice.append({
            "kolo": int(kolo.group(1)),
            "datum": datum,
            "vreme": termin.group(2),
            "domacin": timovi[0],
            "gost": timovi[1],
            "poeni_domacin": domaci_poeni if zavrsena else None,
            "poeni_gost": gosti_poeni if zavrsena else None,
            "status": "zavrsena" if zavrsena else "zakazana"
        })

if len(utakmice) < 14:
    raise RuntimeError(
        f"Pronadjeno samo {len(utakmice)} utakmica."
    )

if not any(
    "novi pazar" in u["domacin"].lower()
    or "novi pazar" in u["gost"].lower()
    for u in utakmice
):
    raise RuntimeError("Nisu pronadjene utakmice Novog Pazara.")

putanja = Path("data/rkscs_rezultati.json")

novi = {
    "liga": "1. MRL Zapad",
    "izvor": URL,
    "utakmice": utakmice
}

if putanja.exists():
    stari = json.loads(putanja.read_text(encoding="utf-8"))
    if stari.get("utakmice") == utakmice:
        print("Nema promena.")
        raise SystemExit(0)

novi["azurirano"] = datetime.now(
    timezone.utc
).isoformat()

putanja.write_text(
    json.dumps(novi, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

print(f"Preuzeto {len(utakmice)} utakmica.")
