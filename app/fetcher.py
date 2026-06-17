from __future__ import annotations

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone

ODRE_URL = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/records"

ENERGY_SOURCES = {
    "nucleaire": "Nucléaire",
    "hydraulique": "Hydraulique",
    "eolien": "Éolien",
    "solaire": "Solaire",
    "bioenergies": "Bioénergies",
    "gaz": "Gaz",
    "fioul": "Fioul",
    "charbon": "Charbon",
}

RENEWABLE_KEYS = {"hydraulique", "eolien", "solaire", "bioenergies"}


def _get(params: dict) -> list | None:
    """Call ODRE API. Returns results list or None on any error."""
    headers = {"User-Agent": "energy-dashboard/1.0 (educational project)"}
    try:
        resp = requests.get(ODRE_URL, params=params, headers=headers, timeout=10)
        if resp.status_code != 200:
            return None
        return resp.json().get("results") or None
    except requests.RequestException:
        return None


def fetch_latest() -> dict | None:
    results = _get({"order_by": "date_heure desc", "limit": 1, "where": "consommation is not null"})
    return results[0] if results else None


def fetch_history(hours: int = 24) -> pd.DataFrame:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    results = _get(
        {
            "order_by": "date_heure asc",
            "limit": 100,
            "where": f"date_heure >= '{since}' and consommation is not null",
        }
    )
    if not results:
        return pd.DataFrame()
    df = pd.DataFrame(results)
    df["date_heure"] = pd.to_datetime(df["date_heure"], utc=True).dt.tz_convert(
        "Europe/Paris"
    )
    return df


# ── Demo mode ──────────────────────────────────────────────────────────────
# Used as fallback when the API is unreachable (e.g. datacenter IP blocks).
# Values reflect realistic French electricity mix (low-carbon, nuclear-heavy).

def _demo_record(dt: datetime) -> dict:
    hour = dt.hour
    # Consumption follows a daily curve: low at night, peaks at 8h and 19h
    base_conso = 48000 + 12000 * np.sin(np.pi * (hour - 4) / 18) if 4 <= hour <= 22 else 42000
    base_conso = int(base_conso + np.random.normal(0, 800))

    solar = max(0, int(8000 * np.sin(np.pi * max(0, hour - 6) / 12))) if 6 <= hour <= 20 else 0
    wind = int(6000 + np.random.normal(0, 1500))
    wind = max(0, wind)
    nuclear = int(42000 + np.random.normal(0, 500))
    hydro = int(8000 + np.random.normal(0, 1000))
    bio = int(1800 + np.random.normal(0, 100))
    gap = base_conso - nuclear - hydro - solar - wind - bio
    gas = max(0, int(gap * 0.7))
    fioul = max(0, int(gap * 0.2))
    charbon = max(0, int(gap * 0.1))

    total = nuclear + hydro + solar + wind + bio + gas + fioul + charbon
    renewable = hydro + solar + wind + bio
    # CO2 estimate: weighted average (nuclear ~6, gas ~490, coal ~820, oil ~650)
    co2 = int(
        (nuclear * 6 + hydro * 4 + solar * 41 + wind * 11 + bio * 230 + gas * 490 + fioul * 650 + charbon * 820)
        / max(total, 1)
    )

    return {
        "date_heure": dt.strftime("%Y-%m-%dT%H:%M:%S+02:00"),
        "consommation": base_conso,
        "nucleaire": nuclear,
        "hydraulique": hydro,
        "eolien": wind,
        "solaire": solar,
        "bioenergies": bio,
        "gaz": gas,
        "fioul": fioul,
        "charbon": charbon,
        "taux_co2": co2,
    }


def demo_latest() -> dict:
    return _demo_record(datetime.now())


def demo_history(hours: int = 24) -> pd.DataFrame:
    now = datetime.now()
    records = [
        _demo_record(now - timedelta(minutes=15 * i))
        for i in range(hours * 4, 0, -1)
    ]
    df = pd.DataFrame(records)
    df["date_heure"] = pd.to_datetime(df["date_heure"], utc=True).dt.tz_convert(
        "Europe/Paris"
    )
    return df


# ── Public interface ────────────────────────────────────────────────────────

def get_latest() -> tuple[dict, bool]:
    """Returns (record, is_demo). Falls back to demo if API unreachable."""
    data = fetch_latest()
    if data:
        return data, False
    return demo_latest(), True


def get_history(hours: int = 24) -> tuple[pd.DataFrame, bool]:
    """Returns (dataframe, is_demo). Falls back to demo if API unreachable."""
    df = fetch_history(hours=hours)
    if not df.empty:
        return df, False
    return demo_history(hours=hours), True


def parse_production(record: dict) -> dict:
    return {label: record.get(key) or 0 for key, label in ENERGY_SOURCES.items()}


def compute_renewable_pct(record: dict) -> float:
    total = sum(record.get(k) or 0 for k in ENERGY_SOURCES)
    renewable = sum(record.get(k) or 0 for k in RENEWABLE_KEYS)
    if total <= 0:
        return 0.0
    return round(renewable / total * 100, 1)
