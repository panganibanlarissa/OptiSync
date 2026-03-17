import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NotificationProvider from "@/components/NotificationProvider";
import { FirebaseProvider } from "@/context/FirebaseContext";
import AuthWrapper from "@/components/AuthWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MT Olaso Inventory",
  description: "Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <FirebaseProvider>
          <NotificationProvider>
            <AuthWrapper>
              {children}
            </AuthWrapper>
          </NotificationProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}