import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import api from '../../api';
import { useDataStore } from '../../store/useDataStore';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

/** Converte markdown simples em JSX (bold, code inline, listas) */
const MdText: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    return (
        <div className="space-y-1 text-sm leading-relaxed">
            {lines.map((line, i) => {
                // Lista
                if (line.match(/^[-*•]\s/)) {
                    return (
                        <div key={i} className="flex gap-2 items-start">
                            <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                            <span>{renderInline(line.slice(2))}</span>
                        </div>
                    );
                }
                // Numeração
                if (line.match(/^\d+\.\s/)) {
                    const num = line.match(/^(\d+)\.\s/)![1];
                    return (
                        <div key={i} className="flex gap-2 items-start">
                            <span className="shrink-0 font-mono text-xs opacity-60">{num}.</span>
                            <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
                        </div>
                    );
                }
                // Linha vazia
                if (!line.trim()) return <div key={i} className="h-1" />;
                // Parágrafo normal
                return <p key={i}>{renderInline(line)}</p>;
            })}
        </div>
    );
};

function renderInline(text: string): React.ReactNode {
    // Divide por **bold** e `code`
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
            return <code key={i} className="px-1 py-0.5 rounded bg-black/20 font-mono text-xs">{part.slice(1, -1)}</code>;
        return part;
    });
}

export const ChatDrawer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: '👋 Olá! Sou o **DataPredict AI**.\n\nCarregue um dataset e execute as análises desejadas. Então, me pergunte qualquer coisa sobre os resultados! Posso interpretar estatísticas, testes ADF, normalidade e resultados de forecast.',
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const { stats, stationarity, normality, forecast } = useDataStore();

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const buildContext = () => ({
        stats: stats ?? undefined,
        stationarity: stationarity ?? undefined,
        normality: normality ?? undefined,
        forecast: forecast
            ? { top_model: forecast.top_model, models: forecast.models }
            : undefined,
    });

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: Message = { role: 'user', content: text };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const res = await api.post('/api/chat', {
                messages: newMessages,
                context: buildContext(),
            });
            setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
        } catch {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: '⚠️ Erro ao conectar com o backend. Verifique se o servidor está rodando.' },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const hasData = !!(stats || stationarity || normality || forecast);

    return (
        <>
            {/* Botão flutuante */}
            <button
                onClick={() => setIsOpen(o => !o)}
                style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 50,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 18px',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    fontSize: '14px', fontWeight: '600',
                    transition: 'all 0.25s',
                    boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
                    background: isOpen ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    border: isOpen ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(124,58,237,0.4)',
                    color: 'white',
                }}
            >
                {isOpen ? <X size={18} /> : <Bot size={18} />}
                {!isOpen && <span>IA Analítica</span>}
                {!isOpen && hasData && (
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '10px', height: '10px', background: '#34d399', borderRadius: '50%', border: '2px solid #08080f' }} />
                )}
            </button>

            {/* Drawer */}
            <div
                style={{
                    position: 'fixed', top: 0, right: 0, height: '100%',
                    width: '400px', maxWidth: '100%', zIndex: 40,
                    display: 'flex', flexDirection: 'column',
                    background: 'rgba(8,8,15,0.98)',
                    borderLeft: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
                    transition: 'transform 0.3s ease-in-out',
                    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                }}
            >
                <div className="flex items-center gap-3 px-5 py-4"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="p-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                        <Sparkles className="text-violet-400" size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-white text-sm">DataPredict AI</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {hasData ? '✅ Contexto dos dados carregado' : '⚪ Aguardando dados'}
                        </p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="cursor-pointer transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseOver={e => (e.currentTarget.style.color = 'white')}
                        onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
                        <X size={18} />
                    </button>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 shrink-0 rounded-full bg-indigo-600/20 flex items-center justify-center mr-2 mt-0.5">
                                    <Bot size={14} className="text-indigo-400" />
                                </div>
                            )}
                            <div
                                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm`}
                                style={msg.role === 'user' ? {
                                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                    color: 'white',
                                    borderTopRightRadius: '4px',
                                } : {
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#e2e8f0',
                                    borderTopLeftRadius: '4px',
                                }}
                            >
                                {msg.role === 'assistant'
                                    ? <MdText text={msg.content} />
                                    : <p>{msg.content}</p>
                                }
                            </div>
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="w-7 h-7 shrink-0 rounded-full bg-indigo-600/20 flex items-center justify-center mr-2">
                                <Bot size={14} className="text-indigo-400" />
                            </div>
                            <div className="px-4 py-3 bg-slate-800 rounded-2xl rounded-tl-sm border border-slate-700/50">
                                <div className="flex gap-1 items-center h-4">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Chips de sugestão */}
                {messages.length <= 1 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                        {['O que é MAPE?', 'Como interpretar o ADF?', 'Explique XGBoost', 'Como está meu forecast?'].map(q => (
                            <button
                                key={q}
                                onClick={() => { setInput(q); }}
                                className="px-3 py-1.5 text-xs rounded-full cursor-pointer transition-all"
                                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa' }}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex gap-2 items-end rounded-xl p-2 transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="Pergunte algo sobre os dados..."
                            rows={1}
                            className="flex-1 bg-transparent resize-none text-sm text-slate-200 placeholder-slate-600 outline-none max-h-28 py-1 px-2"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="shrink-0 p-2 rounded-lg text-white cursor-pointer disabled:opacity-40 transition-all"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                    <p className="text-xs mt-2 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        <MessageSquare size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        Enter para enviar · Shift+Enter nova linha
                    </p>
                </div>
            </div>

            {/* Backdrop escuro (mobile) */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
};
