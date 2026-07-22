import React, { useState, useEffect } from "react";
import { 
  Database, 
  Lock, 
  User, 
  Check, 
  AlertCircle, 
  LogOut, 
  PlusCircle,
  Sparkles,
  ShieldAlert,
  Terminal,
  BookOpen,
  Award,
  Users,
  Shield,
  Activity,
  CheckCircle2,
  LockKeyhole,
  ArrowRight,
  HelpCircle,
  FileText,
  X,
  Mail,
  KeyRound,
  GraduationCap,
  Settings,
  Code2,
  Clock,
  Play
} from "lucide-react";
import { 
  loginWithFirebase, 
  registerWithFirebase, 
  logoutFirebase, 
  subscribeToAuth, 
  AppUser, 
  UserRole 
} from "../services/firebaseAuth";
import { getFirebaseConfig, isFirebaseConfigured, initFirebase } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import ClassroomIllustration from "./ClassroomIllustration";

interface FirebaseAuthPanelProps {
  onUserLoginChange: (user: AppUser | null) => void;
  currentUser: AppUser | null;
}

interface MockStudent {
  id: string;
  name: string;
  file: string;
  status: "nao_iniciado" | "codificando" | "ajuda" | "pausado" | "concluido";
  progress: number;
}

export default function FirebaseAuthPanel({ onUserLoginChange, currentUser }: FirebaseAuthPanelProps) {
  // Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [selectedRole, setSelectedRole] = useState<UserRole>("aluno");
  
  // Auth Form state
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [authSuccess, setAuthSuccess] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Firestore credentials config modal inside homepage for fallback/advanced
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  // Simulated Database demo area
  const [simulatedAcademicData, setSimulatedAcademicData] = useState<Array<{ id: string; title: string; content: string }>>([
    { id: "1", title: "Nota Final - Lógica de Programação", content: "Média das turmas ETE Pedro Leão Leal: 8.4" },
    { id: "2", title: "Frequência Mensal", content: "Relatório Consolidado de Presenças - Junho 2026" }
  ]);
  const [academicTitle, setAcademicTitle] = useState<string>("");
  const [academicContent, setAcademicContent] = useState<string>("");
  const [crudError, setCrudError] = useState<string>("");
  const [crudSuccess, setCrudSuccess] = useState<string>("");

  // Live Mock Students Dashboard list for visual presentation
  const mockStudents: MockStudent[] = [
    { id: "ms1", name: "Ana Silva", file: "index.js", status: "codificando", progress: 85 },
    { id: "ms2", name: "Carlos Oliveira", file: "main.py", status: "ajuda", progress: 35 },
    { id: "ms3", name: "Fernanda Santos", file: "app.tsx", status: "concluido", progress: 100 },
    { id: "ms4", name: "Lucas Martins", file: "styles.css", status: "pausado", progress: 60 },
    { id: "ms5", name: "Gabriel Lima", file: "--", status: "nao_iniciado", progress: 0 },
    { id: "ms6", name: "Mariana Costa", file: "routes.ts", status: "codificando", progress: 92 }
  ];

  useEffect(() => {
    const config = getFirebaseConfig();
    if (config) {
      setApiKey(config.apiKey || "");
      setProjectId(config.projectId || "");
    }
  }, []);

  // Subscribe to auth updates if configured
  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsubscribe = subscribeToAuth((user) => {
        onUserLoginChange(user);
      });
      return () => unsubscribe();
    }
  }, [onUserLoginChange]);

  // Firestore real-time sync for demo table
  useEffect(() => {
    const { db, isMock } = initFirebase();
    if (isMock || !db || !currentUser) {
      return;
    }

    try {
      const queryCol = collection(db, "dados_academicos");
      const unsubscribe = onSnapshot(queryCol, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || "",
          content: doc.data().content || ""
        }));
        setSimulatedAcademicData(items);
      }, (error) => {
        console.error("Erro no onSnapshot do Firestore:", error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Erro ao assinar dados_academicos:", e);
    }
  }, [currentUser]);

  // Handle Authentication submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setIsLoading(true);

    try {
      if (authTab === "register") {
        const user = await registerWithFirebase(email.trim(), password, name.trim(), "aluno");
        onUserLoginChange(user);
        setAuthSuccess(`Usuário cadastrado com sucesso como estudante!`);
        setEmail("");
        setPassword("");
        setName("");
        setShowAuthModal(false);
      } else {
        const user = await loginWithFirebase(email.trim(), password);
        onUserLoginChange(user);
        setAuthSuccess(`Bem-vindo, ${user.name}! Login realizado com sucesso.`);
        setShowAuthModal(false);
      }
    } catch (err: any) {
      setAuthError(err.message || "Erro desconhecido ao processar autenticação.");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action Preset Login
  const handlePresetLogin = async (presetEmail: string) => {
    setAuthError("");
    setAuthSuccess("");
    setIsLoading(true);
    try {
      const user = await loginWithFirebase(presetEmail, "123456");
      onUserLoginChange(user);
      setAuthSuccess(`Logado com sucesso no modo demonstração como ${user.name}!`);
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || "Erro no login rápido de demonstração.");
    } finally {
      setIsLoading(false);
    }
  };

  // Clear or save firebase custom credentials
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId) {
      setAuthError("Forneça pelo menos API Key e Project ID.");
      return;
    }
    const configData = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: `${projectId.trim()}.firebaseapp.com`,
      storageBucket: `${projectId.trim()}.appspot.com`
    };
    localStorage.setItem("firebase_custom_config", JSON.stringify(configData));
    alert("Credenciais do Firebase salvas com sucesso! Recarregando serviço...");
    window.location.reload();
  };

  const handleClearConfig = () => {
    if (window.confirm("Deseja realmente limpar as credenciais salvas e voltar ao modo demonstração?")) {
      localStorage.removeItem("firebase_custom_config");
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    try {
      await logoutFirebase();
      onUserLoginChange(null);
    } catch (e) {
      console.error("Erro ao deslogar:", e);
    }
  };

  // Add simulated or real record
  const handleAddAcademicData = async (e: React.FormEvent) => {
    e.preventDefault();
    setCrudError("");
    setCrudSuccess("");

    if (!academicTitle || !academicContent) {
      setCrudError("Preencha todos os campos do registro.");
      return;
    }

    const { db, isMock } = initFirebase();
    const userRole = currentUser ? currentUser.role : "aluno";

    if (isMock || !db) {
      if (userRole === "aluno") {
        setCrudError("Acesso Negado: Apenas professores e administradores podem adicionar registros acadêmicos.");
        return;
      }
      const newItem = {
        id: Math.random().toString(36).substring(7),
        title: academicTitle,
        content: academicContent
      };
      setSimulatedAcademicData([...simulatedAcademicData, newItem]);
      setCrudSuccess("Registro acadêmico simulado adicionado com sucesso!");
      setAcademicTitle("");
      setAcademicContent("");
      return;
    }

    try {
      await addDoc(collection(db, "dados_academicos"), {
        title: academicTitle,
        content: academicContent,
        createdBy: currentUser?.uid || "unknown",
        createdAt: new Date().toISOString()
      });
      setCrudSuccess("Registro acadêmico salvo no Firestore com sucesso!");
      setAcademicTitle("");
      setAcademicContent("");
    } catch (err: any) {
      setCrudError("Permissão negada pelas regras do Firestore ou erro de gravação.");
    }
  };

  const handleRemoveAcademicData = async (id: string) => {
    setCrudError("");
    setCrudSuccess("");
    const { db, isMock } = initFirebase();
    const userRole = currentUser ? currentUser.role : "aluno";

    if (isMock || !db) {
      if (userRole === "aluno") {
        setCrudError("Acesso Negado: Apenas professores e administradores podem remover registros acadêmicos.");
        return;
      }
      setSimulatedAcademicData(simulatedAcademicData.filter(item => item.id !== id));
      setCrudSuccess("Registro acadêmico removido!");
      return;
    }

    try {
      await deleteDoc(doc(db, "dados_academicos", id));
      setCrudSuccess("Registro acadêmico deletado do Firestore.");
    } catch (err: any) {
      setCrudError("Permissão negada ao tentar deletar o registro.");
    }
  };

  const configured = isFirebaseConfigured();

  // Helper helper to open auth modal with specific settings
  const triggerOpenAuth = (tab: "login" | "register", role: UserRole) => {
    setAuthTab(tab);
    setSelectedRole(role);
    setAuthError("");
    setAuthSuccess("");
    setShowAuthModal(true);
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

          {/* Navigation Action Buttons (Aligned on the right) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => triggerOpenAuth("register", "aluno")}
              className="text-xs text-slate-600 hover:text-[#1A237E] font-bold px-3 py-2 rounded-lg transition-colors hover:bg-slate-50 cursor-pointer"
            >
              Cadastre-se
            </button>
            <button
              onClick={() => triggerOpenAuth("login", "aluno")}
              className="text-xs font-black text-white bg-[#EF6C00] hover:bg-[#d86200] px-4 py-2 rounded-lg transition-all shadow-sm cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* CORE HERO SECTION */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-10 md:py-16 space-y-16">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          
          {/* Hero Left Column (Explanation & CTAs) */}
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

          {/* Hero Right Column (Beautiful Live Classroom Illustration) */}
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

        {/* STATUS LEGEND SECTION */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6">
          <div className="text-left space-y-1">
            <h3 className="font-black text-slate-800 text-lg">Status dos Alunos</h3>
            <p className="text-slate-500 text-xs">Entenda os cinco estados que compõem o fluxo operacional e pedagógico da plataforma</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-2 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Não Iniciado</span>
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                O aluno acabou de entrar no portal mas ainda não abriu ou começou o desenvolvimento da tarefa proposta.
              </p>
            </div>

            <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-150 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Codificando</span>
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                O aluno está escrevendo as linhas de código ativamente no editor da sua respectiva bancada acadêmica.
              </p>
            </div>

            <div className="p-4 bg-orange-50/40 border border-orange-100 rounded-xl space-y-2 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider bg-orange-50 text-[#EF6C00] border border-orange-150 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF6C00] animate-ping" />
                <span>Preciso de Ajuda</span>
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Aluno travado devido a dúvidas de lógica ou erros de compilação. Sinal de alerta ligado para o professor.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-2 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Pausado</span>
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Interrupção temporária devido a intervalos, anotações de teoria ou orientações gerais.
              </p>
            </div>

            <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-2 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-150 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Concluído</span>
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Código finalizado com sucesso, testado e pronto para a avaliação técnica final pelo docente.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* RE-USABLE FIREBASE DADOS ACADEMICOS DEMO & WRITE AREA (ONLY VISIBLE IF ACTUALLY LOGGED IN - AS DEMO SECTIONS) */}
      {currentUser && (
        <section className="bg-white border-t border-slate-200 py-10 px-4 md:px-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">Registros Acadêmicos Seguros (Sessão Ativa: {currentUser.name})</h3>
              </div>
              <button 
                onClick={handleLogout}
                className="text-xs text-red-600 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg border border-red-150 transition-colors cursor-pointer"
              >
                Sair da Sessão ({currentUser.role})
              </button>
            </div>

            {crudError && (
              <div className="p-3 bg-red-50 border border-red-150 text-xs text-red-700 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{crudError}</span>
              </div>
            )}

            {crudSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-150 text-xs text-emerald-700 rounded-lg flex gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{crudSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <form onSubmit={handleAddAcademicData} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inserir Novo Registro</span>
                
                <input
                  type="text"
                  value={academicTitle}
                  onChange={(e) => setAcademicTitle(e.target.value)}
                  placeholder="Título (ex: Nota Final)"
                  className="w-full text-xs border border-slate-250 bg-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-600"
                />

                <textarea
                  value={academicContent}
                  onChange={(e) => setAcademicContent(e.target.value)}
                  placeholder="Informações confidenciais de laboratório..."
                  rows={3}
                  className="w-full text-xs border border-slate-250 bg-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-600"
                />

                <button
                  type="submit"
                  className="w-full text-xs font-bold text-white bg-[#1A237E] hover:bg-indigo-900 rounded-lg py-2 px-4 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Gravar no Banco de Dados</span>
                </button>
              </form>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Registros de Segurança Ativos</span>
                
                <div className="flex-1 space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                  {simulatedAcademicData.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-8">Nenhum registro encontrado.</p>
                  ) : (
                    simulatedAcademicData.map((item) => (
                      <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 relative group shadow-xs">
                        <h6 className="font-bold text-slate-800 text-xs pr-6">{item.title}</h6>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">{item.content}</p>
                        <button
                          onClick={() => handleRemoveAcademicData(item.id)}
                          className="absolute top-2.5 right-2.5 text-slate-300 hover:text-red-500 transition-colors text-lg font-bold cursor-pointer"
                          title="Remover registro"
                        >
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* CORE UNIFIED AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          
          {/* Backdrop blur */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setShowAuthModal(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200 z-10">
            
            {/* Modal Header */}
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
              <p className="text-xs text-white/85 mt-1">Acesso unificado e seguro aos laboratórios acadêmicos</p>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => {
                  setAuthTab("login");
                  setAuthError("");
                  setAuthSuccess("");
                }}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 cursor-pointer transition-all ${
                  authTab === "login" 
                    ? "border-[#1A237E] text-[#1A237E] bg-slate-50/50" 
                    : "border-transparent text-slate-450 hover:text-slate-600"
                }`}
              >
                Entrar na Conta
              </button>
              <button
                onClick={() => {
                  setAuthTab("register");
                  setAuthError("");
                  setAuthSuccess("");
                  setSelectedRole("aluno"); // Default on register tab
                }}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 cursor-pointer transition-all ${
                  authTab === "register" 
                    ? "border-[#1A237E] text-[#1A237E] bg-slate-50/50" 
                    : "border-transparent text-slate-450 hover:text-slate-600"
                }`}
              >
                Cadastrar Estudante
              </button>
            </div>

            {/* Modal Body / Form */}
            <div className="p-6 space-y-4">
              
              {/* Alert Notifications */}
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

              {/* DEMO ACCOUNTS HELPER PRESETS (HIGH USABILITY) */}
              {authTab === "login" && !configured && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Demonstração - Clique para Entrar Rápido:</span>
                  
                  <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                    <button
                      onClick={() => handlePresetLogin("alberto@ete.br")}
                      className="w-full bg-white hover:bg-purple-50 text-[#1A237E] font-bold py-1.5 px-2 rounded border border-slate-200/80 transition-all flex justify-between items-center cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span>Alberto (Professor)</span>
                      </span>
                      <span className="text-slate-400 text-[9px] font-mono font-normal">alberto@ete.br</span>
                    </button>
                    <button
                      onClick={() => handlePresetLogin("ana@ete.br")}
                      className="w-full bg-white hover:bg-blue-50 text-[#1A237E] font-bold py-1.5 px-2 rounded border border-slate-200/80 transition-all flex justify-between items-center cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ana Silva (Estudante Aluno)</span>
                      </span>
                      <span className="text-slate-400 text-[9px] font-mono font-normal">ana@ete.br</span>
                    </button>
                    <button
                      onClick={() => handlePresetLogin("admin@ete.br")}
                      className="w-full bg-white hover:bg-red-50 text-[#1A237E] font-bold py-1.5 px-2 rounded border border-slate-200/80 transition-all flex justify-between items-center cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-red-500" />
                        <span>Admin Geral</span>
                      </span>
                      <span className="text-slate-400 text-[9px] font-mono font-normal">admin@ete.br</span>
                    </button>
                  </div>
                </div>
              )}

              {/* AUTH FORM */}
              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                
                {authTab === "register" && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Seu Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Pedro de Leão"
                        required
                        className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 bg-slate-50/50 focus:outline-none focus:border-[#1A237E]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">E-mail Acadêmico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@ete.br"
                      required
                      className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 bg-slate-50/50 focus:outline-none focus:border-[#1A237E] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Senha de Acesso</label>
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
                </div>



                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1A237E] text-white font-bold text-xs hover:bg-indigo-900 transition-all shadow-md shadow-indigo-900/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    "Autenticando..."
                  ) : (
                    <>
                      <span>{authTab === "register" ? "Confirmar Cadastro & Acessar" : "Entrar no Sistema"}</span>
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
              Versão v1.2.0
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
