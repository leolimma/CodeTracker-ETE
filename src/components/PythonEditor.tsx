import AITutorChat from "./AITutorChat";
import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Trash2, 
  Save, 
  History, 
  Clock, 
  Code, 
  FileCode, 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  RefreshCw, 
  CheckCircle,
  Eye,
  ChevronsRight,
  User,
  ExternalLink,
  ChevronRight,
  RotateCcw,
  XCircle,
  AlertCircle,
  BookOpen,
  Send,
  TerminalSquare
} from "lucide-react";
import { Student, Exercise } from "../types";
import { 
  atualizarStatusPorExercicio,
  salvarCodigoPorExercicio,
  getAlunoDados 
} from "../services/apiClient";

import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

interface ProgressHistoryEntry {
  id: string;
  timestamp: string;
  statusAluno: string;
  codigo: string;
  linhasCodigo: number;
}

interface PythonEditorProps {
  student: Student;
  currentClassId: string;
  exercises: Exercise[];
  initialActiveExerciseId: string | null;
  onStatusUpdateTrigger?: () => void;
}

export default function PythonEditor({
  student,
  currentClassId,
  exercises,
  initialActiveExerciseId,
  onStatusUpdateTrigger
}: PythonEditorProps) {
  // Active Exercise
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const activeExercise = exercises.find(ex => ex.id === selectedExerciseId) || null;

  // Code & Editor states
  const [code, setCode] = useState<string>('print("Olá, CodeTracker ETE!")\n\n# Digite seu algoritmo Python aqui\nnome = input("Qual é o seu nome? ")\nprint(f"Bem-vindo(a) ao laboratório, {nome}!")\n');
  const [consoleOutput, setConsoleOutput] = useState<string>("Console aguardando execução...\n");
  const [isPyodideLoading, setIsPyodideLoading] = useState<boolean>(true);
  const [pyodideStatus, setPyodideStatus] = useState<string>("Carregando Python no navegador...");
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [executionStatus, setExecutionStatus] = useState<"IDLE" | "RUNNING" | "SUCCESS" | "ERROR">("IDLE");

  // CodeMirror instance refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeMirrorInstanceRef = useRef<any>(null);

  // Pyodide Instance ref
  const pyodideRef = useRef<any>(null);

  // Tracking stats
  const [runCount, setRunCount] = useState<number>(0);
  const [typingTime, setTypingTime] = useState<number>(0); // in seconds
  const [totalEditingTime, setTotalEditingTime] = useState<number>(0); // in seconds
  const [cursorPosition, setCursorPosition] = useState<{ line: number; ch: number }>({ line: 0, ch: 0 });
  const [studentState, setStudentState] = useState<"Digitando" | "Executando" | "Inativo" | "Offline" | "Concluído">("Inativo");
  const [lastSavedCode, setLastSavedCode] = useState<string>("");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  
  // Timer and tracking refs
  const lastActiveRef = useRef<number>(Date.now());
  const isTypingRef = useRef<boolean>(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // History & Diff state
  const [historyList, setHistoryList] = useState<ProgressHistoryEntry[]>([]);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<ProgressHistoryEntry | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Initialize selected exercise
  useEffect(() => {
    if (initialActiveExerciseId && exercises.some(ex => ex.id === initialActiveExerciseId)) {
      setSelectedExerciseId(initialActiveExerciseId);
    } else if (exercises.length > 0) {
      setSelectedExerciseId(exercises[0].id);
    }
  }, [initialActiveExerciseId, exercises]);

  // Carrega código salvo do aluno diretamente do PostgreSQL no Neon
  useEffect(() => {
    if (!selectedExerciseId || !student.id) return;
    getAlunoDados().then((dados) => {
      const atv = (dados.atividades || []).find(a => a.exercicio_id === selectedExerciseId);
      if (atv?.codigo_salvo && atv.codigo_salvo.trim()) {
        setCode(atv.codigo_salvo);
        setLastSavedCode(atv.codigo_salvo);
        setLastSavedTime(new Date(atv.updated_at || atv.created_at || Date.now()).toLocaleTimeString());
      } else if (activeExercise?.enunciado) {
        const template = `# ${activeExercise.titulo || activeExercise.title}\n# ${activeExercise.enunciado || activeExercise.descricao || activeExercise.description}\n\n# Escreva seu algoritmo abaixo:\n`;
        setCode(template);
        setLastSavedCode(template);
      }
    }).catch(() => {
      // Ignora erro se não for estudante autenticado
    });
  }, [selectedExerciseId, student.id, activeExercise?.id]);

  // Load Pyodide
  useEffect(() => {
    async function loadPyodideRuntime() {
      try {
        if ((window as any).loadPyodide) {
          setPyodideStatus("Baixando pacotes Python...");
          const py = await (window as any).loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/"
          });
          
          // Setup custom Javascript prompt bindings for Python builtins.input
          py.registerJsModule("js_input_bindings", {
            get_input: (promptMsg: string) => {
              return prompt(promptMsg || "Digite sua entrada Python:") || "";
            }
          });

          // Inject input redirection and initial stdout StringIO
          await py.runPythonAsync(`
import io
import sys
import builtins
import js_input_bindings

def web_input(prompt_text=''):
    return js_input_bindings.get_input(prompt_text)

builtins.input = web_input

stdout = io.StringIO()
stderr = io.StringIO()
sys.stdout = stdout
sys.stderr = stderr
`);

          pyodideRef.current = py;
          setIsPyodideLoading(false);
          setPyodideStatus("Ambiente carregado com sucesso!");
        } else {
          setPyodideStatus("Erro: Biblioteca Pyodide não encontrada");
        }
      } catch (err: any) {
        console.error(err);
        setPyodideStatus("Falha ao inicializar Pyodide: " + err.message);
      }
    }
    loadPyodideRuntime();
  }, []);

  // Initialize CodeMirror 5
  useEffect(() => {
    if (textareaRef.current && (window as any).CodeMirror) {
      if (codeMirrorInstanceRef.current) {
        codeMirrorInstanceRef.current.toTextArea();
      }

      const cm = (window as any).CodeMirror.fromTextArea(textareaRef.current, {
        mode: "python",
        theme: "dracula",
        lineNumbers: true,
        indentUnit: 4,
        smartIndent: true,
        matchBrackets: true,
        lineWrapping: true,
        extraKeys: {
          "Ctrl-Enter": () => {
            triggerRun();
          },
          "Tab": (cmInstance: any) => {
            cmInstance.replaceSelection("    ", "end");
          }
        }
      });

      cm.setValue(code);
      codeMirrorInstanceRef.current = cm;

      cm.on("change", (instance: any) => {
        const val = instance.getValue();
        setCode(val);
        handleTypingEvent();
      });

      cm.on("cursorActivity", (instance: any) => {
        const pos = instance.getCursor();
        setCursorPosition({ line: pos.line, ch: pos.ch });
      });
    }

    return () => {
      if (codeMirrorInstanceRef.current) {
        codeMirrorInstanceRef.current.toTextArea();
        codeMirrorInstanceRef.current = null;
      }
    };
  }, [isPyodideLoading]);

  // Auto-Save Loop: Every 2 seconds
  useEffect(() => {
    const autoSaveTimer = setInterval(() => {
      if (!selectedExerciseId) return;

      const currentCode = codeMirrorInstanceRef.current?.getValue() || code;
      const lines = currentCode.split("\n").length;

      // If code has actually changed, save to backend
      if (currentCode !== lastSavedCode) {
        setLastSavedCode(currentCode);
        salvarCodigoPorExercicio(selectedExerciseId, currentCode).then(() => {
          setLastSavedTime(new Date().toLocaleTimeString());
        });
      }
    }, 2000);

    return () => clearInterval(autoSaveTimer);
  }, [code, selectedExerciseId, lastSavedCode, studentState, typingTime, totalEditingTime, cursorPosition, runCount]);

  // Edit Time and Active/Inactive Tracking
  useEffect(() => {
    const trackingTimer = setInterval(() => {
      // 1. Increment total active session duration
      setTotalEditingTime(prev => prev + 1);

      // 2. Typing accumulation check
      if (isTypingRef.current) {
        setTypingTime(prev => prev + 1);
      }

      // 3. Inactive auto-detection: if no keystrokes for 15 seconds
      const secondsSinceActive = (Date.now() - lastActiveRef.current) / 1000;
      if (secondsSinceActive > 15 && studentState === "Digitando") {
        setStudentState("Inativo");
        syncProgressWithDb("Inativo");
      }
    }, 1000);

    return () => clearInterval(trackingTimer);
  }, [studentState]);

  // Set typing activity trigger
  const handleTypingEvent = () => {
    lastActiveRef.current = Date.now();
    isTypingRef.current = true;

    if (studentState !== "Digitando" && studentState !== "Concluído") {
      setStudentState("Digitando");
      syncProgressWithDb("Digitando");
    }

    // Debounce to stop marking as typing
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 3000);
  };

  // Helper to quickly save state
  const syncProgressWithDb = async (status: "Digitando" | "Executando" | "Inativo" | "Offline" | "Concluído") => {
    if (!selectedExerciseId) return;
    const currentCode = codeMirrorInstanceRef.current?.getValue() || code;
    
    let estado_atual = "Codificando";
    if (status === "Inativo" || status === "Offline") estado_atual = "Pausado";
    if (status === "Concluído") estado_atual = "Concluído";

    try {
      await atualizarStatusPorExercicio({
        exercicio_id: selectedExerciseId,
        estado_atual
      });
      await salvarCodigoPorExercicio(selectedExerciseId, currentCode);
      setLastSavedTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Erro ao salvar progresso", e);
    }
  };

  // Trigger Run Python Code via Pyodide
  const triggerRun = async () => {
    if (!pyodideRef.current || isExecuting) return;

    setIsExecuting(true);
    setExecutionStatus("RUNNING");
    setStudentState("Executando");
    syncProgressWithDb("Executando");
    setConsoleOutput("Executando script Python...\n");

    const startTime = performance.now();
    const currentCode = codeMirrorInstanceRef.current?.getValue() || code;
    const lines = currentCode.split("\n").length;

    try {
      // Reset Python execution streams
      await pyodideRef.current.runPythonAsync(`
stdout.truncate(0)
stdout.seek(0)
stderr.truncate(0)
stderr.seek(0)
`);

      // Run code
      await pyodideRef.current.runPythonAsync(currentCode);

      // Extract outputs
      const stdoutResult = await pyodideRef.current.runPythonAsync("stdout.getvalue()");
      const stderrResult = await pyodideRef.current.runPythonAsync("stderr.getvalue()");

      const endTime = performance.now();
      const elapsed = parseFloat(((endTime - startTime) / 1000).toFixed(3));
      setExecutionTime(elapsed);

      let finalOutput = stdoutResult;
      if (stderrResult && stderrResult.length > 0) {
        finalOutput += "\n" + stderrResult;
      }

      if (finalOutput.trim() === "") {
        finalOutput = "Código executado com sucesso (sem saídas de texto).";
      }

      setConsoleOutput(finalOutput);
      setExecutionStatus("SUCCESS");
      const nextRunCount = runCount + 1;
      setRunCount(nextRunCount);

      await syncProgressWithDb("Digitando");
      setStudentState("Digitando");

    } catch (err: any) {
      const endTime = performance.now();
      const elapsed = parseFloat(((endTime - startTime) / 1000).toFixed(3));
      setExecutionTime(elapsed);

      setConsoleOutput(err.message || String(err));
      setExecutionStatus("ERROR");
      const nextRunCount = runCount + 1;
      setRunCount(nextRunCount);

      await syncProgressWithDb("Digitando");
      setStudentState("Digitando");
    } finally {
      setIsExecuting(false);
    }
  };

  // Submit and mark completed
  const handleMarkAsCompleted = async () => {
    setStudentState("Concluído");
    const currentCode = codeMirrorInstanceRef.current?.getValue() || code;
    await syncProgressWithDb("Concluído");
    if (onStatusUpdateTrigger) {
      onStatusUpdateTrigger();
    }
    alert("Excelente trabalho! Atividade marcada como concluída e compartilhada com o professor.");
  };

  // Clear output console
  const clearConsole = () => {
    setConsoleOutput("Console limpo.\n");
    setExecutionStatus("IDLE");
    setExecutionTime(null);
  };

  // Format active time in MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  // Check version diff helper
  const getDiffStats = (version: ProgressHistoryEntry) => {
    const currentCode = codeMirrorInstanceRef.current?.getValue() || code;
    const currentLines = currentCode.split("\n").length;
    const currentChars = currentCode.length;

    const diffLines = currentLines - (version.linhasCodigo || version.codigo.split("\n").length);
    const diffChars = currentChars - version.codigo.length;

    return {
      diffLines: diffLines > 0 ? `+${diffLines} linhas` : `${diffLines} linhas`,
      diffChars: diffChars > 0 ? `+${diffChars} chars` : `${diffChars} chars`
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-slate-100">
      
      {/* LEFT PANEL: Exercise Select & Instructions */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* Selector card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-900/40 p-1.5 rounded-lg text-blue-400 border border-blue-800/30">
              <FileCode className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-200">Selecionar Atividade</h3>
          </div>

          <select
            value={selectedExerciseId}
            onChange={(e) => setSelectedExerciseId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.difficulty})
              </option>
            ))}
          </select>
        </div>

        {/* Instructions & Objective Card */}
        {activeExercise ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {activeExercise.module}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                activeExercise.difficulty === "EASY" 
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/30"
                  : activeExercise.difficulty === "MEDIUM"
                  ? "bg-amber-950/80 text-amber-400 border border-amber-800/30"
                  : "bg-red-950/80 text-red-400 border border-red-800/30"
              }`}>
                {activeExercise.difficulty}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <h1 className="text-base font-extrabold text-slate-200">{activeExercise.title}</h1>
              
              <div className="bg-slate-950/60 border border-slate-850 rounded-lg p-3">
                <p className="text-xs text-slate-400 whitespace-pre-line leading-relaxed font-mono">
                  {activeExercise.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/50">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tempo: <strong>{activeExercise.estimatedTime} min</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 justify-end">
                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">Python 3</span>
                </div>
              </div>

              {/* Mark Completed button */}
              <button
                onClick={handleMarkAsCompleted}
                disabled={studentState === "Concluído"}
                className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  studentState === "Concluído"
                    ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800/30 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>{studentState === "Concluído" ? "Atividade Concluída!" : "Marcar como Concluído"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center shadow-xl">
            <p className="text-slate-400 text-xs">Nenhuma atividade ativa selecionada.</p>
          </div>
        )}

        {/* Real-Time Live Sync Stats Badge Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acompanhamento Real-Time</h4>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block">Tempo Ativo</span>
              <strong className="text-xs font-mono text-slate-200">{formatTime(totalEditingTime)}</strong>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block">Tempo Digitado</span>
              <strong className="text-xs font-mono text-slate-200">{formatTime(typingTime)}</strong>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                studentState === "Concluído" ? "bg-emerald-500" :
                studentState === "Digitando" ? "bg-blue-500 animate-pulse" :
                studentState === "Executando" ? "bg-amber-500 animate-bounce" : "bg-slate-500"
              }`} />
              <span className="text-xs text-slate-400">Estado: <strong>{studentState}</strong></span>
            </div>
            <span className="text-[10px] text-slate-500">Auto-save: 2s</span>
          </div>

          {lastSavedTime && (
            <div className="text-center text-[10px] text-slate-500">
              Última sincronização com o banco de dados: <strong className="text-slate-400">{lastSavedTime}</strong>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT PANEL: Code Editor & Pyodide Console */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* Code Editor Frame */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
          
          {/* Editor Header Bar */}
          <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-amber-500/10 p-1 rounded text-amber-400 border border-amber-500/20">
                <Code className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-200">editor.py</span>
              <span className="text-[10px] text-slate-500 font-mono">
                L: {cursorPosition.line + 1} C: {cursorPosition.ch + 1} • {code.split("\n").length} linhas
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* History button */}
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  isHistoryOpen 
                    ? "bg-blue-900/30 text-blue-400 border-blue-800" 
                    : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Versões ({historyList.length})</span>
              </button>

              {/* Execution Run button */}
              <button
                onClick={triggerRun}
                disabled={isPyodideLoading || isExecuting}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-blue-900/30 active:scale-[0.98] transition-all"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rodando...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Executar (Ctrl+Enter)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CodeMirror Textarea Mount point */}
          <div className="relative min-h-[280px] bg-[#282a36]">
            {isPyodideLoading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center z-20 gap-3 p-4 text-center">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-200">Preparando Interpretador Python</h4>
                  <p className="text-xs text-slate-500 font-mono">{pyodideStatus}</p>
                </div>
              </div>
            )}
            
            <textarea
              ref={textareaRef}
              className="hidden"
              defaultValue={code}
            />
          </div>

        </div>

        {/* Console / Outputs Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
          
          {/* Console Header */}
          <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">Console de Execução</span>
              
              {executionTime !== null && (
                <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded font-mono border border-slate-800">
                  Tempo: {executionTime}s
                </span>
              )}

              {executionStatus === "SUCCESS" && (
                <span className="text-[9px] font-extrabold bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.5 rounded">
                  SUCESSO
                </span>
              )}
              {executionStatus === "ERROR" && (
                <span className="text-[9px] font-extrabold bg-red-950/60 text-red-400 border border-red-900/30 px-1.5 py-0.5 rounded">
                  FALHA
                </span>
              )}
            </div>

            <button
              onClick={clearConsole}
              className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-900 transition-colors"
              title="Limpar Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Console Output Area */}
          <div className="bg-slate-950 p-4 font-mono text-xs min-h-[140px] max-h-[220px] overflow-y-auto leading-relaxed">
            <pre className={`whitespace-pre-wrap ${
              executionStatus === "ERROR" ? "text-red-400" :
              executionStatus === "SUCCESS" ? "text-emerald-400" : "text-blue-400"
            }`}>
              {consoleOutput}
            </pre>
          </div>

          {/* Console status footer */}
          <div className="px-4 py-2 bg-slate-950 border-t border-slate-850 text-[10px] text-slate-500 flex justify-between">
            <span>Execuções nesta sessão: <strong>{runCount}</strong></span>
            <span>Estilo: VS Code Dark Terminal</span>
          </div>

        </div>

      </div>

      {/* VERSION HISTORY SIDE-PANEL / MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="text-blue-400 w-5 h-5" />
                <h3 className="font-extrabold text-sm text-slate-200">Histórico de Versões Sincronizadas</h3>
              </div>
              <button
                onClick={() => {
                  setIsHistoryOpen(false);
                  setSelectedHistoryVersion(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold px-2 py-1 rounded bg-slate-850 hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
              
              {/* History list */}
              <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto max-h-[50vh] md:max-h-full p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-1">
                  Selecionar Versão
                </div>
                {historyList.length === 0 ? (
                  <p className="text-slate-500 text-xs p-3 text-center">Nenhuma versão salva ainda.</p>
                ) : (
                  historyList.map((ver, idx) => {
                    const isSelected = selectedHistoryVersion?.timestamp === ver.timestamp;
                    const diff = getDiffStats(ver);
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedHistoryVersion(ver)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1 ${
                          isSelected 
                            ? "bg-blue-950/40 border-blue-800 text-blue-200" 
                            : "bg-slate-950/40 border-transparent hover:border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-bold">
                            {new Date(ver.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(ver.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>{ver.linhasCodigo || ver.codigo.split("\n").length} linhas • {ver.codigo.length} chars</span>
                        </div>
                        <div className="text-[9px] flex justify-between font-mono text-slate-400 mt-0.5">
                          <span>{diff.diffLines}</span>
                          <span>{diff.diffChars}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Version preview or diff */}
              <div className="md:col-span-7 overflow-y-auto p-4 bg-slate-950 flex flex-col">
                {selectedHistoryVersion ? (
                  <div className="flex-1 flex flex-col space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-slate-300">Visualizando Versão do Passado</h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(selectedHistoryVersion.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm("Deseja restaurar este código para o editor atual? O código atual será guardado no histórico.")) {
                            setCode(selectedHistoryVersion.codigo);
                            if (codeMirrorInstanceRef.current) {
                              codeMirrorInstanceRef.current.setValue(selectedHistoryVersion.codigo);
                            }
                            setIsHistoryOpen(false);
                            setSelectedHistoryVersion(null);
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] px-2.5 py-1 rounded transition-colors"
                      >
                        Restaurar esta Versão
                      </button>
                    </div>

                    <div className="flex-1 bg-[#282a36] p-3 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed overflow-x-auto min-h-[220px] max-h-[340px]">
                      <pre className="text-slate-300">{selectedHistoryVersion.codigo}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                    <History className="w-10 h-10 text-slate-700" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-400">Nenhuma Versão Selecionada</h4>
                      <p className="text-xs text-slate-500 max-w-xs mt-1">
                        Selecione uma das versões do histórico no menu esquerdo para comparar as mudanças e restaurar o código se desejar.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* AI Tutor Chat Widget */}
      <AITutorChat exercicioId={selectedExerciseId} codigoAtual={code} />
    </div>
  );
}
