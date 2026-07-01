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
        <Head>
          <title>GamePlatform</title>
          
          {/* Mobile Responsiveness (PageSpeed Accessibility Fix: user-scalable=0 hata diya) */}
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          
          {/* Manifest Link - Ye tumhari manifest.json file ko connect karta hai */}
          <link rel="manifest" href="/manifest.json" />
          
          {/* Favicons */}
          <link rel="icon" href="/logo.png" />
          <link rel="apple-touch-icon" href="/logo.png" />
          
          {/* iOS PWA Support - Ye sabse zaroori hai "Install App" experience ke liye */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="GamePlatform" />
        </Head>
        
        <Toaster position="top-center" />
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}
