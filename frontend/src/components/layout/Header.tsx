import React from 'react';
import { Bell, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export const Header: React.FC = () => {
    const { theme, toggle } = useTheme();

    return (
        <header className="h-16 flex items-center justify-between px-6 sticky top-0 z-10 shrink-0"
            style={{
                background: 'var(--header-bg)',
                borderBottom: '1px solid var(--border)',
                backdropFilter: 'blur(16px)',
                transition: 'background 0.25s, border-color 0.25s',
            }}>

            {/* Search pill */}
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl w-64 transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    placeholder="Pesquisar módulo..."
                    className="bg-transparent border-none outline-none text-sm w-full"
                    style={{ color: 'var(--text-primary)', caretColor: '#7c3aed' }}
                />
                <kbd className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'var(--bg-surface-md)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>
                    ⌘K
                </kbd>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">

                {/* Theme toggle */}
                <button
                    onClick={toggle}
                    aria-label="Alternar tema"
                    title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}
                >
                    {theme === 'dark'
                        ? <Sun className="w-4 h-4 text-amber-400" />
                        : <Moon className="w-4 h-4 text-violet-500" />}
                </button>

                {/* Notifications */}
                <button
                    className="w-9 h-9 rounded-xl flex items-center justify-center relative transition-all cursor-pointer"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}
                >
                    <Bell className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-violet-500 rounded-full" />
                </button>

                {/* Divider */}
                <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />

                {/* Avatar */}
                <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                        G
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Gabriel D.</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                </button>
            </div>
        </header>
    );
};
