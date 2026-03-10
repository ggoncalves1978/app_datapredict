import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { Activity, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios from 'axios';

export const TrendSeasonality = () => {
    const { dataset, decomposition, setDecomposition } = useDataStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetch = async () => {
            if (dataset.length > 0 && !decomposition && !loading) {
                setLoading(true); setError(null);
                try {
                    const res = await axios.post('http://localhost:8000/api/decomposition', { dataset, period: 12 });
                    if (res.data.error) setError(res.data.error);
                    else setDecomposition(res.data);
                } catch (err: any) { setError(err.message || 'Erro'); }
                finally { setLoading(false); }
            }
        }; fetch();
    }, [dataset, decomposition, setDecomposition]);

    const M = { color: 'var(--text-muted)' };
    const CS = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };

    if (dataset.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
            <Activity size={40} /><p className="text-sm">Nenhum dataset carregado.</p>
        </div>
    );
    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: '#3b82f6' }} />
            <p className="text-sm" style={M}>Calculando decomposição...</p>
        </div>
    );
    if (error) return (
        <div className="p-5 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
            <div><p className="font-semibold text-rose-400">Erro na Decomposição</p><p className="text-sm text-rose-300/70 mt-1">{error}</p></div>
        </div>
    );

    const chartData = dataset.map((d, i) => ({
        periodo: d.periodo,
        original: decomposition?.observed[i] ?? null,
        tendencia: decomposition?.trend[i] ?? null,
        sazonalidade: decomposition?.seasonal[i] ?? null,
        residuo: decomposition?.resid[i] ?? null,
    }));

    const charts = [
        { key1: 'original', key2: 'tendencia', n1: 'Observado', n2: 'Tendência', c1: '#475569', c2: '#3b82f6', title: '📈 Série Original & Linha de Tendência', h: 280 },
        { key1: 'sazonalidade', key2: null, n1: 'Sazonalidade', n2: '', c1: '#10b981', c2: '', title: '🌊 Ciclo Sazonal', h: 180 },
        { key1: 'residuo', key2: null, n1: 'Resíduo', n2: '', c1: '#f43f5e', c2: '', title: '⚡ Ruído (Resíduos)', h: 180 },
    ];

    return (
        <div className="space-y-5 animate-fadeup pb-10">
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Tendência e Sazonalidade</h1>
                <p className="text-sm mt-1" style={M}>Decomposição aditiva: Observado = Tendência + Sazonalidade + Resíduo</p>
            </div>
            {decomposition && charts.map(({ key1, key2, n1, n2, c1, c2, title, h }) => (
                <div key={key1} className="p-6 rounded-2xl" style={CS}>
                    <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>{title}</p>
                    <div style={{ height: h }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="periodo" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' }} />
                                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }} />
                                <Line type="monotone" dataKey={key1} name={n1} stroke={c1} strokeWidth={1.5} dot={false} opacity={key2 ? 0.5 : 1} />
                                {key2 && <Line type="monotone" dataKey={key2} name={n2} stroke={c2} strokeWidth={2.5} dot={false} />}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ))}
        </div>
    );
};
