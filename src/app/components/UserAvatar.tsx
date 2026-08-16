'use client';

import React from 'react';

interface UserAvatarProps {
  image?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  roundedClassName?: string;
}

export function UserAvatar({
  image,
  name,
  size = 'md',
  className = '',
  roundedClassName = 'rounded-lg',
}: UserAvatarProps) {
  const displayName = name || 'User';
  const initial = displayName[0]?.toUpperCase() || 'U';

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-9 h-9 text-xs',
    xl: 'w-16 h-16 text-2xl',
  }[size];

  if (image && image.startsWith('preset:')) {
    const [, , emoji, bgClass] = image.split(':');
    const colorMap: Record<string, string> = {
      indigo: 'bg-indigo-600',
      emerald: 'bg-emerald-600',
      purple: 'bg-purple-600',
      amber: 'bg-amber-600',
      cyan: 'bg-cyan-600',
      rose: 'bg-rose-600',
      orange: 'bg-orange-600',
      blue: 'bg-blue-600',
    };
    const bgBg = colorMap[bgClass] || 'bg-indigo-600';

    return (
      <div
        className={`${sizeClasses} ${roundedClassName} ${bgBg} flex items-center justify-center text-white shadow-sm shrink-0 border border-white/20 select-none overflow-hidden ${className}`}
      >
        <span>{emoji}</span>
      </div>
    );
  }

  if (image && (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/'))) {
    return (
      <img
        src={image}
        alt={displayName}
        className={`${sizeClasses} ${roundedClassName} object-cover shadow-sm shrink-0 border border-gray-200 dark:border-neutral-700 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} ${roundedClassName} bg-slate-900 dark:bg-neutral-800 text-white font-bold flex items-center justify-center shadow-sm shrink-0 select-none ${className}`}
    >
      {initial}
    </div>
  );
}
