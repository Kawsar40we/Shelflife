import React from 'react';

interface LogoEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const LogoEmblem: React.FC<LogoEmblemProps> = ({ size = 'md', showText = false, className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-16 h-16 rounded-2xl sm:rounded-3xl shadow-lg shadow-purple-500/20',
    xl: 'w-24 h-24 rounded-3xl shadow-xl shadow-purple-600/25 ring-4 ring-purple-100',
  };

  const svgSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white shrink-0 shadow-md transition-transform duration-200 hover:scale-[1.03]`}
        style={{
          boxShadow: '0 8px 24px -4px rgba(124, 58, 237, 0.35)',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className={`${svgSizes[size]} fill-current text-white drop-shadow-sm`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Isometric 3-Cube Cluster */}
          {/* Top Cube */}
          <g transform="translate(0, -6)">
            {/* Top face */}
            <polygon points="50,16 68,26.5 50,37 32,26.5" fill="#FFFFFF" fillOpacity="0.95" />
            {/* Left face */}
            <polygon points="32,26.5 50,37 50,56 32,45.5" fill="#E9D5FF" fillOpacity="0.85" />
            {/* Right face */}
            <polygon points="50,37 68,26.5 68,45.5 50,56" fill="#C084FC" fillOpacity="0.9" />
          </g>

          {/* Bottom Left Cube */}
          <g transform="translate(-18, 25)">
            {/* Top face */}
            <polygon points="50,16 68,26.5 50,37 32,26.5" fill="#FFFFFF" fillOpacity="0.9" />
            {/* Left face */}
            <polygon points="32,26.5 50,37 50,56 32,45.5" fill="#E9D5FF" fillOpacity="0.8" />
            {/* Right face */}
            <polygon points="50,37 68,26.5 68,45.5 50,56" fill="#C084FC" fillOpacity="0.85" />
          </g>

          {/* Bottom Right Cube */}
          <g transform="translate(18, 25)">
            {/* Top face */}
            <polygon points="50,16 68,26.5 50,37 32,26.5" fill="#FFFFFF" fillOpacity="0.9" />
            {/* Left face */}
            <polygon points="32,26.5 50,37 50,56 32,45.5" fill="#E9D5FF" fillOpacity="0.8" />
            {/* Right face */}
            <polygon points="50,37 68,26.5 68,45.5 50,56" fill="#A855F7" fillOpacity="0.95" />
          </g>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span className="font-extrabold tracking-tight text-slate-900 text-lg leading-tight">
            Shelve Life
          </span>
          <span className="text-xs text-purple-600 font-semibold tracking-wide uppercase">
            Checking System
          </span>
        </div>
      )}
    </div>
  );
};
