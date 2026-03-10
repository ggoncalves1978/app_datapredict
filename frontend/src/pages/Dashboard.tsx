import React, { useEffect, useState } from 'react';
import { FileDropzone } from '../components/upload/FileDropzone';
import { useDataStore } from '../store/useDataStore';
import { Activity, Database, TrendingUp, TrendingDown, BarChart3, Hash } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import axios from 'axios';

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

export const Dashboard: React.FC = () => {
    const { dataset, fileName, clearDataset, stats, setStats } = useDataStore();
    const [loadingStats, setLoadingStats] = useState(false);

    useEffect(() => {
        if (dataset.length > 0 && !stats && !loadingStats) {
            setLoadingStats(true);
            axios.post('http://localhost:8000/api/stats', { dataset: dataset.map(d => ({ ...d, codigo: String(d.codigo) })) })
                .then(res => setStats(res.data))
                .catch(() => setStats({ count: dataset.length, mean: 'N/A', std: 'N/A', min: 'N/A', max: 'N/A' }))
                .finally(() => setLoadingStats(false));
        }
    }, [dataset, stats, loadingStats, setStats]);

    const hasData = dataset.length > 0;

    return (
        <div className="space-y-6 animate-fadeup pb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Visão Geral</h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {hasData ? `Dataset ativo: ${fileName}` : 'Faça upload de uma série temporal para iniciar.'}
                    </p>
                </div>
                <div className="flex gap-2.5">
                    {hasData && (
                        <button onClick={clearDataset}
                            className="btn-gradient flex items-center gap-2 px-5 py-2 text-sm rounded-xl cursor-pointer">
                            + Nova Análise
                        </button>
                    )}
                </div>
            </div>

            {!hasData ? (
                <FileDropzone />
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
                                    <XAxis dataKey="periodo" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickMargin={10} minTickGap={40} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                                        tickFormatter={v => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)} />
                                    <Tooltip contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' }} />
                                    <Area type="monotone" dataKey="valor" name="Valor" stroke="#7c3aed" strokeWidth={2} fill="url(#grad-primary)" dot={false} activeDot={{ r: 5, fill: '#7c3aed', strokeWidth: 2, stroke: 'white' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
