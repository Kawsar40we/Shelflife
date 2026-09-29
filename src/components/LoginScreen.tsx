import React from 'react';
import { LogoEmblem } from './LogoEmblem';
import { Shield, User, Wifi } from 'lucide-react';

interface LoginScreenProps {
  onSelectRole: (role: 'ADMIN' | 'USER') => void;
  itemCount?: number;
  isLiveSynced?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSelectRole,
  itemCount = 0,
  isLiveSynced = true,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-purple-500 selection:text-white">
      <div className="w-full max-w-xs mx-auto text-center space-y-6">
        {/* Logo Emblem & Title */}
        <div className="flex flex-col items-center gap-3">
          <LogoEmblem size="lg" />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Shelf Life Checking
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Multi-Device Cloud Barcode & Audit System
          </p>
        </div>

        {/* Live Sync Status Banner */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs text-xs font-semibold text-slate-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {isLiveSynced ? 'Cloud Connected' : 'Connecting...'}
            {itemCount > 0 && ` • ${itemCount} ${itemCount === 1 ? 'Item' : 'Items'}`}
          </span>
        </div>

        {/* Clean Admin & User Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => onSelectRole('ADMIN')}
            className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-purple-50 active:bg-purple-100 border-2 border-slate-200 hover:border-purple-500 text-purple-900 font-extrabold text-lg shadow-sm transition cursor-pointer flex items-center justify-center gap-2.5 group"
          >
            <Shield className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
            <span>Admin</span>
          </button>

          <button
            onClick={() => onSelectRole('USER')}
            className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-emerald-50 active:bg-emerald-100 border-2 border-slate-200 hover:border-emerald-500 text-emerald-900 font-extrabold text-lg shadow-sm transition cursor-pointer flex items-center justify-center gap-2.5 group"
          >
            <User className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span>User</span>
          </button>
        </div>
      </div>
    </div>
  );
};
