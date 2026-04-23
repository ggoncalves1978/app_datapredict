import { useEffect, useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { TrendingUp, AlertCircle, Activity, BarChart2, Target, Sigma } from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import api from '../api';

const fmt = (v: number, dec = 2) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v);

const fmtCompact = (v: number) =>
    new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 }).format(v);

export const LinearRegression = () => {
    const { dataset, linearRegression, setLinearRegression } = useDataStore();
    const [loading, setLoading]   = useState(false);
    const [error,   setError]     = useState<string | null>(null);
    const [horizon, setHorizon]   = useState(12);

    const CS  = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };
    const M   = { color: 'var(--text-muted)' };
    const TT  = { background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' };

    useEffect(() => {
        if (dataset.length === 0) return;
        fetchRegression(horizon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataset]);

    const fetchRegression = async (h: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/api/regression', { dataset, horizon: h });
            if (res.data.error) setError(res.data.error);
            else setLinearRegression(res.data);
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    if (dataset.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
            <Activity size={40} />
            <p className="text-sm">Carregue um dataset no Dashboard para calcular a regressão.</p>
        </div>
    );

    const lr = linearRegression;

    const chartData = lr ? [
        ...lr.periodos_historico.map((p, i) => ({
            periodo:  p,
            historico: lr.historico[i],
            ajustado:  lr.fitted[i],
            previsao:  null as number | null,
            lower:     null as number | null,
            upper:     null as number | null,
        })),
        {
            periodo:  lr.periodos_historico[lr.periodos_historico.length - 1],
            historico: lr.historico[lr.historico.length - 1],
            ajustado:  lr.fitted[lr.fitted.length - 1],
            previsao:  lr.fitted[lr.fitted.length - 1],
            lower:     lr.fitted[lr.fitted.length - 1],
            upper:     lr.fitted[lr.fitted.length - 1],
        },
        ...lr.periodos_forecast.map((p, i) => ({
            periodo:  p,
            historico: null as number | null,
            ajustado:  null as number | null,
            previsao:  lr.forecast_line[i],
            lower:     lr.lower[i],
            upper:     lr.upper[i],
        })),
    ] : [];

    const xTickInterval = Math.max(1, Math.floor((chartData.length) / 10));

    const slopeSign = lr && lr.slope >= 0 ? '+' : '';
    const equation  = lr
        ? `ŷ = ${fmt(lr.intercept, 2)} ${slopeSign}${fmt(lr.slope, 4)} × t`
        : '';

    return (
        <div className="space-y-5 animate-fadeup pb-10">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Regressão Linear
                </h1>
                <p className="text-sm mt-1" style={M}>
                    Ajuste OLS — <strong className="text-violet-400">ŷ = β₀ + β₁ · t</strong> —
                    intercepto, coeficiente angular, R² e projeção da tendência
                </p>
            </div>

            {/* Horizonte + botão */}
            <div className="p-5 rounded-2xl flex flex-wrap items-end gap-6" style={CS}>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm mb-1" style={M}>
                        Horizonte de Projeção{' '}
                        <span className="font-mono font-semibold text-violet-400">{horizon} períodos</span>
                    </label>
                    <input
                        type="range" min={1} max={48} value={horizon}
                        onChange={e => setHorizon(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: '#7c3aed', background: 'var(--bg-surface-md)' }}
                    />
                    <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        <span>1</span><span>48</span>
                    </div>
                </div>
                <button
                    onClick={() => fetchRegression(horizon)}
                    disabled={loading}
                    className="btn-gradient flex items-center gap-2 py-2.5 px-6 rounded-xl text-sm cursor-pointer disabled:opacity-50 shrink-0"
                >
                    {loading
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calculando...</>
                        : <><TrendingUp size={15} /> Recalcular</>}
                </button>
            </div>

            {/* Erro */}
            {error && !loading && (
                <div className="p-5 rounded-2xl flex items-start gap-3"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="font-semibold text-rose-400">Erro na Regressão</p>
                        <p className="text-sm text-rose-300/70 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="p-8 rounded-2xl flex flex-col items-center gap-4" style={CS}>
                    <div className="w-12 h-12 border-2 rounded-full animate-spin"
                        style={{ borderColor: 'rgba(124,58,237,0.2)', borderTopColor: '#7c3aed' }} />
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        Ajustando regressão linear via OLS…
                    </p>
                </div>
            )}

            {/* Resultados */}
            {lr && !loading && (
                <div className="space-y-5">

                    {/* Cards de Parâmetros */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        {/* Intercepto */}
                        <div className="p-5 rounded-2xl"
                            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(124,58,237,0.15)' }}>
                                    <Sigma size={15} className="text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-violet-400">Intercepto</p>
                                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>β₀</p>
                                </div>
                            </div>
                            <p className="text-3xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                {fmtCompact(lr.intercept)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                                Valor da série quando t = 0
                            </p>
                        </div>

                        {/* Coeficiente Angular */}
                        <div className="p-5 rounded-2xl"
                            style={{
                                background: lr.slope >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                                border:     lr.slope >= 0 ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                            }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: lr.slope >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                                    <TrendingUp size={15} style={{ color: lr.slope >= 0 ? '#10b981' : '#ef4444' }} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: lr.slope >= 0 ? '#10b981' : '#ef4444' }}>
                                        Coeficiente Angular
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>β₁</p>
                                </div>
                            </div>
                            <p className="text-3xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                {lr.slope >= 0 ? '+' : ''}{fmt(lr.slope, 4)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                                {lr.slope >= 0 ? 'Tendência crescente' : 'Tendência decrescente'} por período
                            </p>
                        </div>

                        {/* R² */}
                        <div className="p-5 rounded-2xl"
                            style={{
                                background: lr.r_squared >= 0.8 ? 'rgba(16,185,129,0.06)' : lr.r_squared >= 0.5 ? 'rgba(250,204,21,0.06)' : 'rgba(239,68,68,0.06)',
                                border:     lr.r_squared >= 0.8 ? '1px solid rgba(16,185,129,0.2)' : lr.r_squared >= 0.5 ? '1px solid rgba(250,204,21,0.2)' : '1px solid rgba(239,68,68,0.2)',
                            }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{
                                        background: lr.r_squared >= 0.8 ? 'rgba(16,185,129,0.15)' : lr.r_squared >= 0.5 ? 'rgba(250,204,21,0.15)' : 'rgba(239,68,68,0.15)',
                                    }}>
                                    <Target size={15} style={{
                                        color: lr.r_squared >= 0.8 ? '#10b981' : lr.r_squared >= 0.5 ? '#facc15' : '#ef4444',
                                    }} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold" style={{
                                        color: lr.r_squared >= 0.8 ? '#10b981' : lr.r_squared >= 0.5 ? '#facc15' : '#ef4444',
                                    }}>
                                        Coef. de Determinação
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>R²</p>
                                </div>
                            </div>
                            <p className="text-3xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                {(lr.r_squared * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                                {lr.r_squared >= 0.8 ? 'Ótimo ajuste linear' : lr.r_squared >= 0.5 ? 'Ajuste moderado' : 'Baixo ajuste linear'}
                            </p>
                        </div>
                    </div>

                    {/* Fórmula da Reta */}
                    <div className="p-6 rounded-2xl"
                        style={{ background: 'rgba(79,70,229,0.07)', border: '1px solid rgba(79,70,229,0.25)' }}>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2"
                            style={{ color: '#818cf8' }}>
                            <BarChart2 size={13} />
                            Equação da Reta de Regressão
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <code className="text-2xl md:text-3xl font-mono font-bold tracking-tight"
                                style={{ color: 'var(--text-primary)' }}>
                                {equation}
                            </code>
                        </div>
                        <p className="text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
                            onde <strong style={{ color: '#a5b4fc' }}>t</strong> é o índice temporal (0, 1, 2, …, n−1) e{' '}
                            <strong style={{ color: '#a5b4fc' }}>ŷ</strong> é o valor estimado da série
                        </p>
                    </div>

                    {/* Métricas de Desempenho */}
                    <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2"
                            style={{ color: 'var(--text-primary)' }}>
                            <Target size={15} className="text-blue-400" />
                            Desempenho do Modelo
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'MAPE',  value: `${lr.mape.toFixed(2)}%`,      desc: 'Erro percentual médio',   color: lr.mape <= 5 ? '#34d399' : lr.mape <= 15 ? '#facc15' : '#f87171' },
                                { label: 'R²',    value: `${(lr.r_squared * 100).toFixed(2)}%`, desc: 'Variância explicada',    color: lr.r_squared >= 0.8 ? '#34d399' : lr.r_squared >= 0.5 ? '#facc15' : '#f87171' },
                                { label: 'RMSE',  value: fmtCompact(lr.rmse),            desc: 'Raiz do erro quadrático',  color: '#94a3b8' },
                                { label: 'MAE',   value: fmtCompact(lr.mae),             desc: 'Erro absoluto médio',      color: '#94a3b8' },
                            ].map(({ label, value, desc, color }) => (
                                <div key={label} className="p-4 rounded-2xl" style={CS}>
                                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                                    <p className="text-2xl font-mono font-bold" style={{ color }}>{value}</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Legenda MAPE */}
                        <div className="mt-2 p-3 rounded-xl text-xs flex flex-wrap gap-x-5 gap-y-1"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                            <span>MAPE: <span style={{ color: '#34d399' }}>≤5% ótimo</span> · <span style={{ color: '#facc15' }}>5–15% bom</span> · <span style={{ color: '#f87171' }}>&gt;30% ruim</span></span>
                            <span>R²: <span style={{ color: '#34d399' }}>≥80% forte</span> · <span style={{ color: '#facc15' }}>50–80% moderado</span> · <span style={{ color: '#f87171' }}>&lt;50% fraco</span></span>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="p-6 rounded-2xl" style={CS}>
                        <p className="text-sm font-semibold mb-5 flex items-center gap-2"
                            style={{ color: 'var(--text-primary)' }}>
                            <TrendingUp size={16} className="text-violet-400" />
                            Série Histórica · Reta Ajustada · Projeção ({horizon} períodos)
                        </p>
                        <div className="h-[380px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                                    <defs>
                                        <linearGradient id="lr-ic-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
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
                                        tickFormatter={fmtCompact}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={TT}
                                        formatter={(v: any, n?: string) => [
                                            v === null ? '—' : fmt(v),
                                            n ?? '',
                                        ]}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }} />
                                    <ReferenceLine
                                        x={lr.periodos_historico[lr.periodos_historico.length - 1]}
                                        stroke="var(--border-md)" strokeDasharray="5 3"
                                        label={{ value: 'Início Projeção', position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 11 }}
                                    />
                                    {/* IC da projeção */}
                                    <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#lr-ic-grad)" fillOpacity={1} legendType="none" connectNulls />
                                    <Area type="monotone" dataKey="lower" stroke="transparent" fill="var(--card-fill-bg)" fillOpacity={1} legendType="none" connectNulls />
                                    {/* Histórico */}
                                    <Line type="monotone" dataKey="historico" name="Histórico"
                                        stroke="rgba(148,163,184,0.55)" strokeWidth={1.5} dot={false} connectNulls={false} />
                                    {/* Reta ajustada */}
                                    <Line type="monotone" dataKey="ajustado" name="Reta Ajustada"
                                        stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="5 2" connectNulls />
                                    {/* Projeção */}
                                    <Line type="monotone" dataKey="previsao" name={`Projeção (${horizon}p)`}
                                        stroke="#10b981" strokeWidth={2.5} dot={false} strokeDasharray="7 3" connectNulls />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
