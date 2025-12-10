'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
  useDisclosure,
} from '@heroui/react';
import { EyeIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';

type Branch = {
  id: number;
  tenant_id: number;
  name: string;
  name_ar?: string | null;
  address?: string | null;
  address_ar?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
};

type BranchForm = Omit<Branch, 'id' | 'tenant_id' | 'created_at'> & { id?: number; tenant_id?: number };

const pageSize = 6;

export default function BranchesPage() {
  const { language } = useLanguage();
  const t = (key: string, vars?: Record<string, string>) => {
    const value = lang(language, key);
    if (!vars) return value;
    return Object.keys(vars).reduce((acc, token) => acc.replace(`{{${token}}}`, vars[token]), value);
  };
  const isRTL = language === 'ar';

  // بيانات تجريبية مؤقتة لعرض واجهة قبل ربط الـ API
  const seededBranches: Branch[] = [
    {
      id: 1,
      tenant_id: 1,
      name: 'Muscat Head Office',
      name_ar: 'المكتب الرئيسي مسقط',
      address: 'Al Khuwair, Muscat',
      address_ar: 'الخوير، مسقط',
      latitude: 23.6167,
      longitude: 58.5453,
      created_at: '2025-01-01',
    },
    {
      id: 2,
      tenant_id: 1,
      name: 'Salalah Branch',
      name_ar: 'فرع صلالة',
      address: 'Al Haffa, Salalah',
      address_ar: 'الحافة، صلالة',
      latitude: 17.0197,
      longitude: 54.0924,
      created_at: '2025-02-01',
    },
  ];

  const [branches, setBranches] = useState<Branch[]>(seededBranches);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BranchForm>({
    name: '',
    name_ar: '',
    address: '',
    address_ar: '',
    latitude: undefined,
    longitude: undefined,
    tenant_id: undefined,
  });

  const viewModal = useDisclosure();
  const editModal = useDisclosure();

  // نقاط النهاية للـ API
  const API_BASE = '/api/branches';


  const userPermissions = ['branch.view', 'branch.create', 'branch.update', 'branch.delete'];
  const hasPermission = (perm: string) => userPermissions.includes(perm);


  async function fetchBranchesFromApi() {
    setLoading(true);
    try {
      const res = await fetch(API_BASE, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : seededBranches);
    } catch (err) {

      setBranches(seededBranches);
    } finally {
      setLoading(false);
    }
  }

  async function createBranchApi(payload: BranchForm) {
    try {
      const res = await fetch(API_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Create failed');
      const created: Branch = await res.json();
      return created;
    } catch (err) {


      const fallback: Branch = {
        id: Date.now(),
        tenant_id: payload.tenant_id ?? 1,
        name: payload.name,
        name_ar: payload.name_ar ?? '',
        address: payload.address ?? '',
        address_ar: payload.address_ar ?? '',
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        created_at: new Date().toISOString(),
      };
      return fallback;
    }
  }

  async function updateBranchApi(id: number, payload: BranchForm) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Update failed');
      const updated: Branch = await res.json();
      return updated;
    } catch (err) {


      const fallback: Branch = {
        id,
        tenant_id: payload.tenant_id ?? 1,
        name: payload.name,
        name_ar: payload.name_ar ?? '',
        address: payload.address ?? '',
        address_ar: payload.address_ar ?? '',
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        created_at: new Date().toISOString(),
      };
      return fallback;
    }
  }

  async function deleteBranchApi(id: number) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Delete failed');
      return true;
    } catch (err) {


      return true;
    }
  }

  useEffect(() => {
    if (hasPermission('branch.view')) fetchBranchesFromApi();
  }, []);

  useEffect(() => {
    // reset to seeded data on language change so labels show correctly in previews
    setBranches(seededBranches);
  }, [language]);

  const filteredBranches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return branches.filter((b) => {
      const matchesSearch = !term ||
        String(b.id).includes(term) ||
        b.name.toLowerCase().includes(term) ||
        (b.address ?? '').toLowerCase().includes(term);
      const matchesType = typeFilter === 'all' || typeFilter === '';
      return matchesSearch && matchesType;
    });
  }, [branches, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / pageSize));
  useEffect(() => setPage(1), [search, typeFilter]);
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages]);

  const paginatedBranches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBranches.slice(start, start + pageSize);
  }, [filteredBranches, page]);

  const resetForm = () => {
    setFormData({ name: '', name_ar: '', address: '', address_ar: '', latitude: undefined, longitude: undefined, tenant_id: undefined });
  };

  const openCreateBranch = () => {
    setIsEditing(false);
    resetForm();
    editModal.onOpen();
  };

  const openEditBranch = (branch: Branch) => {
    setIsEditing(true);
    setFormData({ id: branch.id, tenant_id: branch.tenant_id, name: branch.name, name_ar: branch.name_ar ?? '', address: branch.address ?? '', address_ar: branch.address_ar ?? '', latitude: branch.latitude ?? undefined, longitude: branch.longitude ?? undefined });
    editModal.onOpen();
  };

  const handleDeleteBranch = async (id: number) => {
    if (!hasPermission('branch.delete')) return;
    if (window.confirm(t('branches.delete.confirmation'))) {
      const ok = await deleteBranchApi(id);
      if (ok) setBranches((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const saveBranch = async () => {
    if (!formData.name || !formData.name.trim()) return;
    const payload: BranchForm = {
      tenant_id: formData.tenant_id ?? 1,
      name: formData.name,
      name_ar: formData.name_ar ?? '',
      address: formData.address ?? '',
      address_ar: formData.address_ar ?? '',
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
    };

    if (isEditing && formData.id) {
      const updated = await updateBranchApi(formData.id, payload);
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } else {
      const created = await createBranchApi(payload);
      setBranches((prev) => [...prev, created]);
    }
    editModal.onClose();
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">
        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">{t('branches.hero.tag')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">{t('branches.hero.title')}</h1>
          </div>
          {hasPermission('branch.create') && (
            <Button variant="solid" color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={openCreateBranch}>
              {t('branches.hero.button_new')}
            </Button>
          )}
        </section>

        <Table aria-label={t('branches.table.aria')} classNames={{ table: 'min-w-full text-base' }} topContent={
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Input radius="lg" label={t('branches.search.placeholder')} variant="faded" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[240px]" />
              <Select radius="lg" variant="faded" label={t('branches.filter.type')} selectedKeys={[typeFilter]} onChange={(e) => setTypeFilter(e.target.value)} className="min-w-[240px]">
                <SelectItem key="all">{t('branches.filter.type_all')}</SelectItem>
              </Select>
            </div>
            <span className="text-sm text-foreground/70">{t('branches.table.results', { count: filteredBranches.length.toString() })}</span>
          </div>
        } bottomContent={
          <div className="flex flex-col gap-3 px-2 py-2 text-sm md:flex-row md:items-center md:justify-between">
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.max(prev - 1, 1))} isDisabled={page === 1}>{t('branches.pagination.prev')}</Button>
              <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))} isDisabled={page === totalPages || filteredBranches.length === 0}>{t('branches.pagination.next')}</Button>
            </div>
            <span className="text-xs text-foreground/60">{t('branches.pagination.page', { page: page.toString(), total: totalPages.toString() })}</span>
            <Pagination page={page} total={totalPages} onChange={setPage} showControls color="primary" size="sm" isDisabled={filteredBranches.length === 0} />
          </div>
        }>

          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>{t('branches.table.column.name_en')}</TableColumn>
            <TableColumn>{t('branches.table.column.name_ar')}</TableColumn>
            <TableColumn>{t('branches.table.column.address')}</TableColumn>
            <TableColumn>{t('branches.table.column.latitude')}</TableColumn>
            <TableColumn>{t('branches.table.column.longitude')}</TableColumn>
            <TableColumn>{t('branches.table.column.created_at')}</TableColumn>
            <TableColumn className="text-center">{t('branches.table.column.actions')}</TableColumn>
          </TableHeader>

          <TableBody emptyContent={t('branches.table.empty')}>
            {paginatedBranches.map((branch) => (
              <TableRow key={branch.id} className="hover:bg-content2/60">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" radius="lg" name={branch.name} className="bg-primary/10 text-primary" />
                    <div>
                      <p className="font-semibold text-text">{language === 'ar' ? (branch.name_ar || branch.name) : branch.name}</p>
                      {branch.created_at && <p className="text-xs text-foreground/60">{new Date(branch.created_at).toLocaleDateString()}</p>}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">
                    <p>{branch.name}</p>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">
                    <p>{branch.name_ar}</p>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">
                    <p>{branch.address}</p>
                  </div>
                </TableCell>

                <TableCell>
                  <Chip size="sm" variant="flat">{branch.latitude ?? '-'}</Chip>
                </TableCell>

                <TableCell>
                  <Chip size="sm" variant="flat">{branch.longitude ?? '-'}</Chip>
                </TableCell>

                <TableCell>
                  <div className={`text-sm text-foreground/70`}>{branch.created_at ? new Date(branch.created_at).toLocaleDateString() : '-'}</div>
                </TableCell>

                <TableCell>
                  <div className={`flex items-center justify-${isRTL ? 'start' : 'end'} gap-2`}>
                    {hasPermission('branch.view') && (
                      <Button isIconOnly variant="light" radius="full" onPress={() => { setActiveBranch(branch); viewModal.onOpen(); }}>
                        <EyeIcon className="h-5 w-5" />
                      </Button>
                    )}
                    {hasPermission('branch.update') && (
                      <Button isIconOnly variant="light" radius="full" onPress={() => openEditBranch(branch)}>
                        <PencilSquareIcon className="h-5 w-5" />
                      </Button>
                    )}
                    {hasPermission('branch.delete') && (
                      <Button isIconOnly variant="light" radius="full" color="danger" onPress={() => handleDeleteBranch(branch.id)}>
                        <TrashIcon className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

        </Table>
      </div>

      <Modal isOpen={viewModal.isOpen} onOpenChange={viewModal.onOpenChange} size="lg" backdrop="blur">
        <ModalContent className="bg-content1/95">
          {() => (
            activeBranch && (
              <>
                <ModalHeader className="flex items-center gap-3">
                  <Avatar size="md" radius="lg" name={activeBranch.name} />
                  <div>
                    <p className="text-lg font-semibold">{activeBranch.name}</p>
                    <p className="text-sm text-foreground/70">{activeBranch.address}</p>
                  </div>
                </ModalHeader>
                <ModalBody className="space-y-4">
                  <Divider />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground/60">{t('branches.details.header')}</p>
                    <p className="text-sm">ID: {activeBranch.id}</p>
                    <p className="text-sm">{t('branches.form.name')}: {activeBranch.name}</p>
                    <p className="text-sm">{t('branches.form.name_ar')}: {activeBranch.name_ar}</p>
                    <p className="text-sm">{t('branches.form.address')}: {activeBranch.address}</p>
                    <p className="text-sm">{t('branches.form.address_ar')}: {activeBranch.address_ar}</p>
                    <p className="text-sm">{t('branches.form.latitude')}: {activeBranch.latitude ?? '-'}</p>
                    <p className="text-sm">{t('branches.form.longitude')}: {activeBranch.longitude ?? '-'}</p>
                    <p className="text-sm">{t('branches.form.created_at')}: {activeBranch.created_at ? new Date(activeBranch.created_at).toLocaleString() : '-'}</p>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button radius="lg" variant="light" onPress={viewModal.onClose}>{t('branches.modal.close')}</Button>
                </ModalFooter>
              </>
            )
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="xl" scrollBehavior="inside" backdrop="blur">
        <ModalContent className="bg-content1/95">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">{isEditing ? t('branches.form.edit_title') : t('branches.form.create_title')}</ModalHeader>
              <ModalBody className="space-y-4">
                <Input label={t('branches.form.name')} variant="faded" radius="lg" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} />
                <Input label={t('branches.form.name_ar')} variant="faded" radius="lg" value={formData.name_ar || ''} onChange={(e) => setFormData((prev) => ({ ...prev, name_ar: e.target.value }))} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label={t('branches.form.address')} variant="faded" radius="lg" value={formData.address || ''} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} />
                  <Input label={t('branches.form.address_ar')} variant="faded" radius="lg" value={formData.address_ar || ''} onChange={(e) => setFormData((prev) => ({ ...prev, address_ar: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label={t('branches.form.latitude')} variant="faded" radius="lg" type="number" value={String(formData.latitude ?? '')} onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value ? Number(e.target.value) : undefined }))} />
                  <Input label={t('branches.form.longitude')} variant="faded" radius="lg" type="number" value={String(formData.longitude ?? '')} onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>

                <Textarea label={t('branches.form.notes_optional')} variant="faded" radius="lg" minRows={2} value={''} onChange={() => {}} />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" radius="lg" onPress={() => { onClose(); resetForm(); }}>{t('branches.form.cancel')}</Button>
                <Button color="primary" radius="lg" onPress={saveBranch}>{t('branches.form.save')}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
