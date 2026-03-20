export const metadata = {
  title: 'MCQ Test Platform',
  description: 'AI-powered MCQ Test Platform to generate questions from PDFs, current affairs & GK. Practice, analyze performance, and compete with friends in real-time quizzes.',
  icons: { icon: '/logo.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
