import React, { useState, useEffect } from "react";
import { Users, Terminal, Clock, ShieldAlert, Shield, Lock, LogOut } from "lucide-react";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentPortal from "./components/StudentPortal";
import AdminPanel from "./components/AdminPanel";
import FirebaseAuthPanel from "./components/FirebaseAuthPanel";
import { Student } from "./types";
import { AppUser, UserRole, logoutFirebase, subscribeToAuth } from "./services/firebaseAuth";

// RBAC View Permissions Definition
const VIEW_PERMISSIONS: Record<string, UserRole[]> = {
  teacher: ["admin", "professor"],
  student: ["admin", "professor", "aluno"],
  admin: ["admin"],
  firebase: ["admin", "professor", "aluno"]
};

// Helper to find a safe view for redirection based on role
const getSafeDefaultView = (role: UserRole): "teacher" | "student" | "admin" | "firebase" => {
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
          className="flex-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 py-2.5 px-4 rounded-md transition-all cursor-pointer shadow-sm shadow-blue-500/10"
        >
          Mudar de Conta / Login
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState<"teacher" | "student" | "admin" | "firebase">("firebase");
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number>(0);
  const [activeSimulatedStudent, setActiveSimulatedStudent] = useState<Student | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [firebaseUser, setFirebaseUser] = useState<AppUser | null>(null);

  // Subscribe to real-time auth changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setFirebaseUser(user);
      if (user) {
        setViewMode(getSafeDefaultView(user.role));
      } else {
        setViewMode("firebase");
      }
    });
    return () => unsubscribe();
  }, []);

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

  // Force redirect to Firebase auth connection panel if not authenticated
  useEffect(() => {
    if (!firebaseUser && viewMode !== "firebase") {
      setViewMode("firebase");
    }
  }, [firebaseUser, viewMode]);

  // Helper to check if a specific view tab is currently locked for the user
  const isTabLocked = (mode: "teacher" | "student" | "admin" | "firebase") => {
    if (mode === "firebase") return false;
    if (!firebaseUser) return true;
    const allowed = VIEW_PERMISSIONS[mode];
    return !allowed.includes(firebaseUser.role);
  };

  // Determine if user has authorization to view current viewMode
  const isAuthorized = firebaseUser 
    ? VIEW_PERMISSIONS[viewMode].includes(firebaseUser.role) 
    : viewMode === "firebase";

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

  if (viewMode === "firebase") {
    return (
      <FirebaseAuthPanel
        currentUser={firebaseUser}
        onUserLoginChange={(user) => setFirebaseUser(user)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans selection:bg-blue-500/10 selection:text-brand-primary">
      
      {/* Top Application Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 py-2 px-4 md:px-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2">
            <div className="bg-brand-primary p-1.5 rounded-md text-white shadow-sm shadow-brand-primary/10">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800 text-base tracking-tight leading-none">CodeTracker</span>
                <span className="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">ETE</span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Laboratório ETE Pedro Leão Leal</p>
            </div>
          </div>

          {/* Staff Back Button (Only visible for Professors/Admins when simulating or viewing other views) */}
          {firebaseUser && (firebaseUser.role === "professor" || firebaseUser.role === "admin") && viewMode === "student" && (
            <button
              onClick={() => {
                handleLogoutSimulatedStudent();
                setViewMode(getSafeDefaultView(firebaseUser.role));
              }}
              className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-brand-primary text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-brand-primary" />
              <span>Voltar ao Painel do Docente</span>
            </button>
          )}

          {firebaseUser && firebaseUser.role === "admin" && viewMode === "teacher" && (
            <button
              onClick={() => {
                setViewMode("admin");
              }}
              className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-brand-primary text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
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

            {firebaseUser && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] uppercase shadow-sm border border-blue-100">
                  {firebaseUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-[10px] font-bold text-slate-800 leading-none">{firebaseUser.name}</p>
                  <span className="text-[9px] text-blue-600 font-mono font-bold uppercase tracking-wider">{firebaseUser.role}</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await logoutFirebase();
                      setFirebaseUser(null);
                      setViewMode("firebase");
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
        {!isAuthorized && firebaseUser ? (
          <AccessDeniedView
            currentRole={firebaseUser.role}
            requiredRoles={VIEW_PERMISSIONS[viewMode]}
            onGoToSafeView={() => setViewMode(getSafeDefaultView(firebaseUser.role))}
            onSwitchAccount={() => setViewMode("firebase")}
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
                  firebaseUser={firebaseUser}
                />
              </div>
            )}

            {viewMode === "admin" && (
              <div className="min-h-[calc(100vh-110px)]">
                <AdminPanel
                  currentUser={firebaseUser ? { name: firebaseUser.name, role: firebaseUser.role } : { name: "Administrador", role: "admin" }}
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
