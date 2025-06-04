import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import User from '@/app/models/User';

let cachedConnection: typeof mongoose | null = null;

const connectDB = async () => {
  if (cachedConnection) return cachedConnection;

  try {
    // Connect first using default URI
    let mongodbUrl = process.env.MONGODB_URI;
    if (!mongodbUrl) {
      throw new Error('Default MongoDB URI not found in env');
    }

    const connection = await mongoose.connect(mongodbUrl);
    cachedConnection = connection;

    // Now safely get session and query User model
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const user = await User.findById(session.user.id);
      if (user?.mongodbUrl && user.mongodbUrl !== mongodbUrl) {
        // Reconnect if user has a custom MongoDB URI
        await mongoose.disconnect();
        const userConnection = await mongoose.connect(user.mongodbUrl);
        cachedConnection = userConnection;
      }
    }

    return cachedConnection;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    throw error;
  }
};

export default connectDB;
