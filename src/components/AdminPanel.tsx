import React, { useState, useEffect } from "react";
import { 
  Users, 
  BookOpen, 
  Terminal, 
  Shield, 
  FolderOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  Download, 
  RotateCcw, 
  AlertTriangle, 
  Check, 
  RefreshCw,
  Clock,
  GraduationCap
} from "lucide-react";
import { ClassItem, Student, Exercise } from "../types";
import { getProfessores, getAuditLogs, getTurmas, getAlunos, getExercicios, exportarDados } from "../services/apiClient";


// Local types matching server.ts models
interface Teacher {
  id: string;
  username: string;
  name: string;
  email?: string;
  password?: string;
}

interface AuditLog {
  id: string;
  userType: string;
  userName: string;
  action: string;
  description: string;
  timestamp: string;
}

interface BackupItem {
  id: string;
  filename: string;
  timestamp: string;
  size: string;
}

interface AdminPanelProps {
  currentUser: { name: string; role: string } | null;
  onForceStatusUpdate?: () => void;
}

export default function AdminPanel({ currentUser, onForceStatusUpdate }: AdminPanelProps) {
  // Tabs: classes, students, teachers, users, exercises, audits, system
  const [activeTab, setActiveTab] = useState<"classes" | "students" | "teachers" | "users" | "exercises" | "audits" | "system">("classes");

  // Data states
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Pagination, Sort & Search states for each tab
  // (We use a single dynamic state configuration to manage all tables cleanly)
  const [tableConfig, setTableConfig] = useState({
    search: "",
    sortField: "",
    sortAsc: true,
    page: 1,
    pageSize: 10,
    filterOption: "ALL" // for filtering by classes or roles
  });

  // Modals
  const [editModal, setEditModal] = useState<{
    type: "class" | "student" | "teacher" | "exercise" | "user";
    mode: "create" | "edit";
    isOpen: boolean;
    data: any;
  }>({
    type: "class",
    mode: "create",
    isOpen: false,
    data: {}
  });

  // CSV Import State
  const [csvText, setCsvText] = useState<string>("");
  const [csvTargetClassId, setCsvTargetClassId] = useState<string>("");
  const [showCsvImport, setShowCsvImport] = useState<boolean>(false);

  // Custom Delete Confirmation Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: "class" | "student" | "teacher" | "exercise" | "user" | null;
    id: string | null;
    name: string | null;
  }>({
    isOpen: false,
    type: null,
    id: null,
    name: null,
  });

  // Trigger alert messages
  const showAlert = (text: string, type: "success" | "error" = "success") => {
    setActionMessage({ text, type });
    setTimeout(() => {
      setActionMessage(null);
    }, 4000);
  };

  // Fetch initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        profs,
        auditsList,
        backupsList,
        classList,
        studentList,
        exerciseList,
        usersList
      ] = await Promise.all([
        getProfessores().catch(() => []),
        getAuditLogs().catch(() => []),
        fetch("/api/admin/backups").then(r => r.ok ? r.json() : []).catch(() => []),
        getTurmas().catch(() => []),
        getAlunos().catch(() => []),
        getExercicios().catch(() => []),
        fetch("/api/users").then(r => r.ok ? r.json() : { users: [] }).then(d => d.users || d.usuarios || (Array.isArray(d) ? d : [])).catch(() => [])
      ]);

      setTeachers((profs || []).map((p: any) => ({
        id: p.id,
        username: p.usuario || p.username || "",
        name: p.nome || p.name || "",
        email: p.email,
      })));
      setAudits(auditsList || []);
      setBackups(backupsList || []);
      setClasses(classList || []);
      setStudents(studentList || []);
      setExercises(exerciseList || []);
      setUsers(usersList || []);

      if (classList && classList.length > 0 && !csvTargetClassId) {
        setCsvTargetClassId(classList[0].id);
      }
    } catch (err: any) {
      showAlert("Erro ao buscar dados do servidor: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset page when tab changes
  useEffect(() => {
    setTableConfig({
      search: "",
      sortField: "",
      sortAsc: true,
      page: 1,
      pageSize: 10,
      filterOption: "ALL"
    });
  }, [activeTab]);

  // Handle Sort Toggle
  const handleSort = (field: string) => {
    setTableConfig(prev => ({
      ...prev,
      sortField: field,
      sortAsc: prev.sortField === field ? !prev.sortAsc : true,
      page: 1
    }));
  };

  // Handle CRUD submissions
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { type, mode, data } = editModal;
    let url = "";
    let method = "POST";
    const actorName = currentUser?.name || "admin";
    const actorType = currentUser?.role || "Administrador";

    // Build request parameters
    const payload = { ...data, actorName, actorType };
    if (type === "teacher" && !payload.username && payload.email) {
      payload.username = payload.email.split("@")[0];
    }

    if (type === "class") {
      url = mode === "create" ? "/api/classes/create" : `/api/classes/${data.id}/update`;
    } else if (type === "student") {
      url = mode === "create" ? "/api/students/create" : `/api/students/${data.id}/update`;
    } else if (type === "teacher") {
      url = mode === "create" ? "/api/teachers/create" : `/api/teachers/${data.id}/update`;
    } else if (type === "exercise") {
      url = mode === "create" ? "/api/exercises/create" : `/api/exercises/${data.id}/update`;
    } else if (type === "user") {
      url = mode === "create" ? "/api/users/create" : `/api/users/${data.uid}/update`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Ocorreu um erro na requisição.");
      }

      // Sync creation or update to Firestore if real Firebase database is active
      

      showAlert(
        `${type === "class" ? "Turma" : type === "student" ? "Aluno" : type === "teacher" ? "Professor" : type === "user" ? "Usuário" : "Exercício"} salvo com sucesso!`
      );
      setEditModal(prev => ({ ...prev, isOpen: false }));
      loadData();
      if (onForceStatusUpdate) onForceStatusUpdate();
    } catch (err: any) {
      showAlert(err.message, "error");
    }
  };

  // Handle Delete Action (Triggers custom safety modal)
  const handleDelete = (type: "class" | "student" | "teacher" | "exercise" | "user", id: string) => {
    let name = "";
    if (type === "class") name = classes.find(c => c.id === id)?.name || id;
    else if (type === "student") name = students.find(s => s.id === id)?.name || id;
    else if (type === "teacher") name = teachers.find(t => t.id === id)?.name || id;
    else if (type === "exercise") name = exercises.find(e => e.id === id)?.title || id;
    else if (type === "user") name = users.find(u => u.uid === id)?.name || id;

    setDeleteConfirmation({
      isOpen: true,
      type,
      id,
      name
    });
  };

  // Perform actual deletion with complete Firestore synchronization
  const executeDelete = async () => {
    const { type, id } = deleteConfirmation;
    if (!type || !id) return;

    // Reset confirmation modal state
    setDeleteConfirmation({ isOpen: false, type: null, id: null, name: null });

    const actorName = currentUser?.name || "admin";
    const actorType = currentUser?.role || "Administrador";
    const url = type === "user"
      ? `/api/users/${id}?actorName=${encodeURIComponent(actorName)}&actorType=${encodeURIComponent(actorType)}`
      : `/api/${type === "class" ? "classes" : type === "student" ? "students" : type === "teacher" ? "teachers" : "exercises"}/${id}?actorName=${encodeURIComponent(actorName)}&actorType=${encodeURIComponent(actorType)}`;

    setIsLoading(true);
    try {
      // 1. Sync deletion to Firestore if real Firebase database is active
      

      // 2. Perform Express JSON Server backend deletion
      const response = await fetch(url, { method: "DELETE" });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Erro ao excluir o registro.");
      }

      showAlert("Registro excluído com sucesso!");
      loadData();
      if (onForceStatusUpdate) onForceStatusUpdate();
    } catch (err: any) {
      showAlert("Erro ao excluir: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // CSV Import Submit
  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      showAlert("Por favor, cole as informações em formato CSV.", "error");
      return;
    }
    if (!csvTargetClassId) {
      showAlert("Por favor, selecione uma turma de destino.", "error");
      return;
    }

    try {
      const response = await fetch("/api/students/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          classId: csvTargetClassId,
          actorName: currentUser?.name || "admin",
          actorType: currentUser?.role || "Administrador"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar arquivo CSV.");
      }

      showAlert(`Importação concluída! ${data.importedCount} alunos cadastrados com sucesso.`);
      setCsvText("");
      setShowCsvImport(false);
      loadData();
      if (onForceStatusUpdate) onForceStatusUpdate();
    } catch (err: any) {
      showAlert(err.message, "error");
    }
  };

  // Database Tools: Backup
  const handleCreateBackup = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorName: currentUser?.name || "admin",
          actorType: currentUser?.role || "Administrador"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showAlert(`Backup realizado com sucesso no arquivo: "${data.backup.filename}"!`);
      loadData();
    } catch (err: any) {
      showAlert("Erro ao gerar backup: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Database Tools: Restore Backup
  const handleRestoreBackup = async (backupId: string) => {
    if (!window.confirm("Atenção! Restaurar o banco de dados substituirá todos os dados ativos. Deseja prosseguir?")) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupId,
          actorName: currentUser?.name || "admin",
          actorType: currentUser?.role || "Administrador"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showAlert("Banco de dados restaurado com sucesso para o backup selecionado!");
      loadData();
      if (onForceStatusUpdate) onForceStatusUpdate();
    } catch (err: any) {
      showAlert("Erro ao restaurar backup: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Database Tools: Reset Defaults
  const handleResetDefaults = async () => {
    if (!window.confirm("Isso redefinirá o banco de dados aos dados de demonstração originais da ETE Pedro Leão Leal. Prosseguir?")) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/restore-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorName: currentUser?.name || "admin",
          actorType: currentUser?.role || "Administrador"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showAlert("Dados de demonstração restaurados com sucesso!");
      loadData();
      if (onForceStatusUpdate) onForceStatusUpdate();
    } catch (err: any) {
      showAlert("Erro ao restaurar padrões: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Generic Data Filter/Sorter/Search/Paginator engine (React equivalent of DataTable)
  const getProcessedData = () => {
    let source: any[] = [];
    if (activeTab === "classes") source = classes;
    else if (activeTab === "students") source = students;
    else if (activeTab === "teachers") source = teachers;
    else if (activeTab === "users") source = users;
    else if (activeTab === "exercises") source = exercises;
    else if (activeTab === "audits") source = audits;

    // 1. Search Query
    let result = source.filter(item => {
      const searchLower = tableConfig.search.toLowerCase();
      if (!searchLower) return true;

      if (activeTab === "classes") {
        return (
          item.name?.toLowerCase().includes(searchLower) ||
          item.room?.toLowerCase().includes(searchLower) ||
          item.id?.toLowerCase().includes(searchLower)
        );
      } else if (activeTab === "students") {
        return (
          item.name?.toLowerCase().includes(searchLower) ||
          item.id?.toLowerCase().includes(searchLower) ||
          item.status?.toLowerCase().includes(searchLower)
        );
      } else if (activeTab === "teachers") {
        return (
          item.name?.toLowerCase().includes(searchLower) ||
          item.username?.toLowerCase().includes(searchLower) ||
          item.email?.toLowerCase().includes(searchLower)
        );
      } else if (activeTab === "users") {
        return (
          item.name?.toLowerCase().includes(searchLower) ||
          item.email?.toLowerCase().includes(searchLower) ||
          item.role?.toLowerCase().includes(searchLower)
        );
      } else if (activeTab === "exercises") {
        return (
          item.title?.toLowerCase().includes(searchLower) ||
          item.module?.toLowerCase().includes(searchLower) ||
          item.difficulty?.toLowerCase().includes(searchLower)
        );
      } else if (activeTab === "audits") {
        return (
          item.userName?.toLowerCase().includes(searchLower) ||
          item.userType?.toLowerCase().includes(searchLower) ||
          item.action?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower)
        );
      }
      return false;
    });

    // 2. Select filter option
    if (tableConfig.filterOption !== "ALL") {
      if (activeTab === "students") {
        result = result.filter(item => item.classId === tableConfig.filterOption);
      } else if (activeTab === "exercises") {
        result = result.filter(item => item.difficulty === tableConfig.filterOption);
      } else if (activeTab === "audits") {
        result = result.filter(item => item.userType === tableConfig.filterOption);
      } else if (activeTab === "users") {
        result = result.filter(item => item.role === tableConfig.filterOption);
      }
    }

    // 3. Sorting logic
    if (tableConfig.sortField) {
      const field = tableConfig.sortField;
      const asc = tableConfig.sortAsc;

      result.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }

    // Paginate Info
    const totalItems = result.length;
    const totalPages = Math.ceil(totalItems / tableConfig.pageSize) || 1;
    const startIndex = (tableConfig.page - 1) * tableConfig.pageSize;
    const paginatedItems = result.slice(startIndex, startIndex + tableConfig.pageSize);

    return {
      paginatedItems,
      totalItems,
      totalPages,
      startIndex,
      endIndex: Math.min(startIndex + tableConfig.pageSize, totalItems)
    };
  };

  const processed = getProcessedData();

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-140px)]">
      
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-1.5 shadow-sm">
        <div className="mb-4 px-2">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-brand-primary" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Administração</h2>
          </div>
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Gestão do CodeTracker</p>
        </div>

        <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1 pb-2 lg:pb-0">
          <button
            onClick={() => setActiveTab("classes")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 lg:shrink ${
              activeTab === "classes" 
                ? "bg-slate-900 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Gerenciar Turmas</span>
          </button>

          <button
            onClick={() => setActiveTab("students")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 lg:shrink ${
              activeTab === "students" 
                ? "bg-slate-900 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Gerenciar Alunos</span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 lg:shrink ${
              activeTab === "users" 
                ? "bg-slate-900 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuários & Papéis</span>
          </button>

          <button
            onClick={() => setActiveTab("exercises")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 lg:shrink ${
              activeTab === "exercises" 
                ? "bg-slate-900 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Gerenciar Exercícios</span>
          </button>

          <button
            onClick={() => setActiveTab("audits")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 lg:shrink ${
              activeTab === "audits" 
                ? "bg-slate-900 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Auditoria de Logs</span>
          </button>

          <button
            onClick={() => setActiveTab("system")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 lg:shrink ${
              activeTab === "system" 
                ? "bg-slate-900 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Backup & Banco</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100 hidden lg:block">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-[11px] text-slate-500">
            <span className="font-bold text-slate-700 block mb-1">Administrador Ativo:</span>
            <div className="flex items-center gap-1 text-xs text-brand-primary font-mono font-bold mt-0.5">
              <span>{currentUser?.name || "Administrador"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel Content (Table area & filters) */}
      <section className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5 flex flex-col">
        
        {/* Banner Action Notification */}
        {actionMessage && (
          <div className={`p-3.5 mb-4 rounded-lg border text-xs font-medium flex items-center gap-2 ${
            actionMessage.type === "success" 
              ? "bg-green-50 border-green-200 text-green-700" 
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {actionMessage.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Tab Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {activeTab === "classes" && "Gestão de Turmas"}
              {activeTab === "students" && "Gestão de Alunos"}
              {activeTab === "users" && "Usuários & Papéis"}
              {activeTab === "exercises" && "Gestão de Exercícios"}
              {activeTab === "audits" && "Auditoria Completa do Sistema"}
              {activeTab === "system" && "Backup e Restauração de Sistema"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "classes" && "Gerencie, edite e crie as turmas do Laboratório ETE Pedro Leão Leal."}
              {activeTab === "students" && "Cadastre alunos, altere turmas e realize importações via CSV em lote."}
              {activeTab === "users" && "Administre contas de usuários cadastrados e edite ou promova seus papéis de acesso."}
              {activeTab === "exercises" && "Gerencie o repositório de desafios práticos condicionados por tempo."}
              {activeTab === "audits" && "Registro completo de cadastros, acessos, exclusões e alterações de competência."}
              {activeTab === "system" && "Realize exportações em JSON, execute backups preventivos e reverta dados."}
            </p>
          </div>

          {/* Action Buttons for current active Tab */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === "classes" && (
              <button
                onClick={() => setEditModal({ type: "class", mode: "create", isOpen: true, data: { name: "", room: "" } })}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Turma</span>
              </button>
            )}

            {activeTab === "students" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCsvImport(!showCsvImport)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar CSV</span>
                </button>
                <button
                  onClick={() => setEditModal({ type: "student", mode: "create", isOpen: true, data: { name: "", classId: classes[0]?.id || "", matricula: "", status: "IDLE", progress: 0, grade: "", notes: "", email: "", password: "ete123" } })}
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Aluno</span>
                </button>
              </div>
            )}

            {activeTab === "users" && (
              <button
                onClick={() => setEditModal({ type: "user", mode: "create", isOpen: true, data: { name: "", email: "", role: "aluno", password: "ete123" } })}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Usuário</span>
              </button>
            )}

            {activeTab === "exercises" && (
              <button
                onClick={() => setEditModal({ type: "exercise", mode: "create", isOpen: true, data: { title: "", module: "", description: "", difficulty: "MEDIUM", estimatedTime: 15, objetivo_aprendizado: "", enunciado: "", entrada_esperada: "", saida_esperada: "", exemplo_entrada: "", exemplo_saida: "", observacoes: "" } })}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Exercício</span>
              </button>
            )}

            {activeTab !== "system" && (
              <button
                onClick={loadData}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer border border-slate-200"
                title="Recarregar dados"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-brand-primary" : ""}`} />
              </button>
            )}
          </div>
        </div>

        {/* CSV Import Layout Panel */}
        {showCsvImport && activeTab === "students" && (
          <form onSubmit={handleCsvImportSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
            <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-brand-primary" />
              <span>Importação em Massa via CSV</span>
            </h3>
            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Cole abaixo as linhas formatadas em CSV. Formato: <strong>Nome do Aluno, Matrícula (opcional)</strong>. <br />
              Exemplo:<br />
              <code className="text-[10px] bg-slate-200 px-1 rounded block mt-1 py-0.5">
                Renato Silva, ETE2026330<br />
                Mariana Souza, ETE2026331
              </code>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Selecione a Turma Destino:</label>
                <select
                  value={csvTargetClassId}
                  onChange={(e) => setCsvTargetClassId(e.target.value)}
                  className="w-full text-xs border border-slate-200 p-2 rounded-lg bg-white font-semibold text-slate-700"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Cole o conteúdo CSV aqui (ex: Nome, Matricula)"
              className="w-full text-xs p-3 font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary mb-3"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCsvImport(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Iniciar Importação
              </button>
            </div>
          </form>
        )}

        {/* Dynamic Search & Column Filters header (Standard for all DataTables tabs) */}
        {activeTab !== "system" && (
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-slate-50 border border-slate-200 p-3 rounded-xl mb-4">
            
            {/* Search query box */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisa rápida..."
                value={tableConfig.search}
                onChange={(e) => setTableConfig(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold"
              />
            </div>

            {/* Additional dropdown select Filters */}
            <div className="flex items-center gap-2 shrink-0">
              
              {/* Filter: Students by Class */}
              {activeTab === "students" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtrar Turma:</span>
                  <select
                    value={tableConfig.filterOption}
                    onChange={(e) => setTableConfig(prev => ({ ...prev, filterOption: e.target.value, page: 1 }))}
                    className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-semibold text-slate-700"
                  >
                    <option value="ALL">Todas as Turmas</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filter: Exercises by Difficulty */}
              {activeTab === "exercises" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dificuldade:</span>
                  <select
                    value={tableConfig.filterOption}
                    onChange={(e) => setTableConfig(prev => ({ ...prev, filterOption: e.target.value, page: 1 }))}
                    className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-semibold text-slate-700"
                  >
                    <option value="ALL">Todas</option>
                    <option value="EASY">Fácil</option>
                    <option value="MEDIUM">Médio</option>
                    <option value="HARD">Difícil</option>
                  </select>
                </div>
              )}

              {/* Filter: Users by Role */}
              {activeTab === "users" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Papel:</span>
                  <select
                    value={tableConfig.filterOption}
                    onChange={(e) => setTableConfig(prev => ({ ...prev, filterOption: e.target.value, page: 1 }))}
                    className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-semibold text-slate-700"
                  >
                    <option value="ALL">Todos os Papéis</option>
                    <option value="admin">Administrador</option>
                    <option value="professor">Professor</option>
                    <option value="aluno">Aluno</option>
                  </select>
                </div>
              )}

              {/* Filter: Audits by Profile Role */}
              {activeTab === "audits" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perfil:</span>
                  <select
                    value={tableConfig.filterOption}
                    onChange={(e) => setTableConfig(prev => ({ ...prev, filterOption: e.target.value, page: 1 }))}
                    className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-semibold text-slate-700"
                  >
                    <option value="ALL">Todos os Perfis</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Professor">Professor</option>
                    <option value="Aluno">Aluno</option>
                    <option value="Sistema">Sistema</option>
                  </select>
                </div>
              )}

              {/* Page size controller */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exibir:</span>
                <select
                  value={tableConfig.pageSize}
                  onChange={(e) => setTableConfig(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                  className="text-xs bg-white border border-slate-200 px-1.5 py-1 rounded-lg font-semibold text-slate-700"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

            </div>
          </div>
        )}

        {/* ----------------- DATA TABLES RENDERING ----------------- */}

        {isLoading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
            <p className="text-xs text-slate-400 font-mono">Sincronizando com o banco de dados...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto border border-slate-150 rounded-xl">
            
            {/* 1. TURMAS TABLE */}
            {activeTab === "classes" && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 select-none">
                    <th onClick={() => handleSort("id")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Código/ID</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("name")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Nome da Turma</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("room")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Sala/Laboratório</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="p-3 font-semibold">Exercício Ativo</th>
                    <th className="p-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processed.paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400 font-medium">Nenhuma turma encontrada.</td>
                    </tr>
                  ) : (
                    processed.paginatedItems.map((c: ClassItem) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 text-slate-700">
                        <td className="p-3 font-mono font-bold text-slate-400 text-[11px]">{c.id}</td>
                        <td className="p-3 font-bold text-slate-800">{c.name}</td>
                        <td className="p-3 font-medium">{c.room}</td>
                        <td className="p-3 font-medium">
                          {c.activeExerciseId ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold px-2 py-0.5 rounded-full">
                              {exercises.find(e => e.id === c.activeExerciseId)?.title || c.activeExerciseId}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-400 font-semibold px-2 py-0.5 rounded-full">Nenhum ativo</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditModal({ type: "class", mode: "edit", isOpen: true, data: c })}
                              className="p-1 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete("class", c.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 2. ALUNOS TABLE */}
            {activeTab === "students" && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 select-none">
                    <th onClick={() => handleSort("id")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Matrícula/ID</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("name")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Nome do Aluno</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("classId")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Turma</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("status")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Estado</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("progress")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Progresso</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("grade")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Nota</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="p-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processed.paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400 font-medium">Nenhum aluno encontrado nesta busca.</td>
                    </tr>
                  ) : (
                    processed.paginatedItems.map((s: Student) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 text-slate-700">
                        <td className="p-3 font-mono font-bold text-slate-400 text-[11px]">{s.id}</td>
                        <td className="p-3 font-bold text-slate-800">{s.name}</td>
                        <td className="p-3 font-semibold text-slate-500">
                          {classes.find(c => c.id === s.classId)?.name || s.classId}
                        </td>
                        <td className="p-3 font-semibold">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            s.status === "COMPLETED" ? "bg-green-50 border-green-200 text-green-700" :
                            s.status === "HELP" ? "bg-red-50 border-red-200 text-red-700" :
                            s.status === "CODING" ? "bg-blue-50 border-blue-200 text-blue-700" :
                            s.status === "PAUSED" ? "bg-amber-50 border-amber-200 text-amber-700" :
                            "bg-slate-100 border-slate-200 text-slate-500"
                          }`}>
                            {s.status === "COMPLETED" ? "Concluído" :
                             s.status === "HELP" ? "Precisa de Ajuda" :
                             s.status === "CODING" ? "Desenvolvendo" :
                             s.status === "PAUSED" ? "Pausado" : "Não Iniciado"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-brand-primary h-full rounded-full" style={{ width: `${s.progress}%` }} />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-slate-500">{s.progress}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {s.grade !== null ? (
                            <span className="font-bold text-brand-primary bg-blue-50 text-[11px] px-1.5 py-0.5 rounded border border-blue-100 font-mono">
                              {s.grade}/100
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditModal({ type: "student", mode: "edit", isOpen: true, data: { ...s, email: s.email || `${s.id.toLowerCase()}@ete.br`, password: (s as any).password || "ete123" } })}
                              className="p-1 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete("student", s.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 3. USUÁRIOS & PAPÉIS TABLE */}
            {activeTab === "users" && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 select-none">
                    <th onClick={() => handleSort("uid")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Código UID</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("name")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Nome do Usuário</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("email")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>E-mail de Cadastro</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("role")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Papel de Acesso</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="p-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processed.paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400 font-medium">Nenhum usuário localizado.</td>
                    </tr>
                  ) : (
                    processed.paginatedItems.map((u: any) => (
                      <tr key={u.uid} className="hover:bg-slate-50/50 text-slate-700">
                        <td className="p-3 font-mono text-slate-400 text-[11px]" title={u.uid}>
                          {u.uid.substring(0, 8)}...
                        </td>
                        <td className="p-3 font-bold text-slate-800">{u.name}</td>
                        <td className="p-3 font-mono font-semibold text-brand-primary">{u.email}</td>
                        <td className="p-3">
                          {u.role === "admin" && (
                            <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Administrador
                            </span>
                          )}
                          {u.role === "professor" && (
                            <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Professor
                            </span>
                          )}
                          {u.role === "aluno" && (
                            <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Aluno
                            </span>
                          )}
                          {!u.role && (
                            <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Aluno
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditModal({ type: "user", mode: "edit", isOpen: true, data: { ...u } })}
                              className="p-1 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Alterar Papel / Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete("user", u.uid)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Excluir Conta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 4. EXERCICIOS TABLE */}
            {activeTab === "exercises" && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 select-none">
                    <th onClick={() => handleSort("id")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Código</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("title")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Título do Exercício</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("module")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Módulo</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("difficulty")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Nível</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("estimatedTime")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Tempo Est.</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="p-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processed.paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400 font-medium">Nenhum exercício cadastrado.</td>
                    </tr>
                  ) : (
                    processed.paginatedItems.map((e: Exercise) => (
                      <tr key={e.id} className="hover:bg-slate-50/50 text-slate-700">
                        <td className="p-3 font-mono font-bold text-slate-400 text-[11px]">{e.id}</td>
                        <td className="p-3 font-bold text-slate-800">{e.title}</td>
                        <td className="p-3 font-medium text-slate-500">{e.module}</td>
                        <td className="p-3 font-bold">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            e.difficulty === "HARD" ? "bg-red-50 border-red-200 text-red-700" :
                            e.difficulty === "MEDIUM" ? "bg-amber-50 border-amber-200 text-amber-700" :
                            "bg-green-50 border-green-200 text-green-700"
                          }`}>
                            {e.difficulty === "HARD" ? "Difícil" : e.difficulty === "MEDIUM" ? "Médio" : "Fácil"}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-500">{e.estimatedTime} min</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditModal({ type: "exercise", mode: "edit", isOpen: true, data: e })}
                              className="p-1 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete("exercise", e.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 5. AUDITORIA DE LOGS TABLE */}
            {activeTab === "audits" && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 select-none">
                    <th onClick={() => handleSort("timestamp")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Data / Hora</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("userType")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Perfil</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("userName")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Usuário</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th onClick={() => handleSort("action")} className="p-3 font-semibold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1"><span>Ação</span> <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="p-3 font-semibold">Descrição da Alteração / Evento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processed.paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400 font-medium">Nenhum evento de auditoria encontrado.</td>
                    </tr>
                  ) : (
                    processed.paginatedItems.map((a: AuditLog) => (
                      <tr key={a.id} className="hover:bg-slate-50/50 text-slate-700">
                        <td className="p-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(a.timestamp).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3 font-bold text-slate-600">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.userType === "Administrador" ? "bg-purple-50 text-purple-700 border border-purple-100" :
                            a.userType === "Professor" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                            a.userType === "Aluno" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                            "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            {a.userType}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">{a.userName}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            a.action === "Cadastro" ? "bg-green-100 text-green-800" :
                            a.action === "Edição" ? "bg-blue-100 text-blue-800" :
                            a.action === "Exclusão" ? "bg-red-100 text-red-800" :
                            a.action === "Backup" || a.action === "Restauração" ? "bg-amber-100 text-amber-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {a.action}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 leading-normal max-w-xs md:max-w-md truncate" title={a.description}>
                          {a.description}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 6. SYSTEM BACKUP AND RESTORE LAYOUT */}
            {activeTab === "system" && (
              <div className="p-5 flex flex-col gap-6">
                
                {/* Main tools card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Backup card */}
                  <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between bg-slate-50 gap-4 shadow-sm">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-brand-primary" />
                        <span>Backup do Banco</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                        Crie instantaneamente uma cópia de segurança completa do banco de dados (arquivos JSON codificados no servidor).
                      </p>
                    </div>
                    <button
                      onClick={handleCreateBackup}
                      disabled={isLoading}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      Criar Backup Automático
                    </button>
                  </div>

                  {/* Export card */}
                  <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between bg-slate-50 gap-4 shadow-sm">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Download className="w-4 h-4 text-brand-primary" />
                        <span>Exportar JSON</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                        Baixe o arquivo completo do banco de dados <code>codetracker.json</code> para conferência externa ou migração offline.
                      </p>
                    </div>
                    <a
                      href="/api/admin/export"
                      download="codetracker_database.json"
                      className="w-full text-center bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-1.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm block"
                    >
                      Exportar Base Ativa (JSON)
                    </a>
                  </div>

                  {/* Reset Defaults card */}
                  <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between bg-red-50/30 border-red-200/50 gap-4 shadow-sm">
                    <div>
                      <h3 className="text-sm font-bold text-red-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span>Reverter para Origem</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                        Apaga o estado customizado e redefine a base com as 3 turmas, 16 alunos e 4 exercícios demonstrativos originais da ETE.
                      </p>
                    </div>
                    <button
                      onClick={handleResetDefaults}
                      disabled={isLoading}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      Restaurar Dados Originais
                    </button>
                  </div>

                </div>

                {/* Backups file table */}
                <div className="mt-2">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Histórico de Arquivos de Backups Preventivos</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold select-none">
                          <th className="p-3">Data/Hora de Criação</th>
                          <th className="p-3">Nome do Arquivo de Backup</th>
                          <th className="p-3">Tamanho</th>
                          <th className="p-3 text-right">Restauração</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {backups.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400 font-medium bg-white">
                              Nenhum arquivo de backup gerado nesta sessão. Use a ferramenta acima para gerar backups.
                            </td>
                          </tr>
                        ) : (
                          [...backups].reverse().map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50/30 bg-white">
                              <td className="p-3 font-semibold text-slate-700">{new Date(b.timestamp).toLocaleString("pt-BR")}</td>
                              <td className="p-3 font-mono font-bold text-brand-primary">{b.filename}</td>
                              <td className="p-3 font-mono text-slate-500">{b.size}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleRestoreBackup(b.id)}
                                  disabled={isLoading}
                                  className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                  Restaurar Este Estado
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* Dynamic Pagination Footer (Standard for all DataTables tabs except Backups) */}
        {activeTab !== "system" && !isLoading && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
            
            {/* Range entries info */}
            <p className="text-slate-500 font-medium">
              Exibindo <span className="font-bold text-slate-700">{processed.totalItems === 0 ? 0 : processed.startIndex + 1}</span> a <span className="font-bold text-slate-700">{processed.endIndex}</span> de <span className="font-bold text-slate-700">{processed.totalItems}</span> registros
            </p>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                disabled={tableConfig.page === 1}
                onClick={() => setTableConfig(prev => ({ ...prev, page: prev.page - 1 }))}
                className="p-1.5 border border-slate-250 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: processed.totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setTableConfig(prev => ({ ...prev, page: pNum }))}
                      className={`min-w-8 h-8 rounded-lg font-bold transition-all text-center cursor-pointer ${
                        tableConfig.page === pNum
                          ? "bg-slate-900 text-white font-black"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={tableConfig.page === processed.totalPages}
                onClick={() => setTableConfig(prev => ({ ...prev, page: prev.page + 1 }))}
                className="p-1.5 border border-slate-250 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

      </section>

      {/* ----------------- EDIT / CREATE CRUD MODAL ----------------- */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-150 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-brand-primary" />
                <span>
                  {editModal.mode === "create" ? "Cadastrar Novo(a) " : "Editar "}
                  {editModal.type === "class" && "Turma"}
                  {editModal.type === "student" && "Aluno"}
                  {editModal.type === "teacher" && "Professor"}
                  {editModal.type === "exercise" && "Exercício"}
                  {editModal.type === "user" && "Usuário"}
                </span>
              </h2>
              <button
                onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-5 flex flex-col gap-4 text-xs">
              
              {/* Class Form */}
              {editModal.type === "class" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Nome da Turma / Curso:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.name || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))}
                      placeholder="Ex: 3º Ano A - Informática"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Sala de Aula / Laboratório:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.room || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, room: e.target.value } }))}
                      placeholder="Ex: Laboratório 401"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>
                </>
              )}

              {/* Student Form */}
              {editModal.type === "student" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo do Aluno:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.name || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))}
                      placeholder="Ex: João da Silva Gomes"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Matrícula (Código ID único):</label>
                    <input
                      type="text"
                      required
                      disabled={editModal.mode === "edit"}
                      value={editModal.data.matricula || editModal.data.id || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, matricula: e.target.value, id: e.target.value } }))}
                      placeholder="Ex: ETE2026401"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Turma Vinculada:</label>
                    <select
                      value={editModal.data.classId || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, classId: e.target.value } }))}
                      className="w-full border border-slate-200 p-2.5 rounded-lg bg-white font-semibold text-slate-700 text-xs"
                    >
                      <option value="">Selecione uma turma</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail Acadêmico / Fictício:</label>
                    <input
                      type="email"
                      required
                      value={editModal.data.email || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, email: e.target.value } }))}
                      placeholder="Ex: joao.gomes@ete.br"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">E-mail para login. Exemplo: <code>matricula@ete.br</code> ou <code>nome@ete.br</code>.</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Senha de Acesso:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.password || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, password: e.target.value } }))}
                      placeholder="Senha de acesso"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Senha de login do estudante. Padrão: <code>ete123</code>.</p>
                  </div>

                  {editModal.mode === "edit" && (
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                      <div>
                        <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Status Atividade:</label>
                        <select
                          value={editModal.data.status || "IDLE"}
                          onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, status: e.target.value } }))}
                          className="w-full border border-slate-200 p-2.5 rounded-lg bg-white font-semibold text-slate-700 text-xs"
                        >
                          <option value="IDLE">Não Iniciado</option>
                          <option value="CODING">Desenvolvendo</option>
                          <option value="HELP">Pediu Ajuda</option>
                          <option value="PAUSED">Pausado</option>
                          <option value="COMPLETED">Concluído</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Progresso (%):</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editModal.data.progress ?? 0}
                          onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, progress: Number(e.target.value) } }))}
                          className="w-full border border-slate-200 p-2.5 rounded-lg bg-white text-xs font-semibold text-slate-700"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Nota da Competência (0 a 100):</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editModal.data.grade ?? ""}
                          onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, grade: e.target.value === "" ? "" : Number(e.target.value) } }))}
                          className="w-full border border-slate-200 p-2.5 rounded-lg bg-white text-xs font-semibold text-slate-700"
                          placeholder="Sem Nota"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Observações do Professor:</label>
                        <textarea
                          rows={2}
                          value={editModal.data.notes || ""}
                          onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, notes: e.target.value } }))}
                          className="w-full border border-slate-200 p-2.5 rounded-lg bg-white text-xs font-semibold text-slate-700"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Teacher Form */}
              {editModal.type === "teacher" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo do Professor:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.name || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))}
                      placeholder="Ex: Henrique de Souza"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail Acadêmico / Fictício:</label>
                    <input
                      type="email"
                      required
                      value={editModal.data.email || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, email: e.target.value, username: e.target.value.split("@")[0] } }))}
                      placeholder="Ex: henrique.souza@ete.br"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">E-mail para login. Exemplo: <code>usuario@ete.br</code>.</p>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Senha de Acesso:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.password || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, password: e.target.value } }))}
                      placeholder="Senha de acesso"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Senha de login do professor. Padrão: <code>ete123</code>.</p>
                  </div>
                </>
              )}

              {/* User Account Form (Role Promotion / Edit) */}
              {editModal.type === "user" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo do Usuário:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.name || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))}
                      placeholder="Ex: Carlos de Souza"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail de Cadastro:</label>
                    <input
                      type="email"
                      required
                      value={editModal.data.email || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, email: e.target.value } }))}
                      placeholder="Ex: usuario@ete.br"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Papel / Nível de Acesso (Permissões):</label>
                    <select
                      value={editModal.data.role || "aluno"}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, role: e.target.value } }))}
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    >
                      <option value="aluno">Aluno (Permissões básicas de envio de código)</option>
                      <option value="professor">Professor (Permissões de avaliação e correção de aulas)</option>
                      <option value="admin">Administrador (Gestão total de dados e configurações)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Promover ou rebaixar este usuário alterará imediatamente suas permissões na próxima sessão ou recarregamento.
                    </p>
                  </div>
                  {editModal.mode === "create" && (
                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Senha Inicial de Cadastro:</label>
                      <input
                        type="text"
                        required
                        value={editModal.data.password || ""}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, password: e.target.value } }))}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Exercise Form */}
              {editModal.type === "exercise" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Título do Exercício:</label>
                    <input
                      type="text"
                      required
                      value={editModal.data.title || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, title: e.target.value } }))}
                      placeholder="Ex: 05. Calculadora de Média"
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Módulo / Tópico:</label>
                      <input
                        type="text"
                        required
                        value={editModal.data.module || ""}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, module: e.target.value } }))}
                        placeholder="Ex: Estruturas Condicionais"
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Tempo Estimado (min):</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={editModal.data.estimatedTime || 15}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, estimatedTime: Number(e.target.value) } }))}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Nível de Dificuldade:</label>
                      <select
                        value={editModal.data.difficulty || "MEDIUM"}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, difficulty: e.target.value } }))}
                        className="w-full border border-slate-200 p-2.5 rounded-lg bg-white font-semibold text-slate-700 text-xs"
                      >
                        <option value="EASY">Fácil</option>
                        <option value="MEDIUM">Médio</option>
                        <option value="HARD">Difícil</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Objetivo de Aprendizagem:</label>
                      <input
                        type="text"
                        required
                        value={editModal.data.objetivo_aprendizado || ""}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, objetivo_aprendizado: e.target.value } }))}
                        placeholder="Ex: Desenvolver habilidades de..."
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Enunciado / Instruções do Exercício:</label>
                    <textarea
                      required
                      rows={4}
                      value={editModal.data.enunciado || editModal.data.description || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, enunciado: e.target.value, description: e.target.value } }))}
                      placeholder="Crie um programa em Python que..."
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Entrada Esperada:</label>
                      <textarea
                        required
                        rows={2}
                        value={editModal.data.entrada_esperada || ""}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, entrada_esperada: e.target.value } }))}
                        placeholder="Ex: Uma string representando a senha."
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Saída Esperada:</label>
                      <textarea
                        required
                        rows={2}
                        value={editModal.data.saida_esperada || ""}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, saida_esperada: e.target.value } }))}
                        placeholder="Ex: A mensagem 'Senha Forte' ou 'Senha Fraca'."
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Exemplo de Entrada:</label>
                      <textarea
                        required
                        rows={2}
                        value={editModal.data.exemplo_entrada || ""}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, exemplo_entrada: e.target.value } }))}
                        placeholder="Ex: P@ssw0rd2026"
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Exemplo de Saída:</label>
                      <textarea
                        required
                        rows={2}
                        value={editModal.data.exemplo_saida || ""}
                        onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, exemplo_saida: e.target.value } }))}
                        placeholder="Ex: Senha Forte"
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Observações do Professor (opcional):</label>
                    <textarea
                      rows={2}
                      value={editModal.data.observacoes || ""}
                      onChange={(e) => setEditModal(prev => ({ ...prev, data: { ...prev.data, observacoes: e.target.value } }))}
                      placeholder="Anotações internas sobre o exercício..."
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary font-semibold text-slate-700 text-xs bg-white"
                    />
                  </div>
                </>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 border-t border-slate-150 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-slate-250 rounded-lg text-xs font-bold hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  Confirmar e Salvar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modern, Safe Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="bg-red-600 text-white p-4 font-black flex items-center gap-2 select-none">
              <AlertTriangle className="w-5 h-5 text-white animate-pulse animate-duration-1000" />
              <span className="text-sm tracking-tight">Confirmar Exclusão Definitiva</span>
            </div>
            
            <div className="p-5 space-y-4 text-left">
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-medium leading-relaxed">
                Esta ação excluirá permanentemente o item do sistema e registrará automaticamente uma auditoria de segurança administrativa.
              </div>
              
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Item a ser Excluído:</span>
                <p className="font-bold text-slate-800 text-sm">
                  {deleteConfirmation.name}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 font-bold border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full capitalize mt-1 select-none">
                  Categoria: {
                    deleteConfirmation.type === "class" ? "Turma" :
                    deleteConfirmation.type === "student" ? "Estudante" :
                    deleteConfirmation.type === "teacher" ? "Professor" : "Exercício Prático"
                  }
                </span>
                {deleteConfirmation.type === "class" && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-2 leading-relaxed">
                    ⚠️ Atenção: Excluir esta turma também desvinculará e removerá permanentemente todos os alunos cadastrados nela.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-150 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation({ isOpen: false, type: null, id: null, name: null })}
                  className="px-4 py-2 border border-slate-250 rounded-lg text-xs font-bold hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
