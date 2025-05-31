import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ClerkProvider } from '@clerk/nextjs';
import ClerkProviderWithRoutes from '../utils/clerkProvider';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProviderWithRoutes>
      <Component {...pageProps} />
    </ClerkProviderWithRoutes>
  );
}

export default MyApp;