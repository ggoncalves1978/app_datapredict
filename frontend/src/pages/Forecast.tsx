import { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import {
    Activity, AlertCircle, PlayCircle, Trophy, Medal,
    Award, TrendingUp, Settings2, ChevronRight, Info
} from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';
import api from '../api';

const MEDALS = [
    { icon: Trophy,   accent: '#facc15', bg: 'rgba(250,204,21,0.08)',  border: 'rgba(250,204,21,0.2)',  label: '🥇 1° Lugar' },
    { icon: Medal,    accent: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', label: '🥈 2° Lugar' },
    { icon: Award,    accent: '#d97706', bg: 'rgba(217,119,6,0.06)',   border: 'rgba(217,119,6,0.15)',  label: '🥉 3° Lugar' },
    { icon: Activity, accent: '#6366f1', bg: 'rgba(99,102,241,0.06)',  border: 'rgba(99,102,241,0.15)', label: '🏅 4° Lugar' },
    { icon: Activity, accent: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.15)',  label: '🏅 5° Lugar' },
];

const MODEL_DESCRIPTIONS: Record<string, string> = {
    'Média Móvel':  'Baseline: média dos últimos N períodos.',
    'Holt-Winters': 'Suavização Exponencial com tendência e sazonalidade.',
    'Theta':        'Método Theta clássico — vencedor da M3 Competition.',
    'AutoARIMA':    'ARIMA com seleção automática de parâmetros via AIC.',
};

const getModelDesc = (name: string) => {
    for (const key of Object.keys(MODEL_DESCRIPTIONS)) {
        if (name.startsWith(key)) return MODEL_DESCRIPTIONS[key];
    }
    if (name.startsWith('ARIMA')) return 'Modelo ARIMA/SARIMAX com parâmetros manuais.';
    return '';
};

export const Forecast = () => {
    const { dataset, forecast, setForecast } = useDataStore();

    const [horizon,      setHorizon]      = useState(12);
    const [testSize,     setTestSize]     = useState(12);
    const [sp,           setSp]           = useState(12);

    const [arimaP,    setArimaP]    = useState(1);
    const [arimaD,    setArimaD]    = useState(1);
    const [arimaQ,    setArimaQ]    = useState(1);

    const [sarimaxP,  setSarimaxP]  = useState(1);
    const [sarimaxD,  setSarimaxD]  = useState(1);
    const [sarimaxQ,  setSarimaxQ]  = useState(1);

    const [naiveWindow, setNaiveWindow] = useState(3);

    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    const CS = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };
    const M  = { color: 'var(--text-muted)' };
    const TT = { background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' };

    const handleRun = async () => {
        setLoading(true); setError(null); setForecast(null);
        try {
            const res = await api.post('/api/forecast', {
                dataset,
                horizon,
                test_size:    testSize,
                sp,
                arima_p:      arimaP,
                arima_d:      arimaD,
                arima_q:      arimaQ,
                sarimax_P:    sarimaxP,
                sarimax_D:    sarimaxD,
                sarimax_Q:    sarimaxQ,
                sarimax_s:    sp,
                naive_window: naiveWindow,
            });
            if (res.data.error) setError(res.data.error);
            else setForecast(res.data);
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    if (dataset.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
            <Activity size={40} />
            <p className="text-sm">Carregue um dataset no Dashboard para gerar previsões.</p>
        </div>
    );

    const chartData = forecast ? [
        ...forecast.periodos_historico.map((p: string, i: number) => ({
            periodo: p, historico: forecast.historico[i],
            previsao: null, lower: null, upper: null,
        })),
        {
            periodo:   forecast.periodos_historico[forecast.periodos_historico.length - 1],
            historico: forecast.historico[forecast.historico.length - 1],
            previsao:  forecast.historico[forecast.historico.length - 1],
            lower:     forecast.lower[0],
            upper:     forecast.upper[0],
        },
        ...forecast.periodos_forecast.map((p: string, i: number) => ({
            periodo: p, historico: null,
            previsao: forecast.forecast[i],
            lower:    forecast.lower[i],
            upper:    forecast.upper[i],
        })),
    ] : [];

    const xTickInterval = Math.max(1, Math.floor(chartData.length / 10));

    return (
        <div className="space-y-5 animate-fadeup pb-10">

            {/* Cabeçalho */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Forecast Predict
                </h1>
                <p className="text-sm mt-1" style={M}>
                    Motor de previsão via <strong className="text-violet-400">sktime</strong> —{' '}
                    Média Móvel · Holt-Winters · ARIMA/SARIMAX · AutoARIMA · Theta
                </p>
            </div>

            {/* Painel de Configuração */}
            <div className="p-6 rounded-2xl space-y-6" style={CS}>
                <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Settings2 size={16} className="text-blue-400" /> Configuração do Forecast
                </p>

                {/* Sliders — Horizonte / Hold-out / Sazonalidade */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        { label: 'Horizonte (Futuro)', value: horizon,  min: 1,  max: 48, set: setHorizon,  color: '#7c3aed', unit: 'períodos' },
                        { label: 'Hold-out (Teste)',   value: testSize, min: 6,  max: 36, set: setTestSize, color: '#8b5cf6', unit: 'períodos' },
                        { label: 'Sazonalidade (sp)',  value: sp,       min: 1,  max: 52, set: setSp,       color: '#0891b2',
                          hint: 'sp=12 mensal · sp=4 trimestral · sp=1 sem sazon.', unit: '' },
                    ].map(({ label, value, min, max, set, color, unit, hint }) => (
                        <div key={label}>
                            <label className="block text-sm mb-1" style={M}>
                                {label}{' '}
                                <span className="font-mono font-semibold" style={{ color }}>
                                    {value}{unit ? ` ${unit}` : ''}
                                </span>
                            </label>
                            {hint && <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>{hint}</p>}
                            <input
                                type="range" min={min} max={max} value={value}
                                onChange={e => set(Number(e.target.value))}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: color, background: 'var(--bg-surface-md)' }}
                            />
                            <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                                <span>{min}</span><span>{max}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Grid de parâmetros manuais */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                    {/* ARIMA (p,d,q) */}
                    <div>
                        <label className="block text-sm mb-2" style={M}>
                            ARIMA{' '}
                            <span className="font-mono font-semibold text-rose-400">
                                ({arimaP},{arimaD},{arimaQ})
                            </span>
                        </label>
                        <div className="flex gap-2">
                            {[
                                { lbl: 'p', val: arimaP, min: 0, max: 5, set: setArimaP },
                                { lbl: 'd', val: arimaD, min: 0, max: 2, set: setArimaD },
                                { lbl: 'q', val: arimaQ, min: 0, max: 5, set: setArimaQ },
                            ].map(p => (
                                <div key={p.lbl} className="flex-1 flex items-center rounded-lg overflow-hidden"
                                    style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                                    <span className="px-2 text-xs font-semibold shrink-0"
                                        style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>
                                        {p.lbl}
                                    </span>
                                    <input type="number" min={p.min} max={p.max} value={p.val}
                                        onChange={e => p.set(Math.max(p.min, Math.min(p.max, Number(e.target.value))))}
                                        className="w-full bg-transparent text-sm font-mono text-center py-1.5 outline-none"
                                        style={{ color: 'var(--text-primary)' }} />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                            Com sp&gt;1 vira SARIMAX automático
                        </p>
                    </div>

                    {/* Sazonais SARIMAX (P,D,Q) */}
                    <div>
                        <label className="block text-sm mb-2" style={M}>
                            Sazonais SARIMAX{' '}
                            <span className="font-mono font-semibold text-amber-400">
                                ({sarimaxP},{sarimaxD},{sarimaxQ})[{sp}]
                            </span>
                        </label>
                        <div className="flex gap-2">
                            {[
                                { lbl: 'P', val: sarimaxP, min: 0, max: 3, set: setSarimaxP },
                                { lbl: 'D', val: sarimaxD, min: 0, max: 2, set: setSarimaxD },
                                { lbl: 'Q', val: sarimaxQ, min: 0, max: 3, set: setSarimaxQ },
                            ].map(p => (
                                <div key={p.lbl} className="flex-1 flex items-center rounded-lg overflow-hidden"
                                    style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                                    <span className="px-2 text-xs font-semibold shrink-0"
                                        style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>
                                        {p.lbl}
                                    </span>
                                    <input type="number" min={p.min} max={p.max} value={p.val}
                                        onChange={e => p.set(Math.max(p.min, Math.min(p.max, Number(e.target.value))))}
                                        className="w-full bg-transparent text-sm font-mono text-center py-1.5 outline-none"
                                        style={{ color: 'var(--text-primary)' }} />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                            Ativo somente quando sp &gt; 1
                        </p>
                    </div>

                    {/* Janela da Média Móvel */}
                    <div>
                        <label className="block text-sm mb-2" style={M}>
                            Janela Média Móvel{' '}
                            <span className="font-mono font-semibold text-emerald-400">{naiveWindow}</span>
                        </label>
                        <input
                            type="range" min={2} max={24} value={naiveWindow}
                            onChange={e => setNaiveWindow(Number(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ accentColor: '#10b981', background: 'var(--bg-surface-md)' }}
                        />
                        <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                            <span>2</span><span>24</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                            Última janela para o baseline
                        </p>
                    </div>
                </div>

                {/* Botão executar */}
                <button
                    onClick={handleRun} disabled={loading}
                    className="btn-gradient flex items-center justify-center gap-2 py-3 px-8 rounded-xl text-sm cursor-pointer disabled:opacity-50 w-full md:w-auto"
                >
                    {loading
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Treinando modelos...</>
                        : <><PlayCircle size={16} /> Executar Forecast (5 modelos)</>}
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="p-8 rounded-2xl flex flex-col items-center gap-4" style={CS}>
                    <div className="w-12 h-12 border-2 rounded-full animate-spin"
                        style={{ borderColor: 'rgba(124,58,237,0.2)', borderTopColor: '#7c3aed' }} />
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        Treinando 5 modelos via sktime…
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {['Média Móvel', 'Holt-Winters', 'ARIMA/SARIMAX', 'AutoARIMA', 'Theta'].map(m => (
                            <span key={m} className="px-3 py-1 rounded-full text-xs animate-pulse"
                                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa' }}>
                                {m}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Erro */}
            {error && !loading && (
                <div className="p-5 rounded-2xl flex items-start gap-3"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="font-semibold text-rose-400">Erro no Forecast</p>
                        <p className="text-sm text-rose-300/70 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {/* Resultados */}
            {forecast && !loading && (
                <div className="space-y-5">

                    {/* Ranking */}
                    <div>
                        <p className="text-sm font-semibold mb-4 flex items-center gap-2"
                            style={{ color: 'var(--text-primary)' }}>
                            <TrendingUp size={16} className="text-blue-400" />
                            Ranking de Modelos
                            <span className="text-xs font-normal" style={M}>
                                ordenado por MAPE (hold-out {forecast.test_size} períodos)
                            </span>
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            {forecast.models.map((model: any, i: number) => {
                                const medal = MEDALS[i] || MEDALS[4];
                                const MIcon = medal.icon;
                                const desc  = getModelDesc(model.name);
                                return (
                                    <div key={model.name} className="p-4 rounded-2xl relative overflow-hidden"
                                        style={{ background: medal.bg, border: `1px solid ${medal.border}` }}>

                                        {i === 0 && (
                                            <div className="absolute top-0 right-0 text-xs font-bold px-2 py-0.5 rounded-bl-xl"
                                                style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15' }}>
                                                ★ MELHOR
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 mb-2">
                                            <MIcon size={15} style={{ color: medal.accent }} />
                                            <span className="text-xs font-semibold" style={{ color: medal.accent }}>
                                                {medal.label}
                                            </span>
                                        </div>

                                        <p className="text-sm font-bold leading-tight mb-0.5"
                                            style={{ color: 'var(--text-primary)' }}>
                                            {model.name}
                                        </p>
                                        {desc && (
                                            <p className="text-xs leading-snug" style={{ color: 'var(--text-faint)' }}>
                                                {desc}
                                            </p>
                                        )}

                                        <div className="mt-3 pt-2 space-y-1.5"
                                            style={{ borderTop: '1px solid var(--border)' }}>
                                            <div>
                                                <p className="text-xs" style={M}>MAPE (hold-out)</p>
                                                <p className="text-xl font-mono font-bold"
                                                    style={{
                                                        color: i === 0 ? medal.accent
                                                             : model.mape > 20 ? '#f87171' : '#34d399'
                                                    }}>
                                                    {model.mape > 9999 ? 'N/A' : `${model.mape.toFixed(1)}%`}
                                                </p>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs" style={M}>Acurácia</span>
                                                <span className="text-xs font-mono font-semibold"
                                                    style={{
                                                        color: model.accuracy == null ? 'var(--text-muted)'
                                                             : model.accuracy >= 85 ? '#34d399'
                                                             : model.accuracy >= 70 ? '#facc15' : '#f87171'
                                                    }}>
                                                    {model.accuracy == null ? 'N/A' : `${model.accuracy.toFixed(1)}%`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs" style={M}>BIAS</span>
                                                <span className="text-xs font-mono font-semibold"
                                                    style={{
                                                        color: model.bias == null ? 'var(--text-muted)'
                                                             : model.bias > 5  ? '#fb923c'
                                                             : model.bias < -5 ? '#60a5fa' : '#34d399'
                                                    }}>
                                                    {model.bias == null ? 'N/A'
                                                        : `${model.bias > 0 ? '+' : ''}${model.bias.toFixed(1)}%`}
                                                </span>
                                            </div>
                                        </div>

                                        {i === 0 && (
                                            <div className="mt-2 flex items-center gap-1 text-xs"
                                                style={{ color: 'rgba(250,204,21,0.5)' }}>
                                                <ChevronRight size={10} /> Gráfico usa este modelo
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legenda de referência */}
                        <div className="mt-3 p-3 rounded-xl flex flex-wrap gap-x-5 gap-y-1 text-xs"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                            <span className="flex items-center gap-1">
                                <Info size={11} />
                                MAPE: <span style={{ color: '#34d399' }}>≤5% ótimo</span> ·{' '}
                                <span style={{ color: '#facc15' }}>5–15% bom</span> ·{' '}
                                <span style={{ color: '#f87171' }}>&gt;30% ruim</span>
                            </span>
                            <span>BIAS: <span style={{ color: '#fb923c' }}>+superestima</span> · <span style={{ color: '#60a5fa' }}>−subestima</span></span>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="p-6 rounded-2xl" style={CS}>
                        <p className="text-sm font-semibold mb-5 flex items-center gap-2"
                            style={{ color: 'var(--text-primary)' }}>
                            <TrendingUp size={16} className="text-blue-500" />
                            Forecast — {forecast.top_model}
                            <span className="text-xs font-normal" style={M}>
                                | {horizon} períodos à frente · IC 80%
                            </span>
                        </p>
                        <div className="h-[380px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                                    <defs>
                                        <linearGradient id="ic-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.18} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis
                                        dataKey="periodo"
                                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                        tickLine={false} axisLine={false}
                                        interval={xTickInterval}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                        tickLine={false} axisLine={false}
                                        tickFormatter={v => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={TT}
                                        formatter={(v: any, n?: string) => [
                                            v === null ? '—'
                                                : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v),
                                            n ?? ''
                                        ]}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }} />
                                    <ReferenceLine
                                        x={forecast.periodos_historico[forecast.periodos_historico.length - 1]}
                                        stroke="var(--border-md)" strokeDasharray="5 3"
                                        label={{ value: 'Início Forecast', position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 11 }}
                                    />
                                    <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#ic-grad)" fillOpacity={1} legendType="none" connectNulls />
                                    <Area type="monotone" dataKey="lower" stroke="transparent" fill="var(--card-fill-bg)" fillOpacity={1} legendType="none" connectNulls />
                                    <Line type="monotone" dataKey="historico" name="Histórico"
                                        stroke="rgba(148,163,184,0.55)" strokeWidth={1.5} dot={false} connectNulls={false} />
                                    <Line type="monotone" dataKey="previsao" name={`Forecast (${forecast.top_model})`}
                                        stroke="#3b82f6" strokeWidth={2.5} dot={false} strokeDasharray="6 3" connectNulls />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
