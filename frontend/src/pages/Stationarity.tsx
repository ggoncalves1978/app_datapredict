import { useEffect, useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

const CS: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' };
const M: React.CSSProperties = { color: 'var(--text-muted)' };
import React from 'react';

export const Stationarity = () => {
  const { dataset, stationarity, setStationarity } = useDataStore();
  const [loadingAdf, setLoadingAdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (dataset.length > 0 && !stationarity && !loadingAdf) {
        setLoadingAdf(true); setError(null);
        try {
          const res = await axios.post('http://localhost:8000/api/stationarity', { dataset });
          if (res.data.error) setError(res.data.error);
          else setStationarity(res.data);
        } catch (err: any) { setError(err.message || 'Erro'); }
        finally { setLoadingAdf(false); }
      }
    }; fetch();
  }, [dataset, stationarity, setStationarity]);

  if (dataset.length === 0) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4" style={M}>
      <Activity size={40} /><p className="text-sm">Nenhum dataset carregado.</p>
    </div>
  );
  if (loadingAdf) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(124,58,237,0.2)', borderTopColor: '#7c3aed' }} />
      <p className="text-sm" style={M}>Rodando Teste ADF...</p>
    </div>
  );
  if (error) return (
    <div className="p-5 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
      <div><p className="font-semibold text-rose-400">Erro no Teste ADF</p><p className="text-sm text-rose-300/70 mt-1">{error}</p></div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeup pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Teste de Estacionariedade</h1>
        <p className="text-sm mt-1" style={M}>Validação estatística via Augmented Dickey-Fuller (ADF)</p>
      </div>
      {stationarity && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl" style={{
            background: stationarity.is_stationary ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${stationarity.is_stationary ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={M}>Diagnóstico Final</p>
                <h3 className={`text-2xl font-bold ${stationarity.is_stationary ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stationarity.is_stationary ? 'Estacionária ✓' : 'Não Estacionária ✗'}
                </h3>
                <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>{stationarity.conclusion}</p>
              </div>
              <div className={`p-3 rounded-xl ${stationarity.is_stationary ? 'text-emerald-400' : 'text-rose-400'}`}
                style={{ background: stationarity.is_stationary ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                {stationarity.is_stationary ? <CheckCircle size={28} /> : <XCircle size={28} />}
              </div>
            </div>
          </div>
          <div className="p-6 rounded-2xl" style={CS}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={M}>Métricas do Teste</p>
            <div className="space-y-3">
              {[
                { label: 'ADF Statistic', value: stationarity.adf_statistic.toFixed(4), color: 'var(--text-primary)' },
                { label: 'P-Value', value: stationarity.p_value.toExponential(4), color: stationarity.p_value < 0.05 ? '#34d399' : '#f87171' },
                { label: 'Lags Utilizados', value: String(stationarity.used_lag), color: 'var(--text-primary)' },
                { label: 'Observações', value: String(stationarity.nobs), color: 'var(--text-primary)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm" style={M}>{label}</span>
                  <span className="font-mono text-sm font-semibold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 rounded-2xl md:col-span-2" style={CS}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={M}>Valores Críticos — Limiares de Rejeição H₀</p>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(stationarity.critical_values).map(([key, value]) => (
                <div key={key} className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-1" style={M}>Nível {key}</p>
                  <p className="text-lg font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{(value as number).toFixed(4)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
