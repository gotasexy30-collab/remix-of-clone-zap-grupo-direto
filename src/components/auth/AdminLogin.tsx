import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Mail, KeyRound, Loader2 } from 'lucide-react';

interface AdminLoginProps {
  onLogin: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('Conta criada! Verifique seu email para confirmar.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00a884]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-[#00a884]" size={28} />
          </div>
          <h1 className="text-2xl font-black text-white">Painel Admin</h1>
          <p className="text-[#8696a0] text-sm mt-1">Faça login para acessar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <Mail size={16} className="text-[#8696a0]" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent text-[#e9edef] text-sm outline-none placeholder:text-[#8696a0]/50"
              />
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex items-center gap-3 mt-3">
              <KeyRound size={16} className="text-[#8696a0]" />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-transparent text-[#e9edef] text-sm outline-none placeholder:text-[#8696a0]/50"
              />
            </div>
          </div>

          {error && (
            <p className={`text-xs text-center ${error.includes('Conta criada') ? 'text-[#00a884]' : 'text-red-400'}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00a884] text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#00a884]/90 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {isSignUp ? 'Criar Conta' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="w-full text-[#8696a0] text-xs text-center hover:text-[#00a884] transition-colors"
          >
            {isSignUp ? 'Já tenho uma conta' : 'Criar nova conta admin'}
          </button>
        </form>
      </div>
    </div>
  );
};
