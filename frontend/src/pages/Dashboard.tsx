import React, { useEffect, useState } from 'react';
import { FileDropzone } from '../components/upload/FileDropzone';
import { StockPicker } from '../components/upload/StockPicker';
import { useDataStore } from '../store/useDataStore';
import {
    Activity, Database, TrendingUp, TrendingDown, BarChart3,
    Hash, UploadCloud, LineChart,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../api';

const StatCard: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    accent?: string;
    loading?: boolean;
    trend?: 'up' | 'down' | null;
}> = ({ label, value, icon, accent = '#7c3aed', loading = false, trend = null }) => (
    <div className="glass-card p-5 animate-fadeup">
        <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                <span style={{ color: accent }}>{icon}</span>
            </div>
        </div>
        {loading
            ? <div className="h-7 w-24 rounded-lg animate-pulse" style={{ background: 'var(--bg-surface-md)' }} />
            : <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
        }
        {trend && (
            <div className="mt-3 flex items-center gap-1">
                {trend === 'up'
                    ? <span className="badge-up flex items-center gap-1"><TrendingUp size={10} /> +2.4%</span>
                    : <span className="badge-down flex items-center gap-1"><TrendingDown size={10} /> -1.2%</span>}
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>vs. período ant.</span>
            </div>
        )}
    </div>
);

type InputTab = 'upload' | 'bolsa';

export const Dashboard: React.FC = () => {
    const { dataset, fileName, clearDataset, stats, setStats } = useDataStore();
    const [loadingStats, setLoadingStats] = useState(false);
    const [activeTab,    setActiveTab]    = useState<InputTab>('upload');

    useEffect(() => {
        if (dataset.length > 0 && !stats && !loadingStats) {
            setLoadingStats(true);
            api.post('/api/stats', { dataset: dataset.map(d => ({ ...d, codigo: String(d.codigo) })) })
                .then(res => setStats(res.data))
                .catch(() => setStats({ count: dataset.length, mean: 'N/A', std: 'N/A', min: 'N/A', max: 'N/A' }))
                .finally(() => setLoadingStats(false));
        }
    }, [dataset, stats, loadingStats, setStats]);

    const hasData = dataset.length > 0;

    const tabStyle = (active: boolean): React.CSSProperties => ({
        background:  active ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.1))' : 'transparent',
        border:      active ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
        color:       active ? 'var(--text-primary)' : 'var(--text-muted)',
        borderRadius: '12px',
        cursor:      'pointer',
        transition:  'all 0.2s',
        fontWeight:  active ? 600 : 400,
    });

    return (
        <div className="space-y-6 animate-fadeup pb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Visão Geral</h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {hasData ? `Dataset ativo: ${fileName}` : 'Faça upload de um arquivo ou busque um ativo da bolsa para iniciar.'}
                    </p>
                </div>
                {hasData && (
                    <button onClick={clearDataset}
                        className="btn-gradient flex items-center gap-2 px-5 py-2 text-sm rounded-xl cursor-pointer">
                        + Nova Análise
                    </button>
                )}
            </div>

            {!hasData ? (
                <div className="space-y-4">
                    {/* Tab switcher */}
                    <div className="flex gap-1 p-1 rounded-2xl"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: 'fit-content' }}>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl"
                            style={tabStyle(activeTab === 'upload')}
                        >
                            <UploadCloud size={15} style={{ color: activeTab === 'upload' ? '#a78bfa' : 'var(--text-faint)' }} />
                            Upload CSV / Excel
                        </button>
                        <button
                            onClick={() => setActiveTab('bolsa')}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl"
                            style={tabStyle(activeTab === 'bolsa')}
                        >
                            <LineChart size={15} style={{ color: activeTab === 'bolsa' ? '#a78bfa' : 'var(--text-faint)' }} />
                            Bolsa de Valores
                        </button>
                    </div>

                    {/* Tab content */}
                    {activeTab === 'upload' ? (
                        <FileDropzone />
                    ) : (
                        <div className="p-6 rounded-2xl"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.22)' }}>
                                    <LineChart className="w-4 h-4 text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        Séries Temporais de Ativos
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Preços de fechamento via <strong className="text-violet-400">yfinance</strong> · B3 · NYSE · NASDAQ · Cripto
                                    </p>
                                </div>
                            </div>
                            <StockPicker />
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Banner info dataset */}
                    <div className="glass-card px-5 py-3.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.22)' }}>
                            <Database className="w-4 h-4 text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{dataset.length} observações importadas</p>
                        </div>
                        <span className="badge-up shrink-0">Ativo</span>
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Contagem (N)" value={stats?.count || dataset.length} icon={<Hash size={14} />} accent="#7c3aed" trend="up" />
                        <StatCard label="Média" value={stats?.mean ?? '—'} icon={<BarChart3 size={14} />} accent="#4f46e5" loading={loadingStats && !stats} />
                        <StatCard label="Desvio Padrão" value={stats?.std ?? '—'} icon={<Activity size={14} />} accent="#0891b2" loading={loadingStats && !stats} />
                        <StatCard label="Amplitude" value={stats ? `${stats.min} – ${stats.max}` : '—'} icon={<TrendingUp size={14} />} accent="#059669" loading={loadingStats && !stats} />
                    </div>

                    {/* Chart */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.22)' }}>
                                <Activity className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Série Temporal Histórica</h2>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{dataset.length} pontos · Visualização completa</p>
                            </div>
                        </div>
                        <div className="h-[340px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dataset} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                    <defs>
                                        <linearGradient id="grad-primary" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                                            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis
                                        dataKey="periodo"
                                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                        tickMargin={10}
                                        minTickGap={40}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={v => {
                                            if (!v || typeof v !== 'string') return v;
                                            const parts = v.split('-');
                                            if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
                                            if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
                                            return v;
                                        }}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={v => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)}
                                    />
                                    <Tooltip
                                        labelFormatter={v => {
                                            if (!v || typeof v !== 'string') return v;
                                            const parts = v.split('-');
                                            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                            if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
                                            return v;
                                        }}
                                        contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="valor"
                                        name="Valor"
                                        stroke="#7c3aed"
                                        strokeWidth={2}
                                        fill="url(#grad-primary)"
                                        dot={false}
                                        activeDot={{ r: 5, fill: '#7c3aed', strokeWidth: 2, stroke: 'white' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
