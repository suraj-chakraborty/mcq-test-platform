'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
  streak: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  achievements: Achievement[];
}

interface UserProfileProps {
  onUpdate?: () => void;
}

export default function UserProfile({ onUpdate }: UserProfileProps) {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mongodbUrl: '',
  });

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/users/profile');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProfileData(data.user);
          setFormData(prev => ({
            ...prev,
            name: data.user.name || '',
            email: data.user.email || '',
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching extended profile:', error);
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
      fetchProfile();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!profileData) {
    return <div className="p-8 text-center animate-pulse text-gray-400 font-bold">Loading your stats...</div>;
  }

  const xpProgress = (profileData.xpInCurrentLevel / profileData.xpNeededForNextLevel) * 100;

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">
      <Card className="border-none shadow-none bg-indigo-50/50 rounded-2xl overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-100">
              {profileData.level}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-gray-900 leading-tight">Level {profileData.level}</h3>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Master Educator</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-indigo-600">{profileData.xp}</span>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Total XP</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-400">
              <span>Progress to Level {profileData.level + 1}</span>
              <span>{Math.floor(profileData.xpInCurrentLevel)} / {profileData.xpNeededForNextLevel} XP</span>
            </div>
            <Progress value={xpProgress} className="h-2.5 bg-indigo-100" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col items-center justify-center text-center">
           <span className="text-2xl font-black text-amber-600">🔥 {profileData.streak}</span>
           <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Day Streak</span>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
           <span className="text-2xl font-black text-emerald-600">🏆 {profileData.achievements.length}</span>
           <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Badges</span>
        </div>
      </div>

      <section>
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-1">Unlocked Badges</h4>
        <div className="flex flex-wrap gap-2">
          {profileData.achievements.length > 0 ? (
            profileData.achievements.map((ach) => (
              <motion.div 
                key={ach.id}
                whileHover={{ scale: 1.05 }}
                className="bg-white border-2 border-gray-100 p-2 rounded-xl flex items-center gap-2 group cursor-help"
                title={ach.description}
              >
                <span className="text-xl">{ach.icon}</span>
                <span className="text-xs font-bold text-gray-700">{ach.name}</span>
              </motion.div>
            ))
          ) : (
            <div className="w-full text-center py-4 text-gray-400 text-xs font-bold bg-gray-50 rounded-xl border-2 border-dashed border-gray-100">
              Complete tests to earn badges!
            </div>
          )}
        </div>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-black">Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-gray-400">Display Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="rounded-xl h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-gray-400">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="rounded-xl h-11"
                required
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-gray-900 hover:bg-black font-black text-white shadow-lg shadow-gray-200">
              {isLoading ? 'Updating...' : 'Save Profile Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}