import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Navbar,
  NavbarItem,
  AvatarIcon
} from "@heroui/react";
import React from "react";
import { DarkModeSwitch } from "./darkmodeswitch";
import { useSession } from "next-auth/react"
import { useRouter } from 'next/navigation'
import { signOut } from "next-auth/react"
import { Popover, PopoverTrigger, PopoverContent, Button, User } from "@heroui/react";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/react";
import CurrencyPoundIcon from '@mui/icons-material/CurrencyPound';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTheme as useNextTheme } from "next-themes";
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import NextLink from "next/link";
import {WalletBalance} from "./WalletBalance";
import { useLanguage } from "../context/LanguageContext";
import { lang } from "../Lang/lang";

export const UserDropdown = () => {
    const { language } = useLanguage();
  
  const { data: session }: any = useSession()
  const router = useRouter()

  function handleClick(key: any) {
    if (key == "my-account" || key == "profile") {
      router.push('/account');
      return;
    }
    if (key == "logout") {
      signOut({ callbackUrl: '/' });
      return;
    }
    if (key == "help") {

      return;
    }
  }
  return (
    <>
      {session && session.user ?
        <Popover showArrow placement="bottom">
          <NavbarItem>
            <PopoverTrigger>
              <div className="flex justify-center items-center gap-2 notranslate">
                <User
                  as="button"
                  name={`${session.user.name.length > 15 ? `${session.user.name.slice(0, 15)}..` : session.user.name}`}
                  description={
                    <span>
                      {session.user.role === 'tenant' && session.user.walletBalance ? (
                        <WalletBalance/>
                      ) : (
                        <>{session.user.email}</>
                      )}
                    </span>
                  }
                  className="transition-transform hidden sm:flex"

                  avatarProps={{
                    src: session.user.avatar || null,
                    color: 'primary',
                    isBordered: false,
                    className: 'w-12 h-12',
                    classNames: {
                      base: "bg-gradient-to-br from-primary to-secondary",
                      icon: "text-text",
                    }
                  }}
                />

                <Avatar
                  src={session.user.avatar || null}
                  color='primary'
                  isBordered={false}
                  className='w-12 h-12 sm:hidden flex'
                  classNames={{
                    base: "bg-gradient-to-br from-primary to-secondary",
                    icon: "text-black/100",
                  }}
                />
                <KeyboardArrowDownIcon style={{ marginTop: '0rem' }} />
              </div>
            </PopoverTrigger>
          </NavbarItem>

          <PopoverContent className="p-1">
            <UserTwitterCard user={session.user} />
          </PopoverContent>
        </Popover>
        :
        ''
      }
    </>
  );
};

export const UserTwitterCard = ({ user }: any) => {
  const [isFollowed, setIsFollowed] = React.useState(false);
  const { setTheme, resolvedTheme, theme } = useNextTheme();
  const { data: session }: any = useSession()
    const { language } = useLanguage();

  function handleThemeChange(e: any) {
    setTheme(theme == "dark" ? "light" : "dark")

  }
  return (
    <Card shadow="none" className="max-w-[300px] border-none bg-transparent">
      <CardHeader className="justify-between">
        <div className="flex gap-3">
          <Avatar isBordered radius="full" size="md" src={user.avatar} />
          <div className="flex flex-col items-start justify-center">
            <h4 className="text-small font-semibold leading-none text-default-600">{user.name}</h4>
            <h5 className="text-small tracking-tight text-default-500">{user.email}</h5>
          </div>
        </div>

      </CardHeader>
      <CardBody className="px-2 py-2 gap-2 border-t-1 border-gray-800">
        <Button as={NextLink} href="/profile" className="w-full justify-start" variant="light" startContent={<AccountCircleRoundedIcon />}>{lang(language, "Your Profile")}</Button>
        <Button onPress={(e) => handleThemeChange(e)} className="w-full justify-start" variant="light" startContent={resolvedTheme == 'dark' ? <LightModeIcon /> : <DarkModeIcon />}>{resolvedTheme == 'dark' ? lang(language, "Light theme") : lang(language, "Dark theme")}</Button>

        {session.user.role === 'tenant' && session.user.walletBalance ?
          <WalletBalance view="button" />
          : ''}


        <Button onPress={() => signOut({ callbackUrl: '/' })} className="w-full justify-start" color="danger" variant="light" startContent={<LogoutIcon style={{ width: '32px', height: '32px' }} />}>{lang(language, "Log out")}</Button>


      </CardBody>

    </Card>
  );
};
