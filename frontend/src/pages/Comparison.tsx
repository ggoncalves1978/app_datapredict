import { useDataStore } from '../store/useDataStore';
import { Activity, X, Layers } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FileDropzone } from '../components/upload/FileDropzone';

export const Comparison = () => {
    const { dataset, fileName, secondaryDataset, secondaryFileName, clearSecondaryDataset } = useDataStore();
    const CS = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };
    const M = { color: 'var(--text-muted)' };
    const TT = { background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px' };

    if (dataset.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
            <Activity size={40} /><p className="text-sm">Carregue o dataset primário no Dashboard primeiro.</p>
        </div>
    );
    if (secondaryDataset.length === 0) return (
        <div className="space-y-5 animate-fadeup">
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Comparação de Séries</h1>
                <p className="text-sm mt-1" style={M}>Adicione uma segunda série para comparar com <strong className="text-violet-400">{fileName}</strong></p>
            </div>
            <div className="p-8 rounded-2xl" style={CS}><FileDropzone isSecondary={true} /></div>
        </div>
    );

    const maxLength = Math.max(dataset.length, secondaryDataset.length);
    const chartData = Array.from({ length: maxLength }).map((_, i) => ({
        index: i,
        primario_periodo: dataset[i]?.periodo || '',
        primario_valor: dataset[i]?.valor ?? null,
        secundario_periodo: secondaryDataset[i]?.periodo || '',
        secundario_valor: secondaryDataset[i]?.valor ?? null,
    }));

    return (
        <div className="space-y-5 animate-fadeup pb-10">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Comparação de Séries</h1>
                    <p className="text-sm mt-1" style={M}>Sobreposição visual pareada por índice sequencial</p>
                </div>
                <button onClick={clearSecondaryDataset}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-rose-500 cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <X size={14} /> Remover Secundário
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {[
                    { name: fileName, color: '#3b82f6', label: 'Série Primária' },
                    { name: secondaryFileName, color: '#10b981', label: 'Série Secundária' },
                ].map(({ name, color, label }) => (
                    <div key={label} className="p-4 rounded-xl flex items-center gap-3" style={CS}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                        <div className="min-w-0">
                            <p className="text-xs mb-0.5" style={M}>{label}</p>
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-6 rounded-2xl" style={CS}>
                <p className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Layers size={16} className="text-indigo-400" /> Gráfico Sobreposto
                </p>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="index" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `+${v}`} />
                            <YAxis yAxisId="left" tick={{ fill: 'rgba(59,130,246,0.7)', fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="right" tick={{ fill: 'rgba(16,185,129,0.7)', fontSize: 11 }} tickLine={false} axisLine={false} orientation="right" />
                            <Tooltip contentStyle={TT} />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }} />
                            <Line yAxisId="left" type="monotone" dataKey="primario_valor" name="Primária (Esq)" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                            <Line yAxisId="right" type="monotone" dataKey="secundario_valor" name="Secundária (Dir)" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
