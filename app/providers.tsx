"use client";
import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeProviderProps } from "next-themes/dist/types";
import { Layout } from "../components/layout/layout";
import { SessionProvider } from "next-auth/react"
import { ToastProvider } from '@heroui/react';

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
  session?: any;

}

export function Providers({ children, themeProps, session }: ProvidersProps) {

  return (
    <HeroUIProvider>
      <ToastProvider/> 
      <NextThemesProvider defaultTheme="system" attribute="class" {...themeProps}>
          <SessionProvider session={session}>
              <Layout>
                {children}
              </Layout>

          </SessionProvider>

      </NextThemesProvider>
    </HeroUIProvider>
  );
}
