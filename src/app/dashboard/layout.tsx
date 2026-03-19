'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import Loading from '../loading';
import { Menu, X, LayoutDashboard, FilePlus, LogOut, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      setIsRedirecting(true);
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === 'loading' || isRedirecting) {
    return <div><Loading /></div>;
  }

  const navLinks = [
    { label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, onClick: () => router.push('/dashboard') },
    { label: 'Create Test', icon: <FilePlus className="h-4 w-4" />, onClick: () => router.push('/create-test') },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center">
              <span className="text-xl font-black text-indigo-600 tracking-tighter sm:tracking-normal">
                MCQ<span className="text-gray-900 ml-1">Test Platform</span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => (
                <Button
                  key={link.label}
                  variant="ghost"
                  className="text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-4 rounded-xl font-bold flex items-center gap-2"
                  onClick={link.onClick}
                >
                  {link.icon}
                  {link.label}
                </Button>
              ))}
              <div className="h-6 w-px bg-gray-100 mx-2" />
              <div className="flex items-center gap-3 pl-2">
                <span className="text-sm font-bold text-gray-700">{session?.user?.name}</span>
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => signOut()}>
                   <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-600"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                {navLinks.map((link) => (
                  <Button
                    key={link.label}
                    variant="ghost"
                    className="w-full justify-start text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-4 py-6 rounded-2xl font-bold flex items-center gap-3"
                    onClick={() => {
                      link.onClick();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {link.icon}
                    {link.label}
                  </Button>
                ))}
                <div className="pt-4 border-t border-gray-100 mt-4">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {session?.user?.name?.[0] || 'U'}
                       </div>
                       <span className="font-bold text-gray-900">{session?.user?.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => signOut()}>
                       <LogOut className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <main className="relative">{children}</main>
    </div>
  );
}