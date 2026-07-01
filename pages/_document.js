import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en"> {/* Is line se tumhara accessibility error khatam ho jayega */}
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
