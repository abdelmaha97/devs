'use client';

import "@fontsource/ibm-plex-sans-arabic";  
import "@fontsource/ibm-plex-sans";  
import React from "react";
import NextLink from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLanguage } from "../context/LanguageContext";
import { lang } from '../Lang/lang';
import { hasPermission, hasRole } from "@/lib/auth";

// HeroUI Components
import {
  Input,
  Link,
  Navbar,
  NavbarContent,
  NavbarItem,
  NavbarBrand,
  NavbarMenuToggle,
  NavbarMenuItem,
  NavbarMenu,
  Button,
  Avatar,
  Spacer,
  Select,
  SelectItem,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@heroui/react";

// Icons

import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded';
import GradingRoundedIcon from '@mui/icons-material/GradingRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import VillaRoundedIcon from '@mui/icons-material/VillaRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import ContactPageRoundedIcon from '@mui/icons-material/ContactPageRounded';
import { ScaleIcon } from '@heroicons/react/24/outline';
import { ReceiptPercentIcon } from "@heroicons/react/24/outline";
import { BurguerButton } from "./burguer-button";
import { NotificationsDropdown } from "./notifications-dropdown";
import { UserDropdown } from "./user-dropdown";
import NavLink from './NavLink';
import LanguageSwitcher from '../Lang/LanguageSwitcher';
import { useTheme as useNextTheme } from "next-themes";

interface Props {
  children: React.ReactNode;
}

export const NavbarWrapper = ({ children }: Props) => {
  const { data: session }: any = useSession();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { setTheme, resolvedTheme, theme } = useNextTheme();
  const { language } = useLanguage();
  const pathname = usePathname();

  // Modern navbar colors
  const cardBg = "bg-white dark:bg-[#181f2a]";
  const border = "border-b border-[#e5e7eb] dark:border-[#232b3b]";

  function handleThemeChange() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <div className="relative flex flex-col flex-1 overflow-x-hidden">
      <Navbar
        isBordered={false}
        className={`w-full sticky top-0 bg-content1 border-b border-divider ${!pathname.startsWith('/admin') && !pathname.includes('//dashboard') ? 'fixed' : ''}`}
        classNames={{
          wrapper: "w-full max-w-full h-[5rem] px-6",
        }}
      >
        {/* Burger Button for mobile */}
        <NavbarContent className="xl:hidden pr-3" justify="center">
          {(pathname.startsWith('/admin') || pathname.includes('/dashboard')) ? (
            <BurguerButton />
          ) : (
            <NavbarMenuToggle aria-label={lang(language, "Open menu")} />
          )}
        </NavbarContent>

        {/* Logo & Brand */}
        <NavbarContent className="gap-4" justify="start">
          <NavbarBrand className="md:block hidden max-w-[fit-content] min-w-[fit-content]">
            <NextLink href="/" className="flex items-center gap-3">
              {/* Logo */}
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
               <ReceiptPercentIcon className="w-7 h-7 text-white" />
              </div>
              <span className="font-bold text-lg text-[#1a2233] dark:text-[#e6eaf3]">
                {lang(language, "navbar.brand_name")}
              </span>
            </NextLink>
          </NavbarBrand>

          {/* Divider */}
          <Divider orientation="vertical" className="mx-4 h-8 bg-gradient-to-b from-cyan-400 to-blue-400 opacity-40" />

          {/* Nav Links */}
          {(pathname.startsWith('/admin') || pathname.includes('/dashboard')) ? null : (
            <div className="hidden md:flex gap-4 items-center">
              <NavLink
                icon={<HomeRoundedIcon className="text-cyan-500 group-hover:text-blue-500 transition-colors" />}
                href="/"
                label={lang(language, "navbar.home")}
                pathname={pathname}
              />
              {hasRole(session?.user, 'super_admin') || hasPermission(session?.user, 'dashboard.access') ? (
                <NavLink
                  icon={<HomeRoundedIcon className="text-cyan-500 group-hover:text-blue-500 transition-colors" />}
                  href="/asdsa/dashboard"
                  label={lang(language, "navbar.admin_dashboard")}
                  pathname={pathname}
                />
              ) : null}
            </div>
          )}
        </NavbarContent>

        {/* Actions */}
        <NavbarContent justify="end" className="gap-2 items-center">
          <Button
            onPress={handleThemeChange}
            isIconOnly
            variant="light"
            className="rounded-full"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
          </Button>

          <LanguageSwitcher className={''} />

          {!session ? (
            <NavbarItem className="gap-2 flex items-center">
              <Button as={NextLink} color="primary" href="/login">{lang(language, "Log In")}</Button>
            </NavbarItem>
          ) : (
            <NavbarItem className="gap-2">
              <UserDropdown />
            </NavbarItem>
          )}
        </NavbarContent>

        {/* Mobile Menu */}
        <NavbarMenu>
          <div className="flex flex-col gap-2 items-start justify-center py-4">
            <NavLink icon={<HomeRoundedIcon className="text-cyan-500" />} href="/" label={lang(language, "navbar.home")} pathname={pathname} />
            <NavLink icon={<ContactPageRoundedIcon className="text-cyan-500" />} href="/contact" label={lang(language, "Contact Us")} pathname={pathname} />
          </div>
        </NavbarMenu>
      </Navbar>
      <Spacer y={0} />
      {children}
    </div>
  );
};
