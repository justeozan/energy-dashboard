import os
import streamlit as st
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

# ── Palette harmonisee bleu / violet ────────────────────────────────────────
PALETTE = {
    "Nucléaire":    "#6C63FF",
    "Hydraulique":  "#5B8DEF",
    "Éolien":       "#4FC3F7",
    "Solaire":      "#7C4DFF",
    "Bioénergies":  "#B388FF",
    "Gaz":          "#90CAF9",
    "Fioul":        "#82B1FF",
    "Charbon":      "#7E57C2",
}

GRADIENT_LINE = ["#6C63FF", "#5B8DEF", "#4FC3F7", "#7C4DFF", "#B388FF", "#90CAF9", "#82B1FF", "#7E57C2"]

st.set_page_config(
    page_title="Énergie France",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CSS global ──────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    /* ── AMOLED black ───────────────────────────────────────────────────── */
    html, body, [data-testid="stAppViewContainer"],
    [data-testid="stHeader"], [data-testid="stToolbar"],
    section[data-testid="stSidebar"] {
        background: #000000 !important;
    }
    .stApp { background: #000000 !important; }

    /* ── Masquer header Streamlit ───────────────────────────────────────── */
    header[data-testid="stHeader"] { display: none !important; }
    [data-testid="stToolbar"] { display: none !important; }
    #MainMenu { display: none !important; }
    footer { display: none !important; }

    /* ── Sidebar 54px — icones only ──────────────────────────────────────── */
    section[data-testid="stSidebar"] {
        background: #050505 !important;
        width: 54px !important;
        min-width: 54px !important;
        max-width: 54px !important;
        border-right: 1px solid #1a1a1a !important;
        padding: 0 !important;
        overflow: hidden;
    }
    section[data-testid="stSidebar"] [data-testid="stSidebarContent"] {
        display: flex !important;
        flex-direction: column !important;
        height: 100vh !important;
        padding: 0 !important;
    }
    section[data-testid="stSidebar"] [data-testid="stVerticalBlock"] {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        padding: 0.5rem 0 !important;
        gap: 0.5rem !important;
    }
    section[data-testid="stSidebar"] [data-testid="stVerticalBlock"]::after {
        content: "";
        flex: 1;
    }
    /* cacher le toggle expand/collapse */
    button[data-testid="baseButton-headerNoPadding"],
    section[data-testid="stSidebar"] [data-testid="stSidebarCollapseButton"],
    section[data-testid="stSidebar"] [data-testid="stSidebarExpandButton"] {
        display: none !important;
    }
    section[data-testid="stSidebar"] .stButton > button {
        background: #0a0a0a !important;
        border: 1px solid #1a1a1a !important;
        color: #555 !important;
        border-radius: 8px !important;
        width: 36px !important;
        height: 36px !important;
        min-height: 36px !important;
        min-width: 36px !important;
        padding: 0 !important;
        font-size: 1.05rem !important;
        line-height: 1 !important;
        transition: all 0.15s !important;
    }
    section[data-testid="stSidebar"] .stButton > button:hover {
        background: #141414 !important;
        color: #888 !important;
        border-color: #333 !important;
    }
    /* aligner les boutons au centre */
    section[data-testid="stSidebar"] .stButton {
        display: flex !important;
        justify-content: center !important;
        padding: 0 !important;
    }

    /* ── Block container — collé au bord ────────────────────────────────── */
    .block-container {
        padding-top: 0 !important;
        padding-bottom: 0.2rem !important;
        padding-left: 0.6rem !important;
        padding-right: 0.6rem !important;
        max-width: 100% !important;
    }

    /* ── Topbar fine ────────────────────────────────────────────────────── */
    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1rem;
        height: 40px;
        min-height: 40px;
        border-bottom: 1px solid #111;
        background: #000000;
        margin: -0.3rem -0.6rem 0.5rem -0.6rem;
        position: relative;
        z-index: 100;
    }
    .topbar-title {
        font-size: 0.82rem;
        font-weight: 500;
        color: #bbb;
        letter-spacing: 0.04em;
    }
    .topbar-sub {
        font-size: 0.62rem;
        color: #444;
        margin-left: 0.5rem;
        font-weight: 400;
    }
    .topbar-rerun {
        background: #0a0a0a;
        border: 1px solid #222;
        color: #777;
        font-size: 0.65rem;
        padding: 0.2rem 0.6rem;
        border-radius: 4px;
        cursor: pointer;
        letter-spacing: 0.03em;
        transition: all 0.15s;
    }
    .topbar-rerun:hover {
        background: #141414;
        color: #bbb;
        border-color: #444;
    }
    .topbar-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    /* ── KPI cards ──────────────────────────────────────────────────────── */
    .kpi-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.5rem;
        margin-bottom: 0.6rem;
    }
    .kpi {
        background: #050505;
        border: 1px solid #1a1a1a;
        border-radius: 6px;
        padding: 0.5rem 0.65rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }
    .kpi-label {
        font-size: 0.6rem;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 500;
    }
    .kpi-value {
        font-size: 1.1rem;
        font-weight: 600;
        color: #e0e0e0;
        line-height: 1.1;
    }
    .kpi-unit {
        font-size: 0.55rem;
        color: #444;
        font-weight: 400;
    }
    .kpi-delta {
        font-size: 0.55rem;
        font-weight: 400;
    }
    .kpi-delta.ok { color: #4FC3F7; }
    .kpi-delta.warn { color: #FF7043; }

    /* ── Section headers ────────────────────────────────────────────────── */
    .section-title {
        font-size: 0.68rem;
        color: #444;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 0.4rem 0 0.25rem 0;
        padding-bottom: 0.2rem;
        border-bottom: 1px solid #111;
        font-weight: 500;
    }

    /* ── Alert banner ───────────────────────────────────────────────────── */
    .alert-bar {
        background: #1a0505;
        border: 1px solid #3d1111;
        border-radius: 5px;
        padding: 0.3rem 0.6rem;
        margin-bottom: 0.4rem;
        color: #FF7043;
        font-size: 0.65rem;
    }

    /* ── Demo banner ────────────────────────────────────────────────────── */
    .demo-bar {
        background: #0d0d00;
        border: 1px solid #333300;
        border-radius: 5px;
        padding: 0.3rem 0.6rem;
        margin-bottom: 0.4rem;
        color: #aaaa00;
        font-size: 0.6rem;
    }

    /* ── Plotly tweaks ──────────────────────────────────────────────────── */
    .stPlotlyChart { margin: 0 !important; padding: 0 !important; }
    .js-plotly-plot .plotly .modebar { top: 2px !important; right: 2px !important; }
    .js-plotly-plot .plotly .modebar-btn { color: #333 !important; }
    .js-plotly-plot .plotly .modebar-btn:hover { color: #666 !important; }

    /* ── Rerun button style ─────────────────────────────────────────────── */
    .stButton > button[data-testid="stBaseButton-secondary"],
    div[data-testid="stHorizontalBlock"] .stButton > button {
        background: #0a0a0a !important;
        border: 1px solid #222 !important;
        color: #777 !important;
        font-size: 0.65rem !important;
        padding: 0.2rem 0.6rem !important;
        border-radius: 4px !important;
        min-height: 0 !important;
        height: 28px !important;
        letter-spacing: 0.03em !important;
        transition: all 0.15s !important;
    }
    .stButton > button[data-testid="stBaseButton-secondary"]:hover,
    div[data-testid="stHorizontalBlock"] .stButton > button:hover {
        background: #141414 !important;
        color: #bbb !important;
        border-color: #444 !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Sidebar — icones only ───────────────────────────────────────────────────
with st.sidebar:
    st.button("\u2302", key="nav_home")
    st.button("\u2699", key="nav_settings")

# ── Autorefresh ─────────────────────────────────────────────────────────────
st_autorefresh(interval=REFRESH_MS, key="autorefresh")

# ── Topbar ──────────────────────────────────────────────────────────────────
st.markdown(
    f"""
    <div class="topbar">
        <div>
            <span class="topbar-title">Énergie France</span>
            <span class="topbar-sub">RTE eco2mix · {REFRESH_MS // 60000}min</span>
        </div>
        <button class="topbar-rerun" onclick="window.location.reload()">↻ Rerun</button>
    </div>
    """,
    unsafe_allow_html=True,
)

# ── Data ────────────────────────────────────────────────────────────────────
with st.spinner("Chargement…"):
    latest, is_demo_latest = get_latest()
    history, is_demo_history = get_history(hours=24)

is_demo = is_demo_latest or is_demo_history
if is_demo:
    st.markdown(
        '<div class="demo-bar">⚠ Mode démo — données simulées (API ODRE inaccessible)</div>',
        unsafe_allow_html=True,
    )

production = parse_production(latest)
conso = latest.get("consommation") or 0
co2 = latest.get("taux_co2") or 0
renewable_pct = compute_renewable_pct(latest)
timestamp = latest.get("date_heure", "")
ts_display = str(timestamp)[:16].replace("T", " ") if timestamp else "N/A"

# ── Alert ───────────────────────────────────────────────────────────────────
if co2 > CO2_THRESHOLD:
    st.markdown(
        f'<div class="alert-bar">⚠ CO₂ {co2} gCO₂eq/kWh · seuil {CO2_THRESHOLD} dépassé</div>',
        unsafe_allow_html=True,
    )

# ── KPI Cards ───────────────────────────────────────────────────────────────
co2_class = "warn" if co2 > CO2_THRESHOLD else "ok"
st.markdown(
    f"""
    <div class="kpi-row">
        <div class="kpi">
            <span class="kpi-label">Consommation</span>
            <span class="kpi-value">{conso:,} <small style="font-size:0.6rem;color:#555">MW</small></span>
        </div>
        <div class="kpi">
            <span class="kpi-label">CO₂</span>
            <span class="kpi-value">{co2} <small style="font-size:0.6rem;color:#555">g/kWh</small></span>
            <span class="kpi-delta {co2_class}">{"élevé" if co2 > CO2_THRESHOLD else "normal"}</span>
        </div>
        <div class="kpi">
            <span class="kpi-label">Renouvelables</span>
            <span class="kpi-value">{renewable_pct} <small style="font-size:0.6rem;color:#555">%</small></span>
        </div>
        <div class="kpi">
            <span class="kpi-label">Mise à jour</span>
            <span class="kpi-value" style="font-size:0.78rem">{ts_display}</span>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ── Mix energetique ─────────────────────────────────────────────────────────
prod_df = (
    pd.DataFrame(
        {"Source": list(production.keys()), "MW": list(production.values())}
    )
    .query("MW > 0")
    .reset_index(drop=True)
)

col_mix, col_bar = st.columns(2)

with col_mix:
    st.markdown('<div class="section-title">Mix énergétique</div>', unsafe_allow_html=True)
    fig_pie = go.Figure(
        go.Pie(
            labels=prod_df["Source"],
            values=prod_df["MW"],
            hole=0.55,
            textinfo="percent",
            textfont_size=10,
            marker=dict(
                colors=[PALETTE.get(s, "#444") for s in prod_df["Source"]],
                line=dict(color="#000", width=1),
            ),
            hovertemplate="<b>%{label}</b><br>%{value:,} MW<br>%{percent}<extra></extra>",
        )
    )
    fig_pie.update_layout(
        showlegend=False,
        margin=dict(t=2, b=2, l=2, r=2),
        height=220,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#999", size=10),
    )
    st.plotly_chart(fig_pie, use_container_width=True)

with col_bar:
    st.markdown('<div class="section-title">Production (MW)</div>', unsafe_allow_html=True)
    prod_sorted = prod_df.sort_values("MW", ascending=True)
    fig_bar = go.Figure(
        go.Bar(
            x=prod_sorted["MW"],
            y=prod_sorted["Source"],
            orientation="h",
            marker=dict(
                color=[PALETTE.get(s, "#444") for s in prod_sorted["Source"]],
                line=dict(color="#000", width=0),
            ),
            text=prod_sorted["MW"].apply(lambda x: f"{x:,}"),
            textposition="outside",
            textfont_size=9,
            textfont_color="#666",
            hovertemplate="<b>%{y}</b><br>%{x:,} MW<extra></extra>",
        )
    )
    fig_bar.update_layout(
        showlegend=False,
        margin=dict(t=2, b=2, l=2, r=4),
        height=220,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#999", size=10),
        xaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
        yaxis=dict(showgrid=False, tickfont_size=9),
    )
    st.plotly_chart(fig_bar, use_container_width=True)

# ── Historique 24h ──────────────────────────────────────────────────────────
if not history.empty:
    st.markdown('<div class="section-title">Historique 24h</div>', unsafe_allow_html=True)
    col_h1, col_h2 = st.columns(2)

    with col_h1:
        fig_conso = go.Figure()
        fig_conso.add_trace(
            go.Scatter(
                x=history["date_heure"],
                y=history["consommation"],
                mode="lines",
                line=dict(color="#6C63FF", width=2, shape="spline"),
                fill="tozeroy",
                fillcolor="rgba(108,99,255,0.08)",
                hovertemplate="%{x|%H:%M}<br>%{y:,} MW<extra></extra>",
            )
        )
        fig_conso.update_layout(
            margin=dict(t=4, b=4, l=4, r=4),
            height=170,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#777", size=9),
            xaxis=dict(showgrid=False, tickformat="%H:%M", tickfont_size=8),
            yaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
        )
        st.plotly_chart(fig_conso, use_container_width=True)

    with col_h2:
        fig_co2 = go.Figure()
        fig_co2.add_trace(
            go.Scatter(
                x=history["date_heure"],
                y=history["taux_co2"],
                mode="lines",
                line=dict(color="#FF7043", width=2, shape="spline"),
                fill="tozeroy",
                fillcolor="rgba(255,112,67,0.06)",
                hovertemplate="%{x|%H:%M}<br>%{y} g/kWh<extra></extra>",
            )
        )
        fig_co2.add_hline(
            y=CO2_THRESHOLD,
            line_dash="dot",
            line_color="#444",
            line_width=1,
        )
        fig_co2.update_layout(
            margin=dict(t=4, b=4, l=4, r=4),
            height=170,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#777", size=9),
            xaxis=dict(showgrid=False, tickformat="%H:%M", tickfont_size=8),
            yaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
        )
        st.plotly_chart(fig_co2, use_container_width=True)

    # ── Aire empilee ──────────────────────────────────────────────────────
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
    available = [k for k in source_keys if k in history.columns]

    if available:
        st.markdown(
            '<div class="section-title">Production 24h</div>',
            unsafe_allow_html=True,
        )
        hist = history[["date_heure"] + available].fillna(0)
        fig_area = go.Figure()
        for key in available:
            label = source_keys[key]
            fig_area.add_trace(
                go.Scatter(
                    x=hist["date_heure"],
                    y=hist[key],
                    name=label,
                    stackgroup="one",
                    line=dict(width=0),
                    fillcolor=PALETTE.get(label, "#444"),
                    hovertemplate=f"<b>{label}</b><br>%{{y:,}} MW<extra></extra>",
                )
            )
        fig_area.update_layout(
            margin=dict(t=4, b=4, l=4, r=4),
            height=190,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#777", size=9),
            xaxis=dict(showgrid=False, tickformat="%H:%M", tickfont_size=8),
            yaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
            legend=dict(
                orientation="h",
                yanchor="top",
                y=-0.18,
                xanchor="center",
                x=0.5,
                font_size=8,
                font_color="#666",
                bgcolor="rgba(0,0,0,0)",
                traceorder="normal",
            ),
        )
        st.plotly_chart(fig_area, use_container_width=True)
