'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Flame,
  Trophy,
  Award,
  BookOpen,
  Brain,
  Layers,
  History,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Shield,
  Edit3,
  BarChart3,
  Calendar,
  LogOut
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

interface TestAttemptHistory {
  id: string;
  score: number;
  percentage: number;
  timeSpent?: number;
  createdAt: string;
  test?: {
    title: string;
  };
}

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
  streak: number;
  isVerified?: boolean;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  totalXp: number;
  totalAttempts: number;
  avgScore: number;
  _count?: {
    tests: number;
    attempts: number;
    flashcards: number;
    descriptiveTests: number;
    hostedDuels: number;
  };
  attempts?: TestAttemptHistory[];
  achievements: Achievement[];
}

interface UserProfileProps {
  onUpdate?: () => void;
}

export default function UserProfile({ onUpdate }: UserProfileProps) {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/users/profile');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProfileData(data.user);
          setFormData({
            name: data.user.name || '',
            email: data.user.email || '',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();

      await update({
        ...session,
        user: {
          ...session?.user,
          name: data.user.name,
          email: data.user.email,
        },
      });

      toast.success('Profile updated successfully');
      setIsEditing(false);
      fetchProfile();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!profileData) {
    return (
      <div className="p-10 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-gray-500 font-semibold">Loading profile analytics...</p>
      </div>
    );
  }

  const xpProgress = Math.min(
    100,
    Math.max(4, Math.floor((profileData.xpInCurrentLevel / profileData.xpNeededForNextLevel) * 100))
  );

  return (
    <div className="space-y-6 pt-2">
      {/* Top Profile Header Card */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-md shrink-0">
            {profileData.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">{profileData.name || 'User'}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Level {profileData.level}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{profileData.email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-amber-300 text-xs font-bold">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{profileData.streak} Day Streak</span>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-gray-100 dark:bg-neutral-800/80 p-1 rounded-lg border border-gray-200 dark:border-neutral-700">
          <TabsTrigger value="overview" className="rounded-md text-xs font-bold py-1.5">
            Overview & Stats
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-md text-xs font-bold py-1.5">
            Test History
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-md text-xs font-bold py-1.5">
            Account Edit
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Overview & Stats */}
        <TabsContent value="overview" className="space-y-4 pt-3">
          {/* Level Progress */}
          <div className="p-4 bg-gray-50 dark:bg-neutral-800/60 rounded-xl border border-gray-200 dark:border-neutral-700 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-700 dark:text-gray-300">Level {profileData.level} Mastery Progress</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {profileData.xpInCurrentLevel} / {profileData.xpNeededForNextLevel} XP ({xpProgress}%)
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium pt-0.5">
              <span>Total XP Accumulated: {profileData.totalXp}</span>
              <span>Next Level at {profileData.xpNeededForNextLevel} XP</span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white">
                {profileData.totalAttempts}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Tests Taken
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white">
                {profileData.avgScore}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Avg Accuracy
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                <Brain className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white">
                {profileData._count?.flashcards || 0}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Flashcards
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white">
                {profileData.achievements?.length || 0}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Badges Won
              </span>
            </div>
          </div>

          {/* Badges / Achievements */}
          <div className="space-y-2 pt-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Unlocked Achievements
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profileData.achievements && profileData.achievements.length > 0 ? (
                profileData.achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">{ach.name}</h4>
                      <p className="text-[11px] text-gray-500 font-medium">{ach.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-4 rounded-lg bg-gray-50 dark:bg-neutral-800/40 border border-dashed border-gray-200 dark:border-neutral-700 text-center">
                  <p className="text-xs text-gray-500 font-medium">
                    Take more practice tests and maintain daily streaks to unlock achievement badges!
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Test History */}
        <TabsContent value="history" className="space-y-3 pt-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Recent Assessment Attempts
          </Label>

          {profileData.attempts && profileData.attempts.length > 0 ? (
            <div className="space-y-2">
              {profileData.attempts.map((att) => (
                <div
                  key={att.id}
                  className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                      {att.test?.title || 'Practice Assessment'}
                    </h4>
                    <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span>{new Date(att.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        att.percentage >= 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : att.percentage >= 50
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {att.percentage}% Score
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-gray-50 dark:bg-neutral-800/40 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700">
              <History className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">No test attempts recorded yet.</p>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: Account Edit */}
        <TabsContent value="settings" className="pt-3">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Display Name
              </Label>
              <Input
                name="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="h-10 rounded-lg text-xs font-medium"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Email Address
              </Label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="h-10 rounded-lg text-xs font-medium"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded-lg bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm"
            >
              {isLoading ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </form>

          <div className="pt-4 mt-6 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">Account Session</h4>
              <p className="text-[11px] text-gray-500">Sign out of your account on this device</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="h-9 px-4 rounded-lg border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}