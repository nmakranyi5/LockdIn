import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// The page the web build is served in. Besides the basics, this lets the app
// be added to an iPhone's home screen and open full screen like an app.
const base = process.env.EXPO_BASE_URL ?? "";

// The browser paints autofilled inputs bright yellow with black text. Keep them
// in the app's dark field colour and white text, so they look like the rest.
const css = `
html{color-scheme:dark}
body{background-color:#0B0B0F}
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active{
  -webkit-text-fill-color:#fff !important;
  caret-color:#fff;
  -webkit-box-shadow:0 0 0 1000px #1C1C24 inset !important;
  box-shadow:0 0 0 1000px #1C1C24 inset !important;
  transition:background-color 99999s ease-out 0s;
}`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0B0B0F" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LockdIn" />
        <link rel="apple-touch-icon" href={`${base}/apple-touch-icon.png`} />
        <link rel="manifest" href={`${base}/manifest.webmanifest`} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
