import React from 'react';
import { LogoEmblem } from './LogoEmblem';

interface LoginScreenProps {
  onSelectRole: (role: 'ADMIN' | 'USER') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-purple-500 selection:text-white">
      <div className="w-full max-w-xs mx-auto text-center space-y-8">
        {/* Logo Emblem & Title */}
        <div className="flex flex-col items-center gap-3">
          <LogoEmblem size="lg" />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Shelf Life Checking
          </h1>
        </div>

        {/* Clean Admin & User Buttons Only */}
        <div className="space-y-3">
          <button
            onClick={() => onSelectRole('ADMIN')}
            className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-purple-50 active:bg-purple-100 border-2 border-slate-200 hover:border-purple-500 text-purple-900 font-extrabold text-lg shadow-sm transition cursor-pointer"
          >
            Admin
          </button>

          <button
            onClick={() => onSelectRole('USER')}
            className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-emerald-50 active:bg-emerald-100 border-2 border-slate-200 hover:border-emerald-500 text-emerald-900 font-extrabold text-lg shadow-sm transition cursor-pointer"
          >
            User
          </button>
        </div>
      </div>
    </div>
  );
};
