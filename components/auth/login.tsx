'use client';

import { useState } from 'react';
import { ReceiptPercentIcon } from "@heroicons/react/24/outline";
import { signIn } from "next-auth/react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Checkbox,
  Button,
  Alert,
  Divider
} from "@heroui/react";
import {
  ScaleIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useLanguage } from "../context/LanguageContext";
import { lang } from '../Lang/lang';

export default function LoginPage() {
  const { language } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    let res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      lang: language,
      type: "user"
    });

    if (res?.error) {
      res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        lang: language,
        type: "admin"
      });
    }

    setIsLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 
      bg-gradient-to-br from-background to-primary/10 dark:from-background dark:to-primary/20">

      <Card className="w-full max-w-md p-6 rounded-2xl shadow-xl border border-content3/10 bg-content1">

        {/* Logo & Titles */}
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl 
    flex items-center justify-center shadow-lg">
  <ReceiptPercentIcon className="w-7 h-7 text-white" />
</div>

          <h1 className="text-2xl font-bold text-text">
            {lang(language, 'platform_name')}
          </h1>
          <p className="text-muted text-base font-medium">
            {lang(language, 'login')}
          </p>
        </CardHeader>

        <Divider className="my-4" />

        {/* Form */}
        <form onSubmit={handleLogin}>
          <CardBody className="space-y-6">

            <Input
              type="email"
              label={lang(language, 'email')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@legal.com"
              startContent={<EnvelopeIcon className="w-5 h-5 text-muted" />}
              required
              variant="bordered"
              radius="lg"
            />

            <Input
              type="password"
              label={lang(language, 'password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              startContent={<LockClosedIcon className="w-5 h-5 text-muted" />}
              required
              variant="bordered"
              radius="lg"
            />

            <div className="flex items-center justify-between text-sm">
              <Checkbox color="primary">
                {language === 'ar' ? 'تذكرني' : 'Remember me'}
              </Checkbox>

              <a
                href="#"
                className="text-primary hover:text-secondary font-medium transition"
              >
                {lang(language, 'forgot_password')}
              </a>
            </div>

            {error && (
              <Alert
                color="danger"
                variant="flat"
                icon={<ShieldCheckIcon className="w-5 h-5" />}
                className="border border-danger-300 rounded-lg"
              >
                <span className="text-xs">{error}</span>
              </Alert>
            )}
          </CardBody>

          <CardFooter>
            <Button
              type="submit"
              color="primary"
              fullWidth
              isLoading={isLoading}
              disabled={isLoading}
              radius="lg"
              size="lg"
              className="font-semibold shadow-md"
            >
              {isLoading
                ? (language === 'ar' ? 'جاري تسجيل الدخول...' : 'Logging in...')
                : lang(language, 'login')}
            </Button>
          </CardFooter>
        </form>

        {/* Security Message */}
        <div className="mt-4">
          <Alert
            color="primary"
            icon={<ShieldCheckIcon className="w-5 h-5" />}
            variant="flat"
            className="text-center rounded-lg"
          >
            <span className="text-xs">
              {lang(language, 'security_message')}
            </span>
          </Alert>
        </div>
      </Card>
    </div>
  );
}
