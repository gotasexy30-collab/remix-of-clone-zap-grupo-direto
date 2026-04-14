import React, { useState } from 'react';
import { Lock, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { getSetting, setSetting } from '../../services/settings';

interface AdminLoginProps {
  onLogin: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checked, setChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checked, setChecked] = useState(false);

  React.useEffect(() => {
    getSetting('admin_password').then(pwd => {
      setIsFirstAccess(!pwd);
      setChecked(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isFirstAccess) {
        if (password.length < 4) {
          setError('A senha deve ter pelo menos 4 caracteres');
          return;
        }
        if (password !== confirmPassword) {
          setError('As senhas não coincidem');
          return;
        }
        await setSetting('admin_password', password);
        sessionStorage.setItem('admin_auth', 'true');
        onLogin();
      } else {
        const savedPassword = await getSetting('admin_password');
        if (password === savedPassword) {
          sessionStorage.setItem('admin_auth', 'true');
          onLogin();
        } else {
          setError('Senha incorreta');
        }
      }
    } catch {
      setError('Erro ao verificar senha');
    } finally {
      setLoading(false);
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <Loader2 className="text-[#00a884] animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00a884]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-[#00a884]" size={28} />
          </div>
          <h1 className="text-2xl font-black text-white">Painel Admin</h1>
          <p className="text-[#8696a0] text-sm mt-1">
            {isFirstAccess ? 'Crie uma senha de acesso' : 'Digite a senha para acessar'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-3">
              <KeyRound size={16} className="text-[#8696a0]" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-transparent text-[#e9edef] text-sm outline-none placeholder:text-[#8696a0]/50"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#8696a0] hover:text-[#e9edef] transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isFirstAccess && (
              <>
                <div className="h-px bg-white/5 my-3" />
                <div className="flex items-center gap-3">
                  <KeyRound size={16} className="text-[#8696a0]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirmar senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-transparent text-[#e9edef] text-sm outline-none placeholder:text-[#8696a0]/50"
                  />
                </div>
              </>
            )}
          </div>

          {error && <p className="text-xs text-center text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00a884] text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#00a884]/90 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {isFirstAccess ? 'Criar Senha' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
