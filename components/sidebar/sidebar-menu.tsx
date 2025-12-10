import React from "react";

interface Props {
  title: string;
  children?: React.ReactNode;
}

export const SidebarMenu = ({ title, children }: Props) => {
  function areAllChildrenEmpty(children: any) {
    // Convert React children to an array
    const childrenArray = React.Children.toArray(children);
    
    // Check if every child is empty (i.e., '', null, undefined, or false)
    return childrenArray.every(child => {
      // Check if the child is a string that is empty, or it's falsy like null/undefined
      return child === '' || child === null || child === undefined;
    });
  }

  return (
    <>
      {children && !areAllChildrenEmpty(children) ?
        <div className="flex gap-1 flex-col">
          <span className="text-xs font-normal ">{title}</span>
          {children}
        </div>
        : ''}

    </>
  );
};
