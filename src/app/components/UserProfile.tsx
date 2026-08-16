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
  LogOut,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  isMarkedForDeletion?: boolean;
  deletionRequestedAt?: string | null;
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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

  const handleRequestDeletion = async () => {
    setIsDeletingAccount(true);
    try {
      const response = await fetch('/api/users/delete-account', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request account deletion');
      }

      toast.success('Account deletion scheduled. Your data is preserved for 30 days.');
      setShowDeleteModal(false);

      // Sign out user after scheduling deletion
      setTimeout(() => {
        signOut({ callbackUrl: '/auth/signin' });
      }, 1200);
    } catch (error) {
      console.error('Error scheduling account deletion:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to schedule account deletion');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleCancelDeletion = async () => {
    setIsDeletingAccount(true);
    try {
      const response = await fetch('/api/users/delete-account', {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel deletion request');
      }

      toast.success('Account deletion request cancelled! Your account is active.');
      fetchProfile();
      onUpdate?.();
    } catch (error) {
      console.error('Error cancelling account deletion:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel deletion');
    } finally {
      setIsDeletingAccount(false);
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

        {/* Right Header Actions: Streak & Easy Logout */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-amber-300 text-xs font-bold">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{profileData.streak} Day Streak</span>
          </div>

          <Button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="h-8 px-3 rounded-lg bg-white/10 hover:bg-rose-500/30 text-slate-200 hover:text-rose-200 border border-white/20 hover:border-rose-500/50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Log Out of Account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </Button>
        </div>
      </div>

      {/* Deletion Grace Period Active Banner */}
      {profileData.isMarkedForDeletion && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold">Account Deletion Scheduled (30-Day Grace Period)</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/80">
                Your account is currently in a 30-day grace period. You can continue using your account normally or cancel deletion.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleCancelDeletion}
            disabled={isDeletingAccount}
            className="h-8 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-sm"
          >
            Cancel Deletion Request
          </Button>
        </div>
      )}

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
                <Trophy className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white">
                {profileData.avgScore}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Average Score
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
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
                <Award className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white">
                {profileData.achievements?.length || 0}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Badges Earned
              </span>
            </div>
          </div>

          {/* Badges Section */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Unlocked Achievements
            </h3>
            {profileData.achievements && profileData.achievements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {profileData.achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 flex items-center gap-3 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-lg shrink-0">
                      {ach.icon || '🏆'}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">{ach.name}</h4>
                      <p className="text-[11px] text-gray-500 line-clamp-1">{ach.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-gray-50 dark:bg-neutral-800/40 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700">
                <p className="text-xs text-gray-500 font-medium">Complete more tests and maintain daily streaks to unlock badges!</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Test History */}
        <TabsContent value="history" className="space-y-3 pt-3">
          {profileData.attempts && profileData.attempts.length > 0 ? (
            profileData.attempts.map((att) => (
              <div
                key={att.id}
                className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">
                    {att.test?.title || 'Practice Assessment'}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(att.createdAt).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      Score: {att.score} pts
                    </span>
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                  att.percentage >= 70
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
                }`}>
                  {att.percentage}%
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-gray-50 dark:bg-neutral-800/40 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700">
              <History className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">No test attempts recorded yet.</p>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: Account Edit & Danger Zone */}
        <TabsContent value="settings" className="pt-3 space-y-6">
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

          {/* Account Session Actions */}
          <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">Account Session</h4>
              <p className="text-[11px] text-gray-500">Sign out of your active session</p>
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

          {/* Danger Zone: Account Deletion (30-Day Recovery Lifecycle) */}
          <div className="pt-4 border-t border-rose-100 dark:border-rose-950/60 space-y-3">
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider">Danger Zone</h4>
            </div>
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-gray-900 dark:text-white">Delete Account (30-Day Recovery)</h5>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 max-w-md">
                  Request account deletion. Your data will be preserved for 30 days. If you remain inactive for 30 days, your account will be permanently deleted. Logging in at any time within 30 days will cancel the deletion request.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mb-2 border border-rose-100 dark:border-rose-900/50">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-lg font-black text-gray-900 dark:text-white">
              Schedule Account Deletion?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
              <p>
                Your account will be deactivated and scheduled for deletion.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[11px] font-semibold space-y-1">
                <p>🛡️ <strong>30-Day Recovery Period:</strong></p>
                <p>• Your tests, answers, and study flashcards will be preserved for the next 30 days.</p>
                <p>• If you log in again within 30 days, your deletion request will be <strong>automatically cancelled</strong> and your account restored.</p>
                <p>• If you remain inactive for 30 full days, your account and data will be <strong>permanently wiped</strong>.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel
              disabled={isDeletingAccount}
              className="h-10 rounded-lg text-xs font-bold"
            >
              Keep My Account
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestDeletion}
              disabled={isDeletingAccount}
              className="h-10 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider"
            >
              {isDeletingAccount ? 'Scheduling...' : 'Confirm Deletion (30 Days)'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}