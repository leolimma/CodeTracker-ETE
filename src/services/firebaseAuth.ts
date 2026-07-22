import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User as FirebaseUser,
  onAuthStateChanged
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  serverTimestamp 
} from "firebase/firestore";
import { initFirebase, isFirebaseConfigured } from "../lib/firebase";

// Define Roles for RBAC
export type UserRole = "admin" | "professor" | "aluno";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt?: string;
  isSimulated?: boolean;
}

// Simulated users for demonstration when Firebase is not yet connected
const SIMULATED_USERS: Record<string, AppUser & { password: string }> = {
  "admin@ete.br": {
    uid: "sim-uid-admin",
    email: "admin@ete.br",
    role: "admin",
    name: "Administrador Pedro Leão",
    password: "123456",
    isSimulated: true
  },
  "alberto@ete.br": {
    uid: "sim-uid-prof",
    email: "alberto@ete.br",
    role: "professor",
    name: "Prof. Alberto Santos",
    password: "123456",
    isSimulated: true
  },
  "ana@ete.br": {
    uid: "sim-uid-ana",
    email: "ana@ete.br",
    role: "aluno",
    name: "Ana Silva",
    password: "123456",
    isSimulated: true
  },
  "carlos@ete.br": {
    uid: "sim-uid-carlos",
    email: "carlos@ete.br",
    role: "aluno",
    name: "Carlos Oliveira",
    password: "123456",
    isSimulated: true
  },
  "fernanda@ete.br": {
    uid: "sim-uid-fernanda",
    email: "fernanda@ete.br",
    role: "aluno",
    name: "Fernanda Santos",
    password: "123456",
    isSimulated: true
  },
  "lucas@ete.br": {
    uid: "sim-uid-lucas",
    email: "lucas@ete.br",
    role: "aluno",
    name: "Lucas Martins",
    password: "123456",
    isSimulated: true
  }
};

/**
 * Tasks 1 & 3: Firebase Auth and RBAC Role Fetching / Default Role Creation
 */

// 1. SIGN IN (Login with Email & Password + Get Role)
export async function loginWithFirebase(email: string, password: string): Promise<AppUser> {
  const { auth, db, isMock } = initFirebase();

  // Mode: SIMULATED (No real keys configured yet)
  if (isMock || !auth || !db) {
    const lowerEmail = email.toLowerCase().trim();
    
    // First, check backend /api/users to see if user has been promoted/edited
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const allUsers = await res.json();
        const match = allUsers.find((u: any) => u.email?.toLowerCase().trim() === lowerEmail);
        if (match) {
          // If we have a password in SIMULATED_USERS, let's check it
          const simUser = SIMULATED_USERS[lowerEmail];
          const expectedPassword = simUser ? simUser.password : "ete123";
          if (password !== expectedPassword && password !== "123456") {
            throw new Error("Senha incorreta.");
          }
          return {
            uid: match.uid,
            email: match.email,
            role: match.role,
            name: match.name,
            isSimulated: true
          };
        }
      }
    } catch (err: any) {
      console.error("Error checking backend users during simulated login:", err);
      if (err.message === "Senha incorreta.") {
        throw err;
      }
    }

    const simUser = SIMULATED_USERS[lowerEmail];
    if (simUser && simUser.password === password) {
      return {
        uid: simUser.uid,
        email: simUser.email,
        role: simUser.role,
        name: simUser.name,
        isSimulated: true
      };
    }

    // Dynamic database check for students
    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const allStudents = await res.json();
        const match = allStudents.find(
          (s: any) => s.email?.toLowerCase().trim() === email.toLowerCase().trim() && (s.password === password || (!s.password && password === "ete123"))
        );
        if (match) {
          return {
            uid: "sim-uid-dyn-student-" + match.id,
            email: match.email || email,
            role: "aluno",
            name: match.name,
            isSimulated: true
          };
        }
      }
    } catch (err) {
      console.error("Error looking up dynamic student during login:", err);
    }

    // Dynamic database check for teachers
    try {
      const res = await fetch("/api/teachers");
      if (res.ok) {
        const allTeachers = await res.json();
        const match = allTeachers.find(
          (t: any) => {
            const matchesEmail = t.email?.toLowerCase().trim() === email.toLowerCase().trim() ||
                                t.username?.toLowerCase().trim() === email.toLowerCase().trim() ||
                                t.username?.toLowerCase().trim() === email.split("@")[0].toLowerCase().trim();
            const matchesPassword = t.password === password || (!t.password && password === "ete123");
            return matchesEmail && matchesPassword;
          }
        );
        if (match) {
          return {
            uid: "sim-uid-dyn-teacher-" + match.id,
            email: match.email || `${match.username}@ete.br`,
            role: "professor",
            name: match.name,
            isSimulated: true
          };
        }
      }
    } catch (err) {
      console.error("Error looking up dynamic teacher during login:", err);
    }
    
    // Allow dynamic creation of simulated users if we're in mock mode
    if (email.includes("@")) {
      return {
        uid: "sim-uid-dynamic-" + Date.now(),
        email: email,
        role: "aluno", // Default role
        name: email.split("@")[0].toUpperCase(),
        isSimulated: true
      };
    }

    throw new Error("Usuário ou senha incorretos (Demonstração: use admin@ete.br, alberto@ete.br ou ana@ete.br com senha '123456').");
  }

  // Mode: REAL FIREBASE
  try {
    // Auth Sign In
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Fetch user profile & role from Firestore
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || email,
        role: (userData.role as UserRole) || "aluno",
        name: userData.name || firebaseUser.email?.split("@")[0] || "Usuário",
        createdAt: userData.createdAt?.toDate?.()?.toISOString() || ""
      };
    } else {
      // If authenticating succeeds but Firestore document is missing, provision role based on email or default
      let role: UserRole = "aluno";
      let name = firebaseUser.email?.split("@")[0] || "Usuário Aluno";

      try {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const q = query(collection(db, "students"), where("email", "==", email.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const studentDoc = snap.docs[0].data();
          role = "aluno";
          name = studentDoc.name || name;
        } else {
          const lowerEmail = email.toLowerCase().trim();
          if (SIMULATED_USERS[lowerEmail]) {
            role = SIMULATED_USERS[lowerEmail].role;
            name = SIMULATED_USERS[lowerEmail].name;
          }
        }
      } catch (err) {
        console.error("Error matching student email in Firestore:", err);
      }

      const defaultUser: AppUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || email,
        role,
        name
      };

      await setDoc(userDocRef, {
        uid: defaultUser.uid,
        email: defaultUser.email,
        role: defaultUser.role,
        name: defaultUser.name,
        createdAt: serverTimestamp()
      });

      return defaultUser;
    }
  } catch (error: any) {
    console.error("Erro no login Firebase Auth:", error);
    
    // Auto-registration on-the-fly for a seamless user/test experience
    const errorCode = error.code;
    const isInvalidCred = errorCode === "auth/user-not-found" || 
                         errorCode === "auth/wrong-password" || 
                         errorCode === "auth/invalid-credential" ||
                         (error.message && error.message.includes("auth/invalid-credential"));
                         
    if (isInvalidCred) {
      try {
        const lowerEmail = email.toLowerCase().trim();
        
        // 1. Check if simulated user
        if (SIMULATED_USERS[lowerEmail]) {
          const role = SIMULATED_USERS[lowerEmail].role;
          const name = SIMULATED_USERS[lowerEmail].name;
          console.log(`[Auth] Auto-registrando usuário simulado: ${email} com papel ${role}`);
          return await registerWithFirebase(email, password, name, role);
        }
        
        // 2. Check if student in server database
        try {
          const res = await fetch("/api/students");
          if (res.ok) {
            const allStudents = await res.json();
            const match = allStudents.find(
              (s: any) => s.email?.toLowerCase().trim() === lowerEmail && (s.password === password || (!s.password && password === "ete123"))
            );
            if (match) {
              console.log(`[Auth] Auto-registrando aluno dinâmico: ${email}`);
              return await registerWithFirebase(email, password, match.name, "aluno");
            }
          }
        } catch (studentErr) {
          console.error("Error looking up dynamic student during auto-reg:", studentErr);
        }

        // 3. Check if teacher in server database
        try {
          const res = await fetch("/api/teachers");
          if (res.ok) {
            const allTeachers = await res.json();
            const match = allTeachers.find((t: any) => {
              const matchesEmail = t.email?.toLowerCase().trim() === lowerEmail ||
                                  t.username?.toLowerCase().trim() === lowerEmail ||
                                  t.username?.toLowerCase().trim() === email.split("@")[0].toLowerCase().trim();
              const matchesPassword = t.password === password || (!t.password && password === "ete123");
              return matchesEmail && matchesPassword;
            });
            if (match) {
              console.log(`[Auth] Auto-registrando professor dinâmico: ${email}`);
              const finalEmail = match.email || `${match.username}@ete.br`;
              return await registerWithFirebase(finalEmail, password, match.name, "professor");
            }
          }
        } catch (teacherErr) {
          console.error("Error looking up dynamic teacher during auto-reg:", teacherErr);
        }
      } catch (regErr) {
        console.error("Erro ao auto-registrar usuário durante login:", regErr);
        // If registration fails, throw the original login error
      }
    }

    let errorMsg = "Falha na autenticação.";
    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      errorMsg = "E-mail ou senha incorretos.";
    } else if (error.code === "auth/invalid-email") {
      errorMsg = "Formato de e-mail inválido.";
    } else {
      errorMsg = error.message || errorMsg;
    }
    throw new Error(errorMsg);
  }
}

// 2. SIGN UP (Create User + Set Default Role: "aluno" - Task 3)
export async function registerWithFirebase(email: string, password: string, name: string, forcedRole?: UserRole): Promise<AppUser> {
  const { auth, db, isMock } = initFirebase();

  // Mode: SIMULATED (No real keys configured yet)
  if (isMock || !auth || !db) {
    const newUser: AppUser = {
      uid: "sim-uid-" + Math.random().toString(36).substring(7),
      email,
      role: forcedRole || "aluno", // Default to aluno
      name,
      isSimulated: true
    };
    SIMULATED_USERS[email.toLowerCase()] = { ...newUser, password };
    
    // Persist to local database server
    try {
      await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: newUser.uid,
          email: newUser.email,
          role: newUser.role,
          name: newUser.name,
          actorName: name,
          actorType: "Aluno"
        })
      });
    } catch (err) {
      console.error("Failed to persist simulated user on server:", err);
    }
    
    return newUser;
  }

  // Mode: REAL FIREBASE
  try {
    // Auth Sign Up
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Default User Data mapping
    let finalName = name || email.split("@")[0];
    let finalRole = forcedRole || "aluno";
    try {
      const { collection, query, where, getDocs, deleteDoc, doc } = await import("firebase/firestore");
      
      // 1. Check if there's a pre-configured user profile in the "users" collection (e.g. created by Admin)
      const qUser = query(collection(db, "users"), where("email", "==", email.toLowerCase().trim()));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        const preUserDoc = snapUser.docs[0];
        const preUserData = preUserDoc.data();
        finalName = preUserData.name || finalName;
        finalRole = preUserData.role || finalRole;
        
        // If the pre-configured document had a simulated or temporary key, clean it up
        if (preUserDoc.id !== firebaseUser.uid) {
          try {
            await deleteDoc(doc(db, "users", preUserDoc.id));
          } catch (delErr) {
            console.error("Error deleting placeholder user document:", delErr);
          }
        }
      } else {
        // 2. Check if there's a pre-registered student
        const q = query(collection(db, "students"), where("email", "==", email.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const studentDoc = snap.docs[0].data();
          finalName = studentDoc.name || finalName;
          finalRole = "aluno";
        }
      }
    } catch (e) {
      console.error("Error looking up pre-registered data during Firebase signup:", e);
    }

    const newUserProfile = {
      uid: firebaseUser.uid,
      email: email,
      role: finalRole,
      name: finalName,
      createdAt: serverTimestamp()
    };

    // Save user document in Firestore "users" collection
    await setDoc(doc(db, "users", firebaseUser.uid), newUserProfile);

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || email,
      role: newUserProfile.role as UserRole,
      name: newUserProfile.name
    };
  } catch (error: any) {
    console.error("Erro no cadastro Firebase Auth:", error);
    let errorMsg = "Falha ao registrar novo usuário.";
    if (error.code === "auth/email-already-in-use") {
      errorMsg = "Este endereço de e-mail já está em uso.";
    } else if (error.code === "auth/weak-password") {
      errorMsg = "A senha é muito fraca (mínimo de 6 caracteres).";
    } else {
      errorMsg = error.message || errorMsg;
    }
    throw new Error(errorMsg);
  }
}

// 3. LOGOUT
export async function logoutFirebase(): Promise<void> {
  const { auth, isMock } = initFirebase();
  if (isMock || !auth) {
    // Simulated logout is instantaneous state clear
    return;
  }
  await signOut(auth);
}

// 4. SUBSCRIBE TO AUTH STATE (Detect persistent sessions)
export function subscribeToAuth(callback: (user: AppUser | null) => void): () => void {
  const { auth, db, isMock } = initFirebase();

  if (isMock || !auth || !db) {
    // Mock state listener: no active real credentials, just return empty unsubscribe
    return () => {};
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          callback({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            role: (userData.role as UserRole) || "aluno",
            name: userData.name || "Usuário"
          });
        } else {
          callback({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            role: "aluno", // Default fallback
            name: firebaseUser.email?.split("@")[0] || "Usuário"
          });
        }
      } catch (e) {
        console.error("Erro ao escutar estado do usuário no Firestore:", e);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}
