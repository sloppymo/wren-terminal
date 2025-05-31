import { ClerkProvider } from '@clerk/nextjs';

export default function ClerkProviderWithRoutes({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        elements: {
          formButtonPrimary: 'bg-green-500 hover:bg-green-600 text-sm normal-case',
          footerActionLink: 'text-green-400 hover:text-green-500',
          card: 'bg-black border border-gray-800',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}