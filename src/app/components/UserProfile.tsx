'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
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
  AlertTriangle,
  Camera,
  Lock,
  GraduationCap,
  School,
  FileText,
  Upload,
  Check,
  X
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { uploadImageDirectToCloudinary } from '@/app/lib/directUpload';

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
  phone?: string | null;
  targetExam?: string | null;
  institution?: string | null;
  academicLevel?: string | null;
  bio?: string | null;
  image?: string | null;
  xp: number;
  level: number;
  streak: number;
  isVerified?: boolean;
  isMarkedForDeletion?: boolean;
  deletionRequestedAt?: string | null;
  lastActivityAt?: string | null;
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

const PRESET_AVATARS = [
  { id: 'scholar_male', label: 'Scholar', emoji: '👨‍🎓', color: 'bg-blue-600' },
  { id: 'scientist_female', label: 'Scientist', emoji: '👩‍🔬', color: 'bg-emerald-600' },
  { id: 'astronaut', label: 'Explorer', emoji: '🚀', color: 'bg-indigo-600' },
  { id: 'owl_master', label: 'Wise Owl', emoji: '🦉', color: 'bg-amber-600' },
  { id: 'cyber_ninja', label: 'Cyber Pro', emoji: '⚡', color: 'bg-purple-600' },
  { id: 'wizard', label: 'Mastermind', emoji: '🧙‍♂️', color: 'bg-rose-600' },
  { id: 'champion_lion', label: 'Champion', emoji: '🦁', color: 'bg-orange-600' },
  { id: 'brain_master', label: 'Brainiac', emoji: '🧠', color: 'bg-cyan-600' },
];

const TARGET_EXAMS_LIST = [
  'College / University Semesters',
  'JEE (Mains & Advanced)',
  'NEET (Medical)',
  'GATE (Engineering & Tech)',
  'UPSC / Civil Services',
  'School / Board Exams (CBSE/ICSE)',
  'GRE / GMAT / SAT',
  'State PSC & Govt Exams',
  'Professional Certification',
  'General Knowledge & Learning',
];

const ACADEMIC_LEVELS_LIST = [
  'High School Student (9th-12th)',
  'Undergraduate Student (Bachelor\'s)',
  'Postgraduate Student (Master\'s/PhD)',
  'Competitive Exam Aspirant',
  'Working Professional',
  'Lifelong Learner',
];

export default function UserProfile({ onUpdate }: UserProfileProps) {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    targetExam: '',
    institution: '',
    academicLevel: '',
    bio: '',
    image: '',
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
            phone: data.user.phone || '',
            targetExam: data.user.targetExam || 'College / University Semesters',
            institution: data.user.institution || '',
            academicLevel: data.user.academicLevel || 'Undergraduate Student (Bachelor\'s)',
            bio: data.user.bio || '',
            image: data.user.image || '',
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

  const handleCustomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setIsUploadingImage(true);
    setUploadProgress(10);

    try {
      const result = await uploadImageDirectToCloudinary(file, (pct) => {
        setUploadProgress(pct);
      });

      // Update image in formData and save immediately
      setFormData((prev) => ({ ...prev, image: result.url }));

      const updateRes = await fetch('/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: result.url }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update avatar profile');
      }

      const updateData = await updateRes.json();

      await update({
        ...session,
        user: {
          ...session?.user,
          image: result.url,
        },
      });

      toast.success('Profile picture updated successfully!');
      setShowAvatarDialog(false);
      fetchProfile();
      onUpdate?.();
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectPresetAvatar = async (preset: typeof PRESET_AVATARS[0]) => {
    const avatarIdentifier = `preset:${preset.id}:${preset.emoji}:${preset.color}`;
    setFormData((prev) => ({ ...prev, image: avatarIdentifier }));

    try {
      const updateRes = await fetch('/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: avatarIdentifier }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update avatar');
      }

      await update({
        ...session,
        user: {
          ...session?.user,
          image: avatarIdentifier,
        },
      });

      toast.success(`Avatar set to ${preset.label} ${preset.emoji}`);
      setShowAvatarDialog(false);
      fetchProfile();
      onUpdate?.();
    } catch (error) {
      console.error('Preset avatar error:', error);
      toast.error('Failed to set avatar');
    }
  };

  const handleRemoveAvatar = async () => {
    setFormData((prev) => ({ ...prev, image: '' }));

    try {
      const updateRes = await fetch('/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: '' }),
      });

      if (!updateRes.ok) throw new Error('Failed to remove avatar');

      toast.success('Avatar reset to default initial');
      setShowAvatarDialog(false);
      fetchProfile();
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to remove avatar');
    }
  };

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      await update({
        ...session,
        user: {
          ...session?.user,
          name: data.user.name,
        },
      });

      toast.success('Profile details updated successfully!');
      fetchProfile();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
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

      toast.success('Account deletion request cancelled! Your account is fully active.');
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

  const isProfileIncomplete = !profileData.phone || !profileData.targetExam;

  // Render Avatar Element
  const renderAvatarContent = (sizeClasses = "w-14 h-14 text-xl") => {
    if (profileData.image && profileData.image.startsWith('preset:')) {
      const parts = profileData.image.split(':');
      const emoji = parts[2] || '🎓';
      const colorClass = parts[3] || 'bg-indigo-600';
      return (
        <div className={`${sizeClasses} rounded-2xl ${colorClass} flex items-center justify-center text-white shadow-md shrink-0 border border-white/20 select-none`}>
          <span>{emoji}</span>
        </div>
      );
    }

    if (profileData.image && profileData.image.startsWith('http')) {
      return (
        <img
          src={profileData.image}
          alt={profileData.name || 'User'}
          className={`${sizeClasses} rounded-2xl object-cover shadow-md shrink-0 border border-white/20`}
        />
      );
    }

    return (
      <div className={`${sizeClasses} rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shrink-0 border border-white/20 select-none`}>
        {profileData.name?.[0]?.toUpperCase() || 'U'}
      </div>
    );
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Top Profile Header Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          {/* Avatar with click to change badge */}
          <div className="relative group cursor-pointer" onClick={() => setShowAvatarDialog(true)}>
            {renderAvatarContent("w-16 h-16 text-2xl")}
            <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Camera className="w-5 h-5" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 border-2 border-slate-900 flex items-center justify-center shadow-sm">
              <Camera className="w-3 h-3 text-white" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">{profileData.name || 'User'}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Level {profileData.level}
              </span>
              {profileData.targetExam && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" />
                  <span>{profileData.targetExam}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{profileData.email}</span>
              </span>
              {profileData.phone ? (
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{profileData.phone}</span>
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 font-semibold cursor-pointer hover:underline" onClick={() => setActiveTab('settings')}>
                  + Add Phone Number
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Actions: Streak & Quick Log Out */}
        <div className="flex items-center gap-2 self-end sm:self-center relative z-10">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-amber-300 text-xs font-bold shadow-sm">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{profileData.streak} Day Streak</span>
          </div>

          <Button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="h-8 px-3 rounded-xl bg-white/10 hover:bg-rose-500/30 text-slate-200 hover:text-rose-200 border border-white/20 hover:border-rose-500/50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Log Out of Account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </Button>
        </div>
      </div>

      {/* Incomplete Profile Alert Reminder for Existing Users */}
      {isProfileIncomplete && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-300 dark:border-amber-900/60 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold">Complete Your Learner Profile</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/80">
                Add your phone number and academic target to unlock personalized AI test generation and peer duel rankings.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="h-8 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-sm"
          >
            Complete Details
          </Button>
        </motion.div>
      )}

      {/* Deletion Grace Period Active Banner */}
      {profileData.isMarkedForDeletion && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <p className="text-xs font-bold">Account Deletion Scheduled (30-Day Grace Period Active)</p>
              <p className="text-[11px] text-rose-800 dark:text-rose-300/80">
                Your account is currently in a 30-day grace period. You can continue using your account normally or cancel deletion.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleCancelDeletion}
            disabled={isDeletingAccount}
            className="h-8 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 shadow-sm"
          >
            Cancel Deletion Request
          </Button>
        </div>
      )}

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-gray-100 dark:bg-neutral-800/80 p-1 rounded-xl border border-gray-200 dark:border-neutral-700">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-bold py-1.5">
            Overview & Stats
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg text-xs font-bold py-1.5">
            Test History
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg text-xs font-bold py-1.5 relative">
            <span>Account Details</span>
            {isProfileIncomplete && (
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-2 right-3 animate-ping" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Overview & Stats */}
        <TabsContent value="overview" className="space-y-4 pt-3">
          {/* Level Progress */}
          <div className="p-4 bg-gray-50 dark:bg-neutral-800/60 rounded-2xl border border-gray-200 dark:border-neutral-700 space-y-2">
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

          {/* Academic Summary Badge Card */}
          {(profileData.targetExam || profileData.institution || profileData.bio) && (
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>Academic Profile</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {profileData.targetExam && (
                  <div>
                    <span className="text-gray-400 text-[11px] block">Target Exam / Goal</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{profileData.targetExam}</span>
                  </div>
                )}
                {profileData.academicLevel && (
                  <div>
                    <span className="text-gray-400 text-[11px] block">Academic Level</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{profileData.academicLevel}</span>
                  </div>
                )}
                {profileData.institution && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-400 text-[11px] block">School / University / College</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{profileData.institution}</span>
                  </div>
                )}
                {profileData.bio && (
                  <div className="sm:col-span-2 pt-1 border-t border-gray-100 dark:border-neutral-800">
                    <span className="text-gray-400 text-[11px] block">Bio / Aspirations</span>
                    <p className="text-gray-700 dark:text-gray-300 text-xs italic mt-0.5">"{profileData.bio}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
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

            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
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

            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
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

            <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center gap-1">
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
                    className="p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 flex items-center gap-3 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-lg shrink-0">
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
              <div className="p-6 text-center bg-gray-50 dark:bg-neutral-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700">
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
                className="p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3 shadow-sm"
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
            <div className="p-8 text-center bg-gray-50 dark:bg-neutral-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700">
              <History className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">No test attempts recorded yet.</p>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: Account Details & Danger Zone */}
        <TabsContent value="settings" className="pt-3 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar Row */}
            <div className="p-4 bg-gray-50 dark:bg-neutral-800/40 rounded-2xl border border-gray-200 dark:border-neutral-700/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {renderAvatarContent("w-12 h-12 text-xl")}
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Profile Avatar & Photo</h4>
                  <p className="text-[11px] text-gray-500">Upload a custom picture or choose a preset avatar</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAvatarDialog(true)}
                className="h-9 px-3.5 rounded-xl border-gray-200 dark:border-neutral-700 text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                <span>Change Avatar</span>
              </Button>
            </div>

            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Full Name
                </Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="h-10 rounded-xl text-xs font-medium"
                  required
                />
              </div>

              {/* Email Address (LOCKED / READ ONLY) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>Email Address</span>
                  </Label>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Locked</span>
                  </span>
                </div>
                <div className="relative">
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="h-10 rounded-xl text-xs font-medium bg-gray-100/80 dark:bg-neutral-800/80 text-gray-500 cursor-not-allowed border-dashed pr-8"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] text-gray-400">Account login email is permanently locked</p>
              </div>

              {/* Phone Number (LOCKED IF SET / EDITABLE IF NOT SET) */}
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Phone Number</span>
                  </Label>
                  {profileData.phone ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Verified & Locked</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      ⚠️ Not set (Will lock permanently once saved)
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Input
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000 or 10-digit number"
                    value={formData.phone}
                    disabled={!!profileData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    className={`h-10 rounded-xl text-xs font-medium ${
                      profileData.phone
                        ? 'bg-gray-100/80 dark:bg-neutral-800/80 text-gray-500 cursor-not-allowed border-dashed pr-8'
                        : 'border-amber-300 dark:border-amber-800 focus:border-indigo-600'
                    }`}
                  />
                  {profileData.phone && (
                    <Lock className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  {profileData.phone
                    ? 'Your phone number is locked for security. Contact support to request updates.'
                    : 'Add your phone number for important assessment notifications and test recovery.'}
                </p>
              </div>
            </div>

            {/* Academic Information */}
            <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4" />
                <span>Academic & Competitive Goals</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Exam */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Target Exam / Goal
                  </Label>
                  <select
                    value={formData.targetExam}
                    onChange={(e) => setFormData((p) => ({ ...p, targetExam: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs font-medium focus:border-indigo-600 outline-none"
                  >
                    {TARGET_EXAMS_LIST.map((exam) => (
                      <option key={exam} value={exam}>{exam}</option>
                    ))}
                  </select>
                </div>

                {/* Academic Level */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Academic Level
                  </Label>
                  <select
                    value={formData.academicLevel}
                    onChange={(e) => setFormData((p) => ({ ...p, academicLevel: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs font-medium focus:border-indigo-600 outline-none"
                  >
                    {ACADEMIC_LEVELS_LIST.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                {/* Institution Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    School / University / College Name
                  </Label>
                  <Input
                    name="institution"
                    placeholder="e.g. Stanford University / Delhi Public School / IIT Bombay"
                    value={formData.institution}
                    onChange={(e) => setFormData((p) => ({ ...p, institution: e.target.value }))}
                    className="h-10 rounded-xl text-xs font-medium"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Short Bio / Learning Aspirations
                  </Label>
                  <Textarea
                    name="bio"
                    placeholder="Tell us about your learning goals, target ranks, or favorite subjects..."
                    value={formData.bio}
                    onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                    rows={2}
                    maxLength={300}
                    className="rounded-xl text-xs font-medium resize-none"
                  />
                  <span className="text-[10px] text-gray-400 block text-right">
                    {formData.bio.length}/300
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm"
            >
              {isLoading ? 'Saving Changes...' : 'Save Profile Changes'}
            </Button>
          </form>

          {/* Account Session Actions */}
          <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">Account Session</h4>
              <p className="text-[11px] text-gray-500">Sign out of your active session on this device</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="h-9 px-4 rounded-xl border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
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
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-gray-900 dark:text-white">Delete Account (30-Day Recovery)</h5>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 max-w-md">
                  Request account deletion. Your data will be preserved for 30 days. If you remain inactive for 30 days, your account will be permanently deleted. Logging in at any time within 30 days will cancel the deletion request.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Avatar Change Dialog */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              <span>Choose Profile Avatar</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Upload your own photo or pick from our curated set of student avatars
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Custom File Upload Option */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                Option 1: Upload Custom Photo
              </span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCustomPhotoUpload}
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="w-full h-11 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploadingImage ? `Uploading (${uploadProgress}%)...` : 'Upload from Device (JPG/PNG)'}</span>
              </Button>
            </div>

            {/* Preset Avatars Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                Option 2: Pick an Instant Avatar
              </span>
              <div className="grid grid-cols-4 gap-2.5">
                {PRESET_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => handleSelectPresetAvatar(avatar)}
                    className="p-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 flex flex-col items-center gap-1.5 transition-all text-center group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${avatar.color} flex items-center justify-center text-xl text-white shadow-sm group-hover:scale-105 transition-transform`}>
                      {avatar.emoji}
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate w-full">
                      {avatar.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reset to Default */}
            {profileData.image && (
              <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 text-center">
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold"
                >
                  Reset to Initial Letter Avatar
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              className="h-10 rounded-xl text-xs font-bold"
            >
              Keep My Account
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestDeletion}
              disabled={isDeletingAccount}
              className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider"
            >
              {isDeletingAccount ? 'Scheduling...' : 'Confirm Deletion (30 Days)'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}