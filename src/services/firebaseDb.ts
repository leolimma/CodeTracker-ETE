import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  Firestore
} from "firebase/firestore";
import { initFirebase } from "../lib/firebase";
import { ClassItem, Student, Exercise, StatusLog } from "../types";

// Firebase error handling schema as defined in the firebase-integration skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const { auth } = initFirebase();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check if we are running with real Firebase or simulated fallback
export function isRealFirebaseActive(): boolean {
  const { db, isMock } = initFirebase();
  return !isMock && db !== null;
}

// Automatically seed Firestore with initial data if empty
export async function seedFirestoreIfNeeded(db: Firestore): Promise<void> {
  const { auth, isMock } = initFirebase();
  if (isMock || !auth) {
    return;
  }

  // Defend against missing/insufficient permissions by checking active user session
  if (!auth.currentUser) {
    console.log("[Firestore] Seeding deferred: No authenticated user session active yet.");
    return;
  }

  try {
    const classesCol = collection(db, "classes");
    const classSnap = await getDocs(classesCol);
    if (classSnap.empty) {
      console.log("[Firestore] Seeding initial ETE Pedro Leão Leal database in Firestore...");

      // Seed classes
      const classesSeed: ClassItem[] = [
        { id: "1a", name: "1º Ano A - Informática", room: "Lab 401", activeExerciseId: "ex04" },
        { id: "1b", name: "1º Ano B - Redes", room: "Lab 402", activeExerciseId: "ex02" },
        { id: "2a", name: "2º Ano A - Desenvolvimento", room: "Lab 403", activeExerciseId: null }
      ];
      for (const c of classesSeed) {
        await setDoc(doc(db, "classes", c.id), c);
      }

      // Seed exercises
      const exercisesSeed: Exercise[] = [
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
      ];
      for (const ex of exercisesSeed) {
        await setDoc(doc(db, "exercises", ex.id), ex);
      }

      // Seed students
      const studentsSeed: Student[] = [
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
      ];
      for (const s of studentsSeed) {
        await setDoc(doc(db, "students", s.id), s);
      }

      console.log("[Firestore] Seeding completed successfully!");
    }
  } catch (error) {
    console.error("[Firestore] Seeding error:", error);
  }
}

// 1. SUBSCRIBE CLASSES
export function subscribeClasses(callback: (classes: ClassItem[]) => void, onError?: (err: any) => void): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  // Run onmount seed check
  seedFirestoreIfNeeded(db);

  return onSnapshot(collection(db, "classes"), (snapshot) => {
    const list: ClassItem[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as ClassItem);
    });
    callback(list);
  }, (err) => {
    if (onError) onError(err);
    handleFirestoreError(err, OperationType.LIST, "classes");
  });
}

// 2. SUBSCRIBE STUDENTS FOR A CLASS
export function subscribeStudents(classId: string, callback: (students: Student[]) => void, onError?: (err: any) => void): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  const q = query(collection(db, "students"), where("classId", "==", classId));
  return onSnapshot(q, (snapshot) => {
    const list: Student[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as Student);
    });
    callback(list);
  }, (err) => {
    if (onError) onError(err);
    handleFirestoreError(err, OperationType.LIST, `students?classId=${classId}`);
  });
}

// 3. SUBSCRIBE ALL STUDENTS (across all classes)
export function subscribeAllStudents(callback: (students: Student[]) => void, onError?: (err: any) => void): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  return onSnapshot(collection(db, "students"), (snapshot) => {
    const list: Student[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as Student);
    });
    callback(list);
  }, (err) => {
    if (onError) onError(err);
    handleFirestoreError(err, OperationType.LIST, "students");
  });
}

// 4. SUBSCRIBE EXERCISES
export function subscribeExercises(callback: (exercises: Exercise[]) => void, onError?: (err: any) => void): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  return onSnapshot(collection(db, "exercises"), (snapshot) => {
    const list: Exercise[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as Exercise);
    });
    // Sort exercises by id
    list.sort((a, b) => a.id.localeCompare(b.id));
    callback(list);
  }, (err) => {
    if (onError) onError(err);
    handleFirestoreError(err, OperationType.LIST, "exercises");
  });
}

// 5. SUBSCRIBE STATUS LOGS
export function subscribeLogs(callback: (logs: StatusLog[]) => void, onError?: (err: any) => void): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  return onSnapshot(collection(db, "logs"), (snapshot) => {
    const list: StatusLog[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as StatusLog);
    });
    // Sort logs by timestamp descending
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    callback(list.slice(0, 30));
  }, (err) => {
    if (onError) onError(err);
    handleFirestoreError(err, OperationType.LIST, "logs");
  });
}

// 6. UPDATE STUDENT STATUS
export async function updateStudentStatusFirestore(
  student: Student,
  newStatus: "IDLE" | "CODING" | "HELP" | "PAUSED" | "COMPLETED",
  progress: number,
  activeExerciseId: string | null
): Promise<void> {
  const { db } = initFirebase();
  if (!db) return;

  const path = `students/${student.id}`;
  try {
    const studentRef = doc(db, "students", student.id);
    const lastUpdate = new Date().toISOString();
    
    // Update student doc
    await updateDoc(studentRef, {
      status: newStatus,
      progress,
      lastUpdate
    });

    // Create a real-time status log document
    const logId = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const logRef = doc(db, "logs", logId);
    
    await setDoc(logRef, {
      id: logId,
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      exerciseId: activeExerciseId || "unknown",
      oldStatus: student.status,
      newStatus: newStatus,
      timestamp: lastUpdate
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// 7. ASSIGN EXERCISE TO CLASS
export async function assignExerciseFirestore(classId: string, exerciseId: string | null): Promise<void> {
  const { db } = initFirebase();
  if (!db) return;

  const path = `classes/${classId}`;
  try {
    const classRef = doc(db, "classes", classId);
    await updateDoc(classRef, {
      activeExerciseId: exerciseId
    });

    if (exerciseId) {
      // If assigning a new exercise, reset all students in this class to IDLE and 0 progress
      const q = query(collection(db, "students"), where("classId", "==", classId));
      const snapshot = await getDocs(q);
      const batchPromises: Promise<void>[] = [];
      
      snapshot.forEach((studentDoc) => {
        const studentRef = doc(db, "students", studentDoc.id);
        batchPromises.push(
          updateDoc(studentRef, {
            status: "IDLE",
            progress: 0,
            lastUpdate: new Date().toISOString()
          })
        );
      });
      await Promise.all(batchPromises);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// 8. GRADE STUDENT
export async function gradeStudentFirestore(studentId: string, grade: number | null, notes: string): Promise<void> {
  const { db } = initFirebase();
  if (!db) return;

  const path = `students/${studentId}`;
  try {
    const studentRef = doc(db, "students", studentId);
    await updateDoc(studentRef, {
      grade,
      notes,
      lastUpdate: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// 9. CREATE CLASS
export async function createClassFirestore(name: string, room: string): Promise<ClassItem> {
  const { db } = initFirebase();
  if (!db) throw new Error("Firebase inativo");

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) + Math.floor(Math.random() * 100);
  const newClass: ClassItem = {
    id,
    name,
    room,
    activeExerciseId: null
  };

  const path = `classes/${id}`;
  try {
    await setDoc(doc(db, "classes", id), newClass);
    return newClass;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

// 10. CREATE STUDENT
export async function createStudentFirestore(
  name: string, 
  classId: string, 
  matricula?: string,
  email?: string,
  password?: string
): Promise<Student> {
  const { db } = initFirebase();
  if (!db) throw new Error("Firebase inativo");

  const id = matricula || "ETE" + Math.floor(100000 + Math.random() * 900000);
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const cleanEmail = email || `${id.toLowerCase()}@ete.br`;
  const cleanPassword = password || "ete123";

  const newStudent: Student = {
    id,
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

  const path = `students/${id}`;
  try {
    await setDoc(doc(db, "students", id), newStudent);
    return newStudent;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

// 11. CREATE EXERCISE
export async function createExerciseFirestore(
  title: string, 
  module: string, 
  description: string, 
  difficulty: "EASY" | "MEDIUM" | "HARD", 
  estimatedTime: number
): Promise<Exercise> {
  const { db } = initFirebase();
  if (!db) throw new Error("Firebase inativo");

  // Generate random ex ID
  const id = "ex" + Math.floor(10 + Math.random() * 90);
  const newExercise: Exercise = {
    id,
    title,
    module,
    description,
    difficulty,
    estimatedTime
  };

  const path = `exercises/${id}`;
  try {
    await setDoc(doc(db, "exercises", id), newExercise);
    return newExercise;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

// Student Progress & History Interfaces for Python Editor
export interface ProgressHistoryEntry {
  codigo: string;
  timestamp: string;
  linhas: number;
  caracteres: number;
}

export interface StudentProgress {
  id: string; // studentId_exerciseId
  studentId: string;
  studentName: string;
  classId: string;
  exerciseId: string;
  codigo: string;
  ultimaAtualizacao: string;
  tempoDigitando: number; // in seconds
  quantidadeExecucoes: number;
  statusAluno: "Digitando" | "Executando" | "Inativo" | "Offline" | "Concluído";
  ultimaExecucao: string;
  cursor: { line: number; ch: number } | null;
  linhasCodigo: number;
  tempoTotalEdicao: number; // in seconds
  historico?: ProgressHistoryEntry[];
}

// 12. SUBSCRIBE STUDENT PROGRESS
export function subscribeStudentProgress(
  studentId: string,
  exerciseId: string,
  callback: (progress: StudentProgress | null) => void,
  onError?: (err: any) => void
): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  const docId = `${studentId}_${exerciseId}`;
  return onSnapshot(
    doc(db, "student_progress", docId),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as StudentProgress);
      } else {
        callback(null);
      }
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, `student_progress/${docId}`);
    }
  );
}

// 13. SAVE STUDENT PROGRESS (WITH HISTORIC VERSION GENERATION)
export async function saveStudentProgressFirestore(
  studentId: string,
  exerciseId: string,
  studentName: string,
  classId: string,
  data: Partial<StudentProgress>
): Promise<void> {
  const { db } = initFirebase();
  if (!db) return;

  const docId = `${studentId}_${exerciseId}`;
  const docRef = doc(db, "student_progress", docId);
  const path = `student_progress/${docId}`;

  try {
    const snap = await getDoc(docRef);
    const now = new Date().toISOString();

    if (!snap.exists()) {
      // Create new document
      const initialProgress: StudentProgress = {
        id: docId,
        studentId,
        studentName,
        classId,
        exerciseId,
        codigo: data.codigo || "",
        ultimaAtualizacao: now,
        tempoDigitando: data.tempoDigitando || 0,
        quantidadeExecucoes: data.quantidadeExecucoes || 0,
        statusAluno: data.statusAluno || "Digitando",
        ultimaExecucao: data.ultimaExecucao || "",
        cursor: data.cursor || null,
        linhasCodigo: data.linhasCodigo || 0,
        tempoTotalEdicao: data.tempoTotalEdicao || 0,
        historico: data.codigo ? [{
          codigo: data.codigo,
          timestamp: now,
          linhas: data.linhasCodigo || 0,
          caracteres: data.codigo.length
        }] : []
      };
      await setDoc(docRef, initialProgress);
    } else {
      const current = snap.data() as StudentProgress;
      const updatedFields: Partial<StudentProgress> = {
        ...data,
        ultimaAtualizacao: now
      };

      // Check if we should append to history (e.g. if code changed significantly or code is saved)
      let historico = current.historico || [];
      if (data.codigo !== undefined && data.codigo !== current.codigo) {
        // Limit history to last 50 entries to avoid hitting firestore size limits
        const newHistoryEntry: ProgressHistoryEntry = {
          codigo: data.codigo,
          timestamp: now,
          linhas: data.linhasCodigo || 0,
          caracteres: data.codigo.length
        };
        historico = [newHistoryEntry, ...historico].slice(0, 50);
        updatedFields.historico = historico;
      }

      await updateDoc(docRef, updatedFields);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// 14. SUBSCRIBE ALL PROGRESS FOR CLASS OR ALL CLASSES (Teacher View)
export function subscribeAllProgress(
  callback: (progressList: StudentProgress[]) => void,
  classId?: string,
  onError?: (err: any) => void
): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  const colRef = collection(db, "student_progress");
  const q = classId ? query(colRef, where("classId", "==", classId)) : colRef;

  return onSnapshot(
    q,
    (snapshot) => {
      const list: StudentProgress[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as StudentProgress);
      });
      callback(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, "student_progress");
    }
  );
}

// 15. SUBSCRIBE ALL USERS FOR ROLE MANAGEMENT
export function subscribeUsers(
  callback: (users: any[]) => void,
  onError?: (err: any) => void
): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  return onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data());
      });
      callback(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, "users");
    }
  );
}

// 16. UPDATE USER ROLE IN FIRESTORE
export async function updateUserRoleFirestore(
  uid: string, 
  role: "admin" | "professor" | "aluno", 
  name?: string, 
  email?: string
): Promise<void> {
  const { db } = initFirebase();
  if (!db) return;

  const docRef = doc(db, "users", uid);
  const updates: any = { role };
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;

  try {
    await setDoc(docRef, updates, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}


