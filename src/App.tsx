import React, { useState, useEffect } from "react";
import { Users, Terminal, Clock, ShieldAlert, Shield, LogOut } from "lucide-react";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentPortal from "./components/StudentPortal";
import AdminPanel from "./components/AdminPanel";
import AuthPanel from "./components/AuthPanel";
import { Student } from "./types";
import { AuthUser, getCurrentUser, signOut } from "./services/neonAuth";
import { getMe } from "./services/apiClient";

// RBAC View Permissions Definition
const VIEW_PERMISSIONS: Record<string, string[]> = {
  teacher: ["admin", "professor"],
  student: ["admin", "professor", "aluno"],
  admin: ["admin"],
  auth: ["admin", "professor", "aluno"]
};

// Helper to find a safe view for redirection based on role
const getSafeDefaultView = (role: string): "teacher" | "student" | "admin" | "auth" => {
  if (role === "admin") return "admin";
  if (role === "professor") return "teacher";
  return "student";
};

// Access Denied Render Wrapper
function AccessDeniedView({ 
  currentRole, 
  requiredRoles, 
  onGoToSafeView,
  onSwitchAccount
}: { 
  currentRole: string; 
  requiredRoles: string[]; 
  onGoToSafeView: () => void;
  onSwitchAccount: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[450px] p-6 bg-white rounded-lg border border-red-100 shadow-sm text-center max-w-lg mx-auto my-8">
      <div className="bg-red-50 p-4 rounded-full text-red-500 mb-4 animate-pulse">
        <ShieldAlert className="w-12 h-12" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 tracking-tight">Acesso Restrito (RBAC)</h3>
      <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-wider">Erro 403 • Forbidden</p>
      
      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-150 text-left w-full space-y-2.5">
        <p className="text-xs text-slate-600 leading-relaxed">
          Sua conta atual está registrada com o papel <strong className="text-red-600 font-black uppercase">'{currentRole}'</strong>. 
          De acordo com as regras de privilégios definidas, você não possui autorização para este painel.
        </p>
        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
          <strong>Papéis com permissão de acesso:</strong>
          <div className="flex gap-1.5 mt-1.5">
            {requiredRoles.map((role) => (
              <span key={role} className="bg-blue-50 text-blue-600 border border-blue-100 font-black px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                {role}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-2.5 w-full">
        <button
          onClick={onGoToSafeView}
          className="flex-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2.5 px-4 rounded-md transition-all cursor-pointer"
        >
          Ir para minha Área Segura
        </button>
        <button
          onClick={onSwitchAccount}
          className="flex-1 text-xs font-bold text-white bg-[#1A237E] hover:bg-indigo-900 py-2.5 px-4 rounded-md transition-all cursor-pointer shadow-sm shadow-indigo-900/10"
        >
          Mudar de Conta / Login
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState<"teacher" | "student" | "admin" | "auth">("auth");
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number>(0);
  const [activeSimulatedStudent, setActiveSimulatedStudent] = useState<Student | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [neonUser, setNeonUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Check auth session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const user = await getCurrentUser();
        if (user) {
          const me = await getMe();
          setNeonUser({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: me.role,
            entityId: me.entity_id
          });
          setViewMode(getSafeDefaultView(me.role));
        } else {
          setNeonUser(null);
          setViewMode("auth");
        }
      } catch (err) {
        console.error("Erro ao validar sessão:", err);
        setNeonUser(null);
        setViewMode("auth");
      } finally {
        setIsInitializing(false);
      }
    }
    checkSession();
  }, []);

  // Handle successful login from AuthPanel
  const handleUserLoginChange = async (user: AuthUser | null) => {
    if (user) {
      // O AuthPanel passou um AuthUser provisório após o login
      // Precisamos buscar o perfil completo via API para ter o role correto
      try {
        const me = await getMe();
        const fullUser: AuthUser = {
          ...user,
          role: me.role,
          entityId: me.entity_id
        };
        setNeonUser(fullUser);
        setViewMode(getSafeDefaultView(me.role));
      } catch (err) {
        console.error("Falha ao resolver perfil pós-login:", err);
        await signOut();
        setNeonUser(null);
        setViewMode("auth");
      }
    } else {
      setNeonUser(null);
      setViewMode("auth");
    }
  };

  // UTC or local clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Force redirect to Auth connection panel if not authenticated
  useEffect(() => {
    if (!isInitializing && !neonUser && viewMode !== "auth") {
      setViewMode("auth");
    }
  }, [neonUser, viewMode, isInitializing]);

  // Determine if user has authorization to view current viewMode
  const isAuthorized = neonUser 
    ? VIEW_PERMISSIONS[viewMode].includes(neonUser.role) 
    : viewMode === "auth";

  // Force sync event
  const triggerStatusUpdateSync = () => {
    setLastUpdateTimestamp(Date.now());
  };

  // Select student for simulation
  const handleSimulateStudent = (student: Student) => {
    setActiveSimulatedStudent(student);
    setViewMode("student"); // Navigate directly to Student Portal with active simulation override
    triggerStatusUpdateSync();
  };

  // Clear simulated student
  const handleLogoutSimulatedStudent = () => {
    setActiveSimulatedStudent(null);
    triggerStatusUpdateSync();
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="animate-spin text-[#1A237E]"><Terminal className="w-8 h-8" /></div>
      </div>
    );
  }

  if (viewMode === "auth") {
    return (
      <AuthPanel
        onUserLoginChange={handleUserLoginChange}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500/10 selection:text-[#1A237E]">
      
      {/* Top Application Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 py-2 px-4 md:px-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2">
            <div className="bg-[#1A237E] p-1.5 rounded-md text-white shadow-sm shadow-indigo-900/10">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800 text-base tracking-tight leading-none">CodeTracker</span>
                <span className="text-[10px] bg-[#EF6C00] text-white font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">ETE</span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Laboratório ETE Pedro Leão Leal</p>
            </div>
          </div>

          {/* Staff Back Button (Only visible for Professors/Admins when simulating or viewing other views) */}
          {neonUser && (neonUser.role === "professor" || neonUser.role === "admin") && viewMode === "student" && (
            <button
              onClick={() => {
                handleLogoutSimulatedStudent();
                setViewMode(getSafeDefaultView(neonUser.role));
              }}
              className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#1A237E] text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-[#1A237E]" />
              <span>Voltar ao Painel do Docente</span>
            </button>
          )}

          {neonUser && neonUser.role === "admin" && viewMode === "teacher" && (
            <button
              onClick={() => {
                setViewMode("admin");
              }}
              className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#1A237E] text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span>Voltar ao Painel Admin</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            {/* Local UTC Time display */}
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-md">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{currentTime}</span>
            </div>

            {neonUser && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="w-7 h-7 rounded-full bg-indigo-50 text-[#1A237E] flex items-center justify-center font-bold text-[10px] uppercase shadow-sm border border-indigo-100">
                  {neonUser.displayName.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-[10px] font-bold text-slate-800 leading-none">{neonUser.displayName}</p>
                  <span className="text-[9px] text-[#1A237E] font-mono font-bold uppercase tracking-wider">{neonUser.role}</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                      setNeonUser(null);
                      setViewMode("auth");
                    } catch (e) {
                      console.error("Erro ao deslogar:", e);
                    }
                  }}
                  className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                  title="Sair da Conta"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Container View Area */}
      <main className="flex-1 p-3 md:p-4 max-w-7xl w-full mx-auto">
        {!isAuthorized && neonUser ? (
          <AccessDeniedView
            currentRole={neonUser.role}
            requiredRoles={VIEW_PERMISSIONS[viewMode]}
            onGoToSafeView={() => setViewMode(getSafeDefaultView(neonUser.role))}
            onSwitchAccount={async () => {
              await signOut();
              setNeonUser(null);
              setViewMode("auth");
            }}
          />
        ) : (
          <>
            {viewMode === "teacher" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[calc(100vh-110px)]">
                <TeacherDashboard
                  lastUpdateTimestamp={lastUpdateTimestamp}
                  onForceStatusUpdate={triggerStatusUpdateSync}
                  onNavigateToStudent={handleSimulateStudent}
                />
              </div>
            )}

            {viewMode === "student" && (
              <div className="bg-slate-50/50 rounded-lg border border-slate-200/80 p-4 md:p-5 min-h-[calc(100vh-110px)] flex flex-col justify-center">
                <StudentPortal
                  onStatusUpdateTrigger={triggerStatusUpdateSync}
                  overrideStudent={activeSimulatedStudent}
                  onLogoutOverride={handleLogoutSimulatedStudent}
                  firebaseUser={
                    // Adaptação para o StudentPortal que esperava AppUser do Firebase
                    { ...neonUser, name: neonUser.displayName } as any
                  }
                />
              </div>
            )}

            {viewMode === "admin" && (
              <div className="min-h-[calc(100vh-110px)]">
                <AdminPanel
                  currentUser={{ name: neonUser.displayName, role: neonUser.role }}
                  onForceStatusUpdate={triggerStatusUpdateSync}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-200 py-3 px-5 text-center text-[11px] text-slate-400 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© {new Date().getFullYear()} CodeTracker ETE • Escola Técnica Estadual Pedro Leão Leal. Todos os direitos reservados.</p>
          <div className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
            <span>Tecnologia ETE Pedro Leão Leal</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
