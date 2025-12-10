import NextLink from 'next/link';
import { NavbarItem } from "@heroui/react";
import { useTheme as useNextTheme } from "next-themes";

const NavLink = ({ href, label, pathname, icon }) => {
  const { setTheme, resolvedTheme } = useNextTheme();

  const isActive = pathname === href;

  return (
    <NavbarItem  className={`flex gap-2 justify-center items-center px-1 py-1 rounded-lg ${isActive? 'text-primary' :''}`} isActive={isActive}>
      <NextLink
        className={`hover:opacity-70 hover:text-secondary hover:underline transition duration-200 ease-in-out text-md flex items-center gap-2`}
        href={href}
      >
       {icon} {label}
      </NextLink>
    </NavbarItem>
  );
};

export default NavLink;
