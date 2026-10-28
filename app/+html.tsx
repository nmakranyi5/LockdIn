import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// The page the web build is served in. Besides the basics, this lets the app
// be added to an iPhone's home screen and open full screen like an app.
const base = process.env.EXPO_BASE_URL ?? "";

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
        <style dangerouslySetInnerHTML={{ __html: "body{background-color:#0B0B0F}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
