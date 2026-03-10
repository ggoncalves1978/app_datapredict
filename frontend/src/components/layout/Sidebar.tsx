import React from 'react';
import {
    Home, LineChart, Activity, Layers, PlayCircle, Share2, Zap
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
    { name: 'Visão Geral', path: '/', icon: Home },
    { name: 'Tend. & Sazonalidade', path: '/trend', icon: LineChart },
    { name: 'Estacionariedade', path: '/stationarity', icon: Activity },
    { name: 'Correlações', path: '/correlations', icon: Share2 },
    { name: 'Comparação', path: '/comparison', icon: Layers },
    { name: 'Forecast Predict', path: '/forecast', icon: PlayCircle },
];

export const Sidebar: React.FC = () => {
    return (
        <aside className="w-60 h-screen flex flex-col sticky top-0 z-20 shrink-0"
            style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', transition: 'background 0.25s' }}>

            {/* Logo */}
            <div className="h-16 flex items-center px-5 shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-sm leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>DataPredict</p>
                        <p className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>Analytics Platform</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-5 px-3 space-y-0.5 overflow-y-auto">
                <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-3"
                    style={{ color: 'var(--text-faint)' }}>
                    Análise
                </p>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${isActive ? '' : ''}`
                        }
                        style={({ isActive }) => isActive ? {
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.1))',
                            border: '1px solid rgba(124,58,237,0.3)',
                            color: 'var(--text-primary)',
                        } : {
                            border: '1px solid transparent',
                            color: 'var(--text-muted)',
                        }}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-violet-400' : ''}`}
                                    style={!isActive ? { color: 'var(--text-faint)' } : {}} />
                                {item.name}
                                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.18)' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                        <span className="text-white text-xs font-bold">GD</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>Gabriel D.</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>v1.0 · Sprint 5</p>
                    </div>
                </div>
            </div>
        </aside>
    );
};
