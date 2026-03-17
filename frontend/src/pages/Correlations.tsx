import { useEffect, useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import api from '../api';

export const Correlations = () => {
    const { dataset, correlogram, normality, setCorrelogram, setNormality } = useDataStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const M = { color: 'var(--text-muted)' };
    const CS = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };

    useEffect(() => {
        const fetchData = async () => {
            if (dataset.length > 0 && (!correlogram || !normality) && !loading) {
                setLoading(true); setError(null);
                try {
                    const [resCorr, resNorm] = await Promise.all([
                        api.post('/api/correlogram', { dataset, nlags: 40 }),
                        api.post('/api/normality', { dataset })
                    ]);
                    if (resCorr.data.error) throw new Error(resCorr.data.error);
                    if (resNorm.data.error) throw new Error(resNorm.data.error);
                    setCorrelogram(resCorr.data); setNormality(resNorm.data);
                } catch (err: any) { setError(err.message || 'Erro'); }
                finally { setLoading(false); }
            }
        }; fetchData();
    }, [dataset, correlogram, normality, setCorrelogram, setNormality]);

    if (dataset.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
            <Activity size={40} /><p className="text-sm">Nenhum dataset carregado.</p>
        </div>
    );
    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(236,72,153,0.2)', borderTopColor: '#ec4899' }} />
            <p className="text-sm" style={M}>Calculando ACF, PACF e Normalidade...</p>
        </div>
    );
    if (error) return (
        <div className="p-5 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
            <div><p className="font-semibold text-rose-400">Erro na Análise</p><p className="text-sm text-rose-300/70 mt-1">{error}</p></div>
        </div>
    );

    const acfData = correlogram?.lags.map((lag, i) => ({
        lag, acf: correlogram.acf[i],
        isSignificant: Math.abs(correlogram.acf[i]) > Math.abs(correlogram.acf_conf_upper[i])
    })) || [];
    const pacfData = correlogram?.lags.map((lag, i) => ({
        lag, pacf: correlogram.pacf[i],
        isSignificant: Math.abs(correlogram.pacf[i]) > Math.abs(correlogram.pacf_conf_upper[i])
    })) || [];
    const histData = normality?.histogram.map((count, i) => ({
        bin: `${normality.bin_edges[i].toFixed(1)}–${normality.bin_edges[i + 1].toFixed(1)}`, count
    })) || [];

    const tooltipStyle = { background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' };

    return (
        <div className="space-y-5 animate-fadeup pb-10">
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Correlações e Normalidade</h1>
                <p className="text-sm mt-1" style={M}>Gráficos ACF/PACF e Teste Shapiro-Wilk</p>
            </div>
            {normality && (
                <div className="p-6 rounded-2xl flex flex-col md:flex-row gap-6" style={{
                    background: normality.is_normal ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                    border: `1px solid ${normality.is_normal ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}>
                    <div className="flex-1">
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={M}>Shapiro-Wilk</p>
                        <div className="flex items-start gap-4 mb-4">
                            <div className={`p-2.5 rounded-xl ${normality.is_normal ? 'text-emerald-400' : 'text-rose-400'}`}
                                style={{ background: normality.is_normal ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
                                {normality.is_normal ? <CheckCircle size={22} /> : <XCircle size={22} />}
                            </div>
                            <div>
                                <p className={`text-xl font-bold ${normality.is_normal ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {normality.is_normal ? 'Distribuição Normal' : 'Não Normal'}
                                </p>
                                <p className="text-sm mt-1" style={M}>{normality.conclusion}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Statistic (W)', v: normality.statistic.toFixed(4), c: 'var(--text-primary)' },
                                { label: 'P-Value', v: normality.p_value.toExponential(4), c: normality.p_value >= 0.05 ? '#34d399' : '#f87171' },
                            ].map(({ label, v, c }) => (
                                <div key={label} className="p-3 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                                    <p className="text-xs mb-1" style={M}>{label}</p>
                                    <p className="text-base font-mono font-semibold" style={{ color: c }}>{v}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 h-44 md:h-auto">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="bin" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--bg-surface-md)' }} />
                                <Bar dataKey="count" name="Frequência" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            {correlogram && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { data: acfData, dk: 'acf', name: 'ACF', color: '#ec4899', cU: correlogram.acf_conf_upper[1], cL: correlogram.acf_conf_lower[1], title: 'Função de Autocorrelação (ACF)' },
                        { data: pacfData, dk: 'pacf', name: 'PACF', color: '#f59e0b', cU: correlogram.pacf_conf_upper[1], cL: correlogram.pacf_conf_lower[1], title: 'Função de Autocorrelação Parcial (PACF)' },
                    ].map(({ data, dk, name, color, cU, cL, title }) => (
                        <div key={dk} className="p-6 rounded-2xl" style={CS}>
                            <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>{title}</p>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                        <ReferenceLine y={0} stroke="var(--border-md)" />
                                        <ReferenceLine y={cU} stroke="#ef4444" strokeDasharray="3 3" opacity={0.4} />
                                        <ReferenceLine y={cL} stroke="#ef4444" strokeDasharray="3 3" opacity={0.4} />
                                        <XAxis dataKey="lag" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} domain={[-1, 1]} />
                                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--bg-surface-md)' }} />
                                        <Bar dataKey={dk} name={name} barSize={7}>
                                            {data.map((entry, index) => (
                                                <Cell key={`c-${index}`} fill={(entry as any).isSignificant ? color : 'rgba(71,85,105,0.5)'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
