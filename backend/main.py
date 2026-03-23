from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Union
import pandas as pd
import numpy as np
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, acf, pacf
from scipy.stats import shapiro

app = FastAPI(title="DataPredict API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Garante que exceções não tratadas retornem JSON com CORS headers."""
    return JSONResponse(
        status_code=500,
        content={"error": f"Erro interno do servidor: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"},
    )

class TimeSeriesDataPoint(BaseModel):
    codigo: Union[str, int]
    descricao: str
    periodo: str
    valor: float

class StatsRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API is running"}

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

class DecompositionRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]
    period: int = 12 # Default para dados mensais
    model_type: str = "additive"

@app.post("/api/decomposition")
def get_decomposition(request: DecompositionRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    
    if len(df) < request.period * 2:
        return {"error": f"Série muito curta para decomposição com período {request.period}. O tamanho precisa ser pelo menos {request.period * 2}."}
        
    values = df['valor'].values
    
    try:
        # Usa o array diretamente para evitar issues de index do pandas com statsmodels
        result = seasonal_decompose(values, model=request.model_type, period=request.period, extrapolate_trend='freq')
        
        # Converte para listas compatíveis com JSON (removendo NaNs se existirem)
        trend = np.nan_to_num(result.trend, nan=0.0).tolist()
        seasonal = np.nan_to_num(result.seasonal, nan=0.0).tolist()
        resid = np.nan_to_num(result.resid, nan=0.0).tolist()
        
        return {
            "trend": trend,
            "seasonal": seasonal,
            "resid": resid,
            "observed": values.tolist()
        }
    except Exception as e:
        return {"error": f"Erro na decomposição: {str(e)}"}

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
        # Testa por estacionariedade
        adf_result = adfuller(values, maxlag=request.maxlag, autolag='AIC' if request.maxlag is None else None)
        
        stat = float(adf_result[0])
        p_value = float(adf_result[1])
        critical_values = {k: float(v) for k, v in adf_result[4].items()}
        
        is_stationary = p_value < 0.05
        
        return {
            "adf_statistic": stat,
            "p_value": p_value,
            "critical_values": critical_values,
            "is_stationary": is_stationary,
            "used_lag": int(adf_result[2]),
            "nobs": int(adf_result[3]),
            "conclusion": "A série é Estacionária (Rejeita H0)" if is_stationary else "A série NÃO é Estacionária (Falha em rejeitar H0)"
        }
    except Exception as e:
        return {"error": f"Erro no teste ADF: {str(e)}"}

class CorrelogramRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]
    nlags: int = 40

@app.post("/api/correlogram")
def get_correlogram(request: CorrelogramRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    
    # PACF exige nlags < n/2 (mais restritivo que ACF). Ajusta automaticamente.
    max_nlags = len(df) // 2 - 1
    if request.nlags >= len(df) // 2:
        request.nlags = max_nlags
    
    try:
        values = df['valor'].values
        # Calcula ACF
        acf_vals, acf_conf = acf(values, nlags=request.nlags, alpha=0.05)
        # Calcula PACF
        pacf_vals, pacf_conf = pacf(values, method='ywm', nlags=request.nlags, alpha=0.05)
        
        # Converte para json serializáveis (ACF retorna lag 0 de brinde, remover index 0 ou enviar)
        return {
            "lags": list(range(len(acf_vals))),
            "acf": acf_vals.tolist(),
            "acf_conf_lower": (acf_conf[:, 0] - acf_vals).tolist(), # Intervalo inferior centrado em 0
            "acf_conf_upper": (acf_conf[:, 1] - acf_vals).tolist(), # Intervalo superior centrado em 0
            "pacf": pacf_vals.tolist(),
            "pacf_conf_lower": (pacf_conf[:, 0] - pacf_vals).tolist(),
            "pacf_conf_upper": (pacf_conf[:, 1] - pacf_vals).tolist(),
        }
    except Exception as e:
        return {"error": f"Erro ao calcular ACF/PACF: {str(e)}"}

class NormalityRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]

@app.post("/api/normality")
def check_normality(request: NormalityRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)
    
    if len(df) < 3:
        return {"error": "Série muito curta para Teste de Normalidade (Min de 3 dados)."}
        
    try:
        values = df['valor'].values

        # Shapiro-Wilk tem limite de 5000 amostras — usa amostra aleatória se necessário
        shapiro_values = values
        sampled = False
        if len(values) > 5000:
            rng = np.random.default_rng(seed=42)
            shapiro_values = rng.choice(values, size=5000, replace=False)
            sampled = True

        # Avalia a Normalidade usando o teste Shapiro-Wilk
        stat, p_value = shapiro(shapiro_values)

        is_normal = bool(p_value >= 0.05)

        # Histograma com número fixo de bins para evitar edge cases com 'auto'
        n_bins = min(50, max(5, int(np.sqrt(len(values)))))
        hist_counts, bin_edges = np.histogram(values, bins=n_bins)

        result = {
            "statistic": float(stat),
            "p_value": float(p_value),
            "is_normal": is_normal,
            "conclusion": "Os dados seguem uma distribuição normal (Falha em rejeitar H0)" if is_normal else "Os dados NÃO seguem uma distribuição normal (Rejeita H0)",
            "histogram": hist_counts.tolist(),
            "bin_edges": bin_edges.tolist()
        }

        if sampled:
            result["warning"] = "Shapiro-Wilk aplicado em amostra aleatória de 5000 observações (série muito longa)."

        return result
    except Exception as e:
        return {"error": f"Erro no teste de normalidade: {str(e)}"}

# ─────────────────────────────────────────────
# Sprint 4 — Motor de Forecast
# ─────────────────────────────────────────────
from statsmodels.tsa.arima.model import ARIMA as StatsARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing

class ForecastRequest(BaseModel):
    dataset: List[TimeSeriesDataPoint]
    horizon: int = 12       # Períodos a prever no futuro
    test_size: int = 12     # Hold-out para avaliação do MAPE
    arima_p: int = 1
    arima_d: int = 1
    arima_q: int = 1

def _make_lag_features(series: np.ndarray, n_lags: int = 12):
    """Cria matriz de features de lags para modelos ML."""
    X, y = [], []
    for i in range(n_lags, len(series)):
        X.append(series[i - n_lags:i])
        y.append(series[i])
    return np.array(X), np.array(y)

def _mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Mean Absolute Percentage Error (ignora zeros)."""
    mask = actual != 0
    if mask.sum() == 0:
        return float('inf')
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)

def _bias(actual: np.ndarray, predicted: np.ndarray) -> float:
    """BIAS: erro médio percentual com sinal (positivo = superestimação, negativo = subestimação)."""
    mask = actual != 0
    if mask.sum() == 0:
        return float('nan')
    return float(np.mean((predicted[mask] - actual[mask]) / actual[mask]) * 100)

def _train_arima(train: np.ndarray, test: np.ndarray, horizon: int, p: int=1, d: int=1, q: int=1):
    """Treina ARIMA(p,d,q) como baseline robusto."""
    try:
        model = StatsARIMA(train, order=(p, d, q)).fit()
        preds = model.forecast(steps=len(test))
        mape = _mape(test, preds)
        bias = _bias(test, preds)
        # Forecast final (retreina em toda a série)
        full_model = StatsARIMA(np.concatenate([train, test]), order=(p, d, q)).fit()
        fc_result = full_model.get_forecast(steps=horizon)
        forecast = fc_result.predicted_mean.tolist()
        conf = fc_result.conf_int(alpha=0.2)
        lower = conf.iloc[:, 0].tolist()
        upper = conf.iloc[:, 1].tolist()
        return mape, bias, forecast, lower, upper
    except Exception as e:
        return float('inf'), float('nan'), [], [], []

def _train_holtwinters(train: np.ndarray, test: np.ndarray, horizon: int):
    """Treina Holt-Winters (Exponential Smoothing) como modelo clássico alternativo."""
    try:
        # Usaremos apenas trend e sem sazonal (Holt linear) devido à flexibilidade necessária
        # method='heuristic' é mais amigável para séries curtas do que 'estimated'
        model = ExponentialSmoothing(train, trend='add', seasonal=None, initialization_method="heuristic").fit(optimized=True)
        preds = model.forecast(steps=len(test))
        mape = _mape(test, preds)
        bias = _bias(test, preds)
        
        # Forecast final
        full_model = ExponentialSmoothing(np.concatenate([train, test]), trend='add', seasonal=None, initialization_method="heuristic").fit(optimized=True)
        forecast = full_model.forecast(steps=horizon).tolist()
        
        # Pseudo-intervalo baseado no desvio padrão dos resíduos
        residuals = full_model.resid
        resid_std = float(np.std(residuals))
        lower = [f - 1.96 * resid_std for f in forecast]
        upper = [f + 1.96 * resid_std for f in forecast]
        
        return mape, bias, forecast, lower, upper
    except Exception as e:
        return float('inf'), float('nan'), [], [], []

def _train_xgboost(train: np.ndarray, test: np.ndarray, horizon: int, n_lags: int):
    """Treina XGBoost com features de n_lags defasagens."""
    try:
        import xgboost as xgb
        X_train, y_train = _make_lag_features(train, n_lags)
        model = xgb.XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.05,
                                  subsample=0.8, random_state=42, verbosity=0)
        model.fit(X_train, y_train)

        # Avalia no teste (one-step ahead)
        full_ts = np.concatenate([train, test])
        test_preds = []
        window = list(train)
        for _ in range(len(test)):
            feats = np.array(window[-n_lags:]).reshape(1, -1)
            pred = float(model.predict(feats)[0])
            test_preds.append(pred)
            window.append(test[len(test_preds) - 1])  # usa valor real para próximo passo
        mape = _mape(test, np.array(test_preds))
        bias = _bias(test, np.array(test_preds))

        # Forecast futuro (iterativo, sem valores reais)
        window = list(full_ts)
        forecast = []
        X_all, y_all = _make_lag_features(full_ts, n_lags)
        model.fit(X_all, y_all)  # retreina em toda série
        fitted = model.predict(X_all)
        residuals = y_all - fitted
        resid_std = float(np.std(residuals))

        for _ in range(horizon):
            feats = np.array(window[-n_lags:]).reshape(1, -1)
            pred = float(model.predict(feats)[0])
            forecast.append(pred)
            window.append(pred)

        lower = [f - 1.96 * resid_std for f in forecast]
        upper = [f + 1.96 * resid_std for f in forecast]
        return mape, bias, forecast, lower, upper
    except Exception as e:
        print(f"Erro no XGBoost: {str(e)}")
        return float('inf'), float('nan'), [], [], []

def _train_lightgbm(train: np.ndarray, test: np.ndarray, horizon: int, n_lags: int):
    """Treina LightGBM com features de n_lags defasagens."""
    try:
        import lightgbm as lgb
        X_train, y_train = _make_lag_features(train, n_lags)
        model = lgb.LGBMRegressor(n_estimators=100, max_depth=3, learning_rate=0.05,
                                   subsample=0.8, random_state=42, verbose=-1, importance_type='split')
        model.fit(X_train, y_train)

        # Avalia no teste (one-step ahead com valores reais)
        test_preds = []
        window = list(train)
        for i in range(len(test)):
            feats = np.array(window[-n_lags:]).reshape(1, -1)
            pred = float(model.predict(feats)[0])
            test_preds.append(pred)
            window.append(test[i])
        mape = _mape(test, np.array(test_preds))
        bias = _bias(test, np.array(test_preds))

        # Forecast futuro iterativo
        full_ts = np.concatenate([train, test])
        X_all, y_all = _make_lag_features(full_ts, n_lags)
        model.fit(X_all, y_all)
        fitted = model.predict(X_all)
        resid_std = float(np.std(y_all - fitted))

        window = list(full_ts)
        forecast = []
        for _ in range(horizon):
            feats = np.array(window[-n_lags:]).reshape(1, -1)
            pred = float(model.predict(feats)[0])
            forecast.append(pred)
            window.append(pred)

        lower = [f - 1.96 * resid_std for f in forecast]
        upper = [f + 1.96 * resid_std for f in forecast]
        return mape, bias, forecast, lower, upper
    except Exception as e:
        print(f"Erro no LightGBM: {str(e)}")
        return float('inf'), float('nan'), [], [], []

def _generate_future_periods(last_period: str, horizon: int) -> list:
    """Tenta gerar labels de período futuro a partir do último período."""
    try:
        # Tenta parsear como data
        from dateutil.parser import parse as parse_date
        from dateutil.relativedelta import relativedelta
        dt = parse_date(str(last_period))
        periods = []
        for i in range(1, horizon + 1):
            future = dt + relativedelta(months=i)
            periods.append(future.strftime('%Y-%m'))
        return periods
    except Exception:
        # Fallback: T+1, T+2, ...
        return [f"T+{i}" for i in range(1, horizon + 1)]
@app.post("/api/forecast")
def run_forecast(request: ForecastRequest):
    data = [item.dict() for item in request.dataset]
    df = pd.DataFrame(data)

    if df.empty:
        return {"error": "Dataset vazio."}

    # Limpeza e Conversão de Dados
    df['valor'] = pd.to_numeric(df['valor'], errors='coerce')
    df = df.dropna(subset=['valor'])
    
    min_required = request.test_size + 13  # test_size + pelo menos 13 pontos de treino para lags
    if len(df) < min_required:
        return {"error": f"Série muito curta após limpeza de dados para forecast. Necessário no mínimo {min_required} observações válidas."}

    values = df['valor'].values.astype(float)
    n_lags = min(12, len(values) // 4)  # lags adaptativos

    train = values[:-request.test_size]
    test  = values[-request.test_size:]

    # ── Treina os modelos ──────────────────────
    arima_mape,  arima_bias,  arima_fc,  arima_low,  arima_up  = _train_arima(train, test, request.horizon, request.arima_p, request.arima_d, request.arima_q)
    hw_mape,     hw_bias,     hw_fc,     hw_low,     hw_up     = _train_holtwinters(train, test, request.horizon)
    xgb_mape,    xgb_bias,    xgb_fc,    xgb_low,    xgb_up   = _train_xgboost(train, test, request.horizon, n_lags)
    lgbm_mape,   lgbm_bias,   lgbm_fc,   lgbm_low,   lgbm_up  = _train_lightgbm(train, test, request.horizon, n_lags)

    # ── Monta ranking ───────────────────────────
    candidates = [
        {"name": f"ARIMA({request.arima_p},{request.arima_d},{request.arima_q})", "mape": arima_mape, "bias": arima_bias, "forecast": arima_fc, "lower": arima_low, "upper": arima_up},
        {"name": "Holt-Winters", "mape": hw_mape,   "bias": hw_bias,   "forecast": hw_fc,   "lower": hw_low,   "upper": hw_up},
        {"name": "XGBoost",      "mape": xgb_mape,  "bias": xgb_bias,  "forecast": xgb_fc,  "lower": xgb_low,  "upper": xgb_up},
        {"name": "LightGBM",     "mape": lgbm_mape, "bias": lgbm_bias, "forecast": lgbm_fc, "lower": lgbm_low, "upper": lgbm_up},
    ]
    ranked = sorted(candidates, key=lambda m: m["mape"])

    # Filtra modelos que falharam (inf MAPE)
    valid = [m for m in ranked if m["mape"] != float('inf')]
    if not valid:
        return {"error": "Nenhum modelo conseguiu ser treinado. Verifique se as bibliotecas xgboost e lightgbm estão instaladas no ambiente."}

    top = valid[0]

    # Períodos futuros para o eixo X
    last_period = df['periodo'].iloc[-1]
    future_periods = _generate_future_periods(last_period, request.horizon)

    def _safe_float(v):
        """Converte float, substituindo NaN/Inf por None."""
        if v is None:
            return None
        try:
            f = float(v)
            if not np.isfinite(f):
                return None
            return f
        except Exception:
            return None

    def _safe_list(lst):
        return [_safe_float(v) for v in lst]

    def _safe_mape(v):
        """MAPE seguro para JSON: Inf vira 9999.99."""
        if v == float('inf') or (isinstance(v, float) and not np.isfinite(v)):
            return 9999.99
        return round(float(v), 2)

    def _safe_bias(v):
        """BIAS seguro para JSON: NaN vira None."""
        try:
            f = float(v)
            if not np.isfinite(f):
                return None
            return round(f, 2)
        except Exception:
            return None

    return {
        "top_model": top["name"],
        "models": [
            {
                "name": m["name"],
                "mape": _safe_mape(m["mape"]),
                "accuracy": round(max(0.0, 100 - m["mape"]), 2) if m["mape"] != float('inf') and np.isfinite(m["mape"]) else None,
                "bias": _safe_bias(m["bias"]),
                "rank": i + 1
            }
            for i, m in enumerate(ranked)
        ],
        "forecast":  _safe_list(top["forecast"]),
        "lower":     _safe_list(top["lower"]),
        "upper":     _safe_list(top["upper"]),
        "historico": _safe_list(values.tolist()),
        "periodos_historico": df['periodo'].tolist(),
        "periodos_forecast":  future_periods,
        "n_lags_used": n_lags,
        "test_size": request.test_size,
    }

# ─────────────────────────────────────────────
# Sprint 5 — Chat de IA Analítico
# ─────────────────────────────────────────────
import os

class ChatMessage(BaseModel):
    role: str   # "user" ou "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[dict] = None   # Dados analíticos do frontend

def _build_system_prompt(context: Optional[dict]) -> str:
    """Constrói o System Prompt com o contexto analítico dos dados."""
    base = (
        "Você é o DataPredict AI, um assistente especialista em análise de séries temporais. "
        "Responda sempre em português brasileiro, de forma clara, objetiva e didática. "
        "Quando os dados de análise estiverem disponíveis, use-os para embasar suas respostas."
    )
    if not context:
        return base

    ctx_lines = [base, "\n\n## Dados Analisados pelo Usuário"]

    if context.get("stats"):
        s = context["stats"]
        ctx_lines.append(
            f"\n### Estatísticas Descritivas\n"
            f"- N: {s.get('count', 'N/A')} | Média: {s.get('mean', 'N/A')} | "
            f"Desvio Padrão: {s.get('std', 'N/A')}\n"
            f"- Mínimo: {s.get('min', 'N/A')} | Máximo: {s.get('max', 'N/A')}\n"
            f"- Coef. Variação: {s.get('cv', 'N/A')}"
        )

    if context.get("stationarity"):
        st = context["stationarity"]
        is_stat = st.get("is_stationary", False)
        ctx_lines.append(
            f"\n### Teste de Estacionariedade (ADF)\n"
            f"- Resultado: {'ESTACIONÁRIA ✓' if is_stat else 'NÃO ESTACIONÁRIA ✗'}\n"
            f"- p-valor: {st.get('p_value', 'N/A')} | Estatística ADF: {st.get('adf_statistic', 'N/A')}"
        )

    if context.get("normality"):
        nm = context["normality"]
        is_norm = nm.get("is_normal", False)
        ctx_lines.append(
            f"\n### Teste de Normalidade (Shapiro-Wilk)\n"
            f"- Resultado: {'NORMAL ✓' if is_norm else 'NÃO NORMAL ✗'}\n"
            f"- p-valor: {nm.get('p_value', 'N/A')}"
        )

    if context.get("forecast"):
        fc = context["forecast"]
        ctx_lines.append(
            f"\n### Motor de Forecast\n"
            f"- Modelo vencedor: {fc.get('top_model', 'N/A')}\n"
            f"- Ranking: " + " | ".join(
                f"{m['name']}: MAPE {m['mape']}%" for m in fc.get("models", [])
            )
        )

    return "\n".join(ctx_lines)

def _rule_based_response(user_msg: str, context: Optional[dict], history: List[ChatMessage]) -> str:
    """Gerador de resposta baseado em regras quando OpenAI não está disponível."""
    msg = user_msg.lower()

    # --- Respostas baseadas no contexto disponível ---
    if context and context.get("stationarity"):
        st = context["stationarity"]
        is_stat = st.get("is_stationary", False)
        p_val = st.get("p_value", "N/A")
        if any(w in msg for w in ["estacionária", "estacionariedade", "adf", "raiz unitária", "stationarity"]):
            if is_stat:
                return (
                    f"✅ **Sua série é estacionária** (p-valor ADF = {p_val}).\n\n"
                    "Isso significa que a média e a variância são constantes ao longo do tempo — ótima notícia! "
                    "Modelos como **ARIMA(p,0,q)** (sem diferenciação, d=0) funcionam bem aqui. "
                    "Você pode partir direto para a modelagem."
                )
            else:
                return (
                    f"⚠️ **Sua série NÃO é estacionária** (p-valor ADF = {p_val}).\n\n"
                    "Isso indica a presença de tendência ou sazonalidade não removida. Recomendações:\n"
                    "1. **Diferenciação (d=1):** aplique uma diferença (yt - yt-1) e teste novamente.\n"
                    "2. **Transformação logarítmica:** reduz variância crescente.\n"
                    "3. O ARIMA já aplica diferenciação automaticamente pelo parâmetro `d`."
                )

    if context and context.get("normality"):
        nm = context["normality"]
        is_norm = nm.get("is_normal", False)
        p_val = nm.get("p_value", "N/A")
        if any(w in msg for w in ["normal", "normalidade", "shapiro", "distribuição", "gaussiana"]):
            if is_norm:
                return (
                    f"✅ **Seus dados seguem distribuição normal** (p-valor Shapiro-Wilk = {p_val}).\n\n"
                    "Os resíduos normais indicam que os modelos paramétricos (ARIMA, regressão linear) têm "
                    "seus pressupostos atendidos. Os intervalos de confiança serão mais confiáveis."
                )
            else:
                return (
                    f"⚠️ **Seus dados NÃO seguem distribuição normal** (p-valor Shapiro-Wilk = {p_val}).\n\n"
                    "Isso é comum em dados econômicos e de vendas. Implicações:\n"
                    "1. Modelos de ML (XGBoost, LightGBM) **não assumem normalidade** — podem ser mais robustos.\n"
                    "2. Intervalos de confiança paramétricos podem ser imprecisos — considere bootstrap.\n"
                    "3. A previsão em si não é invalidada, mas interprete os ICs com cautela."
                )

    if context and context.get("forecast"):
        fc = context["forecast"]
        top = fc.get("top_model", "N/A")
        models = fc.get("models", [])
        if any(w in msg for w in ["forecast", "previsão", "mape", "modelo", "melhor", "xgboost", "lightgbm", "arima"]):
            ranking_txt = "\n".join(
                f"  {'🥇' if i==0 else '🥈' if i==1 else '🥉'} **{m['name']}**: MAPE = {m['mape']}%"
                for i, m in enumerate(models[:3])
            )
            best = models[0] if models else {}
            mape = best.get("mape", "N/A")
            interpretation = ""
            if isinstance(mape, (int, float)):
                if mape < 5:
                    interpretation = "Excelente precisão (MAPE < 5%)."
                elif mape < 15:
                    interpretation = "Boa precisão (MAPE entre 5% e 15%)."
                elif mape < 30:
                    interpretation = "Precisão razoável (MAPE entre 15% e 30%). Considere coletar mais dados."
                else:
                    interpretation = "Alta incerteza (MAPE > 30%). A série pode ser muito ruidosa ou irregular."
            return (
                f"📊 **Resultado do Forecast:**\n\n"
                f"**Modelo vencedor:** {top}\n\n"
                f"**Ranking de modelos:**\n{ranking_txt}\n\n"
                f"**Interpretação:** {interpretation}"
            )

    if context and context.get("stats"):
        s = context["stats"]
        if any(w in msg for w in ["estatística", "média", "desvio", "variação", "resumo", "dados"]):
            return (
                f"📈 **Resumo Estatístico da Série:**\n\n"
                f"- **N:** {s.get('count', 'N/A')} observações\n"
                f"- **Média:** {s.get('mean', 'N/A')}\n"
                f"- **Mediana:** {s.get('median', 'N/A')}\n"
                f"- **Desvio Padrão:** {s.get('std', 'N/A')}\n"
                f"- **Mínimo:** {s.get('min', 'N/A')} | **Máximo:** {s.get('max', 'N/A')}\n"
                f"- **Coef. de Variação:** {s.get('cv', 'N/A')}"
            )

    # --- Respostas educativas genéricas ---
    if any(w in msg for w in ["o que é", "o que sao", "explique", "explica", "defina", "definição"]):
        if "arima" in msg:
            return (
                "**ARIMA** (AutoRegressive Integrated Moving Average) é um modelo clássico para séries temporais.\n\n"
                "- **AR(p):** captura a relação com os p valores passados.\n"
                "- **I(d):** aplica d diferenciações para tornar a série estacionária.\n"
                "- **MA(q):** captura erros de previsão dos q passos anteriores.\n\n"
                "É interpretável, funciona bem com dados mensais/anuais com tendência linear."
            )
        if "mape" in msg:
            return (
                "**MAPE** (Mean Absolute Percentage Error) mede o erro médio da previsão em percentual:\n\n"
                "```\nMAPE = média(|real - previsto| / |real|) × 100%\n```\n\n"
                "Referência:\n- < 5%: Excelente\n- 5–15%: Bom\n- 15–30%: Razoável\n- > 30%: Alta incerteza"
            )
        if any(w in msg for w in ["xgboost", "lightgbm", "gradient boosting"]):
            return (
                "**XGBoost e LightGBM** são algoritmos de **Gradient Boosting** usados para forecast por lags.\n\n"
                "Em séries temporais, eles recebem como features os últimos N valores (lags) e aprendem padrões não-lineares. "
                "São mais flexíveis que o ARIMA, mas exigem mais dados e são menos interpretáveis."
            )

    # --- Resposta padrão quando sem contexto ou pergunta desconhecida ---
    has_data = bool(context and any(context.values()))
    if not has_data:
        return (
            "👋 Olá! Sou o **DataPredict AI**.\n\n"
            "Para análises específicas, faça o **upload de um dataset** e execute as análises disponíveis "
            "(Estatísticas, Decomposição, ADF, Correlações, Forecast). Assim, poderei responder perguntas "
            "com base nos seus dados reais!\n\n"
            "Enquanto isso, você pode me perguntar sobre:\n"
            "- O que é ARIMA, MAPE, XGBoost?\n"
            "- Como interpretar estacionariedade?\n"
            "- O que significa normalidade nos resíduos?"
        )

    return (
        "Entendido! Com base nos dados analisados, posso ajudar com perguntas sobre:\n\n"
        "- 📊 **Estatísticas:** média, desvio padrão, coeficiente de variação\n"
        "- 📉 **Estacionariedade:** interpretação do teste ADF\n"
        "- 🔔 **Normalidade:** resultado do Shapiro-Wilk\n"
        "- 🤖 **Forecast:** ranking de modelos e interpretação do MAPE\n\n"
        "Pode me fazer uma pergunta mais específica sobre esses tópicos!"
    )

@app.post("/api/chat")
def chat(request: ChatRequest):
    """Chat de IA analítico. Usa OpenAI se OPENAI_API_KEY estiver configurado, 
    caso contrário usa análise baseada em regras."""
    if not request.messages:
        return {"error": "Nenhuma mensagem enviada."}

    system_prompt = _build_system_prompt(request.context)
    last_user_msg = next(
        (m.content for m in reversed(request.messages) if m.role == "user"), ""
    )

    api_key = os.environ.get("OPENAI_API_KEY", "")

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
        except Exception as e:
            # Fallback para regras se OpenAI falhar
            pass

    # Análise baseada em regras (sem OpenAI)
    reply = _rule_based_response(last_user_msg, request.context, request.messages)
    return {"response": reply}
