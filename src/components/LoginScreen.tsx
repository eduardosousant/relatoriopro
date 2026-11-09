import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, Droplets, ArrowRight, Cloud, Loader2 } from 'lucide-react';
import { useAuth } from '../services/useAuth';
import { isSupabaseConfigured } from '../services/supabaseClient';

export const LoginScreen: React.FC = () => {
  const { loginComSupabase } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const res = await loginComSupabase(usuario, senha);
      if (!res.sucesso) {
        setErro(res.mensagem || 'Credenciais inválidas no Supabase.');
      }
    } catch (err: any) {
      setErro('Falha na comunicação com o servidor de autenticação.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1B2A3B] to-[#0A111E] p-4 sm:p-6 text-[#1B2A3B]">
      {/* Container Principal */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
        {/* Topo Institucional */}
        <div className="bg-[#1B2A3B] px-8 py-8 text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#E8A020]/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/15 text-[#E8A020] mb-3.5 shadow-inner">
            <Droplets className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            Relator<span className="text-[#E8A020]">PRO</span>
          </h1>
          <p className="text-xs font-medium text-slate-300 mt-1 max-w-xs mx-auto">
            Sistema de Laudos Técnicos Hidrogeológicos e Testes de Bombeamento ABNT
          </p>
        </div>

        {/* Formulário de Acesso */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="text-center pb-1 flex flex-col items-center gap-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Acesso Restrito do Responsável Técnico</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600">
              <Cloud className="w-3.5 h-3.5" />
              <span>{isSupabaseConfigured ? 'Supabase Auth Conectado' : 'Modo Offline Ativo'}</span>
            </div>
          </div>

          {erro && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Campo Usuário */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Usuário ou E-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="adm ou seu e-mail"
                required
                autoFocus
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A3B] focus:border-transparent transition-all placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A3B] focus:border-transparent transition-all placeholder:text-slate-400 font-medium"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3 px-4 rounded-xl bg-[#1B2A3B] hover:bg-[#25394f] active:bg-[#152130] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1B2A3B]/20 transition-all cursor-pointer disabled:opacity-70 mt-2"
          >
            {carregando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#E8A020]" />
                <span>Autenticando no Supabase...</span>
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4 text-[#E8A020]" />
              </>
            )}
          </button>

          <div className="pt-2 text-center text-[11px] text-slate-400 font-mono">
            Autenticação Segura via Supabase Auth • ABNT NBR 12212 / 12244
          </div>
        </form>
      </div>
    </div>
  );
};
