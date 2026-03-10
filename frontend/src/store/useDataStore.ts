import { create } from 'zustand';

export interface TimeSeriesDataPoint {
    codigo: string | number;
    descricao: string;
    periodo: string; // ISO String ou YYYY-MM-DD
    valor: number;
}

export interface DecompositionData {
    trend: number[];
    seasonal: number[];
    resid: number[];
    observed: number[];
}

export interface StationarityData {
    adf_statistic: number;
    p_value: number;
    critical_values: Record<string, number>;
    is_stationary: boolean;
    used_lag: number;
    nobs: number;
    conclusion: string;
}

export interface CorrelogramData {
    lags: number[];
    acf: number[];
    acf_conf_lower: number[];
    acf_conf_upper: number[];
    pacf: number[];
    pacf_conf_lower: number[];
    pacf_conf_upper: number[];
}

export interface NormalityData {
    statistic: number;
    p_value: number;
    is_normal: boolean;
    conclusion: string;
    histogram: number[];
    bin_edges: number[];
}

export interface ModelResult {
    name: string;
    mape: number;
    accuracy: number | null;
    bias: number | null;
    rank: number;
}

export interface ForecastData {
    top_model: string;
    models: ModelResult[];
    forecast: number[];
    lower: number[];
    upper: number[];
    historico: number[];
    periodos_historico: string[];
    periodos_forecast: string[];
    n_lags_used: number;
    test_size: number;
}

interface DataState {
    dataset: TimeSeriesDataPoint[];
    fileName: string | null;
    secondaryDataset: TimeSeriesDataPoint[];
    secondaryFileName: string | null;
    isLoading: boolean;
    stats: any | null;
    decomposition: DecompositionData | null;
    stationarity: StationarityData | null;
    correlogram: CorrelogramData | null;
    normality: NormalityData | null;
    forecast: ForecastData | null;
    setDataset: (data: TimeSeriesDataPoint[], fileName: string) => void;
    setSecondaryDataset: (data: TimeSeriesDataPoint[], fileName: string) => void;
    clearDataset: () => void;
    clearSecondaryDataset: () => void;
    setIsLoading: (status: boolean) => void;
    setStats: (stats: any | null) => void;
    setDecomposition: (data: DecompositionData | null) => void;
    setStationarity: (data: StationarityData | null) => void;
    setCorrelogram: (data: CorrelogramData | null) => void;
    setNormality: (data: NormalityData | null) => void;
    setForecast: (data: ForecastData | null) => void;
}

export const useDataStore = create<DataState>((set) => ({
    dataset: [],
    fileName: null,
    secondaryDataset: [],
    secondaryFileName: null,
    isLoading: false,
    stats: null,
    decomposition: null,
    stationarity: null,
    correlogram: null,
    normality: null,
    forecast: null,
    setDataset: (data, fileName) => set({ dataset: data, fileName, stats: null, decomposition: null, stationarity: null, correlogram: null, normality: null, forecast: null }),
    setSecondaryDataset: (data, fileName) => set({ secondaryDataset: data, secondaryFileName: fileName }),
    clearDataset: () => set({ dataset: [], fileName: null, stats: null, decomposition: null, stationarity: null, correlogram: null, normality: null, forecast: null, secondaryDataset: [], secondaryFileName: null }),
    clearSecondaryDataset: () => set({ secondaryDataset: [], secondaryFileName: null }),
    setIsLoading: (status) => set({ isLoading: status }),
    setStats: (stats) => set({ stats }),
    setDecomposition: (decomposition) => set({ decomposition }),
    setStationarity: (stationarity) => set({ stationarity }),
    setCorrelogram: (correlogram) => set({ correlogram }),
    setNormality: (normality) => set({ normality }),
    setForecast: (forecast) => set({ forecast }),
}));

