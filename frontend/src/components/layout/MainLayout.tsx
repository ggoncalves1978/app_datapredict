import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatDrawer } from '../chat/ChatDrawer';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="flex min-h-screen font-sans" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', transition: 'background 0.25s, color 0.25s' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 p-6 overflow-auto">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
            <ChatDrawer />
        </div>
    );
};
