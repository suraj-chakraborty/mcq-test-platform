'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserProfile from './UserProfile';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function UserProfileModal({ isOpen, onClose, onUpdate }: UserProfileModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl p-6 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
        <DialogHeader className="pb-3 border-b border-gray-100 dark:border-neutral-800">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
            User Profile & Learning Analytics
          </DialogTitle>
        </DialogHeader>
        <UserProfile onUpdate={onUpdate} />
      </DialogContent>
    </Dialog>
  );
}