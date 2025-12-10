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
  toast,
} from '@heroui/react';
import { EyeIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';

type Customer = {
  id: number;
  tenant_id: number;
  full_name: string;
  full_name_ar?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  address_ar?: string | null;
  credit_limit?: number;
  created_at?: string | null;
};

type CustomerForm = Omit<Customer, 'id' | 'tenant_id' | 'created_at'> & { id?: number; tenant_id?: number };

const pageSize = 6;

export default function CustomersPage() {
  const { language } = useLanguage();
  const t = (key: string, vars?: Record<string, string>) => {
    const value = lang(language, key);
    if (!vars) return value;
    return Object.keys(vars).reduce((acc, token) => acc.replace(`{{${token}}}`, vars[token]), value);
  };
  const isRTL = language === 'ar';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CustomerForm>({
    full_name: '',
    full_name_ar: '',
    phone: '',
    email: '',
    address: '',
    address_ar: '',
    credit_limit: 0,
    tenant_id: 1,
  });

  const viewModal = useDisclosure();
  const editModal = useDisclosure();

  const API_BASE = '/api/v1/admin/customers';

  // ======== API FUNCTIONS ========

  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}?tenant_id=1&page=1&pageSize=100`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'accept-language': language },
      });
      if (!res.ok) throw new Error('Failed to fetch customers');
      const data = await res.json();
      setCustomers(data.data || []);
    } catch (err: any) {
      toast.error(err.message || t('customers.toast.fetch_error'));
    } finally {
      setLoading(false);
    }
  }

  async function createCustomer(payload: CustomerForm) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept-language': language },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create customer');
      }
      const created: Customer = await res.json();
      setCustomers((prev) => [...prev, created]);
      toast.success(t('customers.toast.created'));
      return created;
    } catch (err: any) {
      toast.error(err.message || t('customers.toast.create_error'));
    }
  }

  async function updateCustomer(id: number, payload: CustomerForm) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'accept-language': language },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update customer');
      }
      const updated: Customer = await res.json();
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(t('customers.toast.updated'));
      return updated;
    } catch (err: any) {
      toast.error(err.message || t('customers.toast.update_error'));
    }
  }

  async function deleteCustomer(id: number) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'accept-language': language },
        body: JSON.stringify({ tenant_id: 1 }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete customer');
      }
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      toast.success(t('customers.toast.deleted'));
    } catch (err: any) {
      toast.error(err.message || t('customers.toast.delete_error'));
    }
  }

  // ======== USE EFFECT ========
  useEffect(() => {
    fetchCustomers();
  }, [language]);

  // ======== FILTER & PAGINATION ========
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        !term ||
        c.full_name.toLowerCase().includes(term) ||
        (c.email ?? '').toLowerCase().includes(term) ||
        (c.phone ?? '').toLowerCase().includes(term);
      const matchesType = typeFilter === 'all' || typeFilter === '';
      return matchesSearch && matchesType;
    });
  }, [customers, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  useEffect(() => setPage(1), [search, typeFilter]);
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page]);

  // ======== FORM HANDLERS ========
  const resetForm = () => {
    setFormData({
      full_name: '',
      full_name_ar: '',
      phone: '',
      email: '',
      address: '',
      address_ar: '',
      credit_limit: 0,
      tenant_id: 1,
    });
  };

  const openCreateCustomer = () => {
    setIsEditing(false);
    resetForm();
    editModal.onOpen();
  };

  const openEditCustomer = (customer: Customer) => {
    setIsEditing(true);
    setFormData({
      id: customer.id,
      tenant_id: customer.tenant_id,
      full_name: customer.full_name,
      full_name_ar: customer.full_name_ar ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      address_ar: customer.address_ar ?? '',
      credit_limit: customer.credit_limit ?? 0,
    });
    editModal.onOpen();
  };

  const handleDeleteCustomer = async (id: number) => {
    if (window.confirm(t('customers.delete.confirmation'))) {
      await deleteCustomer(id);
    }
  };

  const saveCustomer = async () => {
    if (!formData.full_name?.trim()) return;
    const payload: CustomerForm = {
      tenant_id: formData.tenant_id,
      full_name: formData.full_name,
      full_name_ar: formData.full_name_ar ?? '',
      phone: formData.phone ?? '',
      email: formData.email ?? '',
      address: formData.address ?? '',
      address_ar: formData.address_ar ?? '',
      credit_limit: formData.credit_limit ?? 0,
    };

    if (isEditing && formData.id) {
      await updateCustomer(formData.id, payload);
    } else {
      await createCustomer(payload);
    }

    editModal.onClose();
    resetForm();
  };

  // ======== RENDER ========
  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">
        <section className="flex flex-col gap-4 pt-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">{t('customers.hero.tag')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">{t('customers.hero.title')}</h1>
          </div>
          <Button
            variant="solid"
            color="primary"
            startContent={<PlusIcon className="h-4 w-4" />}
            onPress={openCreateCustomer}
          >
            {t('customers.hero.button_new')}
          </Button>
        </section>

        <Table
          aria-label={t('customers.table.aria')}
          classNames={{ table: 'min-w-full text-base' }}
          topContent={
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Input
                  radius="lg"
                  label={t('customers.search.placeholder')}
                  variant="faded"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-[240px]"
                />
                <Select
                  radius="lg"
                  variant="faded"
                  label={t('customers.filter.type')}
                  selectedKeys={[typeFilter]}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="min-w-[240px]"
                >
                  <SelectItem key="all">{t('customers.filter.type_all')}</SelectItem>
                </Select>
              </div>
              <span className="text-sm text-foreground/70">
                {t('customers.table.results', { count: filteredCustomers.length.toString() })}
              </span>
            </div>
          }
          bottomContent={
            <div className="flex flex-col gap-3 px-2 py-2 text-sm md:flex-row md:items-center md:justify-between">
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.max(prev - 1, 1))} isDisabled={page === 1}>
                  {t('customers.pagination.prev')}
                </Button>
                <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))} isDisabled={page === totalPages || filteredCustomers.length === 0}>
                  {t('customers.pagination.next')}
                </Button>
              </div>
              <span className="text-xs text-foreground/60">
                {t('customers.pagination.page', { page: page.toString(), total: totalPages.toString() })}
              </span>
              <Pagination page={page} total={totalPages} onChange={setPage} showControls color="primary" size="sm" isDisabled={filteredCustomers.length === 0} />
            </div>
          }
        >
          <TableHeader>
            <TableColumn>{t('customers.table.column.name')}</TableColumn>
            <TableColumn>{t('customers.table.column.contact')}</TableColumn>
            <TableColumn>{t('customers.table.column.credit_limit')}</TableColumn>
            <TableColumn className="text-center">{t('customers.table.column.actions')}</TableColumn>
          </TableHeader>
          <TableBody emptyContent={t('customers.table.empty')}>
            {paginatedCustomers.map((customer) => (
              <TableRow key={customer.id} className="hover:bg-content2/60">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" radius="lg" name={customer.full_name} className="bg-primary/10 text-primary" />
                    <div>
                      <p className="font-semibold text-text">{language === 'ar' ? (customer.full_name_ar || customer.full_name) : customer.full_name}</p>
                      {customer.created_at && <p className="text-xs text-foreground/60">{new Date(customer.created_at).toLocaleDateString()}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-foreground/70">
                    <p>{customer.email}</p>
                    <p>{customer.phone}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">{(customer.credit_limit ?? 0).toFixed(2)}</Chip>
                </TableCell>
                <TableCell>
                  <div className={`flex items-center justify-${isRTL ? 'start' : 'end'} gap-2`}>
                    <Button isIconOnly variant="light" radius="full" onPress={() => { setActiveCustomer(customer); viewModal.onOpen(); }}>
                      <EyeIcon className="h-5 w-5" />
                    </Button>
                    <Button isIconOnly variant="light" radius="full" onPress={() => openEditCustomer(customer)}>
                      <PencilSquareIcon className="h-5 w-5" />
                    </Button>
                    <Button isIconOnly variant="light" radius="full" color="danger" onPress={() => handleDeleteCustomer(customer.id)}>
                      <TrashIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View Modal */}
      <Modal isOpen={viewModal.isOpen} onOpenChange={viewModal.onOpenChange} size="lg" backdrop="blur">
        <ModalContent className="bg-content1/95">
          {() => (
            activeCustomer && (
              <>
                <ModalHeader className="flex items-center gap-3">
                  <Avatar size="md" radius="lg" name={activeCustomer.full_name} />
                  <div>
                    <p className="text-lg font-semibold">{activeCustomer.full_name}</p>
                    <p className="text-sm text-foreground/70">{activeCustomer.email}</p>
                  </div>
                </ModalHeader>
                <ModalBody className="space-y-4">
                  <Divider />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground/60">{t('customers.modal.contact')}</p>
                    <p className="text-sm">{activeCustomer.email}</p>
                    <p className="text-sm">{activeCustomer.phone}</p>
                  </div>
                  {activeCustomer.address && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-foreground/60">{t('customers.modal.address')}</p>
                      <p className="text-sm leading-relaxed">{activeCustomer.address}</p>
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button radius="lg" variant="light" onPress={viewModal.onClose}>
                    {t('customers.modal.close')}
                  </Button>
                </ModalFooter>
              </>
            )
          )}
        </ModalContent>
      </Modal>

      {/* Edit/Create Modal */}
      <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="xl" scrollBehavior="inside" backdrop="blur">
        <ModalContent className="bg-content1/95">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">{isEditing ? t('customers.form.edit_title') : t('customers.form.create_title')}</ModalHeader>
              <ModalBody className="space-y-4">
                <Input
                  label={t('customers.form.full_name')}
                  variant="faded"
                  radius="lg"
                  value={formData.full_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                />
                <Input
                  label={t('customers.form.full_name_ar')}
                  variant="faded"
                  radius="lg"
                  value={formData.full_name_ar ?? ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, full_name_ar: e.target.value }))}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={t('customers.form.email')}
                    variant="faded"
                    radius="lg"
                    value={formData.email ?? ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  <Input
                    label={t('customers.form.phone')}
                    variant="faded"
                    radius="lg"
                    value={formData.phone ?? ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={t('customers.form.address')}
                    variant="faded"
                    radius="lg"
                    value={formData.address ?? ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  />
                  <Input
                    label={t('customers.form.address_ar')}
                    variant="faded"
                    radius="lg"
                    value={formData.address_ar ?? ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address_ar: e.target.value }))}
                  />
                </div>
                <Input
                  label={t('customers.form.credit_limit')}
                  variant="faded"
                  radius="lg"
                  type="number"
                  value={String(formData.credit_limit ?? 0)}
                  onChange={(e) => setFormData((prev) => ({ ...prev, credit_limit: Number(e.target.value) }))}
                />
                <Textarea
                  label={t('customers.form.notes')}
                  variant="faded"
                  radius="lg"
                  minRows={3}
                  value={''}
                  onChange={() => {}}
                />
              </ModalBody>
                            <ModalFooter>
                <Button variant="light" radius="lg" onPress={() => { onClose(); resetForm(); }}>
                  {t('customers.form.cancel')}
                </Button>
                <Button color="primary" radius="lg" onPress={saveCustomer}>
                  {t('customers.form.save')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

                
