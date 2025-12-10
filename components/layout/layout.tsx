import React, { useState, useEffect } from "react";
import { useLockedBody } from "../hooks/useBodyLock";
import { NavbarWrapper } from "../navbar/navbar";
import { SidebarWrapper } from "../sidebar/sidebar";
import { SidebarContext } from "./layout-context";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";



interface Props {
  children: React.ReactNode;
}

export const Layout = ({ children }: Props) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [_, setLocked] = useLockedBody(false);
  const [permissionRequested, setPermissionRequested] = useState(false); // Track permission request status
  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    setLocked(!sidebarOpen);
  };

  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <SidebarContext.Provider
      value={{
        collapsed: sidebarOpen,
        setCollapsed: handleToggleSidebar,
      }}
    >
      <section className="flex">
        {(pathname.includes('/dashboard')) && <SidebarWrapper />}
        <NavbarWrapper>{children}</NavbarWrapper>
      </section>
    </SidebarContext.Provider>
  );
};
