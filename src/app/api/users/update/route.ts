import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
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

    // Fetch existing user to enforce locked fields (email & existing phone)
    const currentUser = await (prisma.user as any).findUnique({
      where: { id: session.user.id }
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

    // Phone update logic:
    // Only allow setting phone if user doesn't already have a phone number set
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

        // Check if phone number is already taken
        const existingPhoneUser = await (prisma.user as any).findFirst({
          where: {
            phone: phoneInput,
            id: { not: session.user.id }
          }
        });

        if (existingPhoneUser) {
          return NextResponse.json(
            { error: 'This phone number is already registered to another account' },
            { status: 400 }
          );
        }

        updateData.phone = phoneInput;
      }
    }

    // Update user details
    const updatedUser = await (prisma.user as any).update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        targetExam: updatedUser.targetExam,
        institution: updatedUser.institution,
        academicLevel: updatedUser.academicLevel,
        bio: updatedUser.bio,
        image: updatedUser.image,
        mongodbUrl: updatedUser.mongodbUrl,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}