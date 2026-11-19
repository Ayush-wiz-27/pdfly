import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Lock, Loader2, User, KeyRound } from 'lucide-react';
import logoUrl from '../assets/pdf-analyser-logo.svg';

export default function AuthScreen() {
  const { setAuthToken, setCurrentUser, api } = useAppContext();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Both username and password are required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
      const response = await api.post(endpoint, {
        username: username.trim(),
        password
      });

      const { token, user, message } = response.data;
      
      // Save session in context
      setAuthToken(token);
      setCurrentUser(user);
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.response?.data?.error || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setUsername('');
    setPassword('');
    setError('');
    setSuccessMsg('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel glass-panel-glow w-full max-w-sm rounded-2xl p-8 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4">
          <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
        </div>

        <h1 className="text-xl font-bold text-slate-100 tracking-wide">PDFly</h1>
        <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wider text-amber-400/80">
          {isSignUp ? 'Create Account' : 'SIGN IN'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
          {/* Username field */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="glass-input w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none placeholder-slate-600 font-medium"
                disabled={loading}
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="glass-input w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none placeholder-slate-600"
                disabled={loading}
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-400 bg-rose-950/20 border border-rose-500/20 px-3 py-2 rounded-lg leading-relaxed">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full pill-button-primary py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isSignUp ? 'Create Account' : 'LOGIN'}
              </>
            )}
          </button>
        </form>

        {/* Toggle auth mode */}
        <div className="mt-6 text-xs text-slate-400">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button onClick={toggleAuthMode} className="text-amber-400 hover:text-amber-300 font-medium underline cursor-pointer">
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button onClick={toggleAuthMode} className="text-amber-400 hover:text-amber-300 font-medium underline cursor-pointer">
                Sign Up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
