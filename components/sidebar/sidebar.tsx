import React from "react";
import { Sidebar } from "./sidebar.styles";
import { Divider } from "@heroui/react";
import { SidebarItem } from "./sidebar-item";
import { SidebarMenu } from "./sidebar-menu";
import { useSidebarContext } from "../layout/layout-context";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { useSession } from "next-auth/react";
import { useLanguage } from "../context/LanguageContext";
import { lang } from "../Lang/lang";

import HomeIconMui from "@mui/icons-material/HomeRounded";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";

import {
  UsersIcon,
  BriefcaseIcon,
  CalendarIcon,
  DocumentIcon,
  CreditCardIcon,
  SparklesIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import { useParams } from 'next/navigation';
import { hasPermission } from "@/lib/auth";

export const SidebarWrapper = () => {
  const { language } = useLanguage();
  const { data: session } = useSession();
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebarContext();

  const isRTL = language === "ar";
  const { firmId } = useParams();

  return (
    <aside
      className="
        min-h-screen h-fit 
        z-[42] sticky top-0
        bg-content1
      "
    >
      {collapsed && (
        <div className={Sidebar.Overlay()} onClick={() => setCollapsed()} />
      )}

      <div className={Sidebar({ collapsed, language: isRTL ? "ar" : "ltr" })}>

        {/* Logo */}
        <NextLink
          href={"/"}
          className="flex items-center justify-center mb-4 mt-2 text-sm font-semibold tracking-wide"
        >
          Logo
        </NextLink>

        {/* NAV */}

        {firmId && (
          <nav className="flex flex-col gap-2 px-2">

            {/* ---------------------- MAIN ---------------------- */}
            <SidebarMenu title={lang(language, "Main")}>

              {/* Dashboard with permission */}
              {hasPermission(session?.user, "access_main_dashboard") && (
                <SidebarItem
                  isActive={pathname === `/${firmId}/dashboard`}
                  title={lang(language, "sidebar.dashboard")}
                  href={`/${firmId}/dashboard`}
                  className="!text-sm"
                  icon={<HomeIconMui className="!w-6 !h-6" />}
                />
              )}

            </SidebarMenu>

            {/* ---------------------- Management ---------------------- */}
            <SidebarMenu title={lang(language, "Management")}>

              <SidebarItem
                isActive={pathname.startsWith(`/${firmId}/dashboard/users`)}
                title={lang(language, "sidebar.users")}
                href={`/${firmId}/dashboard/users`}
                className="!text-sm"
                icon={<UsersIcon className=" !w-6 !h-6" />}
              />

              <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/roles`}
                title={lang(language, "sidebar.roles")}
                href={`/${firmId}/dashboard/roles`}
                className="!text-sm"
                icon={<BriefcaseIcon className=" !w-6 !h-6" />}
              />

              <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/branches`}
                title={lang(language, "sidebar.branches")}
                href={`/${firmId}/dashboard/branches`}
                className="!text-sm"
                icon={<BriefcaseIcon className=" !w-6 !h-6" />}
              />

              <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/customers`}
                title={lang(language, "sidebar.customers")}
                href={`/${firmId}/dashboard/customers`}
                className="!text-sm"
                icon={<BriefcaseIcon className=" !w-6 !h-6" />}
              />

              <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/products`}
                title={lang(language, "sidebar.products")}
                href={`/${firmId}/dashboard/products`}
                className="!text-sm"
                icon={<BriefcaseIcon className=" !w-6 !h-6" />}
              />

            </SidebarMenu>

            {/* ---------------------- Operations ---------------------- */}
            <SidebarMenu title={lang(language, "Operations")}>

             <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/visits`}
                title={lang(language, "sidebar.visits")}
                href={`/${firmId}/dashboard/visits`}
                className="!text-sm"
                icon={<DocumentIcon className=" !w-6 !h-6" />}
              />


              <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/warehouse`}
                title={lang(language, "sidebar.warehouse")}
                href={`/${firmId}/dashboard/warehouse`}
                className="!text-sm"
                icon={<DocumentIcon className=" !w-6 !h-6" />}
              />


              
               <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/sales`}
                title={lang(language, "sidebar.sales")}
                href={`/${firmId}/dashboard/sales`}
                className="!text-sm"
                icon={<DocumentIcon className=" !w-6 !h-6" />}
              />


              <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/customer-relationship`}
                title={lang(language, "sidebar.customer-relationship")}
                href={`/${firmId}/dashboard/customer-relationship`}
                className="!text-sm"
                icon={<DocumentIcon className=" !w-6 !h-6" />}
              />

               <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/asset`}
                title={lang(language, "sidebar.asset")}
                href={`/${firmId}/dashboard/asset`}
                className="!text-sm"
                icon={<DocumentIcon className=" !w-6 !h-6" />}
              />

               <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/reports`}
                title={lang(language, "sidebar.reports")}
                href={`/${firmId}/dashboard/reports`}
                className="!text-sm"
                icon={<DocumentIcon className=" !w-6 !h-6" />}
              />
              

            </SidebarMenu>

            {/* ---------------------- AI & REPORTS ---------------------- */}
            <SidebarMenu title={lang(language, "Analytics & AI")}>

               {/* <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/ai-tools`}
                title={lang(language, "sidebar.ai_tools")}
                href={`/${firmId}/dashboard/ai-tools`}
                className="!text-sm"
                icon={<SparklesIcon className=" !w-6 !h-6" />}*/}

            

            </SidebarMenu>

            {/* ---------------------- SETTINGS ---------------------- */}
            <SidebarMenu title={lang(language, "Settings")}>

              <SidebarItem
                isActive={pathname === `/${firmId}/dashboard/settings`}
                title={lang(language, "sidebar.settings")}
                href={`/${firmId}/dashboard/settings`}
                className="!text-sm"
                icon={<Cog6ToothIcon className=" !w-6 !h-6" />}
              />

            </SidebarMenu>

          </nav>

        )}


        {/* Footer */}
        <div className="mt-auto flex flex-col items-center gap-2 py-3 text-center">
          <Divider />
          <span className="text-[10px] text-[#4b5563] dark:text-[#b0b8c9]">
            {lang(language, "Powered by Alrateb")}
          </span>
        </div>
      </div>
    </aside>
  );
};
