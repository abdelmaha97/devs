import { lang } from "@/components/Lang/lang";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Next.js + HeroUI",
  description: "Make beautiful websites regardless of your design experience.",
  navItems: [
    {
      label: "Home",
      href: "/",
      langKey: "navbar.home"
    },
    {
      label: "Admin Dashboard",
      href: "/admin",
      langKey: "navbar.adminDashboard"
    }
  ]
};
