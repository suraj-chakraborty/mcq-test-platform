import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from './lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect('/dashboard');
  } else {
    redirect('/auth/signin');
  }

  return null; // Fix: Return a value to prevent hydration errors
}
