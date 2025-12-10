'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  SelectItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
  useDisclosure,
  Spinner,
  addToast,
  Alert,
  Form,
  User,
  Tooltip
} from '@heroui/react';
import { EyeIcon, PencilSquareIcon, PlusIcon, TrashIcon, ShieldExclamationIcon, ShieldCheckIcon, NoSymbolIcon, MagnifyingGlassIcon, UserGroupIcon, CheckBadgeIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { UserIcon, GlobeAltIcon, IdentificationIcon, EnvelopeIcon, DevicePhoneMobileIcon, LockClosedIcon, BriefcaseIcon } from '@heroicons/react/24/solid';

import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';
import { TableSkeleton } from "@/lib/Skeletons";
import moment from 'moment';
import NextLink from 'next/link';

type UserDB = {
  id: number;
  tenant_id: number;
  role_id: number;
  full_name: string;
  full_name_ar?: string | null;
  email?: string | null;
  phone?: string | null;
  password_hash?: string | null;
  status: 'pending_verification' | 'active' | 'disabled' | 'deleted' | 'pending_approval';
  created_at?: string | null;
};

type UserForm = {
  // keep UI fields (but note: many of these are UI-only and won't be sent to API under option C)
  id?: number;
  name: string; // maps to full_name
  name_ar?: string | null; // maps to full_name_ar
  email?: string | null;
  phone?: string | null;
  image?: string | null; // UI-only (not in DB)
  status: UserDB['status'];
  user_type: 'firm_owner' | 'lawyer' | 'client' | 'paralegal' | 'accountant' | 'external'; // UI-only
  department?: string | null; // UI-only
  bio?: string | null; // UI-only
  role_id?: string | number | null;
  password?: string; // if provided, send to API (API expected to hash)
  file?: File | null;
  username?: string; // UI-only
  // tenant preserved as numeric for API
  tenant_id?: number;
};

const userTypes = ['firm_owner', 'lawyer', 'client', 'paralegal', 'accountant', 'external'] as const;
const pageSize = 6;
const API_BASE_URL = '/api/v1/admin';
const DEFAULT_TENANT_ID = 1;

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function UsersPage() {
  const { language } = useLanguage();
  const t = (key: string, vars?: Record<string, string>) => {
    const value = lang(language, key);
    if (!vars) return value;
    return Object.keys(vars).reduce((acc, token) => acc.replace(`{{${token}}}`, vars[token]), value);
  };
  const [users, setUsers] = useState<UserDB[]>([]);
  const [roles, setRoles] = useState<any[]>([]); // roles come from roles endpoint (id, name, name_ar,...)

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all'); // UI-only filter (user_type is UI-only)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeUser, setActiveUser] = useState<UserDB | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [formData, setFormData] = useState<UserForm>({
    name: '',
    name_ar: '',
    email: '',
    phone: '',
    image: '',
    status: 'active',
    user_type: 'client',
    password: '',
    file: null,
    username: '',
    role_id: '',
    tenant_id: DEFAULT_TENANT_ID,
    department: '',
    bio: '',
  });

  const [submitError, setSubmitError] = useState<string[] | string>([]);


  const viewModal = useDisclosure();
  const editModal = useDisclosure();
  const deleteModal = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; id?: number } | null>(null);

  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);

  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameExists, setUsernameExists] = useState(false);
  const [usernameErrorMsg, setUsernameErrorMsg] = useState<string | null>(null);

  const emailDebounceRef = useRef<number | null>(null);
  const usernameDebounceRef = useRef<number | null>(null);


  const fetchRoles = async () => {
    try {
      const params = new URLSearchParams({
        tenant_id: DEFAULT_TENANT_ID.toString(),
      });

      const response = await fetch(`${API_BASE_URL}/roles/list?${params}`, {
        headers: {
          'accept-language': language,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data.data || []);
    } catch (error: any) {
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tenant_id: DEFAULT_TENANT_ID.toString(),
        page: String(page),
        pageSize: String(pageSize),
        ...(search && { search }),
        sortBy: 'created_at',
        sortOrder: 'desc',
        // Note: user_type is UI-only; backend doesn't have it so we don't send it
        status: statusFilter !== 'all' ? statusFilter : '',
      });

      const response = await fetch(`${API_BASE_URL}/users?${params}`, {
        headers: {
          'accept-language': language,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error(response.statusText);
      const data = await response.json();
      // normalize API response to our UserDB type if necessary
      setUsers(data.data || []);
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.count ?? (data.data ? data.data.length : 0));
    } catch (error: any) {
      console.error(error);
      addToast({ title: t('error_fetching_users'), description: error?.message || t('error'), color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, language, statusFilter, typeFilter]);


  const handleDeleteUser = async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { 'accept-language': language, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEFAULT_TENANT_ID }),
      });
      if (!response.ok) throw new Error('Failed to delete user');
      await fetchUsers();
      addToast({ title: 'تم الحذف', description: 'تم حذف المستخدم بنجاح / Deleted successfully', color: 'success' });
    } catch (error) {
      console.error(error);
      addToast({ title: 'خطأ', description: 'خطأ في حذف المستخدم / Error deleting user', color: 'danger' });
    } finally { setLoading(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'DELETE',
        headers: { 'accept-language': language, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEFAULT_TENANT_ID, user_ids: selectedUsers }),
      });
      if (!response.ok) throw new Error('Failed to delete users');
      setSelectedUsers([]);
      await fetchUsers();
      addToast({ title: 'تم الحذف', description: 'تم حذف المستخدمين بنجاح / Users deleted successfully', color: 'success' });
    } catch (error) {
      console.error(error);
      addToast({ title: 'خطأ', description: 'خطأ في حذف المستخدمين / Error deleting users', color: 'danger' });
    } finally { setLoading(false); }
  };

  const confirmDelete = (type: 'single' | 'bulk', id?: number) => {
    setDeleteTarget({ type, id });
    deleteModal.onOpen();
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    deleteModal.onClose();
    if (deleteTarget.type === 'single' && deleteTarget.id) await handleDeleteUser(deleteTarget.id);
    if (deleteTarget.type === 'bulk') await handleBulkDelete();
    setDeleteTarget(null);
  };


  const fetchUserDetails = async (userId: number) => {

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}?tenant_id=${DEFAULT_TENANT_ID}`, {
        headers: { 'accept-language': language },
      });

      if (!response.ok) throw new Error(response.statusText);


      const data = await response.json();
      // API returns user object; setActiveUser expects UserDB
      setActiveUser(data);
      viewModal.onOpen();
    } catch (error) {
      console.error('Error fetching user details:', error);
      addToast({ title: 'خطأ', description: 'خطأ في جلب بيانات المستخدم / Error fetching user details', color: 'danger' });
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setFormData({
      name: '',
      name_ar: '',
      email: '',
      phone: '',
      image: '',
      status: 'pending_verification',
      user_type: 'client',
      department: '',
      bio: '',
      password: '',
      file: null,
      username: '',
      role_id: '',
      tenant_id: DEFAULT_TENANT_ID,
    });
    setEmailExists(false);
    setEmailErrorMsg(null);
    setUsernameExists(false);
    setUsernameErrorMsg(null);
    setSubmitError([]);
  };

  const openCreateUser = () => {
    setIsEditing(false);
    resetForm();
    editModal.onOpen();
  };

  const openEditUser = (user: UserDB) => {
    setIsEditing(true);
    setFormData({
      id: user.id,
      name: user.full_name,
      name_ar: user.full_name_ar || '',
      email: user.email || '',
      phone: user.phone || '',
      image: '', // UI-only
      status: user.status,
      user_type: 'client', // UI-only (no mapping in DB)
      department: '',
      bio: '',
      password: '',
      file: null,
      username: '',
      role_id: user.role_id ? String(user.role_id) : '',
      tenant_id: user.tenant_id || DEFAULT_TENANT_ID,
    });
    setEmailExists(false);
    setEmailErrorMsg(null);
    setUsernameExists(false);
    setUsernameErrorMsg(null);
    editModal.onOpen();
    setSubmitError([]);
  };


  const toggleUserStatus = async (userId: number, currentStatus: UserDB['status']) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    // flip between active and disabled (keep other statuses intact by logic)
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'accept-language': language, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, tenant_id: DEFAULT_TENANT_ID }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Failed to update user status');
      }

      await fetchUsers();
      addToast({ title: 'تم التحديث', description: 'تم تحديث حالة المستخدم بنجاح / User status updated successfully', color: 'success' });
    } catch (error) {
      console.error('Error updating user status:', error);
      addToast({ title: 'خطأ', description: 'خطأ في تحديث الحالة / Error updating status', color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async () => {

    const payload: Record<string, any> = {
      full_name: formData.name?.trim(),
      full_name_ar: formData.name_ar?.trim() || null,
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      role_id: formData.role_id ? Number(formData.role_id) : null,
      tenant_id: formData.tenant_id ?? DEFAULT_TENANT_ID,
      status: formData.status,
      ...(formData.password ? { password: formData.password } : {}),
    };

    setLoadingForm(true);
    try {
      const endpoint = isEditing && formData.id ? `${API_BASE_URL}/users/${formData.id}` : `${API_BASE_URL}/users`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'accept-language': language, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSubmitError(data?.error || t('users.form.save_failed_desc'));
        return;
      }

      addToast({
        title: t('users.form.save_success'),
        description: data?.message || t('users.form.save_success_desc'),
        color: 'success',
      });
      editModal.onClose();
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('saveUser error:', error);
      setSubmitError(t('users.form.save_failed_desc'));
    } finally {
      setLoadingForm(false);
    }
  };

  const statusChip = (status: UserDB['status']) => (
    <Tooltip showArrow className="capitalize" color={status === 'active' ? 'success' : status === 'pending_verification' ? 'warning' : 'default'} content={status === 'active' ? t('users.status.active') : status === 'disabled' ? t('users.status.inactive') : t('users.filter.status_pending_verification')}>
      <Chip
        size="sm"
        color={status === 'active' ? 'success' : status === 'pending_verification' ? 'warning' : 'default'}
        variant="flat"
      >
        {status === 'active' ?
          <ShieldCheckIcon className="h-4 w-4" />
          : status === 'disabled' ?
            <NoSymbolIcon className="h-4 w-4" />
            : <ShieldExclamationIcon className="h-4 w-4" />
        }
      </Chip>

    </Tooltip>

  );

  // typeChip is UI-only: the DB doesn't have user_type, but we keep visuals
  const typeChip = (type: UserForm['user_type']) => (
    <Chip
      size="sm"
      color={type === 'firm_owner' ? 'danger' : type === 'lawyer' ? 'warning' : type === 'paralegal' ? 'success' : 'default'}
      variant="flat"
    >
      {t(`users.types.${type}`)}
    </Chip>
  );

  // roleChip: show role label using roles lookup (roles must be fetched separately)
  const roleChip = (roleId: number | null | undefined) => {
    const role = roles.find((r: any) => Number(r.id ?? r.role_id) === Number(roleId));
    const roleName = role ? (language === 'ar' ? (role.name_ar || role.name) : (role.name || role.role_name)) : '-';
    return (
      <Chip
        size="sm"
        color={'primary'}
        variant="solid"
      >
        {roleName}
      </Chip>
    );
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setFormData((prev) => ({ ...prev, file, image: URL.createObjectURL(file) }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">

      <div className="mx-auto w-full space-y-8">
        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">{t('users.hero.tag')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">{t('users.hero.title')}</h1>
          </div>
          <div className="flex gap-2">
            {selectedUsers.length > 0 && (
              <Button variant="flat" color="danger" startContent={<TrashIcon className="h-4 w-4" />} onPress={() => confirmDelete('bulk')}>
                حذف ({selectedUsers.length}) / Delete ({selectedUsers.length})
              </Button>)}

            <Button variant="solid" color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={openCreateUser}>
              {t('users.hero.button_new')}
            </Button>
          </div>
        </section>

        <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange} backdrop="blur">
          <ModalContent className="bg-content1/95">
            {(onClose) => (
              <>
                <ModalHeader className="text-xl font-semibold text-danger">
                  {deleteTarget?.type === 'bulk' ? 'حذف جماعي' : 'حذف المستخدم'}
                </ModalHeader>
                <ModalBody>
                  <p className="text-foreground/80 text-md leading-relaxed">
                    {deleteTarget?.type === 'bulk'
                      ? `هل أنت متأكد من حذف ${selectedUsers.length} مستخدم؟`
                      : 'هل أنت متأكد أنك تريد حذف هذا المستخدم؟'}
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>إلغاء</Button>
                  <Button color="danger" onPress={executeDelete}>تأكيد الحذف</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>



        <Table
          aria-label={t('users.table.aria')}
          classNames={{ table: 'min-w-full text-base' }}
          topContent={
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Input
                  startContent={<MagnifyingGlassIcon className="h-5 w-5 text-foreground/60" />}

                  label={t('users.search.placeholder')}
                  variant="faded"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="min-w-[240px]"
                />
                <Select
                  startContent={<UserGroupIcon className="h-5 w-5 text-foreground/60" />}
                  variant="faded"
                  label={t('users.filter.type')}
                  selectedKeys={[typeFilter]}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="min-w-[160px]"
                >
                  <SelectItem key="all">{t('users.filter.type_all')}</SelectItem>
                  <>
                    {userTypes.map((type) => (
                      <SelectItem key={type}>{t(`users.types.${type}`)}</SelectItem>
                    ))}
                  </>
                </Select>
                <Select
                  startContent={<CheckBadgeIcon className="h-5 w-5 text-foreground/60" />}
                  variant="faded"
                  label={t('users.filter.status')}
                  className="min-w-[160px]"
                  selectedKeys={[statusFilter]}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                    setPage(1);
                  }}
                >
                  <SelectItem key="all">{t('users.filter.status_all')}</SelectItem>
                  <SelectItem key="active">{t('users.filter.status_active')}</SelectItem>
                  <SelectItem key="pending_verification">{t('users.filter.status_pending_verification')}</SelectItem>
                  <SelectItem key="disabled">{t('users.filter.status_inactive')}</SelectItem>
                </Select>
              </div>
              <span className="text-sm text-foreground/70">{t('users.table.results', { count: totalCount.toString() })}</span>
            </div>
          }
          bottomContent={
            <div className="flex flex-col gap-3 px-2 py-2 text-sm md:flex-row md:items-center md:justify-between">
              <div className={`flex gap-2`}>
                <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.max(prev - 1, 1))} isDisabled={page === 1}>
                  {t('users.pagination.prev')}
                </Button>
                <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))} isDisabled={page === totalPages}>
                  {t('users.pagination.next')}
                </Button>
              </div>
              <span className="text-xs text-foreground/60">{t('users.pagination.page', { page: page.toString(), total: totalPages.toString() })}</span>
              <Pagination style={{ direction: 'ltr' }} page={page} total={totalPages} onChange={setPage} showControls color="primary" size="sm" isDisabled={users.length === 0} />
            </div>
          }
        >
          <TableHeader>

            <TableColumn>{t('users.table.column.user')}</TableColumn>
            <TableColumn>{t('users.filter.type')}</TableColumn>
            <TableColumn>{t('users.table.column.role')}</TableColumn>
            <TableColumn>{t('users.table.column.joined')}</TableColumn>
            <TableColumn className="text-end">{t('users.table.column.actions')}</TableColumn>
          </TableHeader>
          {loading ?
            <TableBody loadingContent={<TableSkeleton rows={8} columns={8} />} isLoading={loading} emptyContent={""}>{[]}</TableBody>

            :
            <TableBody emptyContent={t('users.table.empty')}>
              {users.map((user) => (
                <TableRow key={user.id} className="hover:bg-content2/60">

                  <TableCell>
                    <User
                      aria-label={t('users.table.view_user_aria', { name: user.full_name })}
                      avatarProps={{
                        src: '', // image not in DB (UI-only)
                        size: 'md',
                      }}
                      name={
                        <div className='flex items-center gap-1'>
                          {statusChip(user.status)}
                          <span>{language === 'ar' ? (user.full_name_ar || user.full_name) : user.full_name}</span>

                        </div>
                      }
                      description={
                        <div className="text-xs text-foreground/70">
                          <p>{user.phone || user.email}</p>
                        </div>
                      }
                    />
                  </TableCell>

                  <TableCell>
                    {/* user_type is UI-only; show default chip or allow selecting per user if you stored it elsewhere */}
                    {typeChip('client')}
                  </TableCell>

                  <TableCell>
                    {roleChip(user.role_id)}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      {moment(user.created_at).locale(language).format('DD MMM YYYY, hh:mm A')}
                    </div>
                  </TableCell>
                  <TableCell className='flex items-center justify-end gap-2'>
                    <Button as={NextLink} isIconOnly radius='full' variant="flat" href={`/${DEFAULT_TENANT_ID}/dashboard/users/${user.id}`} color="default">
                      <InformationCircleIcon className="h-5 w-5" />
                    </Button>

                    <Button isIconOnly color='warning' variant="flat" radius="full" onPress={() => openEditUser(user)}>
                      <PencilSquareIcon className="h-5 w-5" />
                    </Button>
                    <Button isIconOnly variant="flat" radius="full" color="danger" onPress={() => handleDeleteUser(user.id)}>
                      <TrashIcon className="h-5 w-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          }

        </Table>
      </div>

      {/* View Modal */}
      <Modal isOpen={viewModal.isOpen} onOpenChange={viewModal.onOpenChange} size="lg" backdrop="blur">
        <ModalContent className="bg-content1/95">
          {() =>
            activeUser && (
              <>
                <ModalHeader className="flex items-center gap-3">
                  <Avatar size="md" name={activeUser.full_name} src={''} />
                  <div>
                    <p className="text-lg font-semibold">{language === 'ar' ? activeUser.full_name_ar || activeUser.full_name : activeUser.full_name}</p>
                    <p className="text-sm text-foreground/70">{/* user_type not in DB */}</p>
                  </div>
                </ModalHeader>
                <ModalBody className="space-y-4">
                  <Divider />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground/60">{t('users.modal.contact')}</p>
                    <p className="text-sm">{activeUser.email}</p>
                    <p className="text-sm">{activeUser.phone}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-foreground/60">{t('users.modal.username')}</p>
                      <p className="text-sm">-</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-foreground/60">{t('users.modal.role_id')}</p>
                      <p className="text-sm">{activeUser.role_id ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-foreground/60">{t('users.modal.department')}</p>
                      <p className="text-sm">-</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-foreground/60">{t('users.modal.created_at')}</p>
                      <p className="text-sm">{activeUser.created_at || '-'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {statusChip(activeUser.status)}
                    <Chip variant="flat" size="sm">-</Chip>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={viewModal.onClose}>
                    {t('users.modal.close')}
                  </Button>
                </ModalFooter>
              </>
            )
          }
        </ModalContent>
      </Modal>

      {/* Edit / Create Modal */}
      <Modal isDismissable={false} isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="xl" scrollBehavior="inside" backdrop="blur">
        <ModalContent className="bg-content1/95">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">
                {isEditing ? t('users.form.edit_title') : t('users.form.create_title')}
              </ModalHeader>
              <Form onSubmit={(e: any) => { e.preventDefault(); saveUser(); }} className="w-full">
                <ModalBody className="space-y-2">
                  {submitError &&
                    (
                      (Array.isArray(submitError) && submitError.length > 0) ||
                      (typeof submitError === 'string' && submitError.trim() !== '')
                    ) && (
                      <Alert
                        title={isEditing ? t('users.form.save_failed') : t('users.form.create_failed')}
                        description={
                          <ul className='list-disc list-inside'>
                            {Array.isArray(submitError) ? submitError.map((err, idx) => (<li key={idx}>{err}</li>)) : <p>{submitError}</p>}
                          </ul>
                        }
                        variant="flat" color="danger" className="mb-4" />
                    )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label={t('users.form.name')}
                      variant="faded"
                      startContent={<UserIcon className="h-5 w-5 text-foreground/50" />}
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      isRequired
                      errorMessage={t('error.required_field')}
                    />
                    <Input
                      label={t('users.form.name_ar')}
                      variant="faded"
                      startContent={<GlobeAltIcon className="h-5 w-5 text-foreground/50" />}
                      value={formData.name_ar || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name_ar: e.target.value }))}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 relative">
                    <Input
                      variant="faded"
                      label={t('username')}
                      startContent={<IdentificationIcon className="h-5 w-5 text-foreground/50" />}
                      value={formData.username || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                      isRequired
                      className={`${usernameExists ? 'border-red-500' : ''}`}
                      errorMessage={t('error.required_field')}
                    />
                    <Input
                      variant="faded"
                      label={t('users.form.email')}
                      startContent={<EnvelopeIcon className="h-5 w-5 text-foreground/50" />}
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value  }))}
                      isRequired
                      className={`${emailExists ? 'border-red-500' : ''}`}
                      errorMessage={t('error.required_field')}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label={t('users.form.phone')}
                      variant="faded"
                      startContent={<DevicePhoneMobileIcon className="h-5 w-5 text-foreground/50" />}
                      value={formData.phone || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                    <Select
                      label={t('users.form.user_type')}
                      startContent={<UserGroupIcon className="h-5 w-5 text-foreground/60" />}
                      selectedKeys={[formData.user_type]}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, user_type: e.target.value }))
                      }
                      variant="faded"
                    >
                      {userTypes.map((type) => (<SelectItem key={type}>{t(`users.types.${type}`)}</SelectItem>))}
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      type="password"
                      label={t('users.form.password')}
                      variant="faded"
                      startContent={<LockClosedIcon className="h-5 w-5 text-foreground/50" />}
                      isRequired={!isEditing}
                      value={formData.password || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder={isEditing ? t('users.form.password_optional') : ''}
                      errorMessage={t('error.required_field')}
                    />

                    <Select
                      label={t('users.form.user_type')}
                      startContent={<BriefcaseIcon className="h-5 w-5 text-foreground/60" />}
                      selectedKeys={[formData.role_id ? String(formData.role_id) : '']}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, role_id: e.target.value }))
                      }
                      variant="faded"
                    >
                      {roles.map((role) => (
                        <SelectItem key={role.id ?? role.role_id}>
                          {language == 'en' ? role.name : role.name_ar || role.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-1">
                    <Select
                      label={t('users.form.activate')}
                      startContent={<ShieldCheckIcon className="h-5 w-5 text-foreground/60" />}
                      selectedKeys={[formData.status ? String(formData.status) : '']}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, status: e.target.value }))
                      }
                      variant="faded"
                      isRequired
                      errorMessage={t('error.required_field')}
                    >
                      <SelectItem key={'active'}>
                        {t('users.status.active')}
                      </SelectItem>
                      <SelectItem key={'pending_verification'}>
                        {t('users.status.pending_verification')}
                      </SelectItem>
                      <SelectItem key={'disabled'}>
                        {t('users.status.disabled')}
                      </SelectItem>
                    </Select>
                  </div>
                </ModalBody>

                <ModalFooter>
                  <Button variant="light" onPress={() => { onClose(); resetForm(); }}>{t('users.form.cancel')}</Button>
                  <Button color="primary" type="submit" isLoading={loadingForm}>
                    {t('users.form.save')}
                  </Button>
                </ModalFooter>
              </Form>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
