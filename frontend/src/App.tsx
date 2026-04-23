import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { TrendSeasonality } from './pages/TrendSeasonality';
import { Stationarity } from './pages/Stationarity';
import { Correlations } from './pages/Correlations';
import { Comparison } from './pages/Comparison';
import { Forecast } from './pages/Forecast';
import { Diagnostics } from './pages/Diagnostics';
import { LinearRegression } from './pages/LinearRegression';

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trend" element={<TrendSeasonality />} />
          <Route path="/stationarity" element={<Stationarity />} />
          <Route path="/correlations" element={<Correlations />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/regression" element={<LinearRegression />} />
          <Route path="*" element={
            <div className="flex items-center justify-center h-[60vh] text-slate-400 flex-col">
              <h2 className="text-2xl font-bold mb-2">Página em Construção</h2>
              <p>Este módulo entrará nas próximas Sprints.</p>
            </div>
          } />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
