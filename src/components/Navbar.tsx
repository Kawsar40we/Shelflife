import React from 'react';
import { Shield, User, LogOut, FileSpreadsheet } from 'lucide-react';
import { LogoEmblem } from './LogoEmblem';

interface NavbarProps {
  role: 'ADMIN' | 'USER' | null;
  onLogout: () => void;
  onExport?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ role, onLogout, onExport }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        {/* Logo & Title */}
        <div className="flex items-center gap-2">
          <LogoEmblem size="sm" />
          <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 truncate">
            Shelf Life Checking
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* User Export Button */}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
              title="Export Excel Catalog"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden xs:inline sm:inline">Export</span>
            </button>
          )}

          {/* Role Pill */}
          {role === 'ADMIN' && (
            <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl bg-purple-100 text-purple-800 text-xs font-extrabold">
              <Shield className="w-3.5 h-3.5 text-purple-700" />
              <span>Admin</span>
            </div>
          )}

          {role === 'USER' && (
            <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-extrabold">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              <span>User</span>
            </div>
          )}

          {/* Logout Button */}
          {role && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
