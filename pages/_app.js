// pages/_app.js
import '../src/styles/globals.css';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-center" />
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}
