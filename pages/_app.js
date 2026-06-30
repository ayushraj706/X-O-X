// pages/_app.js
import Head from 'next/head';
import '../src/styles/globals.css';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Head component yahan add kiya hai */}
        <Head>
          <title>GamePlatform</title>
          <link rel="icon" href="/logo.png" />
          <link rel="apple-touch-icon" href="/logo.png" />
        </Head>
        
        <Toaster position="top-center" />
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}
