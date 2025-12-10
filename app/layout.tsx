import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import { Link } from "@heroui/link";
import clsx from "clsx";
import "@fontsource/ibm-plex-sans-arabic";  
import "@fontsource/ibm-plex-sans";  
import { Providers } from "./providers";
import { ToastProvider } from '@heroui/react';
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { LanguageContextProvider } from "../components/context/LanguageContext";
import '@fontsource/ibm-plex-sans-arabic';


export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageContextProvider>
      <html suppressHydrationWarning lang="en" className="overflow-y-hidden">
        <head />
        <body
          className={clsx(
            "min-h-screen text-foreground bg-background font-sans antialiased font-ibm-arabic",
            fontSans.variable,
          )}
        >
          <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
            <div className="relative flex flex-col h-screen">
              <main className="container w-full min-w-full pt-16 flex-grow">
                {children}
              </main>
              <footer className="w-full flex items-center justify-center py-3">
                <Link
                  isExternal
                  className="flex items-center gap-1 text-current"
                  href="https://heroui.com?utm_source=next-app-template"
                  title="heroui.com homepage"
                >
                  <span className="text-default-600">Powered by</span>
                  <p className="text-primary">Alrateb Software Company</p>
                </Link>
              </footer>
            </div>
          </Providers>
        </body>
      </html>

    </LanguageContextProvider>

  );
}
