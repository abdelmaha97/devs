import { tv } from "@heroui/react";
import { useLanguage } from "../context/LanguageContext";

export const SidebarWrapper = tv({
  base: "bg-content1 transition-transform h-full fixed -translate-x-full w-64 shrink-0 z-[41] overflow-y-auto border-r border-divider flex-col py-6 px-3 md:ml-0 md:flex md:static md:h-screen md:translate-x-0 ",

  variants: {
    collapsed: {
      true: "translate-x-0 ml-0 [display:inherit]",
    },
    language: {
      ltr: "", // Default for LTR
      ar: "translate-x-full md:mr-0 md:-translate-x-0", // Flip translate-x for RTL (push to right side in RTL)
    },
  },
  compoundVariants: [
    {
      collapsed: true,
      language: "ar",
      className: "translate-x-[-0%]", // For RTL, we push the sidebar off to the right
    },
    
  ]
});
export const Overlay = tv({
  base: "bg-[rgb(15_23_42/0.3)] fixed inset-0 z-[40] opacity-80 transition-opacity md:hidden md:z-auto md:opacity-100",
});

export const Header = tv({
  base: "flex gap-8 items-center px-6",
});

export const Body = tv({
  base: "flex flex-col gap-3 mt-0 px-2",
});

export const Footer = tv({
  base: "flex items-center justify-center gap-6 pt-16 pb-8 px-8 md:pt-10 md:pb-0",
});

export const Sidebar = Object.assign(SidebarWrapper, {
  Header,
  Body,
  Overlay,
  Footer,
});
