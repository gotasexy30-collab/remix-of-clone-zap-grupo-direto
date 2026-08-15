import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';

interface AdminLoginProps {
  onLogin: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (session === 'active') {
      onLogin();
    }
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get password from environment variable (Vite prefix required for client-side access)
    // If not set, it defaults to checking against a hardcoded string or fails
    const expectedPassword = import.meta.env.VITE_SENHA_DE_ADMINISTRADOR;

    if (password === expectedPassword) {
      localStorage.setItem('admin_session', 'active');
      onLogin();
    } else {
      setError('Senha incorreta');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00a884]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-[#00a884]" size={28} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Acesso Restrito</h1>
          <p className="text-[#8696a0] text-sm mt-1">Digite a senha de administrador</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-inner">
            <div className="flex items-center gap-3">
              <KeyRound size={18} className="text-[#8696a0]" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha do Sistema"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full bg-transparent text-[#e9edef] text-sm outline-none placeholder:text-[#8696a0]/50"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="text-[#8696a0] hover:text-[#e9edef] transition-colors p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl py-2 px-4 animate-shake">
              <p className="text-xs text-center text-red-400 font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00a884] text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#00a884]/90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#00a884]/20"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Entrar no Painel"}
          </button>
        </form>
        
        <p className="mt-8 text-center text-[10px] text-[#8696a0] uppercase tracking-[0.2em] font-bold opacity-50">
          Sistema de Gerenciamento WhatsApp
        </p>
      </div>
    </div>
  );
};
