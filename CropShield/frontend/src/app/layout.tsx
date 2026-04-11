import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthShell } from "@/components/AuthShell";
import { AuthProvider } from "@/context/AuthContext";
import { SidebarProvider } from "@/context/SidebarContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "CropShield AI | Smart Agriculture Insurance",
  description: "AI-powered crop damage assessment and insurance claim settlement platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
        <AuthProvider>
          <SidebarProvider>
            <AuthShell>{children}</AuthShell>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
