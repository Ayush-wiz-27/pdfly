import React from 'react';
import { LogOut } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Header() {
  const { startNewChat, logout, currentUser } = useAppContext();

  // Get user initial for avatar
  const getAvatarChar = () => {
    if (!currentUser || !currentUser.username) return 'U';
    return currentUser.username.charAt(0).toUpperCase();
  };

  return (
    <header className="p-4 border-b border-white/5 bg-slate-950/20 backdrop-blur-md flex items-center justify-between z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={startNewChat}
          className="pill-button-glass text-xs font-semibold px-4 py-1.5 transition-all cursor-pointer"
        >
          New Chat
        </button>
      </div>

      
      <div className="flex items-center gap-3">
        {/* User info */}
        {currentUser && (
          <span className="text-xs font-semibold text-amber-300 font-mono truncate max-w-[200px]">
            Hello,{currentUser.username}
          </span>
          
        )}

        <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold flex items-center justify-center text-amber-300 font-mono">
              {getAvatarChar()}
        </div>
        <button
          onClick={() => { if (window.confirm("Are you sure you want to log out?")) { logout(); } }}
          className="pill-button-glass hover:bg-red-950/20 hover:text-red-400 border border-white/5 hover:border-red-500/20 text-xs font-semibold px-3.5 py-1.5 transition-all cursor-pointer flex items-center justify-center"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
