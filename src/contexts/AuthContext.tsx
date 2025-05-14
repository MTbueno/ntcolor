
"use client";
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  type AuthError
} from 'firebase/auth';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  currentUser: User | null;
  loadingAuth: boolean;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  mapAuthCodeToMessage: (authCode: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const mapAuthCodeToMessage = (authCode: string): string => {
    switch (authCode) {
      case 'auth/invalid-email':
        return 'O formato do email fornecido é inválido.';
      case 'auth/user-disabled':
        return 'Este usuário foi desabilitado.';
      case 'auth/user-not-found':
        return 'Nenhum usuário encontrado com este email.';
      case 'auth/wrong-password':
        return 'Senha incorreta. Tente novamente.';
      case 'auth/email-already-in-use':
        return 'Este email já está em uso por outra conta.';
      case 'auth/weak-password':
        return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
      case 'auth/operation-not-allowed':
        return 'Login com email e senha não está habilitado.';
      case 'auth/missing-password':
        return 'Por favor, insira sua senha.';
      default:
        return 'Ocorreu um erro desconhecido. Tente novamente.';
    }
  };

  const signIn = async (email: string, password: string): Promise<User | null> => {
    if (!auth) {
      console.error("Firebase auth não está inicializado.");
      throw new Error("Serviço de autenticação indisponível.");
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      const authError = error as AuthError;
      console.error("Erro ao entrar: ", authError);
      throw new Error(mapAuthCodeToMessage(authError.code));
    }
  };

  const signUp = async (email: string, password: string): Promise<User | null> => {
    if (!auth) {
      console.error("Firebase auth não está inicializado.");
      throw new Error("Serviço de autenticação indisponível.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      const authError = error as AuthError;
      console.error("Erro ao registrar: ", authError);
      throw new Error(mapAuthCodeToMessage(authError.code));
    }
  };

  const signOut = async () => {
    if (!auth) {
      console.error("Firebase auth não está inicializado.");
      return;
    }
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Erro ao sair: ", error);
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) {
      console.error("Firebase auth não está inicializado.");
      throw new Error("Serviço de autenticação indisponível.");
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      const authError = error as AuthError;
      console.error("Erro ao redefinir senha: ", authError);
      throw new Error(mapAuthCodeToMessage(authError.code));
    }
  };

  useEffect(() => {
    if (auth && auth.app && auth.app.options) {
      console.log('Firebase Auth Domain (SDK client-side):', auth.app.options.authDomain);
    } else {
      console.warn('Firebase auth object or auth.app.options is not fully initialized when trying to log authDomain.');
    }

    if (!auth) {
      console.error("Firebase auth não está inicializado no onAuthStateChanged. Verifique a configuração.");
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    loadingAuth,
    signIn,
    signUp,
    signOut,
    resetPassword,
    mapAuthCodeToMessage,
  };

  return <AuthContext.Provider value={value}>{!loadingAuth && children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
