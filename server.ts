import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "codetracker.json");

// Define interfaces for typings
interface ClassItem {
  id: string;
  name: string;
  room: string;
  activeExerciseId: string | null;
}

interface Student {
  id: string;
  classId: string;
  name: string;
  avatar: string;
  status: "IDLE" | "CODING" | "HELP" | "PAUSED" | "COMPLETED";
  lastUpdate: string;
  progress: number;
  grade: number | null;
  notes: string;
  email?: string;
  password?: string;
}

interface Exercise {
  id: string;
  title: string;
  module: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  estimatedTime: number;
  objetivo_aprendizado?: string;
  enunciado?: string;
  entrada_esperada?: string;
  saida_esperada?: string;
  exemplo_entrada?: string;
  exemplo_saida?: string;
  observacoes?: string;
}

interface StatusLog {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  exerciseId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}

interface Teacher {
  id: string;
  username: string;
  name: string;
  email?: string;
  password?: string;
}

interface AuditLog {
  id: string;
  userType: string; // "Administrador", "Professor", "Aluno", "Sistema"
  userName: string;
  action: string; // "Cadastro", "Edição", "Exclusão", "Acesso", "Backup", "Restauração"
  description: string;
  timestamp: string;
}

interface BackupItem {
  id: string;
  filename: string;
  timestamp: string;
  size: string;
}

interface AppUser {
  uid: string;
  email: string;
  role: "admin" | "professor" | "aluno";
  name: string;
  createdAt?: string;
  isSimulated?: boolean;
}

interface DbSchema {
  classes: ClassItem[];
  exercises: Exercise[];
  students: Student[];
  logs: StatusLog[];
  teachers: Teacher[];
  audits: AuditLog[];
  backups: BackupItem[];
  users: AppUser[];
}

// Initial seed data
const initialDb: DbSchema = {
  classes: [
    { id: "1a", name: "1º Ano A - Informática", room: "Lab 401", activeExerciseId: "ex04" },
    { id: "1b", name: "1º Ano B - Redes", room: "Lab 402", activeExerciseId: "ex02" },
    { id: "2a", name: "2º Ano A - Desenvolvimento", room: "Lab 403", activeExerciseId: null }
  ],
  exercises: [
    {
      id: "ex01",
      title: "01. Par ou Ímpar",
      module: "Estruturas Condicionais",
      description: "Escreva um programa que leia um número inteiro e determine se ele é par ou ímpar utilizando o operador módulo (%).",
      difficulty: "EASY",
      estimatedTime: 10
    },
    {
      id: "ex02",
      title: "02. Calculadora de IMC",
      module: "Estruturas Condicionais",
      description: "Crie um programa que calcule o Índice de Massa Corporal (IMC) e classifique o resultado segundo a tabela da OMS (Abaixo do peso, Normal, Sobrepeso, etc).",
      difficulty: "MEDIUM",
      estimatedTime: 15
    },
    {
      id: "ex03",
      title: "03. Ano Bissexto",
      module: "Estruturas Condicionais",
      description: "Desenvolva uma lógica para verificar se um ano fornecido pelo usuário é bissexto ou não, aplicando as regras de divisibilidade corretas.",
      difficulty: "EASY",
      estimatedTime: 15
    },
    {
      id: "ex04",
      title: "04. Desafio Final: Caixa Eletrônico",
      module: "Estruturas Condicionais",
      description: "Crie um algoritmo que leia a nota de um aluno e diga se ele foi aprovado ou reprovado.\n\nRequisitos:\n- Nota >= 7.0 (Aprovado)\n- Nota < 7.0 (Reprovado)",
      difficulty: "HARD",
      estimatedTime: 25
    }
  ],
  students: [
    // 1º Ano A
    { id: "202401", classId: "1a", name: "Ana Silva", avatar: "AS", status: "COMPLETED", lastUpdate: new Date().toISOString(), progress: 100, grade: 100, notes: "Excelente domínio de lógica condicional. Código limpo.", email: "ana@ete.br" },
    { id: "202402", classId: "1a", name: "Carlos Oliveira", avatar: "CO", status: "CODING", lastUpdate: new Date().toISOString(), progress: 66, grade: null, notes: "Falta terminar o desafio de validação de saques.", email: "carlos@ete.br" },
    { id: "202403", classId: "1a", name: "Fernanda Santos", avatar: "FS", status: "HELP", lastUpdate: new Date().toISOString(), progress: 26, notes: "Travado na configuração inicial do ambiente REST. Agendar monitoria.", grade: null, email: "fernanda@ete.br" },
    { id: "202404", classId: "1a", name: "João Gomes", avatar: "JG", status: "IDLE", lastUpdate: new Date().toISOString(), progress: 0, grade: null, notes: "Sem observações...", email: "joao@ete.br" },
    { id: "202405", classId: "1a", name: "Maria Rodrigues", avatar: "MR", status: "COMPLETED", lastUpdate: new Date().toISOString(), progress: 100, grade: 95, notes: "Excelente lógica e atenção aos detalhes.", email: "maria@ete.br" },
    { id: "202406", classId: "1a", name: "Lucas Martins", avatar: "LM", status: "CODING", lastUpdate: new Date().toISOString(), progress: 50, grade: null, notes: "Sem observações...", email: "lucas@ete.br" },
    { id: "202407", classId: "1a", name: "Juliana Silva", avatar: "JS", status: "PAUSED", lastUpdate: new Date().toISOString(), progress: 10, grade: null, notes: "Dificuldade com loops aninhados na atividade 4.", email: "juliana@ete.br" },
    { id: "202408", classId: "1a", name: "Rafael Oliveira", avatar: "RO", status: "HELP", lastUpdate: new Date().toISOString(), progress: 40, grade: null, notes: "Dúvidas sobre operadores condicionais.", email: "rafael@ete.br" },
    
    // 1º Ano B
    { id: "202409", classId: "1b", name: "Bruno Lima", avatar: "BL", status: "CODING", lastUpdate: new Date().toISOString(), progress: 30, grade: null, notes: "", email: "bruno@ete.br" },
    { id: "202410", classId: "1b", name: "Carla Dias", avatar: "CD", status: "COMPLETED", lastUpdate: new Date().toISOString(), progress: 100, grade: 90, notes: "", email: "carla@ete.br" },
    { id: "202411", classId: "1b", name: "Diego Costa", avatar: "DC", status: "HELP", lastUpdate: new Date().toISOString(), progress: 15, grade: null, notes: "", email: "diego@ete.br" },
    { id: "202412", classId: "1b", name: "Eliane Souza", avatar: "ES", status: "IDLE", lastUpdate: new Date().toISOString(), progress: 0, grade: null, notes: "", email: "eliane@ete.br" },
    
    // 2º Ano A
    { id: "202413", classId: "2a", name: "Felipe Melo", avatar: "FM", status: "COMPLETED", lastUpdate: new Date().toISOString(), progress: 100, grade: 88, notes: "", email: "felipe@ete.br" },
    { id: "202414", classId: "2a", name: "Gisele Cruz", avatar: "GC", status: "CODING", lastUpdate: new Date().toISOString(), progress: 45, grade: null, notes: "", email: "gisele@ete.br" },
    { id: "202415", classId: "2a", name: "Hugo Ramos", avatar: "HR", status: "PAUSED", lastUpdate: new Date().toISOString(), progress: 60, grade: null, notes: "", email: "hugo@ete.br" },
    { id: "202416", classId: "2a", name: "Igor Nogueira", avatar: "IN", status: "HELP", lastUpdate: new Date().toISOString(), progress: 20, grade: null, notes: "", email: "igor@ete.br" }
  ],
  logs: [],
  teachers: [
    { id: "prof01", username: "professor", name: "Prof. Henrique Souza" },
    { id: "prof02", username: "mariasilva", name: "Profa. Maria Silva" }
  ],
  audits: [
    {
      id: "audit_init",
      userType: "Sistema",
      userName: "Sistema",
      action: "Acesso",
      description: "Banco de dados inicializado com dados padrão da ETE Pedro Leão Leal.",
      timestamp: new Date().toISOString()
    }
  ],
  backups: [],
  users: [
    { uid: "sim-uid-admin", email: "admin@ete.br", role: "admin", name: "Administrador Pedro Leão" },
    { uid: "sim-uid-prof", email: "alberto@ete.br", role: "professor", name: "Prof. Alberto Santos" },
    { uid: "sim-uid-ana", email: "ana@ete.br", role: "aluno", name: "Ana Silva" },
    { uid: "sim-uid-carlos", email: "carlos@ete.br", role: "aluno", name: "Carlos Oliveira" },
    { uid: "sim-uid-fernanda", email: "fernanda@ete.br", role: "aluno", name: "Fernanda Santos" },
    { uid: "sim-uid-lucas", email: "lucas@ete.br", role: "aluno", name: "Lucas Martins" }
  ]
};

// Database helper functions
function readDb(): DbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const db = JSON.parse(data);
      let updated = false;

      if (!db.classes) { db.classes = []; updated = true; }
      if (!db.exercises) { db.exercises = []; updated = true; }
      if (!db.students) { db.students = []; updated = true; }
      if (!db.logs) { db.logs = []; updated = true; }
      if (!db.teachers) {
        db.teachers = [
          { id: "prof01", username: "professor", name: "Prof. Henrique Souza" },
          { id: "prof02", username: "mariasilva", name: "Profa. Maria Silva" }
        ];
        updated = true;
      }
      if (!db.audits) {
        db.audits = [
          {
            id: "audit_init",
            userType: "Sistema",
            userName: "Sistema",
            action: "Acesso",
            description: "Banco de dados inicializado.",
            timestamp: new Date().toISOString()
          }
        ];
        updated = true;
      }
      if (!db.backups) { db.backups = []; updated = true; }
      if (!db.users) {
        db.users = [
          { uid: "sim-uid-admin", email: "admin@ete.br", role: "admin", name: "Administrador Pedro Leão" },
          { uid: "sim-uid-prof", email: "alberto@ete.br", role: "professor", name: "Prof. Alberto Santos" },
          { uid: "sim-uid-ana", email: "ana@ete.br", role: "aluno", name: "Ana Silva" },
          { uid: "sim-uid-carlos", email: "carlos@ete.br", role: "aluno", name: "Carlos Oliveira" },
          { uid: "sim-uid-fernanda", email: "fernanda@ete.br", role: "aluno", name: "Fernanda Santos" },
          { uid: "sim-uid-lucas", email: "lucas@ete.br", role: "aluno", name: "Lucas Martins" }
        ];
        updated = true;
      }

      if (updated) {
        writeDb(db);
      }
      return db;
    }
  } catch (error) {
    console.error("Error reading database file, using fallback:", error);
  }
  writeDb(initialDb);
  return initialDb;
}

function writeDb(data: DbSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file:", error);
  }
}

// Audit logger helper
function addAuditLog(userType: string, userName: string, action: string, description: string) {
  const db = readDb();
  const log: AuditLog = {
    id: "audit_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    userType,
    userName,
    action,
    description,
    timestamp: new Date().toISOString()
  };
  db.audits.push(log);
  writeDb(db);
}

// Ensure database is initialized
readDb();

app.use(express.json());

// API Endpoints

// Authentication API
app.post("/api/auth/login", (req, res) => {
  const { username, password, userType, classId, studentId } = req.body;

  if (userType === "admin") {
    if (username === "admin" && password === "admin123") {
      addAuditLog("Administrador", "admin", "Acesso", "Entrou no sistema com perfil de Administrador");
      return res.json({ success: true, role: "admin", name: "Administrador do Sistema" });
    }
    return res.status(401).json({ error: "Credenciais de administrador incorretas" });
  }

  if (userType === "professor") {
    const db = readDb();
    const matchedTeacher = db.teachers.find(t => t.username === username);
    if ((username === "professor" && password === "ete123") || (matchedTeacher && password === "ete123")) {
      const name = matchedTeacher ? matchedTeacher.name : "Prof. Henrique Souza";
      addAuditLog("Professor", username, "Acesso", `Entrou no sistema como Professor (${name})`);
      return res.json({ success: true, role: "professor", name });
    }
    return res.status(401).json({ error: "Usuário ou senha de professor incorretos" });
  }

  if (userType === "aluno") {
    if (!classId || !studentId) {
      return res.status(400).json({ error: "Selecione a Turma e o Aluno para entrar" });
    }
    const db = readDb();
    const student = db.students.find(s => s.id === studentId && s.classId === classId);
    if (!student) {
      return res.status(404).json({ error: "Aluno não encontrado" });
    }
    addAuditLog("Aluno", student.name, "Acesso", `Entrou no Portal do Aluno (Turma: ${classId})`);
    return res.json({ success: true, role: "aluno", student });
  }

  return res.status(400).json({ error: "Tipo de acesso inválido" });
});

// Write Manual Audit Log
app.post("/api/admin/audits/create", (req, res) => {
  const { userType, userName, action, description } = req.body;
  addAuditLog(userType || "Sistema", userName || "Desconhecido", action || "Outro", description || "");
  res.json({ success: true });
});

// List Audit Logs
app.get("/api/admin/audits", (req, res) => {
  const db = readDb();
  res.json([...db.audits].reverse());
});

// Get all Classes
app.get("/api/classes", (req, res) => {
  const db = readDb();
  res.json(db.classes);
});

// Create Class
app.post("/api/classes/create", (req, res) => {
  const { name, room, actorName, actorType } = req.body;
  if (!name || !room) {
    return res.status(400).json({ error: "Nome e Sala são obrigatórios." });
  }
  
  const db = readDb();
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) + Math.floor(Math.random() * 100);
  
  const newClass: ClassItem = {
    id,
    name,
    room,
    activeExerciseId: null
  };
  
  db.classes.push(newClass);
  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Cadastro", `Cadastrou nova Turma: "${name}" (Sala: ${room})`);
  res.status(201).json(newClass);
});

// Update Class
app.post("/api/classes/:classId/update", (req, res) => {
  const { classId } = req.params;
  const { name, room, activeExerciseId, actorName, actorType } = req.body;

  const db = readDb();
  const idx = db.classes.findIndex(c => c.id === classId);
  if (idx === -1) {
    return res.status(404).json({ error: "Turma não encontrada." });
  }

  const old = db.classes[idx];
  db.classes[idx] = {
    ...old,
    name: name !== undefined ? name : old.name,
    room: room !== undefined ? room : old.room,
    activeExerciseId: activeExerciseId !== undefined ? activeExerciseId : old.activeExerciseId
  };

  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Edição", `Editou Turma "${old.name}": alterada para "${db.classes[idx].name}"`);
  res.json(db.classes[idx]);
});

// Delete Class
app.delete("/api/classes/:classId", (req, res) => {
  const { classId } = req.params;
  const { actorName, actorType } = req.query;

  const db = readDb();
  const cls = db.classes.find(c => c.id === classId);
  if (!cls) {
    return res.status(404).json({ error: "Turma não encontrada." });
  }

  db.classes = db.classes.filter(c => c.id !== classId);
  const studentCount = db.students.filter(s => s.classId === classId).length;
  db.students = db.students.filter(s => s.classId !== classId);

  writeDb(db);
  addAuditLog(
    (actorType as string) || "Administrador", 
    (actorName as string) || "admin", 
    "Exclusão", 
    `Excluiu a Turma "${cls.name}" e todos os seus ${studentCount} alunos.`
  );
  res.json({ success: true });
});

// Get all Exercises
app.get("/api/exercises", (req, res) => {
  const db = readDb();
  res.json(db.exercises);
});

// Create Exercise
app.post("/api/exercises/create", (req, res) => {
  const { 
    title, 
    module, 
    description, 
    difficulty, 
    estimatedTime, 
    objetivo_aprendizado, 
    enunciado, 
    entrada_esperada, 
    saida_esperada, 
    exemplo_entrada, 
    exemplo_saida, 
    observacoes,
    actorName, 
    actorType 
  } = req.body;

  const resolvedDescription = enunciado || description;
  if (!title || !module || !resolvedDescription) {
    return res.status(400).json({ error: "Título, Módulo e Enunciado/Descrição são obrigatórios." });
  }

  const db = readDb();
  const id = "ex" + (db.exercises.length + 1).toString().padStart(2, "0");
  const newExercise: Exercise = {
    id,
    title,
    module,
    description: resolvedDescription,
    difficulty: difficulty || "MEDIUM",
    estimatedTime: Number(estimatedTime) || 15,
    objetivo_aprendizado: objetivo_aprendizado || "",
    enunciado: enunciado || resolvedDescription,
    entrada_esperada: entrada_esperada || "",
    saida_esperada: saida_esperada || "",
    exemplo_entrada: exemplo_entrada || "",
    exemplo_saida: exemplo_saida || "",
    observacoes: observacoes || ""
  };

  db.exercises.push(newExercise);
  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Cadastro", `Cadastrou o Exercício: "${title}"`);
  res.status(201).json(newExercise);
});

// Update Exercise
app.post("/api/exercises/:exerciseId/update", (req, res) => {
  const { exerciseId } = req.params;
  const { 
    title, 
    module, 
    description, 
    difficulty, 
    estimatedTime, 
    objetivo_aprendizado, 
    enunciado, 
    entrada_esperada, 
    saida_esperada, 
    exemplo_entrada, 
    exemplo_saida, 
    observacoes,
    actorName, 
    actorType 
  } = req.body;

  const db = readDb();
  const idx = db.exercises.findIndex(e => e.id === exerciseId);
  if (idx === -1) {
    return res.status(404).json({ error: "Exercício não encontrado." });
  }

  const old = db.exercises[idx];
  const resolvedDescription = enunciado !== undefined ? enunciado : (description !== undefined ? description : old.description);

  db.exercises[idx] = {
    ...old,
    title: title !== undefined ? title : old.title,
    module: module !== undefined ? module : old.module,
    description: resolvedDescription,
    difficulty: difficulty !== undefined ? difficulty : old.difficulty,
    estimatedTime: estimatedTime !== undefined ? Number(estimatedTime) : old.estimatedTime,
    objetivo_aprendizado: objetivo_aprendizado !== undefined ? objetivo_aprendizado : old.objetivo_aprendizado,
    enunciado: enunciado !== undefined ? enunciado : (old.enunciado || resolvedDescription),
    entrada_esperada: entrada_esperada !== undefined ? entrada_esperada : old.entrada_esperada,
    saida_esperada: saida_esperada !== undefined ? saida_esperada : old.saida_esperada,
    exemplo_entrada: exemplo_entrada !== undefined ? exemplo_entrada : old.exemplo_entrada,
    exemplo_saida: exemplo_saida !== undefined ? exemplo_saida : old.exemplo_saida,
    observacoes: observacoes !== undefined ? observacoes : old.observacoes
  };

  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Edição", `Editou o Exercício "${old.title}"`);
  res.json(db.exercises[idx]);
});

// Delete Exercise
app.delete("/api/exercises/:exerciseId", (req, res) => {
  const { exerciseId } = req.params;
  const { actorName, actorType } = req.query;

  const db = readDb();
  const ex = db.exercises.find(e => e.id === exerciseId);
  if (!ex) {
    return res.status(404).json({ error: "Exercício não encontrado." });
  }

  db.exercises = db.exercises.filter(e => e.id !== exerciseId);
  writeDb(db);
  addAuditLog((actorType as string) || "Administrador", (actorName as string) || "admin", "Exclusão", `Excluiu o Exercício "${ex.title}"`);
  res.json({ success: true });
});

// Assign exercise to class
app.post("/api/classes/:classId/assign", (req, res) => {
  const { classId } = req.params;
  const { exerciseId, actorName, actorType } = req.body;

  const db = readDb();
  const classIndex = db.classes.findIndex(c => c.id === classId);
  if (classIndex === -1) {
    return res.status(404).json({ error: "Turma não encontrada." });
  }

  db.classes[classIndex].activeExerciseId = exerciseId || null;

  if (exerciseId) {
    db.students = db.students.map(student => {
      if (student.classId === classId) {
        return {
          ...student,
          status: "IDLE",
          progress: 0,
          lastUpdate: new Date().toISOString()
        };
      }
      return student;
    });
  }

  writeDb(db);
  const exerciseTitle = db.exercises.find(e => e.id === exerciseId)?.title || "Nenhum";
  addAuditLog(actorType || "Professor", actorName || "professor", "Edição", `Atribuiu exercício "${exerciseTitle}" à turma "${db.classes[classIndex].name}"`);
  res.json(db.classes[classIndex]);
});

// Get all Students
app.get("/api/students", (req, res) => {
  const db = readDb();
  res.json(db.students);
});

// Create Student
app.post("/api/students/create", (req, res) => {
  const { name, classId, matricula, status, progress, grade, notes, email, password, actorName, actorType } = req.body;
  if (!name || !classId) {
    return res.status(400).json({ error: "Nome e Turma são obrigatórios." });
  }

  const db = readDb();
  const id = "std_" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const mat = matricula || "ETE" + Math.floor(100000 + Math.random() * 900000);

  // Check if matricula already exists
  if (db.students.some(s => s.id !== id && s.id === mat)) {
    return res.status(400).json({ error: "Matrícula já existente." });
  }

  const cleanEmail = email || `${mat.toLowerCase()}@ete.br`;
  const cleanPassword = password || "ete123";

  const newStudent: Student = {
    id: mat,
    classId,
    name,
    avatar: initials || "ST",
    status: status || "IDLE",
    lastUpdate: new Date().toISOString(),
    progress: progress !== undefined ? Number(progress) : 0,
    grade: grade !== undefined && grade !== "" ? Number(grade) : null,
    notes: notes || "",
    email: cleanEmail,
    password: cleanPassword
  };

  db.students.push(newStudent);
  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Cadastro", `Cadastrou o Aluno "${name}" (Matrícula: ${newStudent.id})`);
  res.status(201).json(newStudent);
});

// Update Student
app.post("/api/students/:studentId/update", (req, res) => {
  const { studentId } = req.params;
  const { name, classId, status, progress, grade, notes, email, password, actorName, actorType } = req.body;

  const db = readDb();
  const idx = db.students.findIndex(s => s.id === studentId);
  if (idx === -1) {
    return res.status(404).json({ error: "Aluno não encontrado." });
  }

  const old = db.students[idx];
  db.students[idx] = {
    ...old,
    name: name !== undefined ? name : old.name,
    classId: classId !== undefined ? classId : old.classId,
    status: status !== undefined ? status : old.status,
    progress: progress !== undefined ? Number(progress) : old.progress,
    grade: grade !== undefined ? (grade === "" || grade === null ? null : Number(grade)) : old.grade,
    notes: notes !== undefined ? notes : old.notes,
    email: email !== undefined ? email : old.email,
    password: password !== undefined ? password : old.password,
    lastUpdate: new Date().toISOString()
  };

  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Edição", `Editou o Aluno "${old.name}" (Matrícula: ${studentId})`);
  res.json(db.students[idx]);
});

// Delete Student
app.delete("/api/students/:studentId", (req, res) => {
  const { studentId } = req.params;
  const { actorName, actorType } = req.query;

  const db = readDb();
  const std = db.students.find(s => s.id === studentId);
  if (!std) {
    return res.status(404).json({ error: "Aluno não encontrado." });
  }

  db.students = db.students.filter(s => s.id !== studentId);
  writeDb(db);
  addAuditLog((actorType as string) || "Administrador", (actorName as string) || "admin", "Exclusão", `Excluiu o Aluno "${std.name}" (Matrícula: ${studentId})`);
  res.json({ success: true });
});

// Import CSV Alunos
app.post("/api/students/import-csv", (req, res) => {
  const { csvText, classId, actorName, actorType } = req.body;
  if (!csvText || !classId) {
    return res.status(400).json({ error: "CSV e Turma são obrigatórios." });
  }

  const db = readDb();
  const cls = db.classes.find(c => c.id === classId);
  if (!cls) {
    return res.status(404).json({ error: "Turma de destino não encontrada." });
  }

  // Parse CSV (supports comma or semicolon, header and rows)
  const lines = csvText.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
  let importedCount = 0;
  let skippedCount = 0;

  lines.forEach((line: string, index: number) => {
    // Skip typical header if first line
    if (index === 0 && (line.toLowerCase().includes("nome") || line.toLowerCase().includes("name") || line.toLowerCase().includes("matricula") || line.toLowerCase().includes("id"))) {
      return;
    }

    const parts = line.split(/[;,]/);
    const name = parts[0]?.trim();
    let matricula = parts[1]?.trim();
    let email = parts[2]?.trim();
    let password = parts[3]?.trim();

    if (!name) {
      skippedCount++;
      return;
    }

    if (!matricula) {
      matricula = "ETE" + Math.floor(100000 + Math.random() * 900000);
    }

    // Ensure uniqueness
    const exists = db.students.some(s => s.id === matricula);
    if (exists) {
      matricula = matricula + "_" + Math.floor(10 + Math.random() * 90);
    }

    const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanEmail = email || `${cleanName || matricula.toLowerCase()}@ete.br`;
    const cleanPassword = password || "ete123";

    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

    const newStudent: Student = {
      id: matricula,
      classId,
      name,
      avatar: initials || "ST",
      status: "IDLE",
      lastUpdate: new Date().toISOString(),
      progress: 0,
      grade: null,
      notes: "",
      email: cleanEmail,
      password: cleanPassword
    };

    db.students.push(newStudent);
    importedCount++;
  });

  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Cadastro", `Importou ${importedCount} alunos via CSV para a Turma "${cls.name}"`);
  res.json({ success: true, importedCount, skippedCount });
});

// Teachers API CRUD
app.get("/api/teachers", (req, res) => {
  const db = readDb();
  res.json(db.teachers);
});

app.post("/api/teachers/create", (req, res) => {
  const { username, name, email, password, actorName, actorType } = req.body;
  if (!username || !name) {
    return res.status(400).json({ error: "Usuário e Nome Completo são obrigatórios." });
  }

  const db = readDb();
  if (db.teachers.some(t => t.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: "Nome de usuário já cadastrado." });
  }

  const cleanEmail = email || `${username.toLowerCase().trim()}@ete.br`;
  const cleanPassword = password || "ete123";

  const newTeacher: Teacher = {
    id: "prof_" + Date.now().toString().slice(-6),
    username: username.toLowerCase().trim(),
    name: name.trim(),
    email: cleanEmail,
    password: cleanPassword
  };

  db.teachers.push(newTeacher);
  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Cadastro", `Cadastrou o Professor "${name}" (Usuário: ${username})`);
  res.status(201).json(newTeacher);
});

app.post("/api/teachers/:teacherId/update", (req, res) => {
  const { teacherId } = req.params;
  const { username, name, email, password, actorName, actorType } = req.body;

  const db = readDb();
  const idx = db.teachers.findIndex(t => t.id === teacherId);
  if (idx === -1) {
    return res.status(404).json({ error: "Professor não encontrado." });
  }

  const old = db.teachers[idx];
  db.teachers[idx] = {
    ...old,
    username: username !== undefined ? username.toLowerCase().trim() : old.username,
    name: name !== undefined ? name.trim() : old.name,
    email: email !== undefined ? email : old.email,
    password: password !== undefined ? password : old.password
  };

  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Edição", `Editou o Professor "${old.name}"`);
  res.json(db.teachers[idx]);
});

app.delete("/api/teachers/:teacherId", (req, res) => {
  const { teacherId } = req.params;
  const { actorName, actorType } = req.query;

  const db = readDb();
  const teacher = db.teachers.find(t => t.id === teacherId);
  if (!teacher) {
    return res.status(404).json({ error: "Professor não encontrado." });
  }

  db.teachers = db.teachers.filter(t => t.id !== teacherId);
  writeDb(db);
  addAuditLog((actorType as string) || "Administrador", (actorName as string) || "admin", "Exclusão", `Excluiu o Professor "${teacher.name}" (Usuário: ${teacher.username})`);
  res.json({ success: true });
});

// Users Accounts API CRUD for Role management & fallback syncing
app.get("/api/users", (req, res) => {
  const db = readDb();
  res.json(db.users || []);
});

app.post("/api/users/create", (req, res) => {
  const { uid, email, role, name, actorName, actorType } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Nome e E-mail são obrigatórios." });
  }

  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "E-mail de usuário já cadastrado." });
  }

  const newUser: AppUser = {
    uid: uid || "sim-uid-" + Math.random().toString(36).substring(7),
    email: email.toLowerCase().trim(),
    role: role || "aluno",
    name: name.trim(),
    createdAt: new Date().toISOString(),
    isSimulated: true
  };

  db.users.push(newUser);
  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Cadastro", `Cadastrou o Usuário "${name}" com o papel de "${role || 'aluno'}"`);
  res.status(201).json(newUser);
});

app.post("/api/users/:uid/update", (req, res) => {
  const { uid } = req.params;
  const { email, role, name, actorName, actorType } = req.body;

  const db = readDb();
  const idx = db.users.findIndex(u => u.uid === uid);
  if (idx === -1) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const old = db.users[idx];
  db.users[idx] = {
    ...old,
    email: email !== undefined ? email.toLowerCase().trim() : old.email,
    role: role !== undefined ? role : old.role,
    name: name !== undefined ? name.trim() : old.name
  };

  writeDb(db);
  addAuditLog(actorType || "Administrador", actorName || "admin", "Edição", `Promoveu/Alterou Usuário "${old.name}" para "${role || old.role}"`);
  res.json(db.users[idx]);
});

app.delete("/api/users/:uid", (req, res) => {
  const { uid } = req.params;
  const { actorName, actorType } = req.query;

  const db = readDb();
  const user = db.users.find(u => u.uid === uid);
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  db.users = db.users.filter(u => u.uid !== uid);
  writeDb(db);
  addAuditLog((actorType as string) || "Administrador", (actorName as string) || "admin", "Exclusão", `Excluiu a conta do Usuário "${user.name}" (${user.email})`);
  res.json({ success: true });
});

// Get students by class
app.get("/api/classes/:classId/students", (req, res) => {
  const { classId } = req.params;
  const db = readDb();
  const students = db.students.filter(s => s.classId === classId);
  res.json(students);
});

// Update student status in real-time
app.post("/api/student/status", (req, res) => {
  const { studentId, status, progress, actorName, actorType } = req.body;
  if (!studentId || !status) {
    return res.status(400).json({ error: "ID do aluno e status são obrigatórios." });
  }

  const db = readDb();
  const studentIndex = db.students.findIndex(s => s.id === studentId);
  if (studentIndex === -1) {
    return res.status(404).json({ error: "Aluno não encontrado." });
  }

  const oldStudent = db.students[studentIndex];
  const oldStatus = oldStudent.status;

  db.students[studentIndex].status = status;
  db.students[studentIndex].lastUpdate = new Date().toISOString();
  if (typeof progress === "number") {
    db.students[studentIndex].progress = progress;
  } else if (status === "COMPLETED") {
    db.students[studentIndex].progress = 100;
  }

  const activeClass = db.classes.find(c => c.id === oldStudent.classId);
  const log: StatusLog = {
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    studentId,
    studentName: oldStudent.name,
    classId: oldStudent.classId,
    exerciseId: activeClass?.activeExerciseId || "unknown",
    oldStatus,
    newStatus: status,
    timestamp: new Date().toISOString()
  };
  db.logs.push(log);

  writeDb(db);
  addAuditLog(actorType || "Aluno", actorName || oldStudent.name, "Edição", `Alterou status no exercício de "${oldStatus}" para "${status}" (${db.students[studentIndex].progress}% concluído)`);
  res.json(db.students[studentIndex]);
});

// Update student notes & grade
app.post("/api/students/:studentId/grade-notes", (req, res) => {
  const { studentId } = req.params;
  const { grade, notes, actorName, actorType } = req.body;

  const db = readDb();
  const studentIndex = db.students.findIndex(s => s.id === studentId);
  if (studentIndex === -1) {
    return res.status(404).json({ error: "Aluno não encontrado." });
  }

  const old = db.students[studentIndex];
  if (grade !== undefined) {
    db.students[studentIndex].grade = grade === "" ? null : Number(grade);
  }
  if (notes !== undefined) {
    db.students[studentIndex].notes = notes;
  }

  writeDb(db);
  addAuditLog(actorType || "Professor", actorName || "professor", "Edição", `Atribuiu nota ${grade} e observações para o aluno "${old.name}"`);
  res.json(db.students[studentIndex]);
});

// Get activity logs
app.get("/api/logs", (req, res) => {
  const db = readDb();
  res.json([...db.logs].reverse().slice(0, 30));
});

// Add manual student to class
app.post("/api/classes/:classId/students/add", (req, res) => {
  const { classId } = req.params;
  const { name, actorName, actorType } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Nome do aluno é obrigatório." });
  }

  const db = readDb();
  const id = "std_" + Date.now().toString().slice(-6);
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const newStudent: Student = {
    id,
    classId,
    name,
    avatar: initials || "ST",
    status: "IDLE",
    lastUpdate: new Date().toISOString(),
    progress: 0,
    grade: null,
    notes: ""
  };

  db.students.push(newStudent);
  writeDb(db);
  addAuditLog(actorType || "Professor", actorName || "professor", "Cadastro", `Cadastrou o aluno "${name}" na turma com ID "${classId}"`);
  res.status(201).json(newStudent);
});

// DATABASE TOOLS: BACKUPS
app.get("/api/admin/backups", (req, res) => {
  const db = readDb();
  res.json(db.backups);
});

app.post("/api/admin/backup", (req, res) => {
  const { actorName, actorType } = req.body;
  const db = readDb();

  const backupId = "backup_" + Date.now();
  const filename = `codetracker_backup_${Date.now()}.json`;
  const backupPath = path.join(process.cwd(), filename);

  try {
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), "utf-8");
    const stats = fs.statSync(backupPath);
    const sizeKB = (stats.size / 1024).toFixed(2) + " KB";

    const newItem: BackupItem = {
      id: backupId,
      filename,
      timestamp: new Date().toISOString(),
      size: sizeKB
    };

    db.backups.push(newItem);
    writeDb(db);

    addAuditLog(actorType || "Administrador", actorName || "admin", "Backup", `Realizou backup completo do banco de dados no arquivo: "${filename}"`);
    res.json({ success: true, backup: newItem });
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao gerar arquivo de backup: " + err.message });
  }
});

app.post("/api/admin/restore", (req, res) => {
  const { backupId, actorName, actorType } = req.body;
  if (!backupId) {
    return res.status(400).json({ error: "ID de backup é obrigatório" });
  }

  const db = readDb();
  const bkp = db.backups.find(b => b.id === backupId);
  if (!bkp) {
    return res.status(404).json({ error: "Registro de backup não encontrado" });
  }

  const backupPath = path.join(process.cwd(), bkp.filename);
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: `Arquivo de backup ${bkp.filename} não existe fisicamente.` });
  }

  try {
    const data = fs.readFileSync(backupPath, "utf-8");
    const parsed = JSON.parse(data);

    // Write back directly to primary DB file
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf-8");

    // Maintain current backups list in restored DB if desired, or let it restore exactly
    // Log the restore
    addAuditLog(actorType || "Administrador", actorName || "admin", "Restauração", `Restaurou o banco de dados para o estado do backup: "${bkp.filename}"`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao restaurar banco de dados: " + err.message });
  }
});

app.post("/api/admin/restore-defaults", (req, res) => {
  const { actorName, actorType } = req.body;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf-8");
    addAuditLog(actorType || "Administrador", actorName || "admin", "Restauração", "Restaurou o banco de dados aos dados iniciais padrão.");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao restaurar dados padrão: " + err.message });
  }
});

app.get("/api/admin/export", (req, res) => {
  const db = readDb();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=codetracker_database.json");
  res.json(db);
});

// Integrate Frontend (Vite in dev, static files in prod)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
