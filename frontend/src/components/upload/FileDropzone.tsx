import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import type { TimeSeriesDataPoint } from '../../store/useDataStore';

export const FileDropzone: React.FC<{ isSecondary?: boolean }> = ({ isSecondary = false }) => {
    const [isDragActive, setIsDragActive] = useState(false);
    const [errorItem, setErrorItem] = useState<string | null>(null);
    const { setDataset, setSecondaryDataset, setIsLoading } = useDataStore();

    const processData = (data: any[], fileName: string) => {
        if (!data || data.length === 0) { setErrorItem('Arquivo vazio ou incorreto.'); return; }
        const headers = Object.keys(data[0]).map(h => h.trim().toLowerCase());
        const hasPeriodo = headers.some(h => h.includes('período') || h.includes('periodo') || h.includes('data'));
        const hasValor = headers.some(h => h.includes('valor') || h.includes('venda') || h.includes('qtd'));
        if (!(hasPeriodo && hasValor)) { setErrorItem('Arquivo deve conter colunas "Período" e "Valor".'); return; }
        const mapH = (kws: string[]) => Object.keys(data[0]).find(k => kws.some(kw => k.trim().toLowerCase().includes(kw))) || '';
        const mappedData: TimeSeriesDataPoint[] = data.map(row => {
            const rawPeriodo = row[mapH(['período', 'periodo', 'data'])];
            let periodoValue = String(rawPeriodo);
            
            // Tratamento especial para números que são datas do Excel (ex: 44317) ou objetos Date
            if (rawPeriodo instanceof Date) {
                periodoValue = rawPeriodo.toISOString().split('T')[0];
            } else if (!isNaN(Number(rawPeriodo)) && Number(rawPeriodo) > 30000 && Number(rawPeriodo) < 60000) {
                const date = new Date((Number(rawPeriodo) - 25569) * 86400 * 1000);
                periodoValue = date.toISOString().split('T')[0];
            } else if (String(rawPeriodo).includes('T')) {
                 periodoValue = String(rawPeriodo).split('T')[0];
            }

            return {
                codigo: row[mapH(['cod', 'código'])] || 'N/A',
                descricao: row[mapH(['desc', 'nome'])] || 'N/A',
                periodo: periodoValue,
                valor: parseFloat(String(row[mapH(['valor', 'venda', 'qtd', 'quantidade'])]).replace(',', '.')) || 0
            };
        }).filter(r => r.periodo && !isNaN(r.valor));
        if (isSecondary) setSecondaryDataset(mappedData, fileName);
        else setDataset(mappedData, fileName);
        setErrorItem(null);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoading(true); setErrorItem(null);
        if (file.name.endsWith('.csv')) {
            Papa.parse(file, {
                header: true, skipEmptyLines: true,
                complete: r => { processData(r.data, file.name); setIsLoading(false); },
                error: err => { setErrorItem(`Erro CSV: ${err.message}`); setIsLoading(false); }
            });
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const wb = xlsx.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array', cellDates: true });
                    processData(xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]), file.name);
                } catch { setErrorItem('Erro ao processar Excel.'); }
                finally { setIsLoading(false); }
            };
            reader.readAsArrayBuffer(file);
        } else { setErrorItem('Use .csv ou .xlsx'); setIsLoading(false); }
        event.target.value = '';
    };

    return (
        <div className="w-full">
            <label
                htmlFor={isSecondary ? 'file-upload-secondary' : 'file-upload'}
                className="relative flex flex-col items-center justify-center w-full h-72 cursor-pointer transition-all"
                style={{
                    background: isDragActive ? 'rgba(124,58,237,0.08)' : 'var(--bg-surface)',
                    border: `2px dashed ${isDragActive ? 'rgba(124,58,237,0.5)' : 'var(--border-md)'}`,
                    borderRadius: '20px',
                    transition: 'all 0.2s',
                }}
                onDragOver={e => { e.preventDefault(); setIsDragActive(true); }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={e => {
                    e.preventDefault(); setIsDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                        const dt = new DataTransfer(); dt.items.add(file);
                        handleFileUpload({ target: { files: dt.files, value: '' } } as any);
                    }
                }}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                        <UploadCloud className="w-8 h-8 text-violet-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Arraste seu arquivo aqui</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                            ou <span className="text-violet-400 font-medium">clique para selecionar</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {['.CSV', '.XLSX'].map(ext => (
                            <span key={ext} className="text-xs px-3 py-1 rounded-full font-mono"
                                style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                {ext}
                            </span>
                        ))}
                    </div>
                </div>
                <input id={isSecondary ? 'file-upload-secondary' : 'file-upload'} type="file" className="hidden"
                    accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
            </label>

            {errorItem && (
                <div className="mt-4 p-4 rounded-xl flex items-start gap-3"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold text-rose-400">Erro na validação</p>
                        <p className="text-rose-300/70 mt-0.5">{errorItem}</p>
                    </div>
                </div>
            )}

            <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <File className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    O arquivo precisa conter as colunas: <span className="text-violet-400">Período</span> e <span className="text-violet-400">Valor</span>.
                </p>
            </div>
        </div>
    );
};
