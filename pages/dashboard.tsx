import { useState, useEffect } from 'react';
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import Head from 'next/head';
import Link from 'next/link';

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && user) {
      // This would typically be fetched from an API
      setLastLogin(new Date().toLocaleString());
    }
  }, [isSignedIn, user]);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Dashboard | Wren Console</title>
      </Head>
      
      <SignedIn>
        <div className="min-h-screen bg-gray-900 text-green-400 p-8">
          <div className="max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">Wren Dashboard</h1>
              <Link href="/" className="text-green-400 hover:text-green-300">
                Back to Console
              </Link>
            </header>
            
            <div className="bg-black p-6 rounded-lg border border-gray-800 mb-6">
              <h2 className="text-xl font-semibold mb-4">User Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400">Name:</p>
                  <p>{user?.firstName} {user?.lastName}</p>
                </div>
                <div>
                  <p className="text-gray-400">Email:</p>
                  <p>{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
                <div>
                  <p className="text-gray-400">User ID:</p>
                  <p className="font-mono text-sm">{user?.id}</p>
                </div>
                <div>
                  <p className="text-gray-400">Last Login:</p>
                  <p>{lastLogin}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-black p-6 rounded-lg border border-gray-800">
              <h2 className="text-xl font-semibold mb-4">System Status</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>API Connection:</span>
                  <span className="text-green-500">Online</span>
                </div>
                <div className="flex justify-between">
                  <span>Database:</span>
                  <span className="text-green-500">Connected</span>
                </div>
                <div className="flex justify-between">
                  <span>Authentication:</span>
                  <span className="text-green-500">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>System Version:</span>
                  <span>0.1.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SignedIn>
      
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}