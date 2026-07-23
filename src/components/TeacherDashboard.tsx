import React, { useState, useEffect } from "react";
import { 
  Users, 
  Terminal, 
  BookOpen, 
  FileText, 
  Plus, 
  Search, 
  FolderOpen, 
  Clock, 
  Play, 
  HelpCircle, 
  CheckCircle, 
  Pause, 
  UserPlus, 
  Edit, 
  Printer, 
  Download, 
  ChevronRight, 
  ExternalLink,
  MessageSquare,
  Volume2
} from "lucide-react";
import { ClassItem, Student, Exercise, StatusLog } from "../types";


interface TeacherDashboardProps {
  onClassChange?: (classId: string) => void;
  lastUpdateTimestamp: number;
  onForceStatusUpdate?: () => void;
  onNavigateToStudent?: (student: Student) => void;
}

// Simple regex-based syntax highlighter for Python code preview
function highlightPython(code: string): React.ReactNode {
  if (!code) return "# Sem código";
  
  const lines = code.split("\n");
  return lines.map((line, lineIdx) => {
    let currentText = line;
    const commentIdx = currentText.indexOf("#");
    let commentText = "";
    if (commentIdx !== -1) {
      commentText = currentText.substring(commentIdx);
      currentText = currentText.substring(0, commentIdx);
    }
    
    const tokens = currentText.split(/(\s+|\(|\)|\:|\,|\"|'|=)/);
    const formattedTokens = tokens.map((token, tokIdx) => {
      const trimmed = token.trim();
      if (/^(def|import|from|return|if|else|elif|for|while|in|and|or|not|class|pass)$/.test(trimmed)) {
        return <span key={tokIdx} className="text-amber-400 font-bold">{token}</span>;
      }
      if (/^(print|sum|len|range|str|int|float|list|dict|set)$/.test(trimmed)) {
        return <span key={tokIdx} className="text-cyan-400">{token}</span>;
      }
      if (/^[0-9]+$/.test(trimmed)) {
        return <span key={tokIdx} className="text-pink-400 font-mono">{token}</span>;
      }
      if (token.startsWith('"') || token.startsWith("'") || token.endsWith('"') || token.endsWith("'")) {
        return <span key={tokIdx} className="text-emerald-300">{token}</span>;
      }
      return <span key={tokIdx} className="text-slate-200">{token}</span>;
    });
    
    return (
      <div key={lineIdx} className="min-h-[1.2rem] font-mono leading-relaxed">
        {formattedTokens}
        {commentIdx !== -1 && <span className="text-slate-500 italic font-mono">{commentText}</span>}
      </div>
    );
  });
}

export default function TeacherDashboard({ onClassChange, lastUpdateTimestamp, onForceStatusUpdate, onNavigateToStudent }: TeacherDashboardProps) {
  // Sidebar Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "classes" | "exercises" | "reports">("dashboard");

  // Core Database States
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [allProgress, setAllProgress] = useState<StudentProgress[]>([]);

  // Real-time Progress Viewer Modal States
  const [selectedProgressStudent, setSelectedProgressStudent] = useState<Student | null>(null);
  const [viewingProgress, setViewingProgress] = useState<StudentProgress | null>(null);
  const [selectedHistoryVersionIndex, setSelectedHistoryVersionIndex] = useState<number>(-1);

  // Search/Filters
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [exerciseSearch, setExerciseSearch] = useState<string>("");

  // Modals & Creation Panels
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedAssignExerciseId, setSelectedAssignExerciseId] = useState<string>("");
  const [showNewClassModal, setShowNewClassModal] = useState<boolean>(false);
  const [showNewExerciseModal, setShowNewExerciseModal] = useState<boolean>(false);
  const [showNewStudentModal, setShowNewStudentModal] = useState<boolean>(false);
  const [showGradingModal, setShowGradingModal] = useState<boolean>(false);
  const [activeGradingStudent, setActiveGradingStudent] = useState<Student | null>(null);

  // New Item Forms State
  const [newClassName, setNewClassName] = useState<string>("");
  const [newClassRoom, setNewClassRoom] = useState<string>("");
  const [newExerciseTitle, setNewExerciseTitle] = useState<string>("");
  const [newExerciseModule, setNewExerciseModule] = useState<string>("Estruturas Condicionais");
  const [newExerciseDesc, setNewExerciseDesc] = useState<string>("");
  const [newExerciseDiff, setNewExerciseDiff] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [newExerciseTime, setNewExerciseTime] = useState<number>(15);
  const [newStudentName, setNewStudentName] = useState<string>("");
  const [gradeInput, setGradeInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");

  // Loading indicator for background updates
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState<boolean>(false);

  // 1. Load classes, exercises, logs (Realtime Firestore or Poll)
  useEffect(() => {
    
      fetchInitialData();
    
  }, []);

  // Sync refresh on external trigger (like when student portal clicks update)
  useEffect(() => {
    if (lastUpdateTimestamp > 0 && !isRealFirebaseActive()) {
      refreshData(false);
    }
  }, [lastUpdateTimestamp]);

  // Handle class selection changes
  useEffect(() => {
    if (!selectedClassId) return;
    
    
      fetchStudents(selectedClassId);
      if (onClassChange) {
        onClassChange(selectedClassId);
      }
    
  }, [selectedClassId]);

  // Real-time Progress subscription for Python editor
  useEffect(() => {
    if (!selectedClassId) return;

    
  }, [selectedClassId, selectedProgressStudent]);

  // Simulação / Geração de dados de progresso locais (quando Firebase não ativo)
  useEffect(() => {
    if (isRealFirebaseActive()) return;
    if (!selectedClassId || students.length === 0) return;

    const activeClass = classes.find((c) => c.id === selectedClassId);
    if (activeClass?.activeExerciseId) {
      const mockProgress: StudentProgress[] = students.map((s) => {
        let code = "";
        let statusAluno: "Digitando" | "Executando" | "Inativo" | "Offline" | "Concluído" = "Inativo";
        let qtyExec = 0;
        let activeSec = 0;

        if (s.status === "COMPLETED") {
          code = `def calcular_media(notas):\n    soma = sum(notas)\n    return soma / len(notas)\n\nlista_notas = [8.5, 7.0, 9.0, 10.0]\nmedia_final = calcular_media(lista_notas)\nprint(f"Média do aluno: {media_final}")`;
          statusAluno = "Concluído";
          qtyExec = 5;
          activeSec = 450;
        } else if (s.status === "CODING") {
          code = `def calcular_media(notas):\n    # TODO: calcular e retornar a media\n    soma = sum(notas)\n    `;
          statusAluno = "Digitando";
          qtyExec = 1;
          activeSec = 180;
        } else if (s.status === "HELP") {
          code = `def calcular_media(notas):\n    # help! syntax error na divisao\n    soma = sum(notas)\n    return soma / \n`;
          statusAluno = "Inativo";
          qtyExec = 3;
          activeSec = 320;
        } else {
          code = `# Atividade não iniciada ainda`;
          statusAluno = "Inativo";
        }

        return {
          id: `${s.id}_${activeClass.activeExerciseId}`,
          studentId: s.id,
          studentName: s.name,
          classId: selectedClassId,
          exerciseId: activeClass.activeExerciseId,
          codigo: code,
          ultimaAtualizacao: new Date().toISOString(),
          tempoDigitando: activeSec / 2,
          quantidadeExecucoes: qtyExec,
          statusAluno,
          ultimaExecucao: qtyExec > 0 ? "Média do aluno: 8.625" : "",
          cursor: { line: 3, ch: 4 },
          linhasCodigo: code.split("\n").length,
          tempoTotalEdicao: activeSec,
          historico: [
            { codigo: code, timestamp: new Date().toISOString(), linhas: code.split("\n").length, caracteres: code.length },
            { codigo: code.split("\n").slice(0, 3).join("\n"), timestamp: new Date(Date.now() - 60000).toISOString(), fontLinhas: 3, caracteres: 50 } as any
          ]
        };
      });
      setAllProgress(mockProgress);
    } else {
      setAllProgress([]);
    }
  }, [selectedClassId, students, classes]);

  // Set up polling to check student status updates in real-time (Only if not using Firestore)
  useEffect(() => {
    if (isRealFirebaseActive()) return;
    const interval = setInterval(() => {
      refreshData(true);
    }, 2500); // Poll server every 2.5 seconds
    return () => clearInterval(interval);
  }, [selectedClassId]);

  const fetchInitialData = () => {
    setIsRefreshing(true);
    Promise.all([
      fetch("/api/classes").then(res => res.json()),
      fetch("/api/exercises").then(res => res.json()),
      fetch("/api/logs").then(res => res.json())
    ])
      .then(([classesData, exercisesData, logsData]) => {
        setClasses(classesData);
        setExercises(exercisesData);
        setLogs(logsData);
        if (classesData.length > 0 && !selectedClassId) {
          setSelectedClassId(classesData[0].id);
        }
      })
      .catch(err => console.error("Error loading initial database:", err))
      .finally(() => setIsRefreshing(false));
  };

  const fetchStudents = (classId: string) => {
    fetch(`/api/classes/${classId}/students`)
      .then(res => res.json())
      .then(data => setStudents(data))
      .catch(err => console.error("Error loading students:", err));
  };

  const refreshData = (isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);
    
    // Fetch logs & active class state
    Promise.all([
      fetch("/api/classes").then(res => res.json()),
      fetch("/api/logs").then(res => res.json())
    ])
      .then(([classesData, logsData]) => {
        setClasses(classesData);
        setLogs(logsData);
        if (selectedClassId) {
          fetch(`/api/classes/${selectedClassId}/students`)
            .then(res => res.json())
            .then(studentData => setStudents(studentData));
        }
      })
      .catch(err => console.error("Error polling statuses:", err))
      .finally(() => {
        if (!isBackground) setIsRefreshing(false);
      });
  };

  // Assign exercise to active class
  const handleAssignExercise = () => {
    if (!selectedClassId) return;

    
    
    fetch(`/api/classes/${selectedClassId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId: selectedAssignExerciseId })
    })
      .then(res => res.json())
      .then(() => {
        setShowAssignModal(false);
        refreshData(false);
        if (onForceStatusUpdate) {
          onForceStatusUpdate();
        }
      })
      .catch(err => console.error("Error assigning exercise:", err));
  };

  // Submit new Class
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName || !newClassRoom) return;

    

    fetch("/api/classes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClassName, room: newClassRoom })
    })
      .then(res => res.json())
      .then((newClass) => {
        setNewClassName("");
        setNewClassRoom("");
        setShowNewClassModal(false);
        fetchInitialData();
        setSelectedClassId(newClass.id);
      })
      .catch(err => console.error("Error creating class:", err));
  };

  // Submit new Exercise
  const handleCreateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExerciseTitle || !newExerciseDesc) return;

    

    fetch("/api/exercises/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newExerciseTitle,
        module: newExerciseModule,
        description: newExerciseDesc,
        difficulty: newExerciseDiff,
        estimatedTime: newExerciseTime
      })
    })
      .then(res => res.json())
      .then(() => {
        setNewExerciseTitle("");
        setNewExerciseDesc("");
        setShowNewExerciseModal(false);
        fetchInitialData();
      })
      .catch(err => console.error("Error creating exercise:", err));
  };

  // Submit new Student
  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !selectedClassId) return;

    

    fetch(`/api/classes/${selectedClassId}/students/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newStudentName })
    })
      .then(res => res.json())
      .then(() => {
        setNewStudentName("");
        setShowNewStudentModal(false);
        fetchStudents(selectedClassId);
      })
      .catch(err => console.error("Error creating student:", err));
  };

  // Open grading modal
  const openGradingModal = (student: Student) => {
    setActiveGradingStudent(student);
    setGradeInput(student.grade !== null ? student.grade.toString() : "");
    setNotesInput(student.notes || "");
    setShowGradingModal(true);
  };

  // Save grade and remarks notes
  const handleSaveGrading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGradingStudent) return;

    

    fetch(`/api/students/${activeGradingStudent.id}/grade-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grade: gradeInput,
        notes: notesInput
      })
    })
      .then(res => res.json())
      .then(() => {
        setShowGradingModal(false);
        setActiveGradingStudent(null);
        fetchStudents(selectedClassId);
      })
      .catch(err => console.error("Error saving grading remarks:", err));
  };

  // CSV Generator downloader
  const downloadCSVReport = () => {
    if (!selectedClassId) return;
    const activeClass = classes.find(c => c.id === selectedClassId);
    if (!activeClass) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID Aluno,Nome,Turma,Status,Progresso (%),Avaliacao de Competencia,Observacoes do Professor\n";

    students.forEach((s) => {
      const row = [
        s.id,
        `"${s.name}"`,
        `"${activeClass.name}"`,
        s.status,
        s.progress,
        s.grade !== null ? s.grade : "Sem nota",
        `"${s.notes || ""}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_codetracker_${selectedClassId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger browser Print window
  const triggerPrint = () => {
    window.print();
  };

  // Helper selectors
  const activeClass = classes.find(c => c.id === selectedClassId);
  const activeExercise = exercises.find(e => e.id === activeClass?.activeExerciseId);

  // Filter students
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.id.includes(studentSearch)
  );

  // Status Counters
  const codingCount = students.filter(s => s.status === "CODING").length;
  const helpCount = students.filter(s => s.status === "HELP").length;
  const completedCount = students.filter(s => s.status === "COMPLETED").length;
  const pausedCount = students.filter(s => s.status === "PAUSED").length;
  const idleCount = students.filter(s => s.status === "IDLE").length;

  // Real-time Python Editor statistics and counters
  const onlineProgressCount = allProgress.filter(p => p.statusAluno !== "Offline").length;
  const executingProgressCount = allProgress.filter(p => p.statusAluno === "Executando").length;
  const errorCount = allProgress.filter(p => p.codigo?.toLowerCase().includes("error") || p.ultimaExecucao?.toLowerCase().includes("error") || p.statusAluno === "Inativo" && p.ultimaExecucao).length + students.filter(s => s.status === "HELP").length;
  
  const progressWithCode = allProgress.filter(p => p.codigo && p.codigo.trim().length > 0);
  const avgLines = progressWithCode.length > 0 
    ? Math.round(progressWithCode.reduce((acc, curr) => acc + (curr.linhasCodigo || 0), 0) / progressWithCode.length) 
    : 0;

  const avgTimeSeconds = allProgress.length > 0
    ? Math.round(allProgress.reduce((acc, curr) => acc + (curr.tempoTotalEdicao || 0), 0) / allProgress.length)
    : 0;
  const avgTimeMinutes = Math.round(avgTimeSeconds / 60);

  const lastActiveProgress = [...allProgress].sort((a, b) => new Date(b.ultimaAtualizacao).getTime() - new Date(a.ultimaAtualizacao).getTime())[0];
  const lastActiveStudentName = lastActiveProgress ? lastActiveProgress.studentName : "Nenhum";

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      
      {/* Sidebar navigation */}
      <aside className="w-full lg:w-56 bg-white border-r border-slate-200 py-4 px-3 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="bg-brand-primary text-white p-1.5 rounded-md shadow-sm">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-brand-primary leading-tight tracking-tight">CodeTracker ETE</h1>
            <p className="text-slate-400 text-[10px] font-semibold">Acompanhamento Real-Time</p>
          </div>
        </div>

        {/* Quick action: launch a new exercise session */}
        <button
          onClick={() => {
            if (exercises.length > 0) {
              setSelectedAssignExerciseId(exercises[0].id);
            }
            setShowAssignModal(true);
          }}
          className="w-full bg-brand-primary hover:bg-brand-primary/95 text-white rounded-md py-2 px-3 flex items-center justify-center gap-1.5 mb-4 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="font-bold text-xs">Novo Lab Prático</span>
        </button>

        {/* Navigation lists */}
        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-slate-100 text-brand-primary"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Dashboard Lab</span>
          </button>
          
          <button
            onClick={() => setActiveTab("classes")}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
              activeTab === "classes"
                ? "bg-slate-100 text-brand-primary"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Gestão de Turmas</span>
          </button>

          <button
            onClick={() => setActiveTab("exercises")}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
              activeTab === "exercises"
                ? "bg-slate-100 text-brand-primary"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Exercícios Cadastrados</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
              activeTab === "reports"
                ? "bg-slate-100 text-brand-primary"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Relatórios / Notas</span>
          </button>
        </nav>

        {/* Real-time pulse indicator on sidebar footer */}
        <div className="pt-3 border-t border-slate-100 mt-auto">
          <div className="bg-slate-50 rounded-md p-2 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="text-[10px] font-bold text-slate-700">Canal Real-Time</span>
            </div>
            <span className="text-[9px] font-mono font-bold text-slate-400">Ativo</span>
          </div>
        </div>
      </aside>

      {/* Main dashboard content area */}
      <main className="flex-1 bg-brand-bg p-3 md:p-4 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto space-y-4">
          
          {/* Top controller header layout */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/50 pb-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">
                <span>Painel do Professor</span>
                <span>•</span>
                <span>ETE Pedro Leão Leal</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                {activeTab === "dashboard" && "Acompanhamento em Tempo Real"}
                {activeTab === "classes" && "Gestão de Turmas e Alunos"}
                {activeTab === "exercises" && "Banco de Exercícios"}
                {activeTab === "reports" && "Relatório Analítico de Aprendizagem"}
              </h2>
            </div>

            {/* Global class selector filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="class-filter" className="text-xs text-slate-500 font-bold shrink-0">Turma Ativa:</label>
              <select
                id="class-filter"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-700 font-bold focus:outline-none focus:border-brand-primary cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ==================== TAB 1: REAL-TIME MONITORING DASHBOARD ==================== */}
          {activeTab === "dashboard" && (
            <div className="space-y-4">
              
              {/* Dynamic counters status cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Alunos Ativos</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-blue-600">{onlineProgressCount}</span>
                    <span className="text-[10px] text-slate-400 font-bold">/ {students.length}</span>
                  </div>
                </div>

                <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-8 h-8 bg-orange-500/5 rounded-full blur-sm" />
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
                    Dúvida/Ajuda
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-orange-600">{helpCount}</span>
                    <span className="text-[10px] text-orange-500/80 font-bold font-mono">bancada</span>
                  </div>
                </div>

                <div className="bg-emerald-50/20 border border-emerald-100 rounded-lg p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">Concluíram</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-emerald-600">{completedCount}</span>
                    <span className="text-[10px] text-emerald-600/80 font-bold font-mono">prontos</span>
                  </div>
                </div>

                <div className="bg-blue-50/20 border border-blue-100 rounded-lg p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-0.5">Executando</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-indigo-600">{executingProgressCount}</span>
                    <span className="text-[10px] text-indigo-600/80 font-bold font-mono">em run</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Média Linhas</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-slate-700">{avgLines}</span>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">linhas</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between text-white">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Último Ativo</span>
                  <div className="truncate text-xs font-bold text-emerald-400 font-mono" title={lastActiveStudentName}>
                    {lastActiveStudentName}
                  </div>
                  <div className="text-[9px] text-slate-400 font-semibold font-mono">
                    Tempo Médio: {avgTimeMinutes} min
                  </div>
                </div>
              </div>

              {/* Lab session status block */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-3.5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-secondary">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>EXERCÍCIO CORRENTE EM EXECUÇÃO</span>
                  </div>
                  {activeExercise ? (
                    <div>
                      <h3 className="text-base font-bold text-slate-800">{activeExercise.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-2xl line-clamp-1">{activeExercise.description}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Nenhum exercício ativo no momento. Clique em Novo Lab Prático para começar.</p>
                  )}
                </div>

                {activeExercise && (
                  <div className="relative shrink-0 select-none">
                    {!showEndSessionConfirm ? (
                      <button
                        onClick={() => setShowEndSessionConfirm(true)}
                        className="px-2.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold rounded-md text-[11px] transition-colors cursor-pointer"
                      >
                        Encerrar Sessão
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 p-1 bg-red-50 border border-red-200 rounded-md animate-in fade-in zoom-in-95 duration-150">
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-700 px-1">Encerrar?</span>
                        <button
                          onClick={() => {
                            setShowEndSessionConfirm(false);
                            fetch(`/api/classes/${selectedClassId}/assign`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ exerciseId: null })
                            }).then(() => refreshData(false));
                          }}
                          className="px-2 py-1 bg-red-650 hover:bg-red-700 text-white text-[10px] font-black rounded transition-colors cursor-pointer"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setShowEndSessionConfirm(false)}
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-black rounded transition-all cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Grid of students card & Sidebar activity logs split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                
                {/* Student monitor grid */}
                <div className="xl:col-span-8 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Painel de Alunos ({filteredStudents.length})</h3>
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="Buscar aluno..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-md py-1.5 pl-8 pr-3 text-[11px] focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  {filteredStudents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredStudents.map((s) => {
                        const progress = allProgress.find(p => p.studentId === s.id && p.exerciseId === activeClass?.activeExerciseId);
                        
                        // Determine card borders and glow based on real-time activity
                        let borderStyle = "border-slate-200 hover:border-slate-300";
                        if (s.status === "HELP" || progress?.statusAluno === "Inativo" && s.status === "HELP") {
                          borderStyle = "border-orange-300 shadow-[0_2px_8px_rgba(234,88,12,0.06)] bg-orange-50/10 animate-pulse-ring";
                        } else if (progress?.statusAluno === "Executando") {
                          borderStyle = "border-indigo-400 shadow-[0_2px_8px_rgba(79,70,229,0.06)] bg-indigo-50/5";
                        } else if (progress?.statusAluno === "Digitando") {
                          borderStyle = "border-blue-300 bg-blue-50/5";
                        } else if (s.status === "COMPLETED" || progress?.statusAluno === "Concluído") {
                          borderStyle = "border-emerald-200 bg-emerald-50/5 hover:border-emerald-300";
                        }

                        return (
                          <div 
                            key={s.id}
                            className={`bg-white border rounded-lg p-3 transition-all duration-200 relative overflow-hidden group ${borderStyle}`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  s.status === "HELP" ? "bg-orange-500 text-white" :
                                  progress?.statusAluno === "Executando" ? "bg-indigo-600 text-white" :
                                  progress?.statusAluno === "Digitando" ? "bg-blue-500 text-white" :
                                  s.status === "COMPLETED" || progress?.statusAluno === "Concluído" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"
                                }`}>
                                  {s.avatar}
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-800 text-xs">{s.name}</h4>
                                  <span className="text-[9px] text-slate-400 font-mono">#{s.id}</span>
                                </div>
                              </div>

                              {/* Glowing badges */}
                              <div className="flex flex-col items-end gap-1">
                                {s.status === "HELP" && (
                                  <span className="bg-orange-500 text-white text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-mono shrink-0">
                                    <HelpCircle className="w-3 h-3 shrink-0" /> DÚVIDA
                                  </span>
                                )}
                                {progress?.statusAluno === "Executando" && (
                                  <span className="bg-indigo-600 text-white text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-mono shrink-0 animate-pulse">
                                    <Terminal className="w-3 h-3 shrink-0" /> RUNNING
                                  </span>
                                )}
                                {progress?.statusAluno === "Digitando" && (
                                  <span className="bg-blue-500 text-white text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-mono shrink-0">
                                    <Play className="w-3 h-3 shrink-0 fill-current" /> DIGITANDO
                                  </span>
                                )}
                                {progress?.statusAluno === "Concluído" && (
                                  <span className="bg-emerald-500 text-white text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-mono shrink-0">
                                    <CheckCircle className="w-3 h-3 shrink-0" /> CONCLUÍDO
                                  </span>
                                )}
                                {!progress && s.status === "IDLE" && (
                                  <span className="bg-slate-100 text-slate-400 text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm font-mono shrink-0">
                                    INATIVO
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Estimated Progress Bar */}
                            <div className="space-y-1 mb-2">
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span className="font-semibold">Progresso Geral</span>
                                <span className="font-mono font-bold text-slate-600">{s.progress}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-sm overflow-hidden">
                                <div 
                                  className={`h-full rounded-sm transition-all duration-500 ${
                                    s.status === "HELP" ? "bg-orange-500" :
                                    s.status === "COMPLETED" ? "bg-emerald-500" :
                                    s.status === "CODING" ? "bg-blue-500" : "bg-slate-300"
                                  }`}
                                  style={{ width: `${s.progress}%` }}
                                />
                              </div>
                            </div>

                            {/* Real-time Python Code Stats Box */}
                            {progress ? (
                              <div className="mt-2 space-y-1.5 mb-2.5">
                                <div className="flex justify-between items-center text-[9px] font-semibold text-slate-400 font-mono">
                                  <span>📝 {progress.linhasCodigo || 0} linhas • {progress.codigo?.length || 0} caracteres</span>
                                  <span>⚡ {progress.quantidadeExecucoes || 0} execuções</span>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 rounded p-1.5 font-mono text-[9px] text-emerald-400 h-14 overflow-hidden relative select-none">
                                  <div className="absolute right-1 top-1 text-[7px] text-slate-600 bg-slate-950 px-1 rounded font-mono">Python Live</div>
                                  <pre className="whitespace-pre overflow-x-hidden leading-tight select-none opacity-85">{progress.codigo || "# Sem código salvo"}</pre>
                                </div>
                                {progress.ultimaExecucao && (
                                  <div className="text-[8.5px] bg-slate-50 text-slate-600 font-mono px-1.5 py-0.5 rounded truncate border border-slate-150">
                                    <strong className="text-slate-500 font-sans">Output:</strong> {progress.ultimaExecucao}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 mb-2.5 bg-slate-50 border border-slate-150 rounded p-3 text-center">
                                <p className="text-[10px] font-semibold text-slate-400 italic">Sem código enviado ainda</p>
                              </div>
                            )}

                            {/* Cards Footer Actions */}
                            <div className="flex justify-between items-center pt-2 border-t border-slate-150">
                              <button
                                onClick={() => {
                                  setSelectedProgressStudent(s);
                                  setViewingProgress(progress || null);
                                  setSelectedHistoryVersionIndex(-1); // Reset version view
                                }}
                                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                title="Visualizar editor, console e versões de código em tempo real"
                              >
                                <Terminal className="w-3 h-3" />
                                <span>Acompanhar Código</span>
                              </button>

                              <button
                                onClick={() => openGradingModal(s)}
                                className="text-brand-primary hover:text-brand-primary/80 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Avaliar / Notas</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs">
                      Nenhum aluno cadastrado nesta turma ou correspondente à busca.
                    </div>
                  )}
                </div>

                {/* Status Activity Log Widget */}
                <aside className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Histórico de Atividade</h3>
                    <span className="text-[9px] font-mono font-bold text-slate-400">Live feed</span>
                  </div>

                  <div className="overflow-y-auto max-h-[320px] pr-1 space-y-3 divide-y divide-slate-100 scrollbar-thin">
                    {logs.length > 0 ? (
                      logs.map((log, i) => {
                        return (
                          <div key={log.id} className={`pt-2 text-[11px] ${i === 0 ? "pt-0" : ""}`}>
                            <div className="flex justify-between items-start gap-1 mb-0.5">
                              <span className="font-bold text-slate-700">{log.studentName}</span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-500">
                              Mudou de status para:{" "}
                              <span className={`font-bold px-1 py-0.2 rounded-sm font-mono text-[10px] ${
                                log.newStatus === "HELP" ? "bg-orange-50 text-orange-600" :
                                log.newStatus === "COMPLETED" ? "bg-emerald-50 text-emerald-600" :
                                log.newStatus === "CODING" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                              }`}>
                                {log.newStatus}
                              </span>
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-8">
                        Nenhuma atividade registrada na sessão. Os status aparecerão aqui em tempo real conforme os alunos interagirem.
                      </p>
                    )}
                  </div>
                </aside>

              </div>
            </div>
          )}

          {/* ==================== TAB 2: CLASSES & STUDENTS MANAGEMENT ==================== */}
          {activeTab === "classes" && (
            <div className="space-y-4">
              
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Gestão de Turmas ({classes.length})</h3>
                <button
                  onClick={() => setShowNewClassModal(true)}
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold py-1.5 px-3 rounded-md flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Turma</span>
                </button>
              </div>

              {/* Grid of existing classes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {classes.map(c => {
                  return (
                    <div 
                      key={c.id} 
                      className={`bg-white border rounded-lg p-3.5 shadow-sm space-y-3 relative overflow-hidden transition-all duration-200 cursor-pointer ${
                        selectedClassId === c.id ? "border-brand-primary ring-1 ring-brand-primary/10" : "border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => setSelectedClassId(c.id)}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">{c.name}</h4>
                          <span className="text-[9px] font-mono bg-blue-50 text-brand-primary px-1 py-0.5 rounded-sm uppercase font-bold shrink-0">
                            {c.id}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">Sala: {c.room}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                        <span>Gerenciar Alunos</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* List of students in the selected class */}
              {activeClass && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">Alunos cadastrados em: {activeClass.name}</h3>
                      <p className="text-slate-400 text-xs mt-0.5">Gerencie os alunos participantes desta turma</p>
                    </div>
                    <button
                      onClick={() => setShowNewStudentModal(true)}
                      className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold py-1.5 px-3 rounded-md flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Adicionar Aluno</span>
                    </button>
                  </div>

                  {students.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {students.map((std, i) => (
                        <div key={std.id} className="py-2.5 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                              {std.avatar}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 text-xs">{std.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono block">ID Aluno: #{std.id}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {/* Option to grade */}
                            <button
                              onClick={() => openGradingModal(std)}
                              className="text-xs font-bold text-brand-primary hover:underline cursor-pointer"
                            >
                              Notas & Remarks
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic text-center py-6">Nenhum aluno cadastrado nesta turma ainda.</p>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ==================== TAB 3: EXERCISES BANCO MANAGER ==================== */}
          {activeTab === "exercises" && (
            <div className="space-y-4">
              
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Banco de Exercícios ({exercises.length})</h3>
                <button
                  onClick={() => setShowNewExerciseModal(true)}
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold py-1.5 px-3 rounded-md flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Exercício</span>
                </button>
              </div>

              {/* Grid of registered exercises */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exercises.map((ex) => (
                  <div key={ex.id} className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-brand-secondary font-mono bg-slate-50 px-1.5 py-0.5 rounded-sm">
                            {ex.module}
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm mt-0.5">{ex.title}</h4>
                        </div>
                        <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm shrink-0 ${
                          ex.difficulty === "EASY" ? "bg-emerald-50 text-emerald-700" :
                          ex.difficulty === "MEDIUM" ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700"
                        }`}>
                          {ex.difficulty}
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-md p-2.5 border border-slate-200">
                        <p className="font-mono text-[11px] text-slate-600 line-clamp-4 whitespace-pre-wrap leading-relaxed">{ex.description}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Est: {ex.estimatedTime} min
                      </span>
                      <span className="font-bold text-slate-400">ID: {ex.id}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ==================== TAB 4: ANALYTICAL LEARNING REPORTS ==================== */}
          {activeTab === "reports" && (
            <div className="space-y-4">
              
              {/* Reports page top card dashboard and export buttons */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Exportar Dados Técnicos</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Gere arquivos ou imprima relatórios consolidados desta turma</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={downloadCSVReport}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar CSV</span>
                  </button>

                  <button
                    onClick={triggerPrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-md font-bold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Relatório</span>
                  </button>
                </div>
              </div>

              {/* Detailed Grades Table Card */}
              {activeClass && (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-150 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono">
                      Tabela de Desempenho Individual: {activeClass.name}
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="px-4 py-2">Aluno</th>
                          <th className="px-4 py-2">Último Status</th>
                          <th className="px-4 py-2">Progresso (%)</th>
                          <th className="px-4 py-2">Avaliação / Nota</th>
                          <th className="px-4 py-2">Observações do Professor</th>
                          <th className="px-4 py-2 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {students.length > 0 ? (
                          students.map((std) => (
                            <tr key={std.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                  <div className="w-6 h-6 rounded-md bg-blue-50 text-brand-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {std.avatar}
                                  </div>
                                  <div>
                                    <span>{std.name}</span>
                                    <span className="text-[9px] text-slate-400 font-mono block">#{std.id}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                                  std.status === "HELP" ? "bg-orange-50 text-orange-600" :
                                  std.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" :
                                  std.status === "CODING" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {std.status}
                                </span>
                              </td>

                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-12 bg-slate-100 h-1.5 rounded-sm overflow-hidden shrink-0">
                                    <div className="h-full bg-brand-primary rounded-sm" style={{ width: `${std.progress}%` }} />
                                  </div>
                                  <span className="font-mono text-[10px] text-slate-500">{std.progress}%</span>
                                </div>
                              </td>

                              <td className="px-4 py-2.5">
                                {std.grade !== null ? (
                                  <span className="font-bold text-brand-primary bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm text-[10px] font-mono">
                                    {std.grade} / 100
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Pendente</span>
                                )}
                              </td>

                              <td className="px-4 py-2.5 max-w-xs">
                                <p className="text-[11px] text-slate-500 truncate" title={std.notes || "Sem observações"}>
                                  {std.notes || <span className="text-slate-300 italic">Nenhuma observação...</span>}
                                </p>
                              </td>

                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => openGradingModal(std)}
                                  className="text-xs font-bold text-brand-primary hover:underline cursor-pointer"
                                >
                                  Avaliar
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-xs italic">
                              Nenhum aluno cadastrado nesta turma.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* ==================== MODAL 1: ATIVAR/LANÇAR EXERCÍCIO (NOVO LAB) ==================== */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full border border-slate-200 overflow-hidden shadow-xl space-y-4 p-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Lançar Novo Exercício</h3>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="exercise-assign" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Escolha o Exercício Prático
                </label>
                <select
                  id="exercise-assign"
                  value={selectedAssignExerciseId}
                  onChange={(e) => setSelectedAssignExerciseId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 pl-3 pr-8 text-slate-800 text-xs focus:outline-none focus:border-brand-primary"
                >
                  {exercises.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.module})
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-100 italic">
                Atenção: Ao lançar este exercício, todos os alunos da turma <strong>{activeClass?.name}</strong> serão redefinidos para o status de "Aguardando" e verão a nova instrução no Painel do Aluno em tempo real.
              </p>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-md text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignExercise}
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Confirmar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: CRIAR NOVA TURMA ==================== */}
      {showNewClassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateClass} className="bg-white rounded-lg max-w-xs w-full border border-slate-200 overflow-hidden shadow-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Criar Nova Turma</h3>
              <button 
                type="button"
                onClick={() => setShowNewClassModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="new-class-name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nome da Turma
                </label>
                <input
                  id="new-class-name"
                  type="text"
                  placeholder="Ex: 3º Ano A - Informática"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>

              <div>
                <label htmlFor="new-class-room" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Sala / Laboratório
                </label>
                <input
                  id="new-class-room"
                  type="text"
                  placeholder="Ex: Laboratório 102"
                  value={newClassRoom}
                  onChange={(e) => setNewClassRoom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewClassModal(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-md text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Criar Turma
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL 3: CADASTRAR EXERCÍCIO ==================== */}
      {showNewExerciseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateExercise} className="bg-white rounded-lg max-w-sm w-full border border-slate-200 overflow-hidden shadow-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Cadastrar Novo Exercício</h3>
              <button 
                type="button"
                onClick={() => setShowNewExerciseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              <div>
                <label htmlFor="ex-title" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Título do Exercício
                </label>
                <input
                  id="ex-title"
                  type="text"
                  placeholder="Ex: 05. Validação de Senha Forte"
                  value={newExerciseTitle}
                  onChange={(e) => setNewExerciseTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>

              <div>
                <label htmlFor="ex-module" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Unidade Curricular / Módulo
                </label>
                <input
                  id="ex-module"
                  type="text"
                  placeholder="Ex: Estruturas de Repetição"
                  value={newExerciseModule}
                  onChange={(e) => setNewExerciseModule(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ex-diff" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Dificuldade
                  </label>
                  <select
                    id="ex-diff"
                    value={newExerciseDiff}
                    onChange={(e) => setNewExerciseDiff(e.target.value as "EASY" | "MEDIUM" | "HARD")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs focus:outline-none focus:border-brand-primary"
                  >
                    <option value="EASY">Fácil</option>
                    <option value="MEDIUM">Médio</option>
                    <option value="HARD">Difícil</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ex-time" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tempo Estimado (min)
                  </label>
                  <input
                    id="ex-time"
                    type="number"
                    value={newExerciseTime}
                    onChange={(e) => setNewExerciseTime(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs focus:outline-none focus:border-brand-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ex-desc" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Descrição da Atividade
                </label>
                <textarea
                  id="ex-desc"
                  rows={3}
                  placeholder="Crie um algoritmo que leia uma senha do usuário..."
                  value={newExerciseDesc}
                  onChange={(e) => setNewExerciseDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary font-mono"
                  required
                />
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewExerciseModal(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-md text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Cadastrar Atividade
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL 4: ADICIONAR ALUNO À TURMA ==================== */}
      {showNewStudentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateStudent} className="bg-white rounded-lg max-w-xs w-full border border-slate-200 overflow-hidden shadow-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Adicionar Aluno</h3>
              <button 
                type="button"
                onClick={() => setShowNewStudentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Cadastre um novo aluno diretamente na turma: <strong>{activeClass?.name}</strong>
              </p>

              <div>
                <label htmlFor="new-std-name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nome Completo do Aluno
                </label>
                <input
                  id="new-std-name"
                  type="text"
                  placeholder="Ex: Roberta Mendes"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewStudentModal(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-md text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Matricular Aluno
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL 5: AVALIAR ALUNO (GRADE & REMARKS) ==================== */}
      {showGradingModal && activeGradingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveGrading} className="bg-white rounded-lg max-w-xs w-full border border-slate-200 overflow-hidden shadow-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Avaliação: {activeGradingStudent.name}</h3>
              <button 
                type="button"
                onClick={() => {
                  setShowGradingModal(false);
                  setActiveGradingStudent(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="grade-eval" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nota / Desempenho (0 a 100)
                </label>
                <input
                  id="grade-eval"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ex: 85"
                  value={gradeInput}
                  onChange={(e) => setGradeInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div>
                <label htmlFor="notes-eval" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Observações / Remarks do Professor
                </label>
                <textarea
                  id="notes-eval"
                  rows={3}
                  placeholder="Ex: Ótima indentação. Código finalizado rapidamente."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGradingModal(false);
                  setActiveGradingStudent(null);
                }}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-md text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Salvar Avaliação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL 6: ACOMPANHAR CÓDIGO DO ALUNO EM TEMPO REAL ==================== */}
      {selectedProgressStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 md:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-4xl w-full border border-slate-200 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header com Status do Aluno e Infos Gerais */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                  viewingProgress?.statusAluno === "Concluído" ? "bg-emerald-500 text-white" :
                  viewingProgress?.statusAluno === "Executando" ? "bg-indigo-600 text-white" :
                  viewingProgress?.statusAluno === "Digitando" ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {selectedProgressStudent.avatar}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    Rastreador de Código: {selectedProgressStudent.name}
                    {viewingProgress?.statusAluno === "Executando" && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                    )}
                    {viewingProgress?.statusAluno === "Digitando" && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono font-bold">
                    <span>ID: #{selectedProgressStudent.id}</span>
                    <span>•</span>
                    <span className="text-slate-500">Turma: {classes.find(c => c.id === selectedClassId)?.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {viewingProgress && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-mono text-slate-600">
                    <span className="font-sans font-bold">Status:</span>
                    <span className={`font-bold ${
                      viewingProgress.statusAluno === "Concluído" ? "text-emerald-600" :
                      viewingProgress.statusAluno === "Executando" ? "text-indigo-600" :
                      viewingProgress.statusAluno === "Digitando" ? "text-blue-600" : "text-slate-500"
                    }`}>
                      {viewingProgress.statusAluno}
                    </span>
                  </div>
                )}
                <button 
                  onClick={() => {
                    setSelectedProgressStudent(null);
                    setViewingProgress(null);
                    setSelectedHistoryVersionIndex(-1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-[11px] transition-colors cursor-pointer"
                >
                  Fechar Painel
                </button>
              </div>
            </div>

            {/* Corpo do Modal */}
            {!viewingProgress ? (
              <div className="p-8 text-center space-y-2 flex-1 flex flex-col justify-center items-center">
                <HelpCircle className="w-12 h-12 text-slate-300 animate-bounce" />
                <h4 className="font-bold text-slate-700 text-sm">Sem Conectividade de Progresso</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  O aluno ainda não abriu o editor Python para esta atividade ou as informações do laboratório estão carregando.
                </p>
              </div>
            ) : (
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                
                {/* Métricas e KPIs Rápidas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/60 rounded-lg p-3">
                  <div className="text-center sm:text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Última Escrita</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">
                      {new Date(selectedHistoryVersionIndex === -1 ? viewingProgress.ultimaAtualizacao : viewingProgress.historico[selectedHistoryVersionIndex]?.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-center sm:text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Execuções de Teste</span>
                    <span className="text-xs font-bold text-indigo-600 font-mono">
                      {viewingProgress.quantidadeExecucoes || 0} runs
                    </span>
                  </div>
                  <div className="text-center sm:text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Linhas de Código</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">
                      {selectedHistoryVersionIndex === -1 ? viewingProgress.linhasCodigo : (viewingProgress.historico[selectedHistoryVersionIndex]?.linhas || 0)} linhas
                    </span>
                  </div>
                  <div className="text-center sm:text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tempo de Edição</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">
                      {Math.round((viewingProgress.tempoTotalEdicao || 0) / 60)} min / {(viewingProgress.tempoTotalEdicao || 0)}s
                    </span>
                  </div>
                </div>

                {/* Grid Split Principal */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  
                  {/* Lado Esquerdo: Código do Aluno (Destaque do Editor) */}
                  <div className="lg:col-span-8 flex flex-col space-y-1.5 font-mono">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <span>💻 Visualização do Código (Somente Leitura)</span>
                      {selectedHistoryVersionIndex === -1 ? (
                        <span className="text-emerald-500 animate-pulse">● Live Stream Ativo</span>
                      ) : (
                        <span className="text-indigo-500">Histórico: Versão #{selectedHistoryVersionIndex + 1}</span>
                      )}
                    </div>
                    
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-100 overflow-auto max-h-[380px] h-[340px] shadow-inner relative leading-relaxed">
                      {/* Tabs Mock bar */}
                      <div className="sticky top-0 right-0 left-0 bg-slate-900 border-b border-slate-800 px-2 py-1 text-[10px] text-slate-500 font-sans flex justify-between items-center z-10 select-none">
                        <span className="font-semibold text-emerald-400">main.py</span>
                        <span>Python 3 (Pyodide)</span>
                      </div>
                      <div className="flex pt-3 select-text">
                        {/* Line Numbers */}
                        <div className="text-slate-600 text-right pr-3 select-none border-r border-slate-800/80 w-8 flex-shrink-0 text-[11px] font-semibold font-mono">
                          {(selectedHistoryVersionIndex === -1 ? viewingProgress.codigo : viewingProgress.historico[selectedHistoryVersionIndex]?.codigo).split("\n").map((_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                        {/* Highlights */}
                        <pre className="pl-3 overflow-x-auto text-[11px] text-emerald-300 w-full whitespace-pre">
                          {highlightPython(selectedHistoryVersionIndex === -1 ? viewingProgress.codigo : viewingProgress.historico[selectedHistoryVersionIndex]?.codigo)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Histórico de Linha do Tempo e Console */}
                  <div className="lg:col-span-4 flex flex-col space-y-3.5">
                    
                    {/* Linha do Tempo / Histórico de Versões */}
                    <div className="space-y-1.5 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Linha do Tempo de Versões ({1 + (viewingProgress.historico?.length || 0)})
                      </span>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 max-h-[160px] overflow-y-auto space-y-1">
                        <button
                          onClick={() => setSelectedHistoryVersionIndex(-1)}
                          className={`w-full text-left p-1.5 rounded border text-[10px] transition-all font-mono cursor-pointer flex justify-between items-center ${
                            selectedHistoryVersionIndex === -1 
                              ? "bg-indigo-600 text-white border-indigo-600 font-bold" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span>✨ Código Atual (Live)</span>
                          <span className="text-[8px] opacity-80">{new Date(viewingProgress.ultimaAtualizacao).toLocaleTimeString()}</span>
                        </button>
                        {viewingProgress.historico && viewingProgress.historico.map((h, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedHistoryVersionIndex(idx)}
                            className={`w-full text-left p-1.5 rounded border text-[10px] transition-all font-mono cursor-pointer flex justify-between items-center ${
                              selectedHistoryVersionIndex === idx 
                                ? "bg-indigo-600 text-white border-indigo-600 font-bold" 
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <span>📁 Versão #{idx + 1}</span>
                            <span className="text-[8px] opacity-80">{new Date(h.timestamp).toLocaleTimeString()}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Console Terminal de Execução */}
                    <div className="space-y-1.5 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Terminal Output (Console)
                      </span>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 font-mono text-[10px] text-emerald-400 h-[145px] overflow-y-auto shadow-inner">
                        {viewingProgress.ultimaExecucao ? (
                          <pre className="whitespace-pre-wrap leading-tight">{viewingProgress.ultimaExecucao}</pre>
                        ) : (
                          <span className="text-slate-500 italic">Nenhum output registrado para esta versão.</span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* Footer de Fechamento do Painel */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2.5 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => {
                  setSelectedProgressStudent(null);
                  setViewingProgress(null);
                  setSelectedHistoryVersionIndex(-1);
                }}
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Concluir Monitoramento
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
