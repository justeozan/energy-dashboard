import os
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from streamlit_autorefresh import st_autorefresh

from fetcher import (
    get_latest,
    get_history,
    parse_production,
    compute_renewable_pct,
)

CO2_THRESHOLD = int(os.getenv("CO2_THRESHOLD", "100"))
REFRESH_MS = int(os.getenv("REFRESH_INTERVAL_SECONDS", "300")) * 1000

SOURCE_COLORS = {
    "Nucléaire": "#4A90E2",
    "Hydraulique": "#50C878",
    "Éolien": "#87CEEB",
    "Solaire": "#FFD700",
    "Bioénergies": "#6DBF67",
    "Gaz": "#FF8C00",
    "Fioul": "#C0392B",
    "Charbon": "#7F8C8D",
}

st.set_page_config(
    page_title="Dashboard Énergie France",
    page_icon="⚡",
    layout="wide",
)

st.markdown(
    """
    <style>
    .block-container { padding-top: 1rem; }
    .demo-banner {
        background: #2d2d00;
        border: 1px solid #ffcc00;
        border-radius: 6px;
        padding: 0.5rem 1rem;
        margin-bottom: 1rem;
        color: #ffcc00;
        font-size: 0.9rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st_autorefresh(interval=REFRESH_MS, key="autorefresh")

st.title("⚡ Dashboard Énergie France — Temps Réel")
st.caption(
    f"Source : RTE eco2mix via ODRE · Rafraîchissement toutes les "
    f"{REFRESH_MS // 60000} min · Seuil CO₂ : {CO2_THRESHOLD} gCO₂eq/kWh"
)

with st.spinner("Chargement des données RTE eco2mix…"):
    latest, is_demo_latest = get_latest()
    history, is_demo_history = get_history(hours=24)

is_demo = is_demo_latest or is_demo_history
if is_demo:
    st.markdown(
        '<div class="demo-banner">⚠️ <strong>Mode démonstration</strong> — '
        "L'API ODRE est inaccessible depuis cette machine (restriction IP datacenter). "
        "Les données affichées sont simulées mais réalistes. "
        "Lancez le dashboard en local pour les données réelles.</div>",
        unsafe_allow_html=True,
    )

production = parse_production(latest)
conso = latest.get("consommation") or 0
co2 = latest.get("taux_co2") or 0
timestamp = latest.get("date_heure", "")
renewable_pct = compute_renewable_pct(latest)
ts_display = str(timestamp)[:16].replace("T", " ") if timestamp else "N/A"

# ── Alert banner ──────────────────────────────────────────────────────────
if co2 > CO2_THRESHOLD:
    st.error(
        f"🚨 ALERTE CO₂ — {co2} gCO₂eq/kWh · Seuil de {CO2_THRESHOLD} gCO₂eq/kWh dépassé !"
    )

# ── KPIs ──────────────────────────────────────────────────────────────────
k1, k2, k3, k4 = st.columns(4)
k1.metric("Consommation nationale", f"{conso:,} MW")
k2.metric(
    "Émissions CO₂",
    f"{co2} gCO₂eq/kWh",
    delta="⚠️ Élevé" if co2 > CO2_THRESHOLD else "✅ Normal",
    delta_color="inverse" if co2 > CO2_THRESHOLD else "off",
)
k3.metric("Énergies renouvelables", f"{renewable_pct} %")
k4.metric("Dernière mise à jour", ts_display)

st.divider()

# ── Mix + Bar ─────────────────────────────────────────────────────────────
col_pie, col_bar = st.columns(2)

prod_df = (
    pd.DataFrame(
        {"Source": list(production.keys()), "Production (MW)": list(production.values())}
    )
    .query("`Production (MW)` > 0")
    .reset_index(drop=True)
)

with col_pie:
    st.subheader("Mix énergétique")
    fig_pie = px.pie(
        prod_df,
        values="Production (MW)",
        names="Source",
        color="Source",
        color_discrete_map=SOURCE_COLORS,
        hole=0.4,
    )
    fig_pie.update_traces(textposition="inside", textinfo="percent+label")
    fig_pie.update_layout(showlegend=False, margin=dict(t=10, b=0, l=0, r=0), height=380)
    st.plotly_chart(fig_pie, use_container_width=True)

with col_bar:
    st.subheader("Production par source (MW)")
    prod_sorted = prod_df.sort_values("Production (MW)", ascending=True)
    fig_bar = px.bar(
        prod_sorted,
        x="Production (MW)",
        y="Source",
        orientation="h",
        color="Source",
        color_discrete_map=SOURCE_COLORS,
    )
    fig_bar.update_layout(showlegend=False, margin=dict(t=10, b=0, l=0, r=0), height=380)
    st.plotly_chart(fig_bar, use_container_width=True)

# ── Historique 24h ────────────────────────────────────────────────────────
if not history.empty:
    st.divider()
    st.subheader("Historique — 24 dernières heures")
    col_h1, col_h2 = st.columns(2)

    with col_h1:
        fig_conso = px.line(
            history,
            x="date_heure",
            y="consommation",
            labels={"date_heure": "", "consommation": "MW"},
            title="Consommation nationale (MW)",
        )
        fig_conso.update_traces(line_color="#4A90E2", line_width=2)
        fig_conso.update_layout(margin=dict(t=40, b=0, l=0, r=0), height=300)
        st.plotly_chart(fig_conso, use_container_width=True)

    with col_h2:
        fig_co2 = px.line(
            history,
            x="date_heure",
            y="taux_co2",
            labels={"date_heure": "", "taux_co2": "gCO₂eq/kWh"},
            title="Émissions CO₂ (gCO₂eq/kWh)",
        )
        fig_co2.update_traces(line_color="#E74C3C", line_width=2)
        fig_co2.add_hline(
            y=CO2_THRESHOLD,
            line_dash="dash",
            line_color="orange",
            annotation_text=f"Seuil alerte ({CO2_THRESHOLD})",
            annotation_position="top left",
        )
        fig_co2.update_layout(margin=dict(t=40, b=0, l=0, r=0), height=300)
        st.plotly_chart(fig_co2, use_container_width=True)

    # Stacked area — production par source sur 24h
    source_keys = {
        "nucleaire": "Nucléaire",
        "hydraulique": "Hydraulique",
        "eolien": "Éolien",
        "solaire": "Solaire",
        "bioenergies": "Bioénergies",
        "gaz": "Gaz",
        "fioul": "Fioul",
        "charbon": "Charbon",
    }
    available_cols = [k for k in source_keys if k in history.columns]
    if available_cols:
        st.subheader("Production par source — 24h (aire empilée)")
        history_filled = history[["date_heure"] + available_cols].fillna(0)
        fig_area = go.Figure()
        for key in available_cols:
            label = source_keys[key]
            fig_area.add_trace(
                go.Scatter(
                    x=history_filled["date_heure"],
                    y=history_filled[key],
                    name=label,
                    stackgroup="one",
                    line=dict(width=0.5),
                    fillcolor=SOURCE_COLORS.get(label, "#888"),
                    line_color=SOURCE_COLORS.get(label, "#888"),
                )
            )
        fig_area.update_layout(
            yaxis_title="MW",
            margin=dict(t=10, b=0, l=0, r=0),
            height=350,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
        )
        st.plotly_chart(fig_area, use_container_width=True)
