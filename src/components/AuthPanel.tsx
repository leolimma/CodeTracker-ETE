import React, { useState } from "react";
import { 
  Terminal, 
  Check, 
  AlertCircle, 
  Users, 
  Activity,
  ArrowRight,
  Mail,
  KeyRound,
  GraduationCap,
  Shield,
  X
} from "lucide-react";
import { signInWithEmailPassword, AuthUser } from "../services/neonAuth";
import ClassroomIllustration from "./ClassroomIllustration";

interface AuthPanelProps {
  onUserLoginChange: (user: AuthUser | null) => void;
}

export default function AuthPanel({ onUserLoginChange }: AuthPanelProps) {
  // Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  
  // Auth Form state
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [authSuccess, setAuthSuccess] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Handle Authentication submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setIsLoading(true);

    try {
      // Usa o Stack Auth SDK para fazer login
      const result = await signInWithEmailPassword(email.trim(), password);
      
      // O role não vem direto do Stack Auth, ele será resolvido no App.tsx ou na API
      // Mas para onUserLoginChange, passamos o mínimo e o App.tsx busca os detalhes
      // ou passamos um AuthUser parcial e o App lida com isso.
      // O ideal é a API Flask resolver isso ao batermos no /api/aluno/dados ou algo assim.
      // Como a gente precisa do role para navegar, podemos bater no /api/usuarios ou /api/aluno/dados.
      // Vamos assumir que a decodificação no backend vai dizer se é aluno, admin ou professor.
      
      // Como simplificação aqui, emitimos um AuthUser parcial
      // App.tsx será responsável por buscar o perfil completo na API.
      onUserLoginChange({
        id: result.userId,
        email: email.trim(),
        displayName: email.trim(),
        role: "aluno", // Default provisório, App.tsx vai atualizar
        entityId: null
      } as AuthUser);
      
      setAuthSuccess("Login realizado com sucesso!");
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || "Erro desconhecido ao processar autenticação.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-800 font-sans flex flex-col selection:bg-indigo-500/10 selection:text-[#1A237E]">
      
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 py-3.5 px-4 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Logo brand */}
          <div className="flex items-center gap-2.5">
            <div className="bg-[#1A237E] p-2 rounded-xl text-white shadow-md shadow-indigo-900/10 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-[#1A237E] text-lg tracking-tight leading-none">CodeTracker</span>
                <span className="text-[10px] bg-[#EF6C00] text-white font-black px-1.5 py-0.5 rounded uppercase tracking-wider">ETE</span>
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Laboratório ETE Pedro Leão Leal</p>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setAuthError("");
                setAuthSuccess("");
                setShowAuthModal(true);
              }}
              className="text-xs font-black text-white bg-[#EF6C00] hover:bg-[#d86200] px-4 py-2 rounded-lg transition-all shadow-sm cursor-pointer"
            >
              Acessar Plataforma
            </button>
          </div>
        </div>
      </header>

      {/* CORE HERO SECTION */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-10 md:py-16 space-y-16">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-indigo-100 px-3.5 py-1 rounded-full text-[#1A237E] font-bold text-[10px] uppercase tracking-wider shadow-xs">
              <Activity className="w-3.5 h-3.5 text-[#1A237E]" />
              <span>Escola Técnica Estadual Pedro Leão Leal</span>
            </div>

            <h1 className="text-3xl md:text-4.5xl font-black text-slate-900 tracking-tight leading-none">
              Acompanhe o aprendizado dos alunos em <span className="text-[#1A237E]">tempo real</span>
            </h1>

            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              O <strong>CodeTracker ETE</strong> é uma plataforma moderna e intuitiva para o gerenciamento de atividades práticas em laboratórios de programação. Permite que os estudantes atualizem instantaneamente o status do seu desenvolvimento enquanto os professores supervisionam e auxiliam toda a turma de forma centralizada e ágil.
            </p>
          </div>

          {/* Hero Right Column */}
          <div className="lg:col-span-6">
            <ClassroomIllustration />
          </div>

        </div>

        {/* HOW IT WORKS SECTION */}
        <section className="space-y-6 pt-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-black text-slate-800">Como funciona?</h2>
            <p className="text-xs text-slate-400 uppercase font-black tracking-widest">Três passos simples para otimizar suas aulas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/85 shadow-sm space-y-4 text-left hover:border-indigo-200 transition-all group">
              <div className="bg-indigo-50 text-[#1A237E] p-3 rounded-xl w-fit group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 text-base">1. Professor cria turmas e atividades</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Com facilidade, o professor monta o plano de aula, cadastra tarefas práticas e gera as diretrizes de código para o laboratório de programação.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/85 shadow-sm space-y-4 text-left hover:border-orange-200 transition-all group">
              <div className="bg-orange-50 text-[#EF6C00] p-3 rounded-xl w-fit group-hover:bg-[#EF6C00] group-hover:text-white transition-all">
                <Terminal className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 text-base">2. Aluno entra na aula e atualiza status</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Os estudantes conectam suas bancadas, iniciam os códigos de suas tarefas e atualizam em tempo real seu progresso à medida que avançam na solução.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/85 shadow-sm space-y-4 text-left hover:border-emerald-200 transition-all group">
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Activity className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 text-base">3. Monitoramento instantâneo</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  O painel do docente reflete instantaneamente cada alteração de status e cliques de ajuda, permitindo intervir cirurgicamente para destravar alunos com dúvidas.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* MODAL DE LOGIN (Neon Auth) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setShowAuthModal(false)}
          />

          <div className="relative bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200 z-10">
            
            <div className="bg-[#1A237E] p-5 text-white relative">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-black tracking-tight">CodeTracker ETE</h3>
              </div>
              <p className="text-xs text-white/85 mt-1">Acesso à plataforma (Neon Auth)</p>
            </div>

            <div className="p-6 space-y-4">
              
              {authError && (
                <div className="p-3 bg-red-50 border border-red-150 text-xs text-red-700 rounded-lg flex gap-2 items-start animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 text-xs text-emerald-700 rounded-lg flex gap-2 items-start animate-fade-in">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{authSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4 mt-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">E-mail Acadêmico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@ete.edu.br"
                      required
                      className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 bg-slate-50/50 focus:outline-none focus:border-[#1A237E] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Senha (Matrícula)</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 bg-slate-50/50 focus:outline-none focus:border-[#1A237E] font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Para alunos: sua senha padrão é o número da sua matrícula.</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1A237E] text-white font-bold text-xs hover:bg-indigo-900 transition-all shadow-md shadow-indigo-900/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 mt-2"
                >
                  {isLoading ? (
                    "Autenticando..."
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-200 py-8 px-5 text-center text-xs text-slate-400 bg-white mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="space-y-1 text-center md:text-left">
            <p className="font-bold text-[#1A237E] flex items-center justify-center md:justify-start gap-1">
              <Terminal className="w-4 h-4 text-[#EF6C00]" />
              <span>CodeTracker ETE</span>
            </p>
            <p className="text-[11px]">Sistema para acompanhamento de atividades práticas em laboratórios de programação.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <span className="text-[10px] bg-slate-100 text-slate-600 font-mono font-bold px-2 py-0.5 rounded">
              Versão 2.0 (Neon)
            </span>
            <span className="text-[11px]">
              © {new Date().getFullYear()} Escola Técnica Estadual Pedro Leão Leal.
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
