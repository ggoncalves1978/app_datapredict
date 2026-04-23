# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DataPredict** is a full-stack time series analysis and forecasting web app. Users upload CSV/Excel files **or fetch live stock/crypto data from exchanges** and get statistical analysis, seasonal decomposition, stationarity tests, ACF/PACF correlations, linear regression, multi-model forecasts, and advanced diagnostics.

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev       # Dev server with HMR (Vite)
npm run build     # Type check + production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (from `backend/`)
```bash
# Activate venv first
source venv/Scripts/activate  # Windows Git Bash
uvicorn main:app --port 8001   # Dev server (use 8001 to avoid port conflicts)
# Note: use --reload only during active development; ghost reload processes can
# hold the port after crashes and cause 404s on newly added endpoints.
```

### Running tests
```bash
# Backend tests (run from backend/)
python test_api.py
python test_hw.py
```

### Docker (individual containers, no compose file)
```bash
docker build -t datapredict-backend ./backend
docker build -t datapredict-frontend ./frontend
docker run -p 8000:8000 datapredict-backend
docker run -p 80:80 datapredict-frontend
```

## Architecture

### Data Flow
1. User uploads CSV/Excel **or fetches a stock/crypto ticker** in `Dashboard.tsx`
2. Parsed/fetched data stored in Zustand store (`frontend/src/store/useDataStore.ts`)
3. Each analysis page POSTs the dataset to a backend endpoint via `frontend/src/api.ts`
4. Results returned as JSON → stored back in Zustand → rendered with Recharts/Plotly

### Frontend (`frontend/src/`)
- **`api.ts`** — Axios client, reads `VITE_API_URL` (defaults to `http://localhost:8000`; overridden by `frontend/.env.local`)
- **`store/useDataStore.ts`** — Zustand global store; holds `dataset`, `secondaryDataset`, all analysis results, `diagnostics` state slice, and `linearRegression` state
- **`pages/`** — One page per analysis type (Dashboard, TrendSeasonality, Stationarity, Correlations, Comparison, Forecast, Diagnostics, LinearRegression)
- **`components/layout/`** — Shell (MainLayout, Header, Sidebar)
- **`components/upload/`** — FileDropzone (CSV/Excel), StockPicker (yfinance integration)

### Backend (`backend/main.py`)
Single-file FastAPI app (~1600 lines). All endpoints live here:

| Endpoint | Purpose |
|---|---|
| `POST /api/stats` | Descriptive statistics |
| `POST /api/decomposition` | Seasonal decomposition (trend/seasonal/residual) |
| `POST /api/stationarity` | Augmented Dickey-Fuller test |
| `POST /api/correlogram` | ACF/PACF analysis |
| `POST /api/normality` | Shapiro-Wilk test |
| `POST /api/forecast` | Multi-model forecast with ranking (6 models) |
| `POST /api/stock` | Fetch OHLCV history via yfinance (B3, NYSE, NASDAQ, crypto) |
| `POST /api/regression` | OLS linear regression — β₀, β₁, R², RMSE, MAE, MAPE, fitted line + projection |
| `POST /api/diagnostics/transformations` | Log/sqrt/diff transforms + ADF comparison |
| `POST /api/diagnostics/distribution` | Skewness, kurtosis, normality tests, histogram |
| `POST /api/diagnostics/structural-breaks` | CUSUM + Chow scan for breakpoints |
| `POST /api/diagnostics/outliers` | Z-score, IQR, MAD outlier detection |
| `POST /api/diagnostics/residuals` | ARIMA residual analysis (Ljung-Box, QQ data) |
| `POST /api/diagnostics/entropy` | Approximate Entropy + Hurst Exponent |
| `POST /api/chat` | AI chat (GPT-4o-mini or rule-based fallback) |

### Expected Data Format
All POST endpoints receive a JSON body with a `dataset` array (or the array directly for legacy endpoints):
```typescript
{ codigo: string | number; descricao: string; periodo: string; valor: number }
```
`periodo` must be a parseable ISO date string. The `StockPicker` component produces data in this same format automatically (valor = adjusted close price).

### Forecast Engine
Located in `main.py`, trains **6 models** on a train/test split, ranks by MAPE:
- **Regressão Linear** — OLS `ŷ = β₀ + β₁·t` via numpy lstsq
- **Média Móvel** — `NaiveForecaster(strategy="mean")` via sktime, configurable window
- **Holt-Winters** — `ExponentialSmoothing` via sktime, trend+seasonal additive
- **ARIMA/SARIMAX** — manual `(p,d,q)(P,D,Q)[s]` via **statsmodels** directly (not pmdarima — see Notes)
- **AutoARIMA** — grid search over candidate orders, selects by AIC via **statsmodels**
- **Theta** — classical Theta method via sktime (M3 Competition winner)

Returns all model results + best model + confidence intervals for future periods.

### Linear Regression Module (`/regression` route)
Dedicated page (`LinearRegression.tsx`) with:
- Parameter cards: Intercepto (β₀), Coeficiente Angular (β₁), R²
- Formula card rendering the full equation `ŷ = β₀ + β₁ × t`
- Performance cards: MAPE, R², RMSE, MAE
- Chart: historical series + fitted line + future projection with IC 80%
- Configurable forecast horizon (1–48 periods)

### Stock Picker (`StockPicker.tsx`)
Fetches time series from yfinance via `POST /api/stock`. Features:
- Free-text ticker input (Enter or button)
- Period selector: 6mo / 1y / 2y / 5y / 10y / max
- Interval selector: Diário (1d) / Semanal (1wk) / Mensal (1mo)
- Quick-access grids: B3 (12 tickers, `.SA` suffix), NYSE/NASDAQ (8 tickers), Crypto (3 pairs)
- Returns adjusted close price as `valor`

### Diagnostics Module
Six analysis cards in `Diagnostics.tsx`, each calls its own endpoint independently:
1. **Transformações** — applies log/sqrt/diff and compares ADF stationarity
2. **Distribuição** — histogram, skewness, kurtosis, Shapiro-Wilk + Jarque-Bera
3. **Quebras Estruturais** — CUSUM test + sliding-window Chow F-statistic scan
4. **Outliers** — flags anomalies via Z-score, IQR, and MAD; returns severity
5. **Resíduos** — fits ARIMA(1,1,1) residuals, Ljung-Box test, QQ plot data
6. **Entropia & Complexidade** — Approximate Entropy (ApEn) + Hurst Exponent

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `VITE_API_URL` | `frontend/.env.local` | Backend base URL (default: `http://localhost:8000`) |
| `OPENAI_API_KEY` | Backend env | Enables GPT-4o-mini chat; falls back to rule-based if absent |

## Key Tech

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Recharts, Plotly.js, React Router 7
- **Backend:** FastAPI, Uvicorn, Pandas, Statsmodels, SciPy, sktime, **yfinance**
- **Deploy:** Separate Dockerfiles (backend: python:3.11-slim, frontend: nginx:alpine after node:20-alpine build)

## Notes

- `backend/api/`, `backend/models/`, `backend/services/` directories exist but are empty placeholders for future refactoring
- No docker-compose.yml — containers must be run individually
- TypeScript `noUnusedLocals` is disabled in tsconfig to allow builds with unused variables
- **pmdarima removed**: pmdarima 2.0.4 is compiled against numpy 1.x and is incompatible with numpy 2.x (installed by sktime). ARIMA/AutoARIMA use `statsmodels.tsa.arima.model.ARIMA` and `statsmodels.tsa.statespace.SARIMAX` directly instead.
- **numpy serialization**: FastAPI cannot serialize `numpy.bool_` — always cast to `bool()` before returning in response dicts.
- **Dev port**: `frontend/.env.local` sets `VITE_API_URL=http://localhost:8001` to avoid conflicts with ghost uvicorn processes that may persist on port 8000 after crashes.
- **uvicorn --reload gotcha**: when adding new endpoints, `--reload` child processes can persist after the parent is killed and still serve stale code on port 8001. Kill all python processes and restart without `--reload` if endpoints return 404 unexpectedly.
- **yfinance**: installed in backend venv (v1.3.0+). B3 tickers require `.SA` suffix (e.g. `PETR4.SA`). Returns adjusted close price; timezone-aware `Date` index — use `.strftime()` carefully to strip timezone offset.
