import { NextResponse } from 'next/server';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { prisma } from '@/app/lib/prisma';

export async function PUT(request: Request) {
  try {
    const user = await resolveAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const phoneInput = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    const targetExam = typeof body.targetExam === 'string' ? body.targetExam.trim() : undefined;
    const institution = typeof body.institution === 'string' ? body.institution.trim() : undefined;
    const academicLevel = typeof body.academicLevel === 'string' ? body.academicLevel.trim() : undefined;
    const bio = typeof body.bio === 'string' ? body.bio.trim() : undefined;
    const image = typeof body.image === 'string' ? body.image.trim() : undefined;

    if (name !== undefined && (name.length < 2 || name.length > 50)) {
      return NextResponse.json({ error: 'Name must be between 2 and 50 characters' }, { status: 400 });
    }

    const currentUser = await (prisma.user as any).findUnique({
      where: { id: user.id },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (name !== undefined) updateData.name = name;
    if (targetExam !== undefined) updateData.targetExam = targetExam;
    if (institution !== undefined) updateData.institution = institution;
    if (academicLevel !== undefined) updateData.academicLevel = academicLevel;
    if (bio !== undefined) updateData.bio = bio;
    if (image !== undefined) updateData.image = image;

    if (phoneInput !== undefined && phoneInput !== '') {
      if (currentUser.phone && currentUser.phone !== phoneInput) {
        return NextResponse.json(
          { error: 'Phone number cannot be changed once set. Please contact support.' },
          { status: 400 }
        );
      }

      if (!currentUser.phone) {
        if (!/^[0-9+\s()-]{7,20}$/.test(phoneInput)) {
          return NextResponse.json(
            { error: 'Please enter a valid phone number (7-20 digits)' },
            { status: 400 }
          );
        }

        const existingPhoneUser = await (prisma.user as any).findFirst({
          where: {
            phone: phoneInput,
            id: { not: user.id },
          },
        });

        if (existingPhoneUser) {
          return NextResponse.json(
            { error: 'This phone number is already registered with another account.' },
            { status: 400 }
          );
        }

        updateData.phone = phoneInput;
      }
    }

    const updatedUser = await (prisma.user as any).update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        targetExam: true,
        institution: true,
        academicLevel: true,
        bio: true,
        image: true,
        xp: true,
        level: true,
        streak: true,
        isVerified: true,
        isMarkedForDeletion: true,
        deletionRequestedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

