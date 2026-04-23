from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator
from typing import List, Optional, Union
import pandas as pd
import numpy as np
import os
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, acf, pacf
from scipy.stats import shapiro

# ─────────────────────────────────────────────
# Rate limiting (slowapi)
# ─────────────────────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMIT_ENABLED = True
except ImportError:
    limiter = None
    RATE_LIMIT_ENABLED = False

# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────
app = FastAPI(title="DataPredict API", version="1.2.0")

if RATE_LIMIT_ENABLED and limiter:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development") == "production"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if IS_PRODUCTION else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if IS_PRODUCTION:
        return JSONResponse(
            status_code=500,
            content={"error": "Erro interno do servidor. Tente novamente."},
            headers={"Access-Control-Allow-Origin": "*"},
        )
    return JSONResponse(
        status_code=500,
        content={"error": f"Erro interno: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ─────────────────────────────────────────────
# Modelos Pydantic compartilhados
# ─────────────────────────────────────────────
class TimeSeriesDataPoint(BaseModel):
    codigo: Union[str, int]
    descricao: str
    periodo: str
    valor: float


class StatsRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "ok", "message": "DataPredict API v1.2.0 — sktime engine"}


# ─────────────────────────────────────────────
# Estatísticas Descritivas
# ─────────────────────────────────────────────
@app.post("/api/stats")
def get_descriptive_stats(request: StatsRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    if df.empty:
        return {"error": "Dataset is empty"}
    stats = df['valor'].describe()
    return {
        "count": int(stats['count']),
        "mean": round(float(stats['mean']), 2),
        "std": round(float(stats['std']), 2),
        "min": float(stats['min']),
        "max": float(stats['max']),
        "p25": float(stats['25%']),
        "p50": float(stats['50%']),
        "p75": float(stats['75%'])
    }


# ─────────────────────────────────────────────
# Decomposição
# ─────────────────────────────────────────────
class DecompositionRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]
    period: int = 12
    model_type: str = "additive"


@app.post("/api/decomposition")
def get_decomposition(request: DecompositionRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    if len(df) < request.period * 2:
        return {"error": f"Série muito curta para decomposição com período {request.period}. Necessário pelo menos {request.period * 2} pontos."}
    values = df['valor'].values
    try:
        result = seasonal_decompose(values, model=request.model_type, period=request.period, extrapolate_trend='freq')
        return {
            "trend":    np.nan_to_num(result.trend,    nan=0.0).tolist(),
            "seasonal": np.nan_to_num(result.seasonal, nan=0.0).tolist(),
            "resid":    np.nan_to_num(result.resid,    nan=0.0).tolist(),
            "observed": values.tolist()
        }
    except Exception as e:
        return {"error": f"Erro na decomposição: {str(e)}"}


# ─────────────────────────────────────────────
# Estacionariedade (ADF)
# ─────────────────────────────────────────────
class ADFRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]
    maxlag: Optional[int] = None


@app.post("/api/stationarity")
def check_stationarity(request: ADFRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    if len(df) < 5:
        return {"error": "Série muito curta para o Teste ADF."}
    try:
        values = df['valor'].values
        adf_result = adfuller(values, maxlag=request.maxlag, autolag='AIC' if request.maxlag is None else None)
        p_value = float(adf_result[1])
        is_stationary = p_value < 0.05
        return {
            "adf_statistic":   float(adf_result[0]),
            "p_value":         p_value,
            "critical_values": {k: float(v) for k, v in adf_result[4].items()},
            "is_stationary":   is_stationary,
            "used_lag":        int(adf_result[2]),
            "nobs":            int(adf_result[3]),
            "conclusion": (
                "A série é Estacionária (Rejeita H0)"
                if is_stationary else
                "A série NÃO é Estacionária (Falha em rejeitar H0)"
            )
        }
    except Exception as e:
        return {"error": f"Erro no teste ADF: {str(e)}"}


# ─────────────────────────────────────────────
# ACF / PACF
# ─────────────────────────────────────────────
class CorrelogramRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]
    nlags: int = 40


@app.post("/api/correlogram")
def get_correlogram(request: CorrelogramRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    max_nlags = len(df) // 2 - 1
    if request.nlags >= len(df) // 2:
        request.nlags = max_nlags
    try:
        values = df['valor'].values
        acf_vals,  acf_conf  = acf(values,  nlags=request.nlags, alpha=0.05)
        pacf_vals, pacf_conf = pacf(values, method='ywm', nlags=request.nlags, alpha=0.05)
        return {
            "lags":             list(range(len(acf_vals))),
            "acf":              acf_vals.tolist(),
            "acf_conf_lower":   (acf_conf[:, 0]  - acf_vals).tolist(),
            "acf_conf_upper":   (acf_conf[:, 1]  - acf_vals).tolist(),
            "pacf":             pacf_vals.tolist(),
            "pacf_conf_lower":  (pacf_conf[:, 0] - pacf_vals).tolist(),
            "pacf_conf_upper":  (pacf_conf[:, 1] - pacf_vals).tolist(),
        }
    except Exception as e:
        return {"error": f"Erro ao calcular ACF/PACF: {str(e)}"}


# ─────────────────────────────────────────────
# Normalidade (Shapiro-Wilk)
# ─────────────────────────────────────────────
class NormalityRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]


@app.post("/api/normality")
def check_normality(request: NormalityRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    if len(df) < 3:
        return {"error": "Série muito curta para Teste de Normalidade."}
    try:
        values = df['valor'].values
        shapiro_values = values
        sampled = False
        if len(values) > 5000:
            rng = np.random.default_rng(seed=42)
            shapiro_values = rng.choice(values, size=5000, replace=False)
            sampled = True
        stat, p_value = shapiro(shapiro_values)
        is_normal = bool(p_value >= 0.05)
        n_bins = min(50, max(5, int(np.sqrt(len(values)))))
        hist_counts, bin_edges = np.histogram(values, bins=n_bins)
        result = {
            "statistic": float(stat),
            "p_value":   float(p_value),
            "is_normal": is_normal,
            "conclusion": (
                "Os dados seguem uma distribuição normal (Falha em rejeitar H0)"
                if is_normal else
                "Os dados NÃO seguem uma distribuição normal (Rejeita H0)"
            ),
            "histogram":  hist_counts.tolist(),
            "bin_edges":  bin_edges.tolist()
        }
        if sampled:
            result["warning"] = "Shapiro-Wilk aplicado em amostra aleatória de 5000 observações."
        return result
    except Exception as e:
        return {"error": f"Erro no teste de normalidade: {str(e)}"}


# ───────────────────────────────────────────────────────────
# Motor de Forecast via SKTIME
# ───────────────────────────────────────────────────────────
#
# Modelos (todos via sktime, sem GPU/torch):
#   1. NaiveForecaster      — Média Móvel (baseline)
#   2. ExponentialSmoothing — Holt-Winters
#   3. ARIMA / SARIMAX      — via pmdarima
#   4. AutoARIMA            — seleção automática via AIC
#   5. ThetaForecaster      — método Theta clássico (M3/M4 winner)
# ───────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    dataset:    List[TimeSeriesDataPoint]
    horizon:    int = 12
    test_size:  int = 12
    arima_p:    int = 1
    arima_d:    int = 1
    arima_q:    int = 1
    sarimax_P:  int = 1
    sarimax_D:  int = 1
    sarimax_Q:  int = 1
    sarimax_s:  int = 12
    naive_window: int = 3
    sp:         int = 12

    @validator('horizon')
    def horizon_valid(cls, v):
        if not 1 <= v <= 60:
            raise ValueError('Horizonte deve ser entre 1 e 60.')
        return v

    @validator('test_size')
    def test_size_valid(cls, v):
        if not 1 <= v <= 60:
            raise ValueError('Hold-out deve ser entre 1 e 60.')
        return v


# ── Helpers ──────────────────────────────────────────────────
def _to_sktime_series(values: np.ndarray) -> pd.Series:
    return pd.Series(values, index=pd.RangeIndex(len(values)))


def _mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    mask = actual != 0
    if mask.sum() == 0:
        return float('inf')
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)


def _bias(actual: np.ndarray, predicted: np.ndarray) -> float:
    mask = actual != 0
    if mask.sum() == 0:
        return float('nan')
    return float(np.mean((predicted[mask] - actual[mask]) / actual[mask]) * 100)


def _interval_from_residuals(forecast: list, residuals: np.ndarray) -> tuple:
    """IC 80% baseado no desvio-padrão dos resíduos do hold-out."""
    std = float(np.std(residuals)) if len(residuals) > 1 else 0.0
    lower = [f - 1.28 * std for f in forecast]
    upper = [f + 1.28 * std for f in forecast]
    return lower, upper


def _safe_predict(forecaster, fh_arr) -> np.ndarray:
    pred = forecaster.predict(fh=fh_arr)
    if isinstance(pred, pd.Series):
        return pred.values.astype(float)
    return np.array(pred, dtype=float)


# ── Modelo 0: Regressão Linear ───────────────────────────────
def _train_linear_regression(train: np.ndarray, test: np.ndarray, horizon: int):
    """Regressão linear simples OLS: ŷ = β₀ + β₁·t"""
    try:
        n_train = len(train)
        x_train = np.arange(n_train, dtype=float)
        X_train = np.column_stack([np.ones(n_train), x_train])
        beta, _, _, _ = np.linalg.lstsq(X_train, train, rcond=None)
        intercept, slope = float(beta[0]), float(beta[1])

        x_test = np.arange(n_train, n_train + len(test), dtype=float)
        preds  = intercept + slope * x_test
        mape   = _mape(test, preds)
        bias   = _bias(test, preds)

        n_full = n_train + len(test)
        full   = np.concatenate([train, test])
        x_full = np.arange(n_full, dtype=float)
        X_full = np.column_stack([np.ones(n_full), x_full])
        beta_f, _, _, _ = np.linalg.lstsq(X_full, full, rcond=None)
        b0, b1 = float(beta_f[0]), float(beta_f[1])

        x_fc     = np.arange(n_full, n_full + horizon, dtype=float)
        fc_vals  = (b0 + b1 * x_fc).tolist()
        residuals = full - (b0 + b1 * x_full)
        lower, upper = _interval_from_residuals(fc_vals, residuals)
        return mape, bias, fc_vals, lower, upper
    except Exception as e:
        print(f"[LinReg] Erro: {e}")
        return float('inf'), float('nan'), [], [], []


# ── Modelo 1: Média Móvel (Naive) ────────────────────────────
def _train_naive(train: np.ndarray, test: np.ndarray, horizon: int, window: int = 3):
    try:
        from sktime.forecasting.naive import NaiveForecaster

        fh_test = np.arange(1, len(test) + 1)
        fh_fc   = np.arange(1, horizon + 1)

        y_train = _to_sktime_series(train)
        fc = NaiveForecaster(strategy="mean", window_length=window)
        fc.fit(y_train, fh=fh_test)
        preds = _safe_predict(fc, fh_test)
        mape  = _mape(test, preds)
        bias  = _bias(test, preds)

        y_full = _to_sktime_series(np.concatenate([train, test]))
        fc2 = NaiveForecaster(strategy="mean", window_length=window)
        fc2.fit(y_full, fh=fh_fc)
        forecast = _safe_predict(fc2, fh_fc).tolist()

        lower, upper = _interval_from_residuals(forecast, test - preds)
        return mape, bias, forecast, lower, upper
    except Exception as e:
        print(f"[Naive] Erro: {e}")
        return float('inf'), float('nan'), [], [], []


# ── Modelo 2: Holt-Winters ───────────────────────────────────
def _train_holtwinters(train: np.ndarray, test: np.ndarray, horizon: int, sp: int = 12):
    try:
        from sktime.forecasting.exp_smoothing import ExponentialSmoothing

        use_seasonal = sp > 1 and len(train) >= sp * 2
        seasonal_arg = "add" if use_seasonal else None

        fh_test = np.arange(1, len(test) + 1)
        fh_fc   = np.arange(1, horizon + 1)

        y_train = _to_sktime_series(train)
        fc = ExponentialSmoothing(
            trend="add", seasonal=seasonal_arg,
            sp=sp if use_seasonal else 1,
            initialization_method="heuristic",
        )
        fc.fit(y_train, fh=fh_test)
        preds = _safe_predict(fc, fh_test)
        mape  = _mape(test, preds)
        bias  = _bias(test, preds)

        y_full = _to_sktime_series(np.concatenate([train, test]))
        fc2 = ExponentialSmoothing(
            trend="add", seasonal=seasonal_arg,
            sp=sp if use_seasonal else 1,
            initialization_method="heuristic",
        )
        fc2.fit(y_full, fh=fh_fc)
        forecast = _safe_predict(fc2, fh_fc).tolist()

        lower, upper = _interval_from_residuals(forecast, test - preds)
        return mape, bias, forecast, lower, upper
    except Exception as e:
        print(f"[Holt-Winters] Erro: {e}")
        return float('inf'), float('nan'), [], [], []


# ── Helpers ARIMA (statsmodels) ───────────────────────────────
def _sm_fit_forecast(series: np.ndarray, order: tuple, seasonal_order: tuple, horizon: int):
    """Ajusta ARIMA/SARIMAX via statsmodels e retorna predições + IC 80%."""
    import warnings
    from statsmodels.tsa.arima.model import ARIMA as smARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        p, d, q = order
        P, D, Q, s = seasonal_order
        use_seasonal = s > 1 and (P + D + Q) > 0
        if use_seasonal:
            model = SARIMAX(
                series,
                order=(p, d, q),
                seasonal_order=(P, D, Q, s),
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
        else:
            model = smARIMA(series, order=(p, d, q))
        result = model.fit()

    fc_obj = result.get_forecast(steps=horizon)
    pred   = np.array(fc_obj.predicted_mean, dtype=float)
    ci     = np.array(fc_obj.conf_int(alpha=0.20), dtype=float)   # shape (h, 2)
    return pred, ci[:, 0], ci[:, 1]


# ── Modelo 3: ARIMA / SARIMAX ────────────────────────────────
def _train_arima(
    train: np.ndarray, test: np.ndarray, horizon: int,
    p=1, d=1, q=1, P=0, D=0, Q=0, s=1
):
    """ARIMA(p,d,q) ou SARIMAX(p,d,q)(P,D,Q)[s] via statsmodels."""
    try:
        order          = (p, d, q)
        seasonal_order = (P, D, Q, s)

        preds, _, _ = _sm_fit_forecast(train, order, seasonal_order, len(test))
        mape = _mape(test, preds)
        bias = _bias(test, preds)

        full = np.concatenate([train, test])
        fc_vals, lower_arr, upper_arr = _sm_fit_forecast(full, order, seasonal_order, horizon)

        return mape, bias, fc_vals.tolist(), lower_arr.tolist(), upper_arr.tolist()

    except Exception as e:
        print(f"[ARIMA] Erro: {e}")
        return float('inf'), float('nan'), [], [], []


# ── Modelo 4: AutoARIMA (grid AIC via statsmodels) ───────────
def _train_autoarima(train: np.ndarray, test: np.ndarray, horizon: int, sp: int = 1):
    """Seleciona ARIMA/SARIMAX com menor AIC via busca em grade (statsmodels)."""
    import warnings
    from statsmodels.tsa.arima.model import ARIMA as smARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    try:
        # Detecta d automaticamente via ADF
        def _best_d(series: np.ndarray) -> int:
            for d_try in range(3):
                s = np.diff(series, d_try) if d_try > 0 else series
                if len(s) < 5:
                    return d_try
                try:
                    if adfuller(s, autolag='AIC')[1] < 0.05:
                        return d_try
                except Exception:
                    pass
            return 1

        d_opt        = _best_d(train)
        use_seasonal = sp > 1 and len(train) >= sp * 3

        best_aic   = float('inf')
        best_order = (1, d_opt, 1)
        best_seas  = (1, 0, 1, sp) if use_seasonal else (0, 0, 0, 0)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for p_try in range(0, 4):
                for q_try in range(0, 4):
                    for P_try in (range(0, 2) if use_seasonal else [0]):
                        for Q_try in (range(0, 2) if use_seasonal else [0]):
                            try:
                                if use_seasonal:
                                    m = SARIMAX(
                                        train,
                                        order=(p_try, d_opt, q_try),
                                        seasonal_order=(P_try, 0, Q_try, sp),
                                        enforce_stationarity=False,
                                        enforce_invertibility=False,
                                    )
                                else:
                                    m = smARIMA(train, order=(p_try, d_opt, q_try))
                                r = m.fit()
                                if r.aic < best_aic:
                                    best_aic   = r.aic
                                    best_order = (p_try, d_opt, q_try)
                                    best_seas  = (P_try, 0, Q_try, sp) if use_seasonal else (0, 0, 0, 0)
                            except Exception:
                                continue

        p, d, q = best_order
        P, D, Q, s = best_seas

        if use_seasonal and (P + Q) > 0:
            model_label = f"AutoARIMA({p},{d},{q})({P},{D},{Q})[{sp}]"
        else:
            model_label = f"AutoARIMA({p},{d},{q})"

        preds, _, _ = _sm_fit_forecast(train, (p, d, q), (P, D, Q, s), len(test))
        mape = _mape(test, preds)
        bias = _bias(test, preds)

        full = np.concatenate([train, test])
        fc_vals, lower_arr, upper_arr = _sm_fit_forecast(full, (p, d, q), (P, D, Q, s), horizon)

        return mape, bias, fc_vals.tolist(), lower_arr.tolist(), upper_arr.tolist(), model_label

    except Exception as e:
        print(f"[AutoARIMA] Erro: {e}")
        return float('inf'), float('nan'), [], [], [], "AutoARIMA"


# ── Modelo 5: Theta ───────────────────────────────────────────
def _train_theta(train: np.ndarray, test: np.ndarray, horizon: int, sp: int = 1):
    try:
        from sktime.forecasting.theta import ThetaForecaster

        fh_test = np.arange(1, len(test) + 1)
        fh_fc   = np.arange(1, horizon + 1)

        y_train = _to_sktime_series(train)
        fc = ThetaForecaster(sp=sp)
        fc.fit(y_train, fh=fh_test)
        preds = _safe_predict(fc, fh_test)
        mape  = _mape(test, preds)
        bias  = _bias(test, preds)

        y_full = _to_sktime_series(np.concatenate([train, test]))
        fc2 = ThetaForecaster(sp=sp)
        fc2.fit(y_full, fh=fh_fc)
        forecast = _safe_predict(fc2, fh_fc).tolist()

        try:
            intervals = fc2.predict_interval(fh=fh_fc, coverage=0.80)
            lower = intervals.iloc[:, 0].tolist()
            upper = intervals.iloc[:, 1].tolist()
        except Exception:
            lower, upper = _interval_from_residuals(forecast, test - preds)

        return mape, bias, forecast, lower, upper
    except Exception as e:
        print(f"[Theta] Erro: {e}")
        return float('inf'), float('nan'), [], [], []


# ── Geração de labels futuros ─────────────────────────────────
def _generate_future_periods(last_period: str, horizon: int) -> list:
    try:
        from dateutil.parser import parse as parse_date
        from dateutil.relativedelta import relativedelta
        dt = parse_date(str(last_period))
        return [(dt + relativedelta(months=i)).strftime('%Y-%m') for i in range(1, horizon + 1)]
    except Exception:
        return [f"T+{i}" for i in range(1, horizon + 1)]


# ── Endpoint principal ────────────────────────────────────────
@app.post("/api/forecast")
def run_forecast(request: ForecastRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)

    if df.empty:
        return {"error": "Dataset vazio."}

    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])

    min_required = request.test_size + max(10, request.sp * 2)
    if len(df) < min_required:
        return {"error": f"Série muito curta. Necessário pelo menos {min_required} observações válidas."}

    values = df['valor'].values.astype(float)
    train  = values[:-request.test_size]
    test   = values[-request.test_size:]

    sp = request.sarimax_s if request.sarimax_s > 1 else request.sp

    mm_mape,  mm_bias,  mm_fc,  mm_low,  mm_up  = _train_naive(
        train, test, request.horizon, window=request.naive_window
    )
    hw_mape,  hw_bias,  hw_fc,  hw_low,  hw_up  = _train_holtwinters(
        train, test, request.horizon, sp=sp
    )
    ar_mape,  ar_bias,  ar_fc,  ar_low,  ar_up  = _train_arima(
        train, test, request.horizon,
        p=request.arima_p, d=request.arima_d, q=request.arima_q,
        P=request.sarimax_P, D=request.sarimax_D, Q=request.sarimax_Q,
        s=request.sarimax_s,
    )
    aar_mape, aar_bias, aar_fc, aar_low, aar_up, autoarima_label = _train_autoarima(
        train, test, request.horizon, sp=sp
    )
    th_mape,  th_bias,  th_fc,  th_low,  th_up  = _train_theta(
        train, test, request.horizon, sp=sp
    )

    use_seasonal = request.sarimax_s > 1
    arima_label = (
        f"ARIMA({request.arima_p},{request.arima_d},{request.arima_q})"
        f"({request.sarimax_P},{request.sarimax_D},{request.sarimax_Q})[{request.sarimax_s}]"
        if use_seasonal else
        f"ARIMA({request.arima_p},{request.arima_d},{request.arima_q})"
    )

    lr_mape,  lr_bias,  lr_fc,  lr_low,  lr_up  = _train_linear_regression(
        train, test, request.horizon
    )

    candidates = [
        {"name": "Média Móvel",      "mape": mm_mape,  "bias": mm_bias,  "forecast": mm_fc,  "lower": mm_low,  "upper": mm_up},
        {"name": "Holt-Winters",     "mape": hw_mape,  "bias": hw_bias,  "forecast": hw_fc,  "lower": hw_low,  "upper": hw_up},
        {"name": arima_label,        "mape": ar_mape,  "bias": ar_bias,  "forecast": ar_fc,  "lower": ar_low,  "upper": ar_up},
        {"name": autoarima_label,    "mape": aar_mape, "bias": aar_bias, "forecast": aar_fc, "lower": aar_low, "upper": aar_up},
        {"name": "Theta",            "mape": th_mape,  "bias": th_bias,  "forecast": th_fc,  "lower": th_low,  "upper": th_up},
        {"name": "Regressão Linear", "mape": lr_mape,  "bias": lr_bias,  "forecast": lr_fc,  "lower": lr_low,  "upper": lr_up},
    ]

    ranked = sorted(candidates, key=lambda m: m["mape"])
    valid  = [m for m in ranked if m["mape"] != float('inf')]

    if not valid:
        return {"error": "Nenhum modelo conseguiu ser treinado. Verifique os dados e os parâmetros."}

    top = valid[0]
    future_periods = _generate_future_periods(df['periodo'].iloc[-1], request.horizon)

    def _sf(v):
        if v is None: return None
        try:
            f = float(v)
            return None if not np.isfinite(f) else f
        except Exception:
            return None

    def _sl(lst):  return [_sf(v) for v in lst]
    def _sm(v):    return 9999.99 if (v == float('inf') or (isinstance(v, float) and not np.isfinite(v))) else round(float(v), 2)
    def _sb(v):
        try:
            f = float(v)
            return None if not np.isfinite(f) else round(f, 2)
        except Exception:
            return None

    return {
        "top_model": top["name"],
        "models": [
            {
                "name":     m["name"],
                "mape":     _sm(m["mape"]),
                "accuracy": round(max(0.0, 100 - m["mape"]), 2)
                            if m["mape"] != float('inf') and np.isfinite(m["mape"]) else None,
                "bias":     _sb(m["bias"]),
                "rank":     i + 1,
            }
            for i, m in enumerate(ranked)
        ],
        "forecast":           _sl(top["forecast"]),
        "lower":              _sl(top["lower"]),
        "upper":              _sl(top["upper"]),
        "historico":          _sl(values.tolist()),
        "periodos_historico": df['periodo'].tolist(),
        "periodos_forecast":  future_periods,
        "test_size":          request.test_size,
    }


# ═══════════════════════════════════════════════════════════
# Dados de Bolsa via yfinance
# ═══════════════════════════════════════════════════════════

class StockRequest(BaseModel):
    ticker:   str
    period:   str = "2y"   # 1mo 3mo 6mo 1y 2y 5y 10y ytd max
    interval: str = "1mo"  # 1d 1wk 1mo


@app.post("/api/stock")
def fetch_stock(request: StockRequest):
    try:
        import yfinance as yf

        ticker_str = request.ticker.upper().strip()
        t    = yf.Ticker(ticker_str)
        hist = t.history(period=request.period, interval=request.interval, auto_adjust=True)

        if hist.empty:
            return {"error": f"Nenhum dado encontrado para '{ticker_str}'. Verifique o símbolo."}

        info: dict = {}
        try:
            info = t.info or {}
        except Exception:
            pass

        company  = info.get("longName") or info.get("shortName") or ticker_str
        currency = info.get("currency", "")
        exchange = info.get("exchange", "")

        hist = hist.reset_index()
        date_col = "Date" if "Date" in hist.columns else "Datetime"

        dataset = []
        for _, row in hist.iterrows():
            dt  = row[date_col]
            val = float(row.get("Close", float("nan")))
            if pd.isna(val) or not np.isfinite(val):
                continue
            if hasattr(dt, "strftime"):
                periodo = dt.strftime("%Y-%m-%d") if request.interval in ("1d", "1wk") else dt.strftime("%Y-%m")
            else:
                periodo = str(dt)[:10]
            dataset.append({
                "codigo":    ticker_str,
                "descricao": company,
                "periodo":   periodo,
                "valor":     round(val, 4),
            })

        if not dataset:
            return {"error": "Dados inválidos retornados pela API. Tente outro período ou intervalo."}

        return {
            "dataset":      dataset,
            "ticker":       ticker_str,
            "company":      company,
            "currency":     currency,
            "exchange":     exchange,
            "total_points": len(dataset),
            "period":       request.period,
            "interval":     request.interval,
        }

    except Exception as e:
        return {"error": f"Erro ao buscar dados: {str(e)}"}


# ═══════════════════════════════════════════════════════════
# Regressão Linear Dedicada
# ═══════════════════════════════════════════════════════════

class RegressionRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]
    horizon: int = 12


@app.post("/api/regression")
def run_regression(request: RegressionRequest):
    data = [item.dict() for item in request.dataset]
    df   = pd.DataFrame(data)
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])

    if len(df) < 3:
        return {"error": "Série muito curta para regressão linear (mínimo 3 pontos)."}

    values = df['valor'].values.astype(float)
    n      = len(values)
    x      = np.arange(n, dtype=float)
    X      = np.column_stack([np.ones(n), x])

    beta, _, _, _ = np.linalg.lstsq(X, values, rcond=None)
    intercept     = float(beta[0])
    slope         = float(beta[1])

    fitted    = intercept + slope * x
    residuals = values - fitted

    ss_res    = float(np.sum(residuals ** 2))
    ss_tot    = float(np.sum((values - np.mean(values)) ** 2))
    r_squared = float(1.0 - ss_res / ss_tot) if ss_tot != 0 else 0.0
    rmse      = float(np.sqrt(np.mean(residuals ** 2)))
    mae       = float(np.mean(np.abs(residuals)))
    mask      = values != 0
    mape      = float(np.mean(np.abs(residuals[mask] / values[mask])) * 100) if mask.sum() > 0 else 9999.99

    future_periods = _generate_future_periods(df['periodo'].iloc[-1], request.horizon)
    x_fc           = np.arange(n, n + request.horizon, dtype=float)
    forecast_line  = (intercept + slope * x_fc).tolist()

    res_std = float(np.std(residuals))
    lower   = [v - 1.28 * res_std for v in forecast_line]
    upper   = [v + 1.28 * res_std for v in forecast_line]

    return {
        "intercept":          round(intercept, 4),
        "slope":              round(slope, 4),
        "r_squared":          round(r_squared, 4),
        "rmse":               round(rmse, 4),
        "mae":                round(mae, 4),
        "mape":               round(mape, 2),
        "fitted":             fitted.tolist(),
        "residuals":          residuals.tolist(),
        "historico":          values.tolist(),
        "periodos_historico": df['periodo'].tolist(),
        "forecast_line":      forecast_line,
        "lower":              lower,
        "upper":              upper,
        "periodos_forecast":  future_periods,
    }


# ═══════════════════════════════════════════════════════════
# Diagnósticos Avançados de Séries Temporais
# ═══════════════════════════════════════════════════════════

class DiagnosticsRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]


# ── Helpers internos de diagnóstico ──────────────────────────
def _adf_pvalue(values: np.ndarray) -> float:
    try:
        return float(adfuller(values, autolag='AIC')[1])
    except Exception:
        return float('nan')


def _shapiro_pvalue(values: np.ndarray) -> float:
    try:
        sample = values if len(values) <= 5000 else values[:5000]
        return float(shapiro(sample)[1])
    except Exception:
        return float('nan')


def _ols_residuals(values: np.ndarray) -> np.ndarray:
    """Linear detrend → residuals."""
    n = len(values)
    x = np.arange(n, dtype=float)
    X = np.column_stack([np.ones(n), x])
    beta, _, _, _ = np.linalg.lstsq(X, values, rcond=None)
    return values - X @ beta


def _approximate_entropy(U: np.ndarray, m: int = 2, r: float = None) -> float:
    """Approximate Entropy (ApEn) — measures complexity/irregularity."""
    N = len(U)
    if N < 10:
        return float('nan')
    if r is None:
        r = 0.2 * float(np.std(U, ddof=1))
    if r == 0:
        return 0.0
    def _phi(m_val: int) -> float:
        templates = np.array([U[i:i + m_val] for i in range(N - m_val + 1)])
        dists = np.max(np.abs(templates[:, None] - templates[None, :]), axis=2)
        C = np.sum(dists <= r, axis=1) / (N - m_val + 1)
        C = np.where(C > 0, C, 1e-10)
        return float(np.mean(np.log(C)))
    try:
        return abs(_phi(m) - _phi(m + 1))
    except Exception:
        return float('nan')


def _shannon_entropy(values: np.ndarray, bins: int = 20) -> float:
    counts, _ = np.histogram(values, bins=bins)
    probs = counts / counts.sum()
    probs = probs[probs > 0]
    return float(-np.sum(probs * np.log2(probs)))


def _chow_scan(values: np.ndarray):
    """Scan interior breakpoints for the strongest Chow F-statistic."""
    from scipy.stats import f as f_dist
    n = len(values)
    x = np.arange(n, dtype=float)
    X = np.column_stack([np.ones(n), x])
    k = 2

    beta_f, _, _, _ = np.linalg.lstsq(X, values, rcond=None)
    ssr_full = float(np.sum((values - X @ beta_f) ** 2))

    start, end = max(k + 1, int(0.2 * n)), min(n - k - 1, int(0.8 * n))
    best = {"breakpoint_index": None, "f_statistic": 0.0, "p_value": 1.0, "significant": False}

    for bp in range(start, end):
        b1, _, _, _ = np.linalg.lstsq(X[:bp],  values[:bp],  rcond=None)
        b2, _, _, _ = np.linalg.lstsq(X[bp:],  values[bp:],  rcond=None)
        ssr_res = float(np.sum((values[:bp]  - X[:bp]  @ b1) ** 2) +
                        np.sum((values[bp:]  - X[bp:]  @ b2) ** 2))
        df2 = n - 2 * k
        if ssr_res <= 0 or df2 <= 0:
            continue
        f_stat = ((ssr_full - ssr_res) / k) / (ssr_res / df2)
        if f_stat > best["f_statistic"]:
            p_val = float(1 - f_dist.cdf(max(0.0, f_stat), k, df2))
            best = {
                "breakpoint_index": int(bp),
                "f_statistic":      round(float(f_stat), 4),
                "p_value":          round(p_val, 4),
                "significant":      p_val < 0.05,
            }
    return best


def _cusum_ols(values: np.ndarray):
    """CUSUM of OLS residuals (Brown-Durbin-Evans 1975)."""
    n = len(values)
    residuals = _ols_residuals(values)
    sigma = float(np.std(residuals, ddof=2)) or 1.0
    cusum = np.cumsum(residuals) / (sigma * np.sqrt(n))
    cusum_max = float(np.max(np.abs(cusum)))
    # 5% critical value ≈ 0.948 (normalized)
    significant = cusum_max > 0.948
    p_approx = 0.01 if cusum_max > 1.143 else (0.05 if significant else 0.50)
    return cusum.tolist(), round(cusum_max, 4), round(p_approx, 4), significant


# ── 1. Transformações ─────────────────────────────────────────
@app.post("/api/diagnostics/transformations")
def diagnostics_transformations(request: DiagnosticsRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])
    if len(df) < 10:
        return {"error": "Série muito curta (mínimo 10 pontos)."}

    values = df['valor'].values.astype(float)
    periodos = df['periodo'].tolist()

    def _stats(v: np.ndarray, tag: str, applicable: bool = True):
        if not applicable or len(v) < 5:
            return {"tag": tag, "applicable": False, "values": [], "periodos": [],
                    "adf_pvalue": None, "shapiro_pvalue": None, "std": None, "recommendation": "N/A"}
        return {
            "tag":           tag,
            "applicable":    True,
            "values":        [round(float(x), 4) for x in v],
            "periodos":      periodos[:len(v)],
            "adf_pvalue":    round(_adf_pvalue(v), 4),
            "shapiro_pvalue": round(_shapiro_pvalue(v), 4),
            "std":           round(float(np.std(v, ddof=1)), 4),
        }

    results = {}

    # Original
    results["original"] = _stats(values, "Original")

    # Log (only if all values > 0)
    log_ok = bool(np.all(values > 0))
    results["log"] = _stats(np.log(values) if log_ok else values, "Log", log_ok)
    if not log_ok:
        results["log"]["note"] = "Série contém valores ≤ 0 — log não aplicável."

    # Diferenciação 1ª ordem
    diff1 = np.diff(values)
    results["diff1"] = _stats(diff1, "Diff(1)")

    # Diferenciação 2ª ordem
    diff2 = np.diff(diff1)
    results["diff2"] = _stats(diff2, "Diff(2)")

    # Box-Cox (só se valores > 0)
    bc_ok = bool(np.all(values > 0))
    if bc_ok:
        from scipy.stats import boxcox
        try:
            bc_vals, lam = boxcox(values)
            r = _stats(bc_vals, "Box-Cox", True)
            r["lambda"] = round(float(lam), 4)
            results["boxcox"] = r
        except Exception as e:
            results["boxcox"] = {"tag": "Box-Cox", "applicable": False, "note": str(e)}
    else:
        results["boxcox"] = {"tag": "Box-Cox", "applicable": False,
                             "note": "Série contém valores ≤ 0 — Box-Cox não aplicável."}

    # Recomendação automática
    orig_adf = results["original"]["adf_pvalue"]
    rec = []
    if orig_adf is not None and orig_adf > 0.05:
        d1_adf = results["diff1"]["adf_pvalue"]
        if d1_adf is not None and d1_adf < 0.05:
            rec.append("Diferenciação de 1ª ordem torna a série estacionária.")
        elif results["diff2"]["adf_pvalue"] is not None and results["diff2"]["adf_pvalue"] < 0.05:
            rec.append("Diferenciação de 2ª ordem torna a série estacionária.")
    else:
        rec.append("Série já é estacionária — transformações podem não ser necessárias.")
    if log_ok and results["log"]["adf_pvalue"] is not None:
        rec.append("Log pode estabilizar variância se a série crescer exponencialmente.")
    results["recommendation"] = rec

    return results


# ── 2. Distribuição ───────────────────────────────────────────
@app.post("/api/diagnostics/distribution")
def diagnostics_distribution(request: DiagnosticsRequest):
    from scipy.stats import skew, kurtosis, jarque_bera, norm, probplot
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])
    if len(df) < 5:
        return {"error": "Série muito curta."}

    values = df['valor'].values.astype(float)

    skewness  = float(skew(values))
    kurt      = float(kurtosis(values))  # excess kurtosis (normal = 0)
    shap_stat, shap_p = shapiro(values[:5000] if len(values) > 5000 else values)
    jb_stat,   jb_p   = jarque_bera(values)

    # Q-Q plot data
    (osm, osr), _ = probplot(values, dist="norm")

    # Histogram
    n_bins = min(50, max(5, int(np.sqrt(len(values)))))
    hist_counts, bin_edges = np.histogram(values, bins=n_bins, density=True)
    # Normal curve overlay
    mu, sigma = float(np.mean(values)), float(np.std(values, ddof=1))
    bin_centers = [(bin_edges[i] + bin_edges[i+1]) / 2 for i in range(len(bin_edges)-1)]
    normal_curve = [float(norm.pdf(c, mu, sigma)) for c in bin_centers]

    # Interpretation
    if abs(skewness) < 0.5:
        skew_interp = "Aproximadamente simétrica"
    elif skewness > 0:
        skew_interp = f"Assimetria positiva (cauda longa à direita, skew={skewness:.2f})"
    else:
        skew_interp = f"Assimetria negativa (cauda longa à esquerda, skew={skewness:.2f})"

    if abs(kurt) < 0.5:
        kurt_interp = "Curtose normal (mesocúrtica)"
    elif kurt > 0:
        kurt_interp = f"Leptocúrtica — caudas pesadas, presença de outliers extremos (kurt={kurt:.2f})"
    else:
        kurt_interp = f"Platicúrtica — distribuição mais achatada que normal (kurt={kurt:.2f})"

    return {
        "n":                  int(len(values)),
        "mean":               round(mu, 4),
        "std":                round(sigma, 4),
        "skewness":           round(skewness, 4),
        "skewness_interp":    skew_interp,
        "kurtosis":           round(kurt, 4),
        "kurtosis_interp":    kurt_interp,
        "shapiro_stat":       round(float(shap_stat), 4),
        "shapiro_pvalue":     round(float(shap_p), 4),
        "is_normal_shapiro":  bool(shap_p >= 0.05),
        "jarque_bera_stat":   round(float(jb_stat), 4),
        "jarque_bera_pvalue": round(float(jb_p), 4),
        "is_normal_jb":       bool(jb_p >= 0.05),
        "histogram":          [round(float(h), 6) for h in hist_counts],
        "bin_centers":        [round(float(c), 4) for c in bin_centers],
        "bin_edges":          [round(float(e), 4) for e in bin_edges],
        "normal_curve":       normal_curve,
        "qq_theoretical":     [round(float(v), 4) for v in osm],
        "qq_sample":          [round(float(v), 4) for v in osr],
    }


# ── 3. Quebras Estruturais ────────────────────────────────────
@app.post("/api/diagnostics/structural-breaks")
def diagnostics_structural_breaks(request: DiagnosticsRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])
    if len(df) < 20:
        return {"error": "Série muito curta para testes de quebra estrutural (mínimo 20 pontos)."}

    values  = df['valor'].values.astype(float)
    periodos = df['periodo'].tolist()

    # CUSUM
    cusum_series, cusum_max, cusum_p, cusum_sig = _cusum_ols(values)
    # Critical bands (±0.948 for 5%)
    cusum_upper = [0.948] * len(cusum_series)
    cusum_lower = [-0.948] * len(cusum_series)

    # Chow
    chow = _chow_scan(values)
    if chow["breakpoint_index"] is not None:
        chow["breakpoint_periodo"] = periodos[chow["breakpoint_index"]]

    return {
        "cusum": {
            "series":      [round(v, 4) for v in cusum_series],
            "periodos":    periodos[:len(cusum_series)],
            "upper_band":  cusum_upper,
            "lower_band":  cusum_lower,
            "max_stat":    cusum_max,
            "p_value":     cusum_p,
            "significant": cusum_sig,
            "conclusion":  (
                "⚠️ CUSUM detectou instabilidade estrutural — possível quebra na série."
                if cusum_sig else
                "✓ CUSUM não detectou quebra estrutural significativa."
            ),
        },
        "chow": {
            **chow,
            "conclusion": (
                f"⚠️ Chow Test detectou quebra estrutural no período '{chow.get('breakpoint_periodo', '?')}' "
                f"(F={chow['f_statistic']}, p={chow['p_value']})."
                if chow["significant"] else
                "✓ Chow Test não detectou quebra estrutural significativa."
            ),
        },
    }


# ── 4. Detecção de Outliers ───────────────────────────────────
@app.post("/api/diagnostics/outliers")
def diagnostics_outliers(request: DiagnosticsRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])
    if len(df) < 5:
        return {"error": "Série muito curta."}

    values   = df['valor'].values.astype(float)
    periodos = df['periodo'].tolist()
    n = len(values)

    # Z-score
    mu, sigma = np.mean(values), np.std(values, ddof=1)
    z_scores = (values - mu) / sigma if sigma > 0 else np.zeros(n)

    # IQR
    q1, q3 = np.percentile(values, 25), np.percentile(values, 75)
    iqr = q3 - q1
    iqr_lower, iqr_upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr

    # MAD (Median Absolute Deviation) — mais robusto
    med = np.median(values)
    mad = np.median(np.abs(values - med))
    mad_scores = np.abs(values - med) / (mad * 1.4826) if mad > 0 else np.zeros(n)

    outliers = []
    for i in range(n):
        methods = []
        if abs(z_scores[i]) > 3:
            methods.append("Z-score")
        if values[i] < iqr_lower or values[i] > iqr_upper:
            methods.append("IQR")
        if mad_scores[i] > 3.5:
            methods.append("MAD")
        if methods:
            outliers.append({
                "index":    i,
                "periodo":  periodos[i],
                "valor":    round(float(values[i]), 4),
                "z_score":  round(float(z_scores[i]), 4),
                "mad_score": round(float(mad_scores[i]), 4),
                "methods":  methods,
                "severity": "extremo" if len(methods) >= 2 else "moderado",
            })

    # Série completa com flag para o gráfico (bool() garante JSON-serializável)
    series_flagged = [
        {
            "periodo": periodos[i],
            "valor":   round(float(values[i]), 4),
            "outlier": bool(abs(z_scores[i]) > 3 or values[i] < iqr_lower or values[i] > iqr_upper),
        }
        for i in range(n)
    ]

    return {
        "n":                int(n),
        "n_outliers":       len(outliers),
        "outlier_fraction": round(len(outliers) / n * 100, 2),
        "thresholds": {
            "iqr_lower":   round(float(iqr_lower), 4),
            "iqr_upper":   round(float(iqr_upper), 4),
            "z_threshold": 3.0,
            "mad_threshold": 3.5,
        },
        "outliers":      outliers,
        "series_flagged": series_flagged,
        "conclusion": (
            f"⚠️ {len(outliers)} outlier(s) detectado(s) ({len(outliers)/n*100:.1f}% da série). Considere tratamento antes do forecast."
            if outliers else
            "✓ Nenhum outlier detectado pela combinação de métodos (Z-score, IQR, MAD)."
        ),
    }


# ── 5. Análise de Resíduos ────────────────────────────────────
@app.post("/api/diagnostics/residuals")
def diagnostics_residuals(request: DiagnosticsRequest):
    from statsmodels.stats.diagnostic import acorr_ljungbox
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])
    if len(df) < 15:
        return {"error": "Série muito curta para análise de resíduos (mínimo 15 pontos)."}

    values   = df['valor'].values.astype(float)
    periodos = df['periodo'].tolist()

    residuals = _ols_residuals(values)

    # Ljung-Box
    lags_to_test = min(20, len(residuals) // 4)
    lb = acorr_ljungbox(residuals, lags=[lags_to_test], return_df=True)
    lb_stat  = float(lb['lb_stat'].iloc[-1])
    lb_pval  = float(lb['lb_pvalue'].iloc[-1])
    is_white = lb_pval >= 0.05

    # ACF dos resíduos
    max_lags = min(30, len(residuals) // 2 - 1)
    acf_vals, acf_conf = acf(residuals, nlags=max_lags, alpha=0.05)
    conf_bound = 1.96 / np.sqrt(len(residuals))

    return {
        "residuals":      [round(float(r), 4) for r in residuals],
        "periodos":       periodos,
        "mean":           round(float(np.mean(residuals)), 4),
        "std":            round(float(np.std(residuals, ddof=1)), 4),
        "ljung_box": {
            "stat":         round(lb_stat, 4),
            "p_value":      round(lb_pval, 4),
            "lags_tested":  lags_to_test,
            "is_white_noise": is_white,
            "conclusion": (
                "✓ Resíduos são ruído branco — modelo bem especificado."
                if is_white else
                "⚠️ Resíduos apresentam autocorrelação — o modelo pode estar mal especificado."
            ),
        },
        "acf":            [round(float(v), 4) for v in acf_vals],
        "acf_lags":       list(range(len(acf_vals))),
        "conf_bound":     round(float(conf_bound), 4),
    }


# ── 6. Entropia & Complexidade ────────────────────────────────
@app.post("/api/diagnostics/entropy")
def diagnostics_entropy(request: DiagnosticsRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])
    if len(df) < 10:
        return {"error": "Série muito curta (mínimo 10 pontos)."}

    values = df['valor'].values.astype(float)

    shannon  = _shannon_entropy(values)
    apen     = _approximate_entropy(values, m=2)

    # Coeficiente de variação (complementar à entropia)
    cv = float(np.std(values, ddof=1) / np.mean(values)) if np.mean(values) != 0 else float('nan')

    # Hurst exponent (R/S method) — estima persistência
    def _hurst(ts):
        n = len(ts)
        if n < 20:
            return float('nan')
        lags = range(2, min(20, n // 2))
        rs_list = []
        for lag in lags:
            chunks = [ts[i:i+lag] for i in range(0, n - lag, lag)]
            rs_chunk = []
            for chunk in chunks:
                if len(chunk) < 2:
                    continue
                mean_c = np.mean(chunk)
                cumdev = np.cumsum(chunk - mean_c)
                R = max(cumdev) - min(cumdev)
                S = np.std(chunk, ddof=1)
                if S > 0:
                    rs_chunk.append(R / S)
            if rs_chunk:
                rs_list.append((lag, np.mean(rs_chunk)))
        if len(rs_list) < 4:
            return float('nan')
        lags_arr = np.log([r[0] for r in rs_list])
        rs_arr   = np.log([r[1] for r in rs_list])
        hurst, _ = np.polyfit(lags_arr, rs_arr, 1)
        return round(float(hurst), 4)

    hurst = _hurst(values)

    # Interpretation
    def _shannon_interp(h):
        if h > 4.0:  return "Alta entropia — série muito irregular/imprevisível."
        if h > 2.5:  return "Entropia moderada — padrões parcialmente identificáveis."
        return "Baixa entropia — série previsível com padrões claros."

    def _apen_interp(ap):
        if np.isnan(ap):   return "Não calculável."
        if ap > 1.5:  return "Alta complexidade — série caótica."
        if ap > 0.5:  return "Complexidade moderada."
        return "Baixa complexidade — série regular e previsível."

    def _hurst_interp(h):
        if np.isnan(h):   return "Não calculável."
        if h > 0.55: return f"H={h:.3f} — persistente (tendência se mantém)."
        if h < 0.45: return f"H={h:.3f} — anti-persistente (reversão à média)."
        return f"H={h:.3f} — caminho aleatório (sem memória de longo prazo)."

    return {
        "shannon_entropy":      round(float(shannon), 4) if np.isfinite(shannon) else None,
        "shannon_interp":       _shannon_interp(shannon),
        "approximate_entropy":  round(float(apen), 4) if not np.isnan(apen) else None,
        "apen_interp":          _apen_interp(apen),
        "hurst_exponent":       hurst if not np.isnan(hurst) else None,
        "hurst_interp":         _hurst_interp(hurst),
        "coef_variation":       round(cv * 100, 2) if np.isfinite(cv) else None,
        "predictability_score": round(max(0.0, min(100.0, 100 - float(apen) * 30)), 1)
                                if not np.isnan(apen) else None,
    }


# ───────────────────────────────────────────────────────────
# Chat de IA Analítico
# ───────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[dict] = None


def _build_system_prompt(context: Optional[dict]) -> str:
    base = (
        "Você é o DataPredict AI, assistente especialista em análise de séries temporais. "
        "Responda sempre em português brasileiro, de forma clara, objetiva e didática. "
        "Os modelos disponíveis são: Média Móvel (baseline), Suavização Exponencial "
        "(Holt-Winters), ARIMA/SARIMAX, AutoARIMA e Theta Forecaster — todos via sktime."
    )
    if not context:
        return base

    ctx_lines = [base, "\n\n## Dados Analisados"]

    if context.get("stats"):
        s = context["stats"]
        ctx_lines.append(
            f"\n### Estatísticas\nN={s.get('count','?')} | "
            f"Média={s.get('mean','?')} | Std={s.get('std','?')} | "
            f"Min={s.get('min','?')} | Max={s.get('max','?')}"
        )
    if context.get("stationarity"):
        st = context["stationarity"]
        ctx_lines.append(
            f"\n### ADF: {'ESTACIONÁRIA ✓' if st.get('is_stationary') else 'NÃO ESTACIONÁRIA ✗'} "
            f"(p={st.get('p_value','?')})"
        )
    if context.get("normality"):
        nm = context["normality"]
        ctx_lines.append(
            f"\n### Shapiro-Wilk: {'NORMAL ✓' if nm.get('is_normal') else 'NÃO NORMAL ✗'} "
            f"(p={nm.get('p_value','?')})"
        )
    if context.get("forecast"):
        fc = context["forecast"]
        ranking = " | ".join(f"{m['name']}: {m['mape']}%" for m in fc.get("models", []))
        ctx_lines.append(f"\n### Forecast: vencedor={fc.get('top_model','?')} | {ranking}")

    return "\n".join(ctx_lines)


def _rule_based_response(user_msg: str, context: Optional[dict]) -> str:
    msg = user_msg.lower()

    if context and context.get("stationarity"):
        st = context["stationarity"]
        is_stat = st.get("is_stationary", False)
        p_val   = st.get("p_value", "N/A")
        if any(w in msg for w in ["estacionária", "estacionariedade", "adf", "raiz unitária"]):
            if is_stat:
                return (
                    f"✓ **Sua série é estacionária** (p-valor ADF = {p_val}).\n\n"
                    "Modelos como **ARIMA(p,0,q)** (d=0) funcionam diretamente. "
                    "O **AutoARIMA** vai identificar automaticamente os melhores parâmetros."
                )
            return (
                f"⚠️ **Sua série NÃO é estacionária** (p-valor ADF = {p_val}).\n\n"
                "Recomendações:\n"
                "1. Use **d=1** no ARIMA (diferenciação de 1ª ordem).\n"
                "2. O **AutoARIMA** detecta `d` automaticamente — boa opção aqui.\n"
                "3. Para sazonalidade, use **D=1** nos parâmetros sazonais e defina `s`."
            )

    if context and context.get("forecast"):
        fc    = context["forecast"]
        top   = fc.get("top_model", "N/A")
        models = fc.get("models", [])
        if any(w in msg for w in ["forecast", "previsão", "mape", "modelo", "melhor",
                                   "arima", "theta", "holt", "média", "autoarima"]):
            ranking_txt = "\n".join(
                f"  {'🥇' if i==0 else '🥈' if i==1 else '🥉' if i==2 else '🏅'} "
                f"**{m['name']}**: MAPE={m['mape']}%"
                for i, m in enumerate(models[:5])
            )
            mape  = models[0].get("mape", 0) if models else 0
            interp = (
                "Excelente (< 5%)" if isinstance(mape, (int, float)) and mape < 5 else
                "Bom (5–15%)"      if isinstance(mape, (int, float)) and mape < 15 else
                "Razoável (15–30%)" if isinstance(mape, (int, float)) and mape < 30 else
                "Alta incerteza (> 30%)"
            )
            return (
                f"📊 **Modelo vencedor:** {top}\n\n"
                f"**Ranking:**\n{ranking_txt}\n\n"
                f"**Precisão:** {interp}"
            )

    if any(w in msg for w in ["o que é", "explique", "explica", "defina", "como funciona"]):
        if "theta" in msg:
            return (
                "**Theta Forecaster** é um método clássico de 2 linhas (Assimakopoulos, 2000).\n\n"
                "- Ganhou a **M3 Competition** de previsão.\n"
                "- Decompõe a série em duas 'linhas theta': tendência longo prazo e variações de curto prazo.\n"
                "- Muito robusto para séries **mensais/trimestrais** com tendência clara."
            )
        if "autoarima" in msg:
            return (
                "**AutoARIMA** testa automaticamente diferentes combinações de (p,d,q)(P,D,Q) "
                "e seleciona a que minimiza o **AIC**.\n\n"
                "- Usa busca **stepwise** — rápida e eficiente.\n"
                "- Detecta `d` e `D` automaticamente via testes ADF/KPSS.\n"
                "- Ideal quando você não sabe os parâmetros certos do ARIMA."
            )
        if "arima" in msg or "sarimax" in msg:
            return (
                "**ARIMA(p,d,q)**:\n"
                "- **p** = lags autoregressivos (AR)\n"
                "- **d** = diferenciação (use 1 se não estacionária)\n"
                "- **q** = lags de média móvel (MA)\n\n"
                "Com **(P,D,Q)[s]** vira **SARIMAX** — ideal para séries com sazonalidade."
            )
        if "holt" in msg or "suavização" in msg or "exponencial" in msg:
            return (
                "**Holt-Winters (Suavização Exponencial)**:\n"
                "- Pesos decrescentes — observações recentes pesam mais.\n"
                "- **Trend='add'**: captura tendência linear.\n"
                "- **Seasonal='add'**: captura ciclos sazonais regulares."
            )
        if "mape" in msg:
            return (
                "**MAPE** (Mean Absolute Percentage Error):\n\n"
                "`MAPE = média(|real – previsto| / |real|) × 100%`\n\n"
                "- **< 5%**: Excelente · **5–15%**: Bom · **15–30%**: Razoável · **> 30%**: Alta incerteza"
            )
        if "bias" in msg:
            return (
                "**BIAS** mede tendência do modelo:\n\n"
                "- **BIAS > 0**: superestima · **BIAS < 0**: subestima · **|BIAS| ≤ 5%**: neutro"
            )
        if "média móvel" in msg or "naive" in msg or "baseline" in msg:
            return (
                "**Média Móvel (NaiveForecaster)** — baseline mínimo.\n\n"
                "- Prevê a média dos últimos N pontos (janela configurável).\n"
                "- Se os outros modelos não superam a Média Móvel, algo está errado."
            )

    has_data = bool(context and any(context.values()))
    if not has_data:
        return (
            "👋 Olá! Sou o **DataPredict AI**.\n\n"
            "Carregue um dataset e execute as análises.\n\n"
            "Posso explicar: **Média Móvel · Holt-Winters · ARIMA · AutoARIMA · Theta** "
            "e métricas como **MAPE, BIAS, Acurácia**."
        )

    return (
        "Estou pronto! Pergunte sobre:\n"
        "- 📈 Estatísticas · 📉 ADF · 📊 Shapiro-Wilk\n"
        "- 🤖 Ranking de modelos · 📖 Como funcionam os modelos"
    )


@app.post("/api/chat")
def chat(request: ChatRequest):
    if not request.messages:
        return {"error": "Nenhuma mensagem enviada."}

    system_prompt  = _build_system_prompt(request.context)
    last_user_msg  = next(
        (m.content for m in reversed(request.messages) if m.role == "user"), ""
    )

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    *[{"role": m.role, "content": m.content} for m in request.messages]
                ],
                max_tokens=800,
                temperature=0.5,
            )
            return {"response": response.choices[0].message.content}
        except Exception:
            pass

    return {"response": _rule_based_response(last_user_msg, request.context)}
