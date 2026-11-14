import { NextResponse } from 'next/server';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { prisma } from '@/app/lib/prisma';

// POST: Request account deletion (30-day grace period)
export async function POST(request: Request) {
  try {
    const user = await resolveAuthUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const purgeDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updatedUser = await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        isMarkedForDeletion: true,
        deletionRequestedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deletion requested. Your account and data will be preserved for 30 days. If you log back in during this time, the deletion request will be automatically cancelled.',
      scheduledPermanentDeletionAt: purgeDate,
      user: {
        id: updatedUser.id,
        isMarkedForDeletion: true,
        deletionRequestedAt: now,
      },
    });
  } catch (error) {
    console.error('Error requesting account deletion:', error);
    return NextResponse.json(
      { error: 'Failed to request account deletion' },
      { status: 500 }
    );
  }
}

// DELETE: Cancel account deletion request
export async function DELETE(request: Request) {
  try {
    const user = await resolveAuthUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updatedUser = await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        isMarkedForDeletion: false,
        deletionRequestedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deletion request has been cancelled. Your account is fully active and safe.',
      user: {
        id: updatedUser.id,
        isMarkedForDeletion: false,
        deletionRequestedAt: null,
      },
    });
  } catch (error) {
    console.error('Error cancelling account deletion:', error);
    return NextResponse.json(
      { error: 'Failed to cancel account deletion' },
      { status: 500 }
    );
  }
}

