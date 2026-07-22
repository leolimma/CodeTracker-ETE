import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles } from 'lucide-react';
import { consultarTutor } from '../services/apiClient';
import type { AIMensagem } from '../types';

interface AITutorChatProps {
  exercicioId: string;
  codigoAtual: string;
}

export default function AITutorChat({ exercicioId, codigoAtual }: AITutorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMensagem[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    const newMessages: AIMensagem[] = [...messages, { role: 'user', content: userMsg }];
    
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const result = await consultarTutor({
        exercicio_id: exercicioId,
        codigo_atual: codigoAtual,
        duvida: userMsg,
        historico_conversa: messages
      });

      setMessages([...newMessages, { role: 'assistant', content: result.resposta }]);
    } catch (err: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Erro de conexão com o Tutor: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-transform hover:scale-105 z-50 flex items-center justify-center group"
          title="Falar com Tutor IA"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <span className="absolute right-full mr-3 whitespace-nowrap bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            Pedir Dica (Tutor IA)
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden" style={{ height: '500px', maxHeight: '80vh' }}>
          
          {/* Header */}
          <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between text-white shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500 rounded-lg">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white leading-tight">Tutor Gemini</h3>
                <p className="text-[10px] text-indigo-200 font-medium leading-none mt-0.5">Método Socrático (Não dá a resposta)</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:bg-indigo-500 p-1 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 text-xs my-auto p-4 flex flex-col items-center gap-2 opacity-70">
                <Bot className="w-8 h-8 text-slate-400" />
                <p>Olá! Eu sou seu Tutor IA.<br/>Se tiver alguma dúvida ou não souber como começar, me pergunte!</p>
                <p className="text-[10px] font-bold text-slate-400 mt-2">Dica: Seu código atual é enviado automaticamente para mim, então eu consigo ver onde você parou.</p>
              </div>
            )}
            
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-brand-primary text-white rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={handleSend} className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Qual é a sua dúvida?"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-full pl-4 pr-12 py-2.5 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all"
                disabled={isTyping}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isTyping}
                className="absolute right-1 p-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-brand-primary"
              >
                {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
}
