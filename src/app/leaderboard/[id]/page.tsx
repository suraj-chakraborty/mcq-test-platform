'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/app/components/Skeleton';

interface LeaderboardEntry {
  id: string;
  userName: string;
  score: number;
  date: string;
}

export default function LeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/tests/leaderboard/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setEntries(data.leaderboard);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-black text-gray-900 mb-2">🏆 Hall of Fame</h1>
          <p className="text-gray-500 uppercase tracking-widest text-sm font-bold">Test Performance Leaders</p>
        </motion.div>

        <Card className="border-none shadow-2xl shadow-indigo-100 overflow-hidden">
          <CardHeader className="bg-indigo-600 text-white py-8">
            <CardTitle className="text-center text-2xl">Global Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : entries.length > 0 ? (
              <div className="divide-y divide-gray-100">
                <AnimatePresence>
                  {entries.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-6 hover:bg-gray-50 transition-colors ${
                        index === 0 ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                          index === 0 ? 'bg-amber-400 text-white' : 
                          index === 1 ? 'bg-gray-300 text-white' :
                          index === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-lg">{entry.userName}</p>
                          <p className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-indigo-600">{entry.score}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Points</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 font-medium">
                No attempts recorded yet. Be the first!
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-10 text-center">
          <Button 
            size="lg" 
            variant="ghost" 
            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-bold"
            onClick={() => router.push('/dashboard')}
          >
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
