import NextLink from "next/link";
import React from "react";
import { useSidebarContext } from "../layout/layout-context";
import clsx from "clsx";

interface Props {
  title: string | React.ReactNode;
  icon: React.ReactNode;
  isActive?: boolean;
  href?: string;
  blankTarget?: boolean;
  selectedColor?: string;
  unSelectedColor?: string;
  className?: string;
}

export const SidebarItem = ({ icon, title, isActive, href = "", blankTarget, selectedColor, unSelectedColor, className }: Props) => {
  const { collapsed, setCollapsed } = useSidebarContext();

  const handleClick = () => {
    if (window.innerWidth < 768) {
      setCollapsed();
    }
  };
  return (
    <NextLink
      href={href}
      target={blankTarget ? "_blank" : undefined} 
      className={`text-default-900 active:bg-none max-w-full ${className || ''}`}
    >
      <div
        className={clsx(
          isActive
            ? ` ${selectedColor || 'bg-primary'} [&_svg_path]:fill-content1`
            : `hover:bg-default-100 ${unSelectedColor}`,
          "flex gap-2 w-full min-h-[44px] h-full items-center px-3.5 rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.98]"
        )}
        onClick={handleClick}
      >
        {icon}
        <span className={`${isActive ? 'text-content1' : ''} text-md`}>{title}</span>
      </div>
    </NextLink>
  );
};
