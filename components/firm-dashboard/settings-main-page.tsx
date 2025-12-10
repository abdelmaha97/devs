'use client';

import { useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  Input,
  Switch,
  Select,
  SelectItem,
} from '@heroui/react';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'appearance' | 'integrations' | 'admin';

export default function SettingsPage() {
  const { language } = useLanguage();
  const t = (key: string, vars?: Record<string, string>) => {
    const value = lang(language, key);
    if (!vars) return value;
    return Object.keys(vars).reduce((acc, token) => acc.replace(`{{${token}}}`, vars[token]), value);
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const [profile, setProfile] = useState({
    avatar: '',
    name: '',
    name_ar: '',
    email: '',
    phone: '',
    company: '',
  });

  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
    show: false,
    twoFA: false,
  });

  const [notifications, setNotifications] = useState({
    email: true,
    app: true,
    sms: false,
  });

  const [appearance, setAppearance] = useState({
    language: 'en',
    darkMode: false,
  });

  const [integrations, setIntegrations] = useState([
    { name: 'Google Drive', connected: false },
    { name: 'Dropbox', connected: true },
  ]);

  const [adminSettings, setAdminSettings] = useState({
    usersCount: 12,
    activeUsers: 10,
    roles: ['Admin', 'Editor', 'Viewer'],
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <h1 className="text-3xl font-semibold text-text mb-6">{t('settings.title', { default: 'الإعدادات' })}</h1>

      <div className="flex gap-6">
        {/* القوائم الجانبية للتبويبات */}
        <div className="flex flex-col gap-2 w-60">
          <Button variant={activeTab === 'profile' ? 'faded' : 'flat'} onPress={() => setActiveTab('profile')}>
            {t('settings.tabs.profile', { default: 'الحساب الشخصي' })}
          </Button>
          <Button variant={activeTab === 'security' ? 'faded' : 'flat'} onPress={() => setActiveTab('security')}>
            {t('settings.tabs.security', { default: 'الأمان وكلمة المرور' })}
          </Button>
          <Button variant={activeTab === 'notifications' ? 'faded' : 'flat'} onPress={() => setActiveTab('notifications')}>
            {t('settings.tabs.notifications', { default: 'الإشعارات' })}
          </Button>
          <Button variant={activeTab === 'appearance' ? 'faded' : 'flat'} onPress={() => setActiveTab('appearance')}>
            {t('settings.tabs.appearance', { default: 'اللغة والواجهة' })}
          </Button>
          <Button variant={activeTab === 'integrations' ? 'faded' : 'flat'} onPress={() => setActiveTab('integrations')}>
            {t('settings.tabs.integrations', { default: 'الربط مع خدمات خارجية' })}
          </Button>
          <Button variant={activeTab === 'admin' ? 'faded' : 'flat'} onPress={() => setActiveTab('admin')}>
            {t('settings.tabs.admin', { default: 'الإدارة والتراخيص' })}
          </Button>
        </div>

        {/* محتوى التبويبات */}
        <div className="flex-1 space-y-4">
          {/* الحساب الشخصي */}
          {activeTab === 'profile' && (
            <Card>
              <CardBody className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar size="lg" radius="lg" src={profile.avatar} name={profile.name} />
                  <Button variant="flat" radius="lg">{t('settings.profile.change_avatar', { default: 'تغيير الصورة' })}</Button>
                </div>
                <Input label={t('settings.profile.name', { default: 'الاسم' })} radius="lg" variant="faded" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                <Input label={t('settings.profile.name_ar', { default: 'الاسم بالعربية' })} radius="lg" variant="faded" value={profile.name_ar} onChange={(e) => setProfile({ ...profile, name_ar: e.target.value })} />
                <Input label={t('settings.profile.email', { default: 'البريد الإلكتروني' })} radius="lg" variant="faded" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                <Input label={t('settings.profile.phone', { default: 'رقم الهاتف' })} radius="lg" variant="faded" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                <Input label={t('settings.profile.company', { default: 'الشركة' })} radius="lg" variant="faded" value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} />
                <Button color="primary" radius="lg" onPress={() => console.log('Save profile', profile)}>{t('settings.save', { default: 'حفظ التغييرات' })}</Button>
              </CardBody>
            </Card>
          )}

          {/* الأمان وكلمة المرور */}
{activeTab === 'security' && (
  <Card>
    <CardBody className="space-y-4">
      <Input
        type={passwordData.show ? 'text' : 'password'}
        label={t('settings.security.current_password', { default: 'كلمة المرور الحالية' })}
        radius="lg"
        variant="faded"
        value={passwordData.current}
        onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
      />
      <Input
        type={passwordData.show ? 'text' : 'password'}
        label={t('settings.security.new_password', { default: 'كلمة المرور الجديدة' })}
        radius="lg"
        variant="faded"
        value={passwordData.new}
        onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
      />
      <Input
        type={passwordData.show ? 'text' : 'password'}
        label={t('settings.security.confirm_password', { default: 'تأكيد كلمة المرور' })}
        radius="lg"
        variant="faded"
        value={passwordData.confirm}
        onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
      />

      {/* Switches للأمان */}
      {[
        { key: 'show', label: t('settings.security.show_password', { default: 'إظهار كلمة المرور' }) },
        { key: 'twoFA', label: t('settings.security.2fa', { default: 'تفعيل المصادقة الثنائية 2FA' }) },
      ].map((option) => (
        <div key={option.key} className="flex items-center gap-2">
          <Switch
            isSelected={passwordData[option.key]}
            onChange={(e) =>
              setPasswordData({ ...passwordData, [option.key]: e.target.checked })
            }
          />
          <span>{option.label}</span>
        </div>
      ))}

      <Button color="primary" radius="lg" onPress={() => console.log('Change password', passwordData)}>
        {t('settings.save', { default: 'حفظ التغييرات' })}
      </Button>
    </CardBody>
  </Card>
)}

{/* الإشعارات */}
{activeTab === 'notifications' && (
  <Card>
    <CardBody className="space-y-4">
      {[
        { key: 'email', label: t('settings.notifications.email', { default: 'البريد الإلكتروني' }) },
        { key: 'app', label: t('settings.notifications.app', { default: 'التنبيهات داخل التطبيق' }) },
        { key: 'sms', label: t('settings.notifications.sms', { default: 'التنبيهات الهاتفية' }) },
      ].map((option) => (
        <div key={option.key} className="flex items-center gap-2">
          <Switch
            isSelected={notifications[option.key]}
            onChange={(e) =>
              setNotifications({ ...notifications, [option.key]: e.target.checked })
            }
          />
          <span>{option.label}</span>
        </div>
      ))}
      <Button color="primary" radius="lg" onPress={() => console.log('Save notifications', notifications)}>
        {t('settings.save', { default: 'حفظ التغييرات' })}
      </Button>
    </CardBody>
  </Card>
)}


{/* اللغة والواجهة */}
{activeTab === 'appearance' && (
  <Card>
    <CardBody className="space-y-4">
      <Select
        selectedKeys={[appearance.language]}
        onChange={(e) => setAppearance({ ...appearance, language: e.target.value })}
        radius="lg"
        variant="faded"
      >
        <SelectItem key="en">English</SelectItem>
        <SelectItem key="ar">العربية</SelectItem>
      </Select>

      <div className="flex items-center gap-2">
        <Switch
          isSelected={appearance.darkMode}
          onChange={(e) => setAppearance({ ...appearance, darkMode: e.target.checked })}
        />
        <span>{t('settings.appearance.dark_mode', { default: 'الوضع الليلي' })}</span>
      </div>

      <Button color="primary" radius="lg" onPress={() => console.log('Save appearance', appearance)}>
        {t('settings.save', { default: 'حفظ التغييرات' })}
      </Button>
    </CardBody>
  </Card>
)}

          {/* الربط مع خدمات خارجية */}
          {activeTab === 'integrations' && (
            <Card>
              <CardBody className="space-y-4">
                {integrations.map((service, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span>{service.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={service.connected ? 'text-success' : 'text-foreground/60'}>
                        {service.connected ? t('settings.integrations.connected', { default: 'متصل' }) : t('settings.integrations.disconnected', { default: 'غير متصل' })}
                      </span>
                      <Button size="sm" radius="lg" variant="flat" onPress={() => {
                        const updated = [...integrations];
                        updated[idx].connected = !updated[idx].connected;
                        setIntegrations(updated);
                      }}>
                        {service.connected ? t('settings.integrations.disconnect', { default: 'فصل' }) : t('settings.integrations.connect', { default: 'إعادة الاتصال' })}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* الإدارة والتراخيص */}
          {activeTab === 'admin' && (
            <Card>
              <CardBody className="space-y-4">
                <p>{t('settings.admin.users_count', { default: 'عدد المستخدمين: ' })}{adminSettings.usersCount}</p>
                <p>{t('settings.admin.active_users', { default: 'المستخدمين النشطين: ' })}{adminSettings.activeUsers}</p>
                <p>{t('settings.admin.roles', { default: 'الصلاحيات: ' })}{adminSettings.roles.join(', ')}</p>
                <Button color="primary" radius="lg">{t('settings.admin.manage_users', { default: 'إدارة المستخدمين' })}</Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
