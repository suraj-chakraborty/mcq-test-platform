'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { 
  Brain, 
  Sparkles, 
  UploadCloud, 
  LayoutDashboard, 
  BookOpen, 
  PenTool, 
  LogOut, 
  Menu, 
  X, 
  ChevronDown, 
  Plus,
  Settings,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/upload', label: 'Upload PDF', icon: UploadCloud },
    { href: '/tests', label: 'Explore Tests', icon: BookOpen },
    { href: '/descriptive', label: 'AI Studio', icon: PenTool },
  ];

  const isActive = (path: string) => pathname === path || (path !== '/dashboard' && pathname?.startsWith(path));

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 dark:bg-neutral-900/90 border-b border-gray-200/80 dark:border-neutral-800 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex items-center justify-center p-1 shadow-sm overflow-hidden shrink-0">
              <img src="/logo.png" alt="QP Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white">
                  MCQ<span className="text-indigo-600 dark:text-indigo-400">Test</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-neutral-700">
                  PRO
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          {session && (
            <nav className="hidden md:flex items-center gap-1 bg-gray-100/70 dark:bg-neutral-800/60 p-1 rounded-lg border border-gray-200/60 dark:border-neutral-700/60">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all ${
                      active
                        ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm border border-gray-200/70 dark:border-neutral-700'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/create-test"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Test</span>
                </Link>

                <Link
                  href="/settings"
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors hidden sm:flex items-center justify-center"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 border border-transparent transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-neutral-800 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                      {session.user?.name?.[0] || 'U'}
                    </div>
                    <div className="hidden lg:flex flex-col text-left">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">
                        {session.user?.name || 'User'}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
                  </button>

                  <AnimatePresence>
                    {userDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setUserDropdownOpen(false)} 
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98, y: 5 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 mt-2 w-52 rounded-xl bg-white dark:bg-neutral-900 p-1.5 shadow-xl border border-gray-200 dark:border-neutral-800 z-50"
                        >
                          <div className="p-2.5 border-b border-gray-100 dark:border-neutral-800 mb-1">
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {session.user?.name}
                            </p>
                            <p className="text-[11px] font-medium text-gray-400 truncate">
                              {session.user?.email}
                            </p>
                          </div>

                          <Link
                            href="/dashboard"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <LayoutDashboard className="w-3.5 h-3.5 text-gray-400" />
                            <span>Dashboard</span>
                          </Link>

                          <Link
                            href="/upload"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <UploadCloud className="w-3.5 h-3.5 text-gray-400" />
                            <span>Upload PDF</span>
                          </Link>

                          <Link
                            href="/profile"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span>My Profile & Stats</span>
                          </Link>

                          <Link
                            href="/settings"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5 text-gray-400" />
                            <span>Settings & AI Key</span>
                          </Link>

                          <div className="border-t border-gray-100 dark:border-neutral-800 my-1 pt-1">
                            <button
                              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Sign Out</span>
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mobile Menu Toggle (Only on mobile) */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle Menu"
                  className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/signin"
                  className="h-9 px-3.5 rounded-lg flex items-center text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="h-9 px-4 rounded-lg flex items-center text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && session && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-100 dark:border-neutral-800 py-3 space-y-1"
            >
              {/* User Profile Summary */}
              <div className="px-3 py-2 border-b border-gray-100 dark:border-neutral-800 mb-2">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {session.user?.name || 'User'}
                </p>
                <p className="text-[11px] font-medium text-gray-400 truncate">
                  {session.user?.email}
                </p>
              </div>

              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800/60"
              >
                <User className="w-4 h-4" />
                <span>My Profile & Stats</span>
              </Link>

              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800/60"
              >
                <Settings className="w-4 h-4" />
                <span>Settings & AI Engine</span>
              </Link>

              <div className="pt-2 mt-2 border-t border-gray-100 dark:border-neutral-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut({ callbackUrl: '/auth/signin' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out / Log Out</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}