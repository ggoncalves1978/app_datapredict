import { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { Activity, AlertCircle, PlayCircle, Trophy, Medal, Award, TrendingUp, Settings2, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import axios from 'axios';

const MEDALS = [
    { icon: Trophy, accent: '#facc15', bg: 'rgba(250,204,21,0.08)', border: 'rgba(250,204,21,0.2)', label: '🥇 1° Lugar' },
    { icon: Medal, accent: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', label: '🥈 2° Lugar' },
    { icon: Award, accent: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.15)', label: '🥉 3° Lugar' },
    { icon: Activity, accent: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)', label: '🏅 4° Lugar' },
];

export const Forecast = () => {
    const { dataset, forecast, setForecast } = useDataStore();
    const [horizon, setHorizon] = useState(12);
    const [testSize, setTestSize] = useState(12);
    const [arimaP, setArimaP] = useState(1);
    const [arimaD, setArimaD] = useState(1);
    const [arimaQ, setArimaQ] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const CS = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };
    const M = { color: 'var(--text-muted)' };
    const TT = { background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' };

    const handleRun = async () => {
        setLoading(true); setError(null); setForecast(null);
        try {
            const res = await axios.post('http://localhost:8000/api/forecast', {
                dataset, horizon, test_size: testSize,
                arima_p: arimaP, arima_d: arimaD, arima_q: arimaQ
            });
            if (res.data.error) setError(res.data.error);
            else setForecast(res.data);
        } catch (err: any) { setError(err.message || 'Erro'); }
        finally { setLoading(false); }
    };

    if (dataset.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
            <Activity size={40} /><p className="text-sm">Carregue um dataset no Dashboard para gerar previsões.</p>
        </div>
    );

    const chartData = forecast ? [
        ...forecast.periodos_historico.map((p, i) => ({ periodo: p, historico: forecast.historico[i], previsao: null, lower: null, upper: null })),
        {
            periodo: forecast.periodos_historico[forecast.periodos_historico.length - 1],
            historico: forecast.historico[forecast.historico.length - 1],
            previsao: forecast.historico[forecast.historico.length - 1],
            lower: forecast.lower[0], upper: forecast.upper[0],
        },
        ...forecast.periodos_forecast.map((p, i) => ({ periodo: p, historico: null, previsao: forecast.forecast[i], lower: forecast.lower[i], upper: forecast.upper[i] })),
    ] : [];

    const xTickInterval = Math.max(1, Math.floor(chartData.length / 10));

    return (
        <div className="space-y-5 animate-fadeup pb-10">
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Forecast Predict</h1>
                <p className="text-sm mt-1" style={M}>Motor de previsão com ranking automático: ARIMA × XGBoost × LightGBM</p>
            </div>

            {/* Config */}
            <div className="p-6 rounded-2xl" style={CS}>
                <p className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Settings2 size={16} className="text-blue-400" /> Configuração do Forecast
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    {[
                        { label: 'Horizonte (Futuro)', value: horizon, min: 1, max: 48, onChange: setHorizon, color: '#7c3aed', unit: 'períodos' },
                        { label: 'Hold-out (Teste)', value: testSize, min: 6, max: 36, onChange: setTestSize, color: '#8b5cf6', unit: 'períodos' },
                    ].map(({ label, value, min, max, onChange, color, unit }) => (
                        <div key={label}>
                            <label className="block text-sm mb-2" style={M}>
                                {label} <span className="font-mono font-semibold" style={{ color }}>{value} {unit}</span>
                            </label>
                            <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: color, background: 'var(--bg-surface-md)' }} />
                            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                                <span>{min}</span><span>{max}</span>
                            </div>
                        </div>
                    ))}

                    {/* Configuração do ARIMA */}
                    <div>
                        <label className="block text-sm mb-2" style={M}>
                            Parâmetros ARIMA <span className="font-mono font-semibold text-rose-400">({arimaP},{arimaD},{arimaQ})</span>
                        </label>
                        <div className="flex gap-2">
                            {[
                                { label: 'p', val: arimaP, min: 0, max: 5, set: setArimaP },
                                { label: 'd', val: arimaD, min: 0, max: 2, set: setArimaD },
                                { label: 'q', val: arimaQ, min: 0, max: 5, set: setArimaQ },
                            ].map(param => (
                                <div key={param.label} className="flex-1 flex flex-col">
                                    <div className="flex items-center" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                                        <span className="px-2 text-xs font-semibold" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>{param.label}</span>
                                        <input type="number" min={param.min} max={param.max} value={param.val}
                                            onChange={e => param.set(Math.max(param.min, Math.min(param.max, Number(e.target.value))))}
                                            className="w-full bg-transparent text-sm font-mono text-center py-1 outline-none" style={{ color: 'var(--text-primary)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleRun} disabled={loading}
                        className="btn-gradient flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm cursor-pointer disabled:opacity-50">
                        {loading
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Treinando...</>
                            : <><PlayCircle size={16} /> Executar Forecast</>}
                    </button>
                </div>
            </div>

            {loading && (
                <div className="p-8 rounded-2xl flex flex-col items-center gap-4" style={CS}>
                    <div className="w-12 h-12 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(124,58,237,0.2)', borderTopColor: '#7c3aed' }} />
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Treinando 4 modelos em paralelo...</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {['ARIMA', 'Holt-Winters', 'XGBoost', 'LightGBM'].map(m => (
                            <span key={m} className="px-3 py-1 rounded-full text-xs animate-pulse"
                                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa' }}>{m}</span>
                        ))}
                    </div>
                </div>
            )}

            {error && !loading && (
                <div className="p-5 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                    <div><p className="font-semibold text-rose-400">Erro no Forecast</p><p className="text-sm text-rose-300/70 mt-1">{error}</p></div>
                </div>
            )}

            {forecast && !loading && (
                <div className="space-y-5">
                    <div>
                        <p className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <TrendingUp size={16} className="text-blue-400" /> Ranking de Modelos
                            <span className="text-xs font-normal" style={M}>MAPE · Acurácia · BIAS</span>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {forecast.models.map((model, i) => {
                                const m = MEDALS[i] || MEDALS[3];
                                const MIcon = m.icon;
                                return (
                                    <div key={model.name} className="p-5 rounded-2xl relative overflow-hidden"
                                        style={{ background: m.bg, border: `1px solid ${m.border}` }}>
                                        {i === 0 && (
                                            <div className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-xl"
                                                style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15' }}>VENCEDOR ✓</div>
                                        )}
                                        <div className="flex items-center gap-2 mb-3">
                                            <MIcon size={20} style={{ color: m.accent }} />
                                            <span className="text-xs font-semibold" style={{ color: m.accent }}>{m.label}</span>
                                        </div>
                                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{model.name}</p>
                                        <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                                            {/* MAPE */}
                                            <div>
                                                <p className="text-xs mb-0.5" style={M}>MAPE (hold-out)</p>
                                                <p className="text-2xl font-mono font-bold" style={{ color: i === 0 ? m.accent : model.mape > 20 ? '#f87171' : '#34d399' }}>
                                                    {model.mape === Infinity || model.mape > 9999 ? 'N/A' : `${model.mape.toFixed(2)}%`}
                                                </p>
                                            </div>
                                            {/* Acurácia */}
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs" style={M}>Acurácia</p>
                                                <p className="text-sm font-mono font-semibold"
                                                    style={{ color: model.accuracy == null ? 'var(--text-muted)' : model.accuracy >= 85 ? '#34d399' : model.accuracy >= 70 ? '#facc15' : '#f87171' }}>
                                                    {model.accuracy == null ? 'N/A' : `${model.accuracy.toFixed(1)}%`}
                                                </p>
                                            </div>
                                            {/* BIAS */}
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs" style={M}>BIAS</p>
                                                <p className="text-sm font-mono font-semibold"
                                                    style={{ color: model.bias == null ? 'var(--text-muted)' : model.bias > 5 ? '#fb923c' : model.bias < -5 ? '#60a5fa' : '#34d399' }}>
                                                    {model.bias == null ? 'N/A' : `${model.bias > 0 ? '+' : ''}${model.bias.toFixed(2)}%`}
                                                </p>
                                            </div>
                                        </div>
                                        {i === 0 && (
                                            <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'rgba(250,204,21,0.5)' }}>
                                                <ChevronRight size={11} /> Usado para a previsão abaixo
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 text-xs flex flex-wrap gap-x-5 gap-y-1" style={M}>
                            <span>📊 Lags: <strong style={{ color: 'var(--text-primary)' }}>{forecast.n_lags_used}</strong></span>
                            <span>🔬 Hold-out: <strong style={{ color: 'var(--text-primary)' }}>{forecast.test_size} períodos</strong></span>
                            <span>🎯 Acurácia: <span style={{ color: '#34d399' }}>≥85% ótimo</span> · <span style={{ color: '#facc15' }}>≥70% bom</span> · <span style={{ color: '#f87171' }}>&lt;70% fraco</span></span>
                            <span>⚖️ BIAS: <span style={{ color: '#fb923c' }}>+superestima</span> · <span style={{ color: '#60a5fa' }}>−subestima</span> · <span style={{ color: '#34d399' }}>|≤5%| neutro</span></span>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl" style={CS}>
                        <p className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <TrendingUp size={16} className="text-blue-500" />
                            Forecast — {forecast.top_model}
                            <span className="text-xs font-normal" style={M}>| {horizon} períodos à frente</span>
                        </p>
                        <div className="h-[380px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                                    <defs>
                                        <linearGradient id="ic-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="periodo" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} interval={xTickInterval} />
                                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false}
                                        tickFormatter={v => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)} domain={['auto', 'auto']} />
                                    <Tooltip contentStyle={TT} formatter={(v: any, n?: string) => [v === null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v), n ?? '']} />
                                    <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }} />
                                    <ReferenceLine x={forecast.periodos_historico[forecast.periodos_historico.length - 1]}
                                        stroke="var(--border-md)" strokeDasharray="5 3"
                                        label={{ value: 'Início Forecast', position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 11 }} />
                                    <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#ic-grad)" fillOpacity={1} legendType="none" connectNulls />
                                    <Area type="monotone" dataKey="lower" stroke="transparent" fill="var(--card-fill-bg)" fillOpacity={1} legendType="none" connectNulls />
                                    <Line type="monotone" dataKey="historico" name="Histórico" stroke="rgba(148,163,184,0.6)" strokeWidth={1.5} dot={false} connectNulls={false} />
                                    <Line type="monotone" dataKey="previsao" name={`Previsão (${forecast.top_model})`} stroke="#3b82f6" strokeWidth={2.5} dot={false} strokeDasharray="6 3" connectNulls />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
