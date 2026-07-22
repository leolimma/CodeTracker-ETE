import React, { useState, useEffect } from "react";
import { 
  Play, 
  HelpCircle, 
  Pause, 
  CheckCircle, 
  Search, 
  LogOut, 
  BookOpen, 
  Terminal, 
  Check, 
  Clock, 
  FolderOpen 
} from "lucide-react";
import { ClassItem, Student, Exercise } from "../types";
import PythonEditor from "./PythonEditor";
import { 
  isRealFirebaseActive, 
  subscribeClasses, 
  subscribeStudents, 
  subscribeExercises, 
  updateStudentStatusFirestore 
} from "../services/firebaseDb";

interface StudentPortalProps {
  onStatusUpdateTrigger?: () => void;
  overrideStudent?: Student | null;
  onLogoutOverride?: () => void;
  firebaseUser?: any;
}

export default function StudentPortal({ onStatusUpdateTrigger, overrideStudent, onLogoutOverride, firebaseUser }: StudentPortalProps) {
  // Login State
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  // Active Session State
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [currentClass, setCurrentClass] = useState<ClassItem | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("Pronto para começar.");
  const [submittingStatus, setSubmittingStatus] = useState<string | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  // 1. Load Classes (Realtime Firestore or Poll)
  useEffect(() => {
    if (isRealFirebaseActive()) {
      const unsubscribe = subscribeClasses((classesList) => {
        setClasses(classesList);
        if (classesList.length > 0 && !selectedClassId) {
          // Find if there's already a class selected, else default to first
          setSelectedClassId((prev) => prev || classesList[0].id);
        }
      });
      return unsubscribe;
    } else {
      fetch("/api/classes")
        .then((res) => res.json())
        .then((data) => {
          setClasses(data);
          if (data.length > 0) {
            setSelectedClassId(data[0].id);
          }
        })
        .catch((err) => console.error("Error loading classes:", err));
    }
  }, []);

  // Sync with override student if provided (useful for side-by-side simulator)
  useEffect(() => {
    if (overrideStudent) {
      setCurrentStudent(overrideStudent);
      setIsLoggedIn(true);
      setSelectedClassId(overrideStudent.classId);
    }
  }, [overrideStudent]);

  // 2. Load Students when selected class changes (Realtime Firestore or Poll)
  useEffect(() => {
    if (!selectedClassId) return;

    if (isRealFirebaseActive()) {
      const unsubscribe = subscribeStudents(selectedClassId, (studentsList) => {
        setStudents(studentsList);
      });

      const cls = classes.find((c) => c.id === selectedClassId);
      if (cls) {
        setCurrentClass(cls);
      }

      return unsubscribe;
    } else {
      fetch(`/api/classes/${selectedClassId}/students`)
        .then((res) => res.json())
        .then((data) => {
          setStudents(data);
          setSelectedStudentId("");
        })
        .catch((err) => console.error("Error loading students:", err));

      const cls = classes.find((c) => c.id === selectedClassId);
      if (cls) {
        setCurrentClass(cls);
      }
    }
  }, [selectedClassId, classes]);

  // 3. Keep current student object in sync with realtime class student subscription changes
  useEffect(() => {
    if (!isLoggedIn || !currentStudent || !isRealFirebaseActive()) return;
    const matched = students.find((s) => s.id === currentStudent.id);
    if (matched) {
      setCurrentStudent(matched);
    }
  }, [students, isLoggedIn, currentStudent?.id]);

  // Auto-login matching firebaseUser email
  useEffect(() => {
    if (overrideStudent) return; // Keep simulation override
    if (!firebaseUser || firebaseUser.role !== "aluno" || isLoggedIn) return;

    const emailToMatch = firebaseUser.email?.toLowerCase().trim();
    if (!emailToMatch) return;

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const attemptAutoLogin = async () => {
      if (isRealFirebaseActive()) {
        const { subscribeAllStudents } = await import("../services/firebaseDb");
        if (!isMounted) return;
        unsubscribe = subscribeAllStudents((allStudents) => {
          if (!isMounted) return;
          const match = allStudents.find((s) => s.email?.toLowerCase().trim() === emailToMatch);
          if (match) {
            setSelectedClassId(match.classId);
            setSelectedStudentId(match.id);
            setCurrentStudent(match);
            setIsLoggedIn(true);
            setStatusMsg(`Status: ${getFriendlyStatus(match.status)}`);
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = null;
            }
          }
        });
      } else {
        try {
          const res = await fetch("/api/students");
          if (res.ok) {
            const allStudents: Student[] = await res.json();
            if (!isMounted) return;
            const match = allStudents.find((s) => s.email?.toLowerCase().trim() === emailToMatch);
            if (match) {
              setSelectedClassId(match.classId);
              setSelectedStudentId(match.id);
              setCurrentStudent(match);
              setIsLoggedIn(true);
              setStatusMsg(`Status: ${getFriendlyStatus(match.status)}`);
            }
          }
        } catch (err) {
          console.error("Error auto-logging student:", err);
        }
      }
    };

    attemptAutoLogin();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [firebaseUser, isLoggedIn, overrideStudent]);

  // 4. Periodically fetch active exercise if logged in to stay synchronized in real-time (Realtime Firestore or Poll)
  useEffect(() => {
    if (!isLoggedIn || !currentStudent) return;

    if (isRealFirebaseActive()) {
      // Subscribe to exercises list once to find the active exercise
      const unsubscribeExercises = subscribeExercises((exercisesList) => {
        setAllExercises(exercisesList);
        // Class is already updated in realtime via classes subscription. Let's find it.
        const cls = classes.find((c) => c.id === currentStudent.classId);
        if (cls) {
          setCurrentClass(cls);
          if (cls.activeExerciseId) {
            const ex = exercisesList.find((e) => e.id === cls.activeExerciseId);
            setActiveExercise(ex || null);
          } else {
            setActiveExercise(null);
          }
        }
      });
      return unsubscribeExercises;
    } else {
      const fetchActiveState = () => {
        fetch("/api/classes")
          .then((res) => res.json())
          .then((allClasses: ClassItem[]) => {
            const cls = allClasses.find((c) => c.id === currentStudent.classId);
            if (cls) {
              setCurrentClass(cls);
              if (cls.activeExerciseId) {
                fetch("/api/exercises")
                  .then((res) => res.json())
                  .then((exercises: Exercise[]) => {
                    setAllExercises(exercises);
                    const ex = exercises.find((e) => e.id === cls.activeExerciseId);
                    setActiveExercise(ex || null);
                  });
              } else {
                setActiveExercise(null);
              }
            }
          });
      };

      fetchActiveState();
      const interval = setInterval(fetchActiveState, 3000); // Poll active state every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, currentStudent, classes]);

  // Handle student login action
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !selectedStudentId) return;

    if (isRealFirebaseActive()) {
      const std = students.find((s) => s.id === selectedStudentId);
      if (std) {
        setCurrentStudent(std);
        setIsLoggedIn(true);
        setStatusMsg(`Status: ${getFriendlyStatus(std.status)}`);
      }
      return;
    }

    fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: selectedClassId, studentId: selectedStudentId })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro de autenticação");
        return res.json();
      })
      .then((student: Student) => {
        setCurrentStudent(student);
        setIsLoggedIn(true);
        setStatusMsg(`Status: ${getFriendlyStatus(student.status)}`);
      })
      .catch((err) => alert(err.message));
  };

  // Log Out student
  const handleLogout = async () => {
    if (onLogoutOverride) {
      onLogoutOverride();
    } else {
      setIsLoggedIn(false);
      setCurrentStudent(null);
      setSelectedStudentId("");
      setSearchTerm("");
      
      try {
        const { logoutFirebase } = {};
        await logoutFirebase();
      } catch (err) {
        console.error("Error signing out during student portal logout:", err);
      }
      window.location.reload();
    }
  };

  // Translate database status to Portuguese friendly text
  const getFriendlyStatus = (status: string) => {
    switch (status) {
      case "CODING": return "Desenvolvendo código";
      case "HELP": return "Solicitou ajuda do professor";
      case "PAUSED": return "Pausado temporariamente";
      case "COMPLETED": return "Finalizou a atividade! 🎉";
      default: return "Pronto para iniciar";
    }
  };

  // Update student status action
  const updateStatus = (newStatus: "CODING" | "HELP" | "PAUSED" | "COMPLETED") => {
    if (!currentStudent) return;
    setSubmittingStatus(newStatus);

    // Calculate simulated progress based on status clicks
    let newProgress = currentStudent.progress;
    if (newStatus === "COMPLETED") {
      newProgress = 100;
    } else if (newStatus === "CODING" && currentStudent.progress === 0) {
      newProgress = 15;
    } else if (newStatus === "CODING" && currentStudent.progress < 90) {
      newProgress = Math.min(90, currentStudent.progress + 15);
    }

    if (isRealFirebaseActive()) {
      updateStudentStatusFirestore(currentStudent, newStatus, newProgress, currentClass?.activeExerciseId || null)
        .then(() => {
          // Setup interactive notification messages
          if (newStatus === "CODING") {
            setStatusMsg("Status Atualizado: Desenvolvendo código do exercício.");
          } else if (newStatus === "HELP") {
            setStatusMsg("Status Atualizado: Chamado de ajuda enviado ao professor. Continue tentando!");
          } else if (newStatus === "PAUSED") {
            setStatusMsg("Status Atualizado: Atividade pausada.");
          } else if (newStatus === "COMPLETED") {
            setStatusMsg("Status Atualizado: Parabéns! Exercício finalizado e enviado para revisão.");
          }

          // Notify parent component (dashboard) to trigger refresh
          if (onStatusUpdateTrigger) {
            onStatusUpdateTrigger();
          }
        })
        .catch((err) => console.error("Error updating status in Firestore:", err))
        .finally(() => setSubmittingStatus(null));
      return;
    }

    fetch("/api/student/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: currentStudent.id,
        status: newStatus,
        progress: newProgress
      })
    })
      .then((res) => res.json())
      .then((updatedStudent: Student) => {
        setCurrentStudent(updatedStudent);
        
        // Setup interactive notification messages
        if (newStatus === "CODING") {
          setStatusMsg("Status Atualizado: Desenvolvendo código do exercício.");
        } else if (newStatus === "HELP") {
          setStatusMsg("Status Atualizado: Chamado de ajuda enviado ao professor. Continue tentando!");
        } else if (newStatus === "PAUSED") {
          setStatusMsg("Status Atualizado: Atividade pausada.");
        } else if (newStatus === "COMPLETED") {
          setStatusMsg("Status Atualizado: Parabéns! Exercício finalizado e enviado para revisão.");
        }

        // Notify parent component (dashboard) to trigger refresh
        if (onStatusUpdateTrigger) {
          onStatusUpdateTrigger();
        }
      })
      .catch((err) => console.error("Error updating status:", err))
      .finally(() => setSubmittingStatus(null));
  };

  // Filter student lists based on search
  const filteredStudents = students.filter(
    (s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm)
  );

  // Render Login Panel
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center p-3 min-h-[440px]">
        {/* Ambient glow behind card */}
        <div className="absolute w-64 h-64 bg-blue-500/5 rounded-full blur-[60px] -z-10 pointer-events-none" />

        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-4 text-center border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="bg-brand-primary p-1.5 rounded-md text-white">
                <Terminal className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg text-brand-primary tracking-tight">CodeTracker ETE</span>
            </div>
            <p className="text-slate-500 text-xs">Selecione sua turma e nome para iniciar no laboratório</p>
          </div>

          <form onSubmit={handleLogin} className="p-4 space-y-4">
            {/* Class Dropdown */}
            <div>
              <label htmlFor="class-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Turma (Class)
              </label>
              <div className="relative">
                <select
                  id="class-select"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 pl-3 pr-8 text-slate-800 text-xs focus:outline-none focus:border-brand-primary cursor-pointer transition-colors"
                >
                  <option value="" disabled>Selecione sua turma...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.room})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student Search and List */}
            <div>
              <label htmlFor="student-search" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Nome do Aluno (Student Name)
              </label>
              <div className="relative mb-1.5">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input
                  id="student-search"
                  type="text"
                  placeholder="Pesquise por nome ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:outline-none focus:border-brand-primary transition-colors"
                />
              </div>

              {/* Student Scrollable Selector Container */}
              <div className="border border-slate-200 rounded-md bg-slate-50 overflow-hidden h-36 flex flex-col">
                <ul className="flex-1 overflow-y-auto p-1 divide-y divide-slate-100">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((s) => {
                      const isSelected = selectedStudentId === s.id;
                      return (
                        <li
                          key={s.id}
                          onClick={() => setSelectedStudentId(s.id)}
                          className={`p-1.5 rounded cursor-pointer flex items-center justify-between group transition-all duration-150 ${
                            isSelected 
                              ? "bg-blue-50/80 border border-blue-200" 
                              : "hover:bg-white border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-colors ${
                              isSelected ? "bg-brand-primary text-white" : "bg-slate-200 text-slate-700"
                            }`}>
                              {s.avatar}
                            </div>
                            <span className={`text-xs transition-colors ${
                              isSelected ? "text-brand-primary font-semibold" : "text-slate-700 group-hover:text-brand-primary"
                            }`}>
                              {s.name}
                            </span>
                          </div>
                          <span className={`font-mono text-[10px] ${
                            isSelected ? "text-brand-primary font-medium" : "text-slate-400"
                          }`}>
                            #{s.id}
                          </span>
                        </li>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      Nenhum aluno encontrado nesta turma.
                    </div>
                  )}
                </ul>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={!selectedStudentId}
              className={`w-full font-bold py-2.5 rounded-md flex items-center justify-center gap-1.5 transition-all text-xs ${
                selectedStudentId 
                  ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer active:scale-[0.99] shadow-md shadow-blue-600/10" 
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              <span>Iniciar Sessão</span>
              <Play className="w-3 h-3 fill-current" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Painel do Aluno (Dashboard Workspace)
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      
      {/* Student Panel Top Status Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-150 text-brand-primary flex items-center justify-center font-bold text-base shadow-sm">
            {currentStudent?.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-slate-800 font-bold text-base">{currentStudent?.name}</h2>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded">
                #{currentStudent?.id}
              </span>
            </div>
            <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              {currentClass?.name} • 🏢 {currentClass?.room}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Progress bar info */}
          <div className="text-right hidden md:block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Progresso Estimado</span>
            <span className="font-mono text-xs font-bold text-slate-700">{currentStudent?.progress}%</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 hover:text-red-600 hover:border-red-100 transition-all text-xs font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Editor Python Module */}
      {currentStudent && (
        <PythonEditor
          student={currentStudent}
          currentClassId={currentStudent.classId}
          exercises={allExercises}
          initialActiveExerciseId={currentClass?.activeExerciseId || null}
          onStatusUpdateTrigger={onStatusUpdateTrigger}
        />
      )}

    </div>
  );
}
