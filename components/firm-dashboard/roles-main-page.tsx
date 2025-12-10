'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
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
  Pagination,
  toast
} from '@heroui/react';
import { EyeIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';

type Role = {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  permissions: number[];
  status: 'active' | 'deleted';
};

type RoleForm = {
  id?: number;
  displayName: string;
  description: string;
  permissions: number[];
  status: 'active' | 'deleted';
};

type ApiPermission = {
  permission_id?: number;
  id?: number;
  name?: string;
  name_ar?: string;
  code?: string;
  description?: string;
  description_ar?: string;
};

const API_BASE_URL = '/api/v1/admin';
const TENANT_ID = 1;

export default function RolesPage() {
  const { language } = useLanguage();
  const t = (key: string) => lang(language, key);

  const [permissionsMap, setPermissionsMap] = useState<Record<number, ApiPermission>>({});
  const [permissionsList, setPermissionsList] = useState<ApiPermission[]>([]);
  const [permissionsSearch, setPermissionsSearch] = useState('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'deleted'>('all');

  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleForm>({
    displayName: '',
    description: '',
    permissions: [],
    status: 'active',
  });
  const [isEditing, setIsEditing] = useState(false);

  const viewModal = useDisclosure();
  const editModal = useDisclosure();

  const getPermissionLabel = (permId: number) => {
    const p = permissionsMap[permId];
    if (!p) return String(permId);
    return language === 'ar' ? p.name_ar ?? p.name ?? String(permId) : p.name ?? p.name_ar ?? String(permId);
  };

  const fetchPermissions = async () => {
    try {
      const params = new URLSearchParams({ tenant_id: String(TENANT_ID) });
      const res = await fetch(`${API_BASE_URL}/permissions/list?${params.toString()}`, {
        headers: { 'accept-language': language, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed fetching permissions: ${res.status}`);
      const json = await res.json();
      const data: ApiPermission[] = Array.isArray(json.data) ? json.data : [];

      const normalized = data.map((p) => {
        const id = Number(p.permission_id ?? p.id);
        return { ...p, id, permission_id: id } as ApiPermission;
      });

      const map: Record<number, ApiPermission> = {};
      normalized.forEach((p) => (map[p.id!] = p));
      setPermissionsMap(map);
      setPermissionsList(normalized);
    } catch (err: any) {
      console.error('fetchPermissions error', err);
      toast.error(`Error fetching permissions: ${err.message}`);
      setPermissionsList([]);
    }
  };

  const fetchRoles = async (opts?: { page?: number; pageSize?: number; search?: string }) => {
    try {
      const p = opts?.page ?? page;
      const ps = opts?.pageSize ?? pageSize;
      const params = new URLSearchParams({
        tenant_id: String(TENANT_ID),
        page: String(p),
        pageSize: String(ps),
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      if (opts?.search ?? search) params.set('search', opts?.search ?? search);

      const res = await fetch(`${API_BASE_URL}/roles?${params.toString()}`, {
        headers: { 'accept-language': language, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed fetching roles: ${res.status}`);
      const json = await res.json();
      const data = json.data || [];

      const mapped: Role[] = data.map((r: any) => {
        const id: number = Number(r.id);
        const displayName = language === 'ar' ? (r.name_ar ?? r.name ?? r.slug ?? String(id)) : (r.name ?? r.name_ar ?? r.slug ?? String(id));
        const permIds: number[] = (r.permissions ?? []).map((p: any) => Number(p.permission_id ?? p.id)).filter(Boolean);
        const status = r.status ?? 'active';
        return {
          id,
          name: r.slug ?? r.name ?? String(id),
          displayName,
          description: r.description ?? null,
          permissions: permIds,
          status,
        } as Role;
      });

      setRoles(mapped);
      setTotalPages(json.totalPages ?? Math.max(1, Math.ceil((json.count ?? data.length) / ps)));
      setPage(json.page ?? p);
    } catch (err: any) {
      console.error('fetchRoles error', err);
      toast.error(`Error fetching roles: ${err.message}`);
    }
  };

  useEffect(() => { fetchPermissions(); }, [language]);
  useEffect(() => { fetchRoles({ page: 1, pageSize, search }); }, [language]);
  useEffect(() => { fetchRoles({ page, pageSize, search }); }, [page, search]);

  const toggleSelectRole = (roleId: number) => {
    setSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const filteredRoles = useMemo(() => {
    return roles.filter(role => {
      const matchesSearch = !search.trim() || role.displayName.toLowerCase().includes(search.toLowerCase()) || role.permissions.some(pid => getPermissionLabel(pid).toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || (role.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [roles, search, statusFilter, permissionsMap]);

  const openCreateRole = () => {
    setFormData({ displayName: '', description: '', permissions: [], status: 'active' });
    setIsEditing(false);
    editModal.onOpen();
  };

  const openEditRole = (role: Role) => {
    setFormData({
      id: role.id,
      displayName: role.displayName,
      description: role.description ?? '',
      permissions: role.permissions,
      status: role.status,
    });
    setIsEditing(true);
    editModal.onOpen();
  };

  const handleSaveRole = async () => {
    if (!formData.displayName.trim()) {
      toast.error(lang(language, 'roles.form.role_name_required') ?? 'Role name is required');
      return;
    }

    const payload = {
      tenant_id: TENANT_ID,
      name: formData.displayName,
      name_ar: formData.displayName,
      slug: formData.displayName.trim().toLowerCase().replace(/\s+/g, '_'),
      description: formData.description || '',
      permissions: formData.permissions,
      status: formData.status
    };

    try {
      if (isEditing && formData.id) {
        const res = await fetch(`${API_BASE_URL}/roles/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'accept-language': language },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success(lang(language, 'roles.notifications.update_success') ?? 'Role updated successfully');
      } else {
        const res = await fetch(`${API_BASE_URL}/roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'accept-language': language },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success(lang(language, 'roles.notifications.create_success') ?? 'Role created successfully');
      }
      editModal.onClose();
      fetchRoles({ page: 1, pageSize, search });
    } catch (err: any) {
      console.error('saveRole error', err);
      toast.error(lang(language, 'roles.notifications.save_failed') ?? `Operation failed: ${err.message}`);
    }
  };

  const statusChip = (role: Role) => (
    <Chip color={role.status === 'active' ? 'success' : 'danger'} variant="flat" size="sm">
      {role.status === 'active' ? lang(language, 'roles.status.active') : lang(language, 'roles.status.inactive')}
    </Chip>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">

        {/* Header */}
        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] ">{lang(language, 'roles.hero.tag')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">{lang(language, 'roles.hero.title')}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="solid" color="primary" onPress={openCreateRole} startContent={<PlusIcon className="h-4 w-4" />}>
              {lang(language, 'roles.hero.button_new')}
            </Button>
            <Button color="danger" onPress={() => { /* bulk delete */ }} isDisabled={!selectedRoles.length}>
              {lang(language, 'roles.bulk_delete')}
            </Button>
          </div>
        </section>

        {/* Roles Table */}
        <Table
          topContent={
            <div className="flex justify-between gap-3 items-center">
              <Input radius="lg" label={lang(language, 'roles.search.placeholder')} value={search} onChange={e => setSearch(e.target.value)} variant="faded" className="min-w-[250px]" />
              <Select radius="lg" selectedKeys={[statusFilter]} onChange={e => setStatusFilter(e.target.value as 'all'|'active'|'deleted')} variant="faded" label={lang(language, 'roles.filter.status_label')} className="min-w-xs">
                <SelectItem key="all">{lang(language, 'roles.filter.all_status')}</SelectItem>
                <SelectItem key="active">{lang(language, 'roles.status.active')}</SelectItem>
                <SelectItem key="deleted">{lang(language, 'roles.status.inactive')}</SelectItem>
              </Select>
            </div>
          }
        >
          <TableHeader>
            <TableColumn>Select</TableColumn>
            <TableColumn>{lang(language, 'roles.table.column.role')}</TableColumn>
            <TableColumn>{lang(language, 'roles.table.column.description')}</TableColumn>
            <TableColumn>{lang(language, 'roles.table.column.permissions')}</TableColumn>
            <TableColumn>{lang(language, 'roles.table.column.status')}</TableColumn>
            <TableColumn className="text-end">{lang(language, 'roles.table.column.actions')}</TableColumn>
          </TableHeader>
          <TableBody emptyContent={lang(language, 'roles.table.empty')}>
            {filteredRoles.map(role => (
              <TableRow key={role.id} className="hover:bg-content2/60">
                <TableCell><input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={() => toggleSelectRole(role.id)} /></TableCell>
                <TableCell>{role.displayName}</TableCell>
                <TableCell>{role.description}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">{role.permissions.map(pid => <Chip key={pid} color="secondary" size="sm" variant="flat">{getPermissionLabel(pid)}</Chip>)}</div>
                </TableCell>
                <TableCell>{statusChip(role)}</TableCell>
                <TableCell className="text-end">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="flat" onPress={() => openEditRole(role)} startContent={<PencilSquareIcon className="h-4 w-4" />} />
                    <Button size="sm" variant="flat" color="danger" onPress={() => {}} startContent={<TrashIcon className="h-4 w-4" />} />
                    <Button size="sm" variant="flat" onPress={() => { setActiveRole(role); viewModal.onOpen(); }} startContent={<EyeIcon className="h-4 w-4" />} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Create/Edit Modal */}
        <Modal isOpen={editModal.isOpen} onClose={editModal.onClose}>
          <ModalContent>
            <ModalHeader>{isEditing ? lang(language, 'roles.modal.edit_title') : lang(language, 'roles.modal.create_title')}</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <Input label={lang(language, 'roles.form.label_name')} value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
                <Textarea label={lang(language, 'roles.form.label_description')} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                <Select label={lang(language, 'roles.form.label_status')} selectedKeys={[formData.status]} onChange={e => setFormData({...formData, status: e.target.value as 'active'|'deleted'})}>
                  <SelectItem key="active">{lang(language, 'roles.status.active')}</SelectItem>
                  <SelectItem key="deleted">{lang(language, 'roles.status.inactive')}</SelectItem>
                </Select>

                {/* Permissions with search */}
                <div>
                  <Input placeholder={lang(language, 'roles.form.search_permissions')} value={permissionsSearch} onChange={e => setPermissionsSearch(e.target.value)} />
                  <div className="max-h-64 overflow-y-auto flex flex-wrap gap-2 mt-2">
                    {permissionsList.filter(p => {
                      const label = getPermissionLabel(p.id!);
                      return label.toLowerCase().includes(permissionsSearch.toLowerCase());
                    }).map(p => (
                      <Chip
                        key={p.id}
                        color={formData.permissions.includes(p.id!) ? 'primary' : 'secondary'}
                        variant="flat"
                        size="sm"
                        onPress={() => {
                          setFormData(prev => ({
                            ...prev,
                            permissions: prev.permissions.includes(p.id!) ? prev.permissions.filter(x => x !== p.id!) : [...prev.permissions, p.id!]
                          }));
                        }}
                      >
                        {getPermissionLabel(p.id!)}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button onPress={handleSaveRole} color="primary">{lang(language, 'roles.modal.save')}</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

      </div>
    </div>
  );
}
