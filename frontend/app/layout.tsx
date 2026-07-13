import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CurrentUserProvider } from "./CurrentUserContext";
import Nav from "./Nav";
import Toast from "./Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClubMaxing",
  description: "Find things happening near you, or start your own.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-neutral-900">
        <div className="app-backdrop" />
        <CurrentUserProvider>
          <Nav />
          <Toast />
          <main className="flex-1">{children}</main>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
