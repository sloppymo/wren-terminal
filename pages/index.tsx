import type { NextPage } from 'next';
import Head from 'next/head';
import WrenConsole from '../components/WrenConsole';

const Home: NextPage = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <Head>
        <title>Wren Console</title>
        <meta name="description" content="Terminal-style console UI with Clerk authentication" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-green-400 mb-6 text-center">Wren Console</h1>
        <WrenConsole />
      </main>

      <footer className="mt-8 text-center text-gray-400 text-sm">
        <p>Built with Next.js + Clerk + Vercel</p>
      </footer>
    </div>
  );
};

export default Home;