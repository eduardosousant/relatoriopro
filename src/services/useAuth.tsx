import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  estaAutenticado: boolean;
  carregando: boolean;
  loginComSupabase: (identificador: string, senhaPlana: string) => Promise<{ sucesso: boolean; mensagem?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  estaAutenticado: false,
  carregando: true,
  loginComSupabase: async () => ({ sucesso: false }),
  logout: async () => {},
});

/**
 * Converte nomes de usuário simples (como "adm" ou "LuizKatiana") em um e-mail válido
 * aceito pela especificação RFC 5322 do Supabase Auth.
 */
export function normalizarIdentificadorParaEmail(identificador: string): string {
  const limpo = identificador.trim().toLowerCase();
  if (limpo.includes('@')) {
    return limpo;
  }
  // Se o usuário digitou apenas "adm" ou "luizkatiana", converte para email no domínio da aplicação
  return `${limpo}@relatorpro.app`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  // Inicializa e escuta mudanças de estado do Supabase Auth
  useEffect(() => {
    let montado = true;

    async function checarSessaoInicial() {
      try {
        if (supabase && isSupabaseConfigured) {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data?.session && montado) {
            setSession(data.session);
            setUser(data.session.user);
            setCarregando(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Erro ao checar sessão no Supabase:', err);
      }

      // Fallback para sessão local rápida se offline
      if (typeof window !== 'undefined') {
        const usuarioLocal = localStorage.getItem('relatorpro_auth_user');
        if (usuarioLocal && montado) {
          // Cria um usuário mock local representativo
          setUser({
            id: 'local-adm',
            email: `${usuarioLocal}@relatorpro.app`,
            app_metadata: {},
            user_metadata: { name: 'Administrador' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          } as User);
        }
      }

      if (montado) {
        setCarregando(false);
      }
    }

    checarSessaoInicial();

    // Inscreve no listener de eventos do Supabase Auth (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
    let subscription: { unsubscribe: () => void } | null = null;
    if (supabase && isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
        if (!montado) return;
        setSession(novaSessao);
        setUser(novaSessao?.user || null);
        if (novaSessao?.user) {
          localStorage.setItem('relatorpro_auth_user', novaSessao.user.email || 'adm');
        } else {
          localStorage.removeItem('relatorpro_auth_user');
        }
      });
      subscription = data.subscription;
    }

    return () => {
      montado = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  /**
   * Realiza login no Supabase Auth.
   * Se o usuário ainda não existir no Supabase, cria automaticamente via signUp
   * para que o acesso funcione imediatamente em qualquer lugar sem bloqueios.
   */
  const loginComSupabase = async (
    identificador: string,
    senhaPlana: string
  ): Promise<{ sucesso: boolean; mensagem?: string }> => {
    const emailNormalizado = normalizarIdentificadorParaEmail(identificador);
    const senhaLimpa = senhaPlana.trim();

    // Validação básica
    if (!senhaLimpa || senhaLimpa.length < 6) {
      return { sucesso: false, mensagem: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    if (supabase && isSupabaseConfigured) {
      try {
        // 1. Tenta fazer login com a conta existente
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: emailNormalizado,
          password: senhaLimpa,
        });

        if (!loginError && loginData.session) {
          setSession(loginData.session);
          setUser(loginData.session.user);
          localStorage.setItem('relatorpro_auth_user', emailNormalizado);
          return { sucesso: true };
        }

        // 2. Se o usuário não foi encontrado ou credencial inválida, tenta auto-provisionar a conta no Supabase
        if (
          loginError?.message.toLowerCase().includes('invalid login credentials') ||
          loginError?.message.toLowerCase().includes('user not found')
        ) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: emailNormalizado,
            password: senhaLimpa,
            options: {
              data: {
                nome: identificador,
                criadoEm: new Date().toISOString(),
              },
            },
          });

          if (!signUpError && signUpData.user) {
            // Se o Supabase confirmou ou fez auto-login
            if (signUpData.session) {
              setSession(signUpData.session);
              setUser(signUpData.user);
            }
            localStorage.setItem('relatorpro_auth_user', emailNormalizado);
            return { sucesso: true };
          }
        }

        // Se houver erro específico do Supabase, retorna a mensagem
        if (loginError) {
          // Permite fallback local se a senha corresponder a LuizKatiana
          if (
            (identificador.toLowerCase() === 'adm' || identificador.toLowerCase() === 'luizkatiana') &&
            senhaLimpa === 'LuizKatiana'
          ) {
            localStorage.setItem('relatorpro_auth_user', 'adm');
            setUser({
              id: 'local-adm',
              email: `${identificador}@relatorpro.app`,
              app_metadata: {},
              user_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            } as User);
            return { sucesso: true };
          }

          return { sucesso: false, mensagem: loginError.message };
        }
      } catch (err: any) {
        console.warn('Erro ao autenticar com Supabase:', err);
      }
    }

    // Fallback local se o Supabase não estiver acessível
    if (
      (identificador.toLowerCase() === 'adm' || identificador.toLowerCase() === 'luizkatiana') &&
      senhaLimpa === 'LuizKatiana'
    ) {
      localStorage.setItem('relatorpro_auth_user', 'adm');
      setUser({
        id: 'local-adm',
        email: `${identificador}@relatorpro.app`,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as User);
      return { sucesso: true };
    }

    return { sucesso: false, mensagem: 'Credenciais inválidas no Supabase.' };
  };

  const logout = async () => {
    try {
      if (supabase && isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Erro no signOut do Supabase:', err);
    } finally {
      localStorage.removeItem('relatorpro_auth_user');
      localStorage.removeItem('relatorpro_auth_time');
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        estaAutenticado: Boolean(user),
        carregando,
        loginComSupabase,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
