# MCQ Test Platform

A modern web application for creating and taking multiple-choice tests, built with Next.js and MongoDB.

## Features

- User authentication with NEXTAUTH
- Create custom MCQ tests with multiple questions
- Take tests with a timer
- Automatic scoring and detailed results
- Responsive design with a modern UI
- Test history and performance tracking

## Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Authentication**: NextAuth.js
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS with CSS Variables
- **Type Safety**: TypeScript

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/suraj-chakraborty/mcq-test-platform.git
   cd mcq-test-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   MONGODB_URI="your_mongodb_url"
   NEXTAUTH_SECRET="your_nextauth_secret"
   NEXTAUTH_URL="http://localhost:3000"
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret" 
   GOOGLE_AI_API_KEY="your_google_API_Key"
   ```


4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.


## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 








<!-- mongod --replSet rs0 --bind_ip localhost --port 27017 --dbpath /data/db -->
