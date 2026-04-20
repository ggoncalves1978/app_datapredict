import { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import type { DiagnosticsState } from '../store/useDataStore';
import {
    Activity, AlertCircle, ArrowRightLeft, BarChart2,
    Boxes, FlaskConical, Waves, Zap, ChevronDown, ChevronUp,
    CheckCircle, XCircle, Info, PlayCircle,
} from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ScatterChart, Scatter,
} from 'recharts';
import api from '../api';

// ── Tipos ─────────────────────────────────────────────────────
type DiagKey = keyof DiagnosticsState;

interface Section {
    key:       DiagKey;
    label:     string;
    endpoint:  string;
    icon:      React.ElementType;
    color:     string;
    accent:    string;
    desc:      string;
}

// ── Config das 6 seções ───────────────────────────────────────
const SECTIONS: Section[] = [
    {
        key:      'transformations',
        label:    'Transformações',
        endpoint: '/api/diagnostics/transformations',
        icon:     ArrowRightLeft,
        color:    '#8b5cf6',
        accent:   'rgba(139,92,246,0.1)',
        desc:     'Avalia Log, Diferenciação e Box-Cox — necessárias quando a série não é estacionária ou tem variância instável.',
    },
    {
        key:      'distribution',
        label:    'Distribuição',
        endpoint: '/api/diagnostics/distribution',
        icon:     BarChart2,
        color:    '#0891b2',
        accent:   'rgba(8,145,178,0.1)',
        desc:     'Assimetria, curtose, Q-Q plot e testes de normalidade (Shapiro-Wilk + Jarque-Bera).',
    },
    {
        key:      'structuralBreaks',
        label:    'Quebras Estruturais',
        endpoint: '/api/diagnostics/structural-breaks',
        icon:     Waves,
        color:    '#f59e0b',
        accent:   'rgba(245,158,11,0.1)',
        desc:     'Detecta mudanças abruptas via CUSUM (Brown-Durbin-Evans) e Chow Test com varredura automática.',
    },
    {
        key:      'outliers',
        label:    'Outliers',
        endpoint: '/api/diagnostics/outliers',
        icon:     Boxes,
        color:    '#ef4444',
        accent:   'rgba(239,68,68,0.1)',
        desc:     'Detecção por Z-score, IQR (Tukey) e MAD — identifica pontos que distorcem o forecast.',
    },
    {
        key:      'residuals',
        label:    'Resíduos',
        endpoint: '/api/diagnostics/residuals',
        icon:     FlaskConical,
        color:    '#10b981',
        accent:   'rgba(16,185,129,0.1)',
        desc:     'Valida se os resíduos são ruído branco via Ljung-Box Test e ACF dos resíduos.',
    },
    {
        key:      'entropy',
        label:    'Entropia & Complexidade',
        endpoint: '/api/diagnostics/entropy',
        icon:     Zap,
        color:    '#ec4899',
        accent:   'rgba(236,72,153,0.1)',
        desc:     'Mede previsibilidade via Shannon Entropy, Approximate Entropy e Expoente de Hurst.',
    },
];

// ── Helpers visuais ───────────────────────────────────────────
const CS  = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };
const M   = { color: 'var(--text-muted)' };
const TT  = { background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '11px' };

function Badge({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: ok ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: ok ? '#34d399' : '#f87171' }}>
            {ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
            {label}
        </span>
    );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number | null; sub?: string; color?: string }) {
    return (
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={M}>{label}</p>
            <p className="text-xl font-mono font-bold" style={{ color: color || 'var(--text-primary)' }}>
                {value === null || value === undefined ? '—' : value}
            </p>
            {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{sub}</p>}
        </div>
    );
}

function ConclusionBox({ text }: { text: string }) {
    const isWarn = text.startsWith('⚠️');
    return (
        <div className="p-3 rounded-xl flex items-start gap-2 text-sm"
            style={{
                background: isWarn ? 'rgba(245,158,11,0.08)' : 'rgba(52,211,153,0.08)',
                border: `1px solid ${isWarn ? 'rgba(245,158,11,0.25)' : 'rgba(52,211,153,0.25)'}`,
                color: isWarn ? '#fbbf24' : '#34d399',
            }}>
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{text}</span>
        </div>
    );
}

// ── Renderizadores de resultado por seção ─────────────────────
function TransformationsResult({ data }: { data: any }) {
    const tags = ['original', 'log', 'diff1', 'diff2', 'boxcox'];
    const colors: Record<string, string> = {
        original: '#94a3b8', log: '#8b5cf6', diff1: '#0891b2', diff2: '#06b6d4', boxcox: '#f59e0b',
    };
    const labels: Record<string, string> = {
        original: 'Original', log: 'Log', diff1: 'Diff(1)', diff2: 'Diff(2)', boxcox: 'Box-Cox',
    };

    return (
        <div className="space-y-5">
            {/* Comparação tabular */}
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background: 'var(--bg-surface-md)', borderBottom: '1px solid var(--border)' }}>
                            {['Transformação', 'ADF p-valor', 'Estacionária?', 'Shapiro p-valor', 'Normal?', 'Std'].map(h => (
                                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold" style={M}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tags.map(tag => {
                            const d = data[tag];
                            if (!d?.applicable) return (
                                <tr key={tag} style={{ borderTop: '1px solid var(--border)', opacity: 0.45 }}>
                                    <td className="px-4 py-2.5 font-semibold" style={{ color: colors[tag] }}>{labels[tag]}</td>
                                    <td className="px-4 py-2.5" colSpan={5} style={M}>{d?.note || 'N/A'}</td>
                                </tr>
                            );
                            return (
                                <tr key={tag} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td className="px-4 py-2.5 font-semibold" style={{ color: colors[tag] }}>{labels[tag]}</td>
                                    <td className="px-4 py-2.5 font-mono">{d.adf_pvalue?.toFixed(4) ?? '—'}</td>
                                    <td className="px-4 py-2.5"><Badge ok={d.adf_pvalue < 0.05} label={d.adf_pvalue < 0.05 ? 'Sim' : 'Não'} /></td>
                                    <td className="px-4 py-2.5 font-mono">{d.shapiro_pvalue?.toFixed(4) ?? '—'}</td>
                                    <td className="px-4 py-2.5"><Badge ok={d.shapiro_pvalue >= 0.05} label={d.shapiro_pvalue >= 0.05 ? 'Sim' : 'Não'} /></td>
                                    <td className="px-4 py-2.5 font-mono">{d.std?.toFixed(2) ?? '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mini chart — série original vs diff1 */}
            {data.original?.values?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { tag: 'original', label: 'Original', color: colors.original },
                        { tag: 'diff1',    label: 'Diferenciação 1ª Ordem', color: colors.diff1 },
                    ].map(({ tag, label, color }) => {
                        const d = data[tag];
                        if (!d?.applicable || !d.values?.length) return null;
                        const chartData = d.periodos.map((p: string, i: number) => ({ p, v: d.values[i] }));
                        return (
                            <div key={tag} className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                                <p className="text-xs font-semibold mb-3" style={{ color }}>{label}</p>
                                <div className="h-[120px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
                                            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
                                            <XAxis dataKey="p" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip contentStyle={TT} formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, label]} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {data.recommendation?.length > 0 && (
                <div className="space-y-2">
                    {data.recommendation.map((r: string, i: number) => <ConclusionBox key={i} text={r} />)}
                </div>
            )}
        </div>
    );
}

function DistributionResult({ data }: { data: any }) {
    const histData = data.bin_centers?.map((c: number, i: number) => ({
        x: c.toFixed(2),
        densidade: data.histogram[i],
        normal:    data.normal_curve[i],
    })) ?? [];

    const qqData = data.qq_theoretical?.map((t: number, i: number) => ({
        theoretical: t,
        sample:      data.qq_sample[i],
    })) ?? [];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Assimetria (Skewness)" value={data.skewness?.toFixed(4)} sub={Math.abs(data.skewness) < 0.5 ? 'Aproximadamente simétrica' : data.skewness > 0 ? 'Cauda direita' : 'Cauda esquerda'} color={Math.abs(data.skewness) < 0.5 ? '#34d399' : '#f59e0b'} />
                <MetricCard label="Curtose (Excess)" value={data.kurtosis?.toFixed(4)} sub={Math.abs(data.kurtosis) < 0.5 ? 'Mesocúrtica' : data.kurtosis > 0 ? 'Leptocúrtica' : 'Platicúrtica'} color={Math.abs(data.kurtosis) < 1 ? '#34d399' : '#f87171'} />
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={M}>Shapiro-Wilk</p>
                    <p className="font-mono font-bold text-base" style={{ color: 'var(--text-primary)' }}>p={data.shapiro_pvalue?.toFixed(4)}</p>
                    <div className="mt-1"><Badge ok={data.is_normal_shapiro} label={data.is_normal_shapiro ? 'Normal' : 'Não Normal'} /></div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={M}>Jarque-Bera</p>
                    <p className="font-mono font-bold text-base" style={{ color: 'var(--text-primary)' }}>p={data.jarque_bera_pvalue?.toFixed(4)}</p>
                    <div className="mt-1"><Badge ok={data.is_normal_jb} label={data.is_normal_jb ? 'Normal' : 'Não Normal'} /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Histograma com curva normal */}
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-3" style={M}>Histograma de Densidade vs Curva Normal</p>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histData} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
                                <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="x" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} interval={Math.floor(histData.length / 5)} />
                                <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={TT} />
                                <Bar dataKey="densidade" fill="rgba(139,92,246,0.5)" name="Densidade" radius={[2, 2, 0, 0]} />
                                <Line type="monotone" dataKey="normal" stroke="#f59e0b" strokeWidth={2} dot={false} name="Normal Teórica" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Q-Q Plot */}
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-3" style={M}>Q-Q Plot (Teórico × Amostral)</p>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
                                <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
                                <XAxis dataKey="theoretical" name="Teórico" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} />
                                <YAxis dataKey="sample" name="Amostral" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={TT} formatter={(v: any, n: any) => [typeof v === 'number' ? v.toFixed(3) : v, n]} />
                                <Scatter data={qqData} fill="rgba(8,145,178,0.7)" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <ConclusionBox text={data.skewness_interp + ' · ' + data.kurtosis_interp} />
        </div>
    );
}

function StructuralBreaksResult({ data }: { data: any }) {
    const cusum = data.cusum;
    const chow  = data.chow;

    const cusumChart = cusum?.periodos?.map((p: string, i: number) => ({
        p,
        cusum: cusum.series[i],
        upper: cusum.upper_band[i],
        lower: cusum.lower_band[i],
    })) ?? [];

    const xInterval = Math.max(1, Math.floor(cusumChart.length / 8));

    return (
        <div className="space-y-5">
            {/* CUSUM */}
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>CUSUM Test</p>
                    <Badge ok={!cusum.significant} label={cusum.significant ? 'Quebra detectada' : 'Estável'} />
                    <span className="text-xs font-mono" style={M}>max={cusum.max_stat} · p≈{cusum.p_value}</span>
                </div>
                <div className="h-[200px] p-4 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cusumChart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="p" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} interval={xInterval} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={TT} formatter={(v: any, n: any) => [typeof v === 'number' ? v.toFixed(3) : v, n]} />
                            <ReferenceLine y={0} stroke="var(--border-md)" strokeDasharray="4 2" />
                            <Line type="monotone" dataKey="upper" stroke="rgba(239,68,68,0.5)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Banda +5%" />
                            <Line type="monotone" dataKey="lower" stroke="rgba(239,68,68,0.5)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Banda -5%" />
                            <Line type="monotone" dataKey="cusum" stroke="#f59e0b" strokeWidth={2} dot={false} name="CUSUM" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2"><ConclusionBox text={cusum.conclusion} /></div>
            </div>

            {/* Chow */}
            <div>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Chow Test (varredura automática)</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                    <MetricCard label="Ponto de Quebra" value={chow.breakpoint_periodo ?? '—'} color={chow.significant ? '#f87171' : '#34d399'} />
                    <MetricCard label="F-estatístico" value={chow.f_statistic?.toFixed(4) ?? '—'} />
                    <MetricCard label="p-valor" value={chow.p_value?.toFixed(4) ?? '—'} color={chow.significant ? '#f87171' : '#34d399'} />
                </div>
                <ConclusionBox text={chow.conclusion} />
            </div>
        </div>
    );
}

function OutliersResult({ data }: { data: any }) {
    const seriesData = data.series_flagged ?? [];
    const xInterval = Math.max(1, Math.floor(seriesData.length / 10));

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Total de pontos" value={data.n} />
                <MetricCard label="Outliers detectados" value={data.n_outliers} color={data.n_outliers > 0 ? '#f87171' : '#34d399'} />
                <MetricCard label="Fração da série" value={`${data.outlier_fraction}%`} color={data.outlier_fraction > 5 ? '#f87171' : '#34d399'} />
                <MetricCard label="Limite IQR inferior" value={data.thresholds?.iqr_lower?.toFixed(2)} />
            </div>

            {/* Série com outliers marcados */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold mb-3" style={M}>Série Temporal — outliers destacados</p>
                <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={seriesData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="periodo" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} interval={xInterval} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false}
                                tickFormatter={(v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)} />
                            <Tooltip contentStyle={TT} formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'Valor']} />
                            <Line type="monotone" dataKey="valor" stroke="rgba(148,163,184,0.55)" strokeWidth={1.5} dot={false} name="Série" connectNulls />
                            {/* Pontos outlier em vermelho */}
                            {seriesData.filter((d: any) => d.outlier).map((d: any) => (
                                <ReferenceLine key={d.periodo} x={d.periodo} stroke="rgba(239,68,68,0.4)" strokeWidth={1} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Tabela de outliers */}
            {data.outliers?.length > 0 && (
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ background: 'var(--bg-surface-md)', borderBottom: '1px solid var(--border)' }}>
                                {['Período', 'Valor', 'Z-score', 'MAD score', 'Métodos', 'Severidade'].map(h => (
                                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold" style={M}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.outliers.map((o: any) => (
                                <tr key={o.index} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td className="px-4 py-2 font-mono text-xs">{o.periodo}</td>
                                    <td className="px-4 py-2 font-mono">{o.valor?.toFixed(2)}</td>
                                    <td className="px-4 py-2 font-mono" style={{ color: Math.abs(o.z_score) > 4 ? '#f87171' : '#f59e0b' }}>{o.z_score?.toFixed(2)}</td>
                                    <td className="px-4 py-2 font-mono">{o.mad_score?.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-xs">{o.methods.join(', ')}</td>
                                    <td className="px-4 py-2">
                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                            style={{ background: o.severity === 'extremo' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: o.severity === 'extremo' ? '#f87171' : '#f59e0b' }}>
                                            {o.severity}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConclusionBox text={data.conclusion} />
        </div>
    );
}

function ResidualsResult({ data }: { data: any }) {
    const lb = data.ljung_box;
    const residChart = data.residuals?.map((r: number, i: number) => ({ p: data.periodos[i], r })) ?? [];
    const acfChart   = data.acf?.map((v: number, i: number) => ({ lag: i, acf: v })) ?? [];
    const bound      = data.conf_bound ?? 0;
    const xInterval  = Math.max(1, Math.floor(residChart.length / 10));

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Média dos resíduos" value={data.mean?.toFixed(4)} color={Math.abs(data.mean) < 0.01 ? '#34d399' : '#f59e0b'} sub="≈0 é esperado" />
                <MetricCard label="Std dos resíduos" value={data.std?.toFixed(4)} />
                <MetricCard label="Ljung-Box p-valor" value={lb?.p_value?.toFixed(4)} color={lb?.is_white_noise ? '#34d399' : '#f87171'} />
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={M}>Ruído Branco?</p>
                    <div className="mt-1"><Badge ok={lb?.is_white_noise} label={lb?.is_white_noise ? 'Sim' : 'Não'} /></div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>lags={lb?.lags_tested}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Resíduos no tempo */}
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-3" style={M}>Resíduos no Tempo</p>
                    <div className="h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={residChart} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                                <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="p" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} interval={xInterval} />
                                <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={TT} formatter={(v: any) => [typeof v === 'number' ? v.toFixed(4) : v, 'Resíduo']} />
                                <ReferenceLine y={0} stroke="rgba(52,211,153,0.5)" strokeDasharray="4 2" />
                                <Line type="monotone" dataKey="r" stroke="#10b981" strokeWidth={1.5} dot={false} name="Resíduo" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ACF dos resíduos */}
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-3" style={M}>ACF dos Resíduos</p>
                    <div className="h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={acfChart} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                                <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="lag" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} />
                                <YAxis domain={[-1, 1]} tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={TT} formatter={(v: any) => [typeof v === 'number' ? v.toFixed(4) : v, 'ACF']} />
                                <ReferenceLine y={bound}  stroke="rgba(239,68,68,0.5)" strokeDasharray="4 2" />
                                <ReferenceLine y={-bound} stroke="rgba(239,68,68,0.5)" strokeDasharray="4 2" />
                                <Bar dataKey="acf" fill="rgba(16,185,129,0.6)" radius={[2, 2, 0, 0]} name="ACF" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <ConclusionBox text={lb?.conclusion} />
        </div>
    );
}

function EntropyResult({ data }: { data: any }) {
    const score = data.predictability_score;
    const scoreColor = score === null ? 'var(--text-muted)' : score >= 70 ? '#34d399' : score >= 40 ? '#f59e0b' : '#f87171';

    return (
        <div className="space-y-5">
            {/* Score de previsibilidade */}
            <div className="p-5 rounded-xl text-center"
                style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold mb-2" style={M}>Score de Previsibilidade</p>
                <p className="text-5xl font-mono font-bold" style={{ color: scoreColor }}>
                    {score !== null ? `${score}%` : '—'}
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
                    Baseado na Approximate Entropy — quanto maior, mais previsível
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#ec4899' }}>Shannon Entropy</p>
                    <p className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                        {data.shannon_entropy !== null ? data.shannon_entropy?.toFixed(4) : '—'}
                    </p>
                    <p className="text-xs leading-snug" style={{ color: 'var(--text-faint)' }}>{data.shannon_interp}</p>
                </div>

                <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#ec4899' }}>Approximate Entropy (ApEn)</p>
                    <p className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                        {data.approximate_entropy !== null ? data.approximate_entropy?.toFixed(4) : '—'}
                    </p>
                    <p className="text-xs leading-snug" style={{ color: 'var(--text-faint)' }}>{data.apen_interp}</p>
                </div>

                <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#ec4899' }}>Expoente de Hurst (R/S)</p>
                    <p className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                        {data.hurst_exponent !== null ? data.hurst_exponent?.toFixed(4) : '—'}
                    </p>
                    <p className="text-xs leading-snug" style={{ color: 'var(--text-faint)' }}>{data.hurst_interp}</p>
                </div>
            </div>

            {data.coef_variation !== null && (
                <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                    <Info size={14} style={M} />
                    <p className="text-sm" style={M}>
                        Coeficiente de Variação (CV):{' '}
                        <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{data.coef_variation}%</span>
                        {' '}— {data.coef_variation > 30 ? 'alta dispersão relativa' : 'dispersão relativa moderada/baixa'}
                    </p>
                </div>
            )}
        </div>
    );
}

const RESULT_RENDERERS: Record<DiagKey, React.FC<{ data: any }>> = {
    transformations:  TransformationsResult,
    distribution:     DistributionResult,
    structuralBreaks: StructuralBreaksResult,
    outliers:         OutliersResult,
    residuals:        ResidualsResult,
    entropy:          EntropyResult,
};

// ── Componente principal ──────────────────────────────────────
export const Diagnostics = () => {
    const { dataset, diagnostics, setDiagnostic } = useDataStore();

    const [loading, setLoading] = useState<Partial<Record<DiagKey, boolean>>>({});
    const [errors,  setErrors]  = useState<Partial<Record<DiagKey, string>>>({});
    const [open,    setOpen]    = useState<Partial<Record<DiagKey, boolean>>>({});

    const runAnalysis = async (section: Section) => {
        setLoading(prev => ({ ...prev, [section.key]: true }));
        setErrors(prev =>  ({ ...prev, [section.key]: undefined }));
        try {
            const res = await api.post(section.endpoint, { dataset });
            if (res.data.error) {
                setErrors(prev => ({ ...prev, [section.key]: res.data.error }));
            } else {
                setDiagnostic(section.key, res.data);
                setOpen(prev => ({ ...prev, [section.key]: true }));
            }
        } catch (err: any) {
            setErrors(prev => ({ ...prev, [section.key]: err.message || 'Erro ao conectar com o servidor.' }));
        } finally {
            setLoading(prev => ({ ...prev, [section.key]: false }));
        }
    };

    const toggleOpen = (key: DiagKey) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

    if (dataset.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
            <Activity size={40} />
            <p className="text-sm">Carregue um dataset no Dashboard para executar os diagnósticos.</p>
        </div>
    );

    return (
        <div className="space-y-4 animate-fadeup pb-10">
            {/* Cabeçalho */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Diagnósticos de Série Temporal
                </h1>
                <p className="text-sm mt-1" style={M}>
                    6 módulos de análise avançada — execute individualmente e expanda para ver os resultados.
                </p>
            </div>

            {/* Cards de seção */}
            {SECTIONS.map(section => {
                const Icon      = section.icon;
                const result    = diagnostics[section.key];
                const isLoading = loading[section.key];
                const error     = errors[section.key];
                const isOpen    = open[section.key];
                const Renderer  = RESULT_RENDERERS[section.key];

                return (
                    <div key={section.key} className="rounded-2xl overflow-hidden" style={CS}>
                        {/* Header do card */}
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                        style={{ background: section.accent }}>
                                        <Icon size={16} style={{ color: section.color }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                            {section.label}
                                        </p>
                                        <p className="text-xs mt-0.5 leading-snug" style={M}>
                                            {section.desc}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {result && (
                                        <button onClick={() => toggleOpen(section.key)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                            style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                            {isOpen ? <><ChevronUp size={12} /> Recolher</> : <><ChevronDown size={12} /> Ver resultado</>}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => runAnalysis(section)}
                                        disabled={!!isLoading}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity"
                                        style={{ background: section.accent, border: `1px solid ${section.color}33`, color: section.color }}>
                                        {isLoading
                                            ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Analisando...</>
                                            : <><PlayCircle size={13} /> {result ? 'Re-analisar' : 'Analisar'}</>}
                                    </button>
                                </div>
                            </div>

                            {/* Erro */}
                            {error && (
                                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl text-xs"
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Resultado expandido */}
                        {result && isOpen && (
                            <div className="px-5 pb-6 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                                <Renderer data={result} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
