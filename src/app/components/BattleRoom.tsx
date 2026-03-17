'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import TestAttempt from './TestAttempt';

interface DuelRoom {
  id: string;
  roomCode: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  hostProgress: number;
  guestProgress: number;
  testId: string;
  host: { id: string, name: string };
  guest?: { id: string, name: string };
  test: { title: string, questions: any[] };
}

interface BattleRoomProps {
  roomCode: string;
  userId: string;
  onExit: () => void;
}

export default function BattleRoom({ roomCode, userId, onExit }: BattleRoomProps) {
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTestActive, setIsTestActive] = useState(false);

  const fetchRoomStatus = async () => {
    try {
      const res = await fetch(`/api/duels/${roomCode}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        
        if (data.room.status === 'ACTIVE' && !isTestActive) {
          setIsTestActive(true);
        }
      }
    } catch (err) {
      console.error('Failed to poll room:', err);
    }
  };

  useEffect(() => {
    fetchRoomStatus();
    const interval = setInterval(fetchRoomStatus, 3000); // Poll every 3 seconds for simplicity
    return () => clearInterval(interval);
  }, [roomCode, isTestActive]);

  const updateProgress = async (currentQuestionIndex: number, totalQuestions: number) => {
    const progress = Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100);
    try {
      await fetch(`/api/duels/${roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      });
    } catch (err) {
      console.error('Failed to update progress:', err);
    }
  };

  if (loading && !room) {
    return <div className="p-20 text-center font-black animate-pulse">Initializing Battle Field...</div>;
  }

  if (!room) return <div className="p-20 text-center">Room Error</div>;

  const isHost = userId === room.host.id;

  if (isTestActive && room.status === 'ACTIVE') {
    return (
      <div className="relative">
         <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-50 p-4 flex justify-between items-center">
            <div className="flex-1 px-4">
               <p className="text-[10px] font-black uppercase text-gray-400">Your Progress</p>
               <Progress value={isHost ? room.hostProgress : room.guestProgress} className="h-2" />
            </div>
            <div className="flex flex-col items-center px-8 border-x mx-4">
                <span className="text-xl font-black">VS</span>
            </div>
            <div className="flex-1 px-4 text-right">
               <p className="text-[10px] font-black uppercase text-gray-400">Opponent</p>
               <Progress value={isHost ? room.guestProgress : room.hostProgress} className="h-2" />
            </div>
         </div>
         <div className="pt-20">
            <TestAttempt 
              test={room.test as any} 
              onComplete={() => updateProgress(room.test.questions.length - 1, room.test.questions.length)}
              onQuestionChange={(index) => updateProgress(index, room.test.questions.length)}
            />
         </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl pt-20">
      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-indigo-600 text-white p-8 text-center">
          <CardTitle className="text-3xl font-black">🔥 Battle Room</CardTitle>
          <p className="opacity-80 font-bold uppercase tracking-widest text-xs mt-2">{room.test.title}</p>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="bg-gray-50 rounded-2xl p-6 text-center border-2 border-dashed border-gray-200">
             <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Room Code</p>
             <span className="text-5xl font-black tracking-tighter text-indigo-600 font-mono">{room.roomCode}</span>
             <p className="text-[10px] font-bold text-gray-500 mt-4">Share this code with your opponent to start the duel!</p>
          </div>

          <div className="grid grid-cols-2 gap-8 items-center py-4">
             <div className="flex flex-col items-center gap-3">
                <div className="h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600 shadow-inner">
                   {room.host.name[0]}
                </div>
                <span className="font-black text-gray-900">{room.host.name}</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase">Host</span>
             </div>

             <div className="flex flex-col items-center gap-3">
                {room.guest ? (
                  <>
                    <div className="h-20 w-20 rounded-2xl bg-amber-100 flex items-center justify-center text-3xl font-bold text-amber-600 shadow-inner">
                      {room.guest.name[0]}
                    </div>
                    <span className="font-black text-gray-900">{room.guest.name}</span>
                    <span className="text-[10px] font-black text-amber-400 uppercase">Opponent</span>
                  </>
                ) : (
                  <>
                    <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-300 animate-pulse border-2 border-dashed border-gray-200">
                      ?
                    </div>
                    <span className="font-black text-gray-400 italic">Waiting...</span>
                  </>
                )}
             </div>
          </div>

          <div className="flex gap-4">
             <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black" onClick={onExit}>Cancel Battle</Button>
             {room.status === 'ACTIVE' && (
                <Button className="flex-1 h-14 rounded-2xl bg-green-600 hover:bg-green-700 font-black shadow-lg shadow-green-100" onClick={() => setIsTestActive(true)}>Start Now!</Button>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
