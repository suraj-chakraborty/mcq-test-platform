import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || user.password === null) {
          throw new Error('No user found with this email, or registered via OAuth');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        if (!user.isVerified) {
          throw new Error('Please verify your email with OTP before logging in');
        }

        // Account Deletion 30-day Grace Period Lifecycle
        const userAny = user as any;
        if (userAny.isMarkedForDeletion && userAny.deletionRequestedAt) {
          const msSinceDeletion = Date.now() - new Date(userAny.deletionRequestedAt).getTime();
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

          if (msSinceDeletion > thirtyDaysInMs) {
            // Expired -> permanently delete account
            try {
              await prisma.user.delete({ where: { id: user.id } });
            } catch (err) {
              console.error('Error permanently deleting expired account:', err);
            }
            throw new Error('This account has been permanently deleted after the 30-day grace period.');
          } else {
            // User logged in within 30 days -> Automatically cancel deletion request and restore account!
            try {
              await (prisma.user as any).update({
                where: { id: user.id },
                data: {
                  isMarkedForDeletion: false,
                  deletionRequestedAt: null,
                },
              });
            } catch (err) {
              console.error('Error restoring account on login:', err);
            }
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.picture = (user as any).image;
      }
      if (trigger === 'update' && session?.user) {
        if (session.user.image !== undefined) {
          token.picture = session.user.image;
        }
        if (session.user.name !== undefined) {
          token.name = session.user.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        if (token.picture) {
          session.user.image = token.picture as string;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};