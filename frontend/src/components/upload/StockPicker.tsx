import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { TrendingUp, Search, AlertCircle, RefreshCw, Building2 } from 'lucide-react';
import api from '../../api';

const B3_TICKERS = [
    { symbol: 'PETR4.SA', name: 'Petrobras PN' },
    { symbol: 'VALE3.SA', name: 'Vale ON' },
    { symbol: 'ITUB4.SA', name: 'Itaú Unibanco PN' },
    { symbol: 'BBDC4.SA', name: 'Bradesco PN' },
    { symbol: 'WEGE3.SA', name: 'WEG ON' },
    { symbol: 'EGIE3.SA', name: 'Engie Brasil ON' },
    { symbol: 'ABEV3.SA', name: 'Ambev ON' },
    { symbol: 'MGLU3.SA', name: 'Magazine Luiza ON' },
    { symbol: 'BBAS3.SA', name: 'Banco do Brasil ON' },
    { symbol: 'RENT3.SA', name: 'Localiza ON' },
    { symbol: 'RADL3.SA', name: 'Raia Drogasil ON' },
    { symbol: 'LREN3.SA', name: 'Lojas Renner ON' },
];

const US_TICKERS = [
    { symbol: 'AAPL',  name: 'Apple' },
    { symbol: 'MSFT',  name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'AMZN',  name: 'Amazon' },
    { symbol: 'NVDA',  name: 'NVIDIA' },
    { symbol: 'TSLA',  name: 'Tesla' },
    { symbol: 'META',  name: 'Meta' },
    { symbol: 'BRK-B', name: 'Berkshire B' },
];

const CRYPTO = [
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' },
    { symbol: 'BNB-USD', name: 'BNB' },
];

const PERIODS = [
    { value: '6mo', label: '6 meses' },
    { value: '1y',  label: '1 ano' },
    { value: '2y',  label: '2 anos' },
    { value: '5y',  label: '5 anos' },
    { value: '10y', label: '10 anos' },
    { value: 'max', label: 'Máximo' },
];

const INTERVALS = [
    { value: '1d',  label: 'Diário' },
    { value: '1wk', label: 'Semanal' },
    { value: '1mo', label: 'Mensal' },
];

export const StockPicker: React.FC = () => {
    const { setDataset } = useDataStore();

    const [ticker,   setTicker]   = useState('');
    const [period,   setPeriod]   = useState('2y');
    const [interval, setInterval] = useState('1mo');
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState<string | null>(null);
    const [fetched,  setFetched]  = useState<{ ticker: string; company: string; points: number; currency: string } | null>(null);

    const CS  = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '14px' };
    const M   = { color: 'var(--text-muted)' };

    const handleFetch = async (sym?: string) => {
        const t = (sym || ticker).trim();
        if (!t) return;
        setLoading(true);
        setError(null);
        setFetched(null);
        try {
            const res = await api.post('/api/stock', { ticker: t, period, interval });
            if (res.data.error) {
                setError(res.data.error);
            } else {
                const label = `${res.data.ticker} — ${res.data.company} (${res.data.period} · ${
                    INTERVALS.find(i => i.value === res.data.interval)?.label ?? res.data.interval
                })`;
                setDataset(res.data.dataset, label);
                setFetched({
                    ticker:   res.data.ticker,
                    company:  res.data.company,
                    points:   res.data.total_points,
                    currency: res.data.currency,
                });
                setTicker(t);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    const chipStyle = (active: boolean, accent = '#7c3aed') => ({
        background:  active ? `${accent}22` : 'var(--bg-surface-md)',
        border:      `1px solid ${active ? accent + '55' : 'var(--border)'}`,
        color:       active ? accent : 'var(--text-muted)',
        borderRadius: '10px',
        cursor:      'pointer',
        transition:  'all 0.15s',
        fontWeight:  active ? 600 : 400,
    } as React.CSSProperties);

    return (
        <div className="space-y-5">

            {/* Search row */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: 'var(--text-faint)' }} />
                    <input
                        type="text"
                        value={ticker}
                        onChange={e => setTicker(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleFetch()}
                        placeholder="Ex: PETR4.SA   AAPL   BTC-USD"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{
                            background: 'var(--bg-surface-md)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                        }}
                    />
                </div>
                <button
                    onClick={() => handleFetch()}
                    disabled={loading || !ticker.trim()}
                    className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-40 shrink-0"
                >
                    {loading
                        ? <RefreshCw size={14} className="animate-spin" />
                        : <TrendingUp size={14} />}
                    {loading ? 'Buscando…' : 'Buscar'}
                </button>
            </div>

            {/* Period selector */}
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold uppercase tracking-widest shrink-0" style={{ color: 'var(--text-faint)' }}>Período</span>
                {PERIODS.map(p => (
                    <button key={p.value} onClick={() => setPeriod(p.value)}
                        className="px-3 py-1 text-xs rounded-lg"
                        style={chipStyle(period === p.value, '#7c3aed')}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Interval selector */}
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold uppercase tracking-widest shrink-0" style={{ color: 'var(--text-faint)' }}>Intervalo</span>
                {INTERVALS.map(i => (
                    <button key={i.value} onClick={() => setInterval(i.value)}
                        className="px-3 py-1 text-xs rounded-lg"
                        style={chipStyle(interval === i.value, '#0891b2')}>
                        {i.label}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 rounded-xl flex items-start gap-3"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-rose-400">Erro</p>
                        <p className="text-xs text-rose-300/70 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {/* Success badge */}
            {fetched && !error && (
                <div className="p-3 rounded-xl flex items-center gap-3"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(16,185,129,0.15)' }}>
                        <Building2 size={13} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-400 truncate">
                            {fetched.ticker} — {fetched.company}
                        </p>
                        <p className="text-xs" style={M}>
                            {fetched.points} pontos · {fetched.currency} · Preço de Fechamento (ajustado)
                        </p>
                    </div>
                    <span className="badge-up shrink-0">Carregado</span>
                </div>
            )}

            {/* Popular tickers */}
            <div className="space-y-4 pt-1">

                {/* B3 */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>B</div>
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                            B3 — Brasil
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {B3_TICKERS.map(t => (
                            <button
                                key={t.symbol}
                                onClick={() => { setTicker(t.symbol); handleFetch(t.symbol); }}
                                disabled={loading}
                                className="group flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all disabled:opacity-40"
                                style={{ ...CS, minWidth: '110px' }}
                            >
                                <span className="text-xs font-mono font-bold" style={{ color: '#10b981' }}>{t.symbol.replace('.SA', '')}</span>
                                <span className="text-xs mt-0.5 leading-tight" style={M}>{t.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* US */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>$</div>
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                            NYSE / NASDAQ — EUA
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {US_TICKERS.map(t => (
                            <button
                                key={t.symbol}
                                onClick={() => { setTicker(t.symbol); handleFetch(t.symbol); }}
                                disabled={loading}
                                className="group flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all disabled:opacity-40"
                                style={{ ...CS, minWidth: '100px' }}
                            >
                                <span className="text-xs font-mono font-bold" style={{ color: '#3b82f6' }}>{t.symbol}</span>
                                <span className="text-xs mt-0.5 leading-tight" style={M}>{t.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Crypto */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15' }}>₿</div>
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                            Criptomoedas
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {CRYPTO.map(t => (
                            <button
                                key={t.symbol}
                                onClick={() => { setTicker(t.symbol); handleFetch(t.symbol); }}
                                disabled={loading}
                                className="group flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all disabled:opacity-40"
                                style={{ ...CS, minWidth: '100px' }}
                            >
                                <span className="text-xs font-mono font-bold" style={{ color: '#facc15' }}>{t.symbol.replace('-USD', '')}</span>
                                <span className="text-xs mt-0.5 leading-tight" style={M}>{t.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tip */}
            <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
                Ações B3 usam sufixo <code className="text-violet-400">.SA</code> · Ex: PETR4.SA · VALE3.SA · WEGE3.SA
            </p>
        </div>
    );
};
