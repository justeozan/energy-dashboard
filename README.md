# ⚡ Dashboard Énergie France — Temps Réel

Dashboard de monitoring énergétique national en temps réel, branché sur l'API publique RTE eco2mix (ODRE).

## Ce que ça affiche

- **Production par source** : nucléaire, hydraulique, éolien, solaire, bioénergies, gaz, fioul, charbon
- **Consommation nationale** en MW
- **Mix énergétique** (donut + barres horizontales)
- **Émissions CO₂** en gCO₂eq/kWh avec seuil d'alerte configurable
- **Historique 24h** : consommation, CO₂, et production empilée par source
- **Rafraîchissement automatique** toutes les 5 minutes

## Lancement rapide

### Avec Docker (recommandé)

```bash
docker-compose up --build
```

Dashboard accessible sur [http://localhost:8501](http://localhost:8501)

### Sans Docker

```bash
pip install -r requirements.txt
streamlit run app/dashboard.py
```

## Configuration

Variables d'environnement disponibles :

| Variable | Défaut | Description |
|---|---|---|
| `CO2_THRESHOLD` | `100` | Seuil CO₂ en gCO₂eq/kWh déclenchant l'alerte |
| `REFRESH_INTERVAL_SECONDS` | `300` | Fréquence de rafraîchissement (secondes) |

## Source des données

API publique ODRE (Open Data Réseaux Énergies) — dataset `eco2mix-national-tr`  
→ `https://odre.opendatasoft.com`

- Gratuit, sans inscription, sans clé API
- Données mises à jour toutes les 15 minutes
- Quota : 50 000 appels/mois

## Stack

- **Python 3.11** + **Streamlit** — dashboard web
- **Plotly** — graphiques interactifs
- **Pandas** — traitement des données
- **Docker** — déploiement conteneurisé
