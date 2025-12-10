'use client';
import { useEffect, useState } from 'react';
import {
  Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn,
  TableHeader, TableRow, useDisclosure, addToast, Alert, Form, Tooltip,
  Tabs, Tab, Card, CardBody, Textarea, Autocomplete, AutocompleteItem
} from '@heroui/react';
import {
  PencilSquareIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon,
  WrenchScrewdriverIcon, TruckIcon, DocumentTextIcon, CubeIcon,
  ArrowPathIcon, DocumentArrowDownIcon, PhotoIcon, ClockIcon,
  MapPinIcon, UserIcon, BuildingOfficeIcon
} from '@heroicons/react/24/solid';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';
import { TableSkeleton } from "@/lib/Skeletons";
import moment from 'moment';

const pageSize = 6;

export default function AssetManagementPage() {
  const { language } = useLanguage();
  const t = (key: string) => lang(language, key);

  const [activeTab, setActiveTab] = useState('assets');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string[] | string>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const editModal = useDisclosure();
  const detailsModal = useDisclosure();
  const maintenanceModal = useDisclosure();
  const transferModal = useDisclosure();

  /** ------------------ بيانات افتراضية ------------------ **/
  const MOCK_LOCATIONS = [
    { id: 1, name: 'Main Warehouse', name_ar: 'المخزن الرئيسي' },
    { id: 2, name: 'Branch A', name_ar: 'الفرع أ' },
    { id: 3, name: 'Customer Site', name_ar: 'موقع العميل' }
  ];

  const MOCK_EMPLOYEES = [
    { id: 1, name: 'Ahmed', name_ar: 'أحمد' },
    { id: 2, name: 'Fatima', name_ar: 'فاطمة' },
    { id: 3, name: 'Mohammed', name_ar: 'محمد' }
  ];

  const MOCK_CUSTOMERS = [
    { id: 1, name: 'Ali Store', name_ar: 'متجر علي' },
    { id: 2, name: 'Sara Shop', name_ar: 'متجر سارة' },
    { id: 3, name: 'Omar Market', name_ar: 'سوق عمر' }
  ];

  const MOCK_ASSETS = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    asset_id: `AST-${1000 + i}`,
    type: ['Cooler', 'POS', 'Truck', 'Freezer'][i % 4],
    model: `Model-${i + 1}`,
    status: ['active', 'in_maintenance', 'out_of_service'][i % 3],
    location_id: (i % 3) + 1,
    location_name: MOCK_LOCATIONS[i % 3].name,
    location_name_ar: MOCK_LOCATIONS[i % 3].name_ar,
    last_maintenance: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    employee_id: (i % 3) + 1,
    employee_name: MOCK_EMPLOYEES[i % 3].name,
    employee_name_ar: MOCK_EMPLOYEES[i % 3].name_ar,
    customer_id: (i % 3) + 1,
    customer_name: MOCK_CUSTOMERS[i % 3].name,
    customer_name_ar: MOCK_CUSTOMERS[i % 3].name_ar,
    value: (Math.random() * 5000 + 1000).toFixed(2),
    manufacturer: ['Samsung', 'LG', 'Bosch', 'Siemens'][i % 4],
    warranty_expiry: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000),
    operational_date: new Date(Date.now() - Math.random() * 730 * 24 * 60 * 60 * 1000)
  }));

  const MOCK_MAINTENANCE = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    asset_id: (i % 25) + 1,
    asset_no: `AST-${1000 + (i % 25)}`,
    type: ['preventive', 'corrective', 'emergency'][i % 3],
    description: `Maintenance ${i + 1}`,
    technician: MOCK_EMPLOYEES[i % 3].name,
    technician_ar: MOCK_EMPLOYEES[i % 3].name_ar,
    cost: (Math.random() * 500).toFixed(2),
    date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
    status: ['scheduled', 'in_progress', 'completed'][i % 3]
  }));

  const MOCK_MOVEMENTS = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    asset_id: (i % 25) + 1,
    asset_no: `AST-${1000 + (i % 25)}`,
    from_location: MOCK_LOCATIONS[i % 3].name,
    from_location_ar: MOCK_LOCATIONS[i % 3].name_ar,
    to_location: MOCK_LOCATIONS[(i + 1) % 3].name,
    to_location_ar: MOCK_LOCATIONS[(i + 1) % 3].name_ar,
    moved_by: MOCK_EMPLOYEES[i % 3].name,
    moved_by_ar: MOCK_EMPLOYEES[i % 3].name_ar,
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    notes: `Movement ${i + 1}`
  }));

  /** ------------------ KPIs ------------------ **/
  const calculateKPIs = () => {
    const total = MOCK_ASSETS.length;
    const active = MOCK_ASSETS.filter(a => a.status === 'active').length;
    const maintenance = MOCK_ASSETS.filter(a => a.status === 'in_maintenance').length;
    const outOfService = MOCK_ASSETS.filter(a => a.status === 'out_of_service').length;
    const totalValue = MOCK_ASSETS.reduce((sum, a) => sum + parseFloat(a.value), 0).toFixed(2);

    return { total, active, maintenance, outOfService, totalValue };
  };

  const kpis = calculateKPIs();

  /** ------------------ محاكاة استدعاء API ------------------ **/
  const fetchData = async () => {
    setLoading(true);
    try {
      let tabData: any[] = [];

      if (activeTab === 'assets') tabData = [...MOCK_ASSETS];
      else if (activeTab === 'maintenance') tabData = [...MOCK_MAINTENANCE];
      else if (activeTab === 'movements') tabData = [...MOCK_MOVEMENTS];

      if (search) {
        tabData = tabData.filter((row: any) =>
          Object.values(row).some((value: any) =>
            String(value).toLowerCase().includes(search.toLowerCase())
          )
        );
      }

      if (statusFilter !== 'all') {
        tabData = tabData.filter((row) => row.status === statusFilter);
      }

      if (typeFilter !== 'all' && activeTab === 'assets') {
        tabData = tabData.filter((row) => row.type === typeFilter);
      }

      const start = (page - 1) * pageSize;
      const paginated = tabData.slice(start, start + pageSize);

      setData(paginated);
      setTotalPages(Math.ceil(tabData.length / pageSize));
      setTotalCount(tabData.length);
    } finally {
      setLoading(false);
    }
  };

  /** ------------------ حذف عنصر ------------------ **/
  const handleDelete = async (id: number) => {
    setData((prev) => prev.filter((item) => item.id !== id));
    addToast({
      title: language === 'ar' ? 'تم الحذف' : 'Deleted',
      description: language === 'ar' ? 'تم بنجاح' : 'Item deleted',
      color: 'success'
    });
  };

  /** ------------------ حفظ عنصر ------------------ **/
  const saveData = async () => {
    setLoadingForm(true);
    try {
      if (isEditing) {
        setData((prev) =>
          prev.map((item) => item.id === formData.id ? formData : item)
        );
      } else {
        setData((prev) => [
          { ...formData, id: Date.now() },
          ...prev
        ]);
      }

      addToast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم بنجاح' : 'Item saved',
        color: 'success'
      });

      editModal.onClose();
      setFormData({});
    } finally {
      setLoadingForm(false);
    }
  };

  /** ------------------ شريحة الحالة ------------------ **/
  const statusChip = (status: string, type: 'asset' | 'maintenance') => {
    if (type === 'asset') {
      const colors: any = {
        active: 'success',
        in_maintenance: 'warning',
        out_of_service: 'danger'
      };
      const labels: any = {
        active: language === 'ar' ? 'قيد التشغيل' : 'Active',
        in_maintenance: language === 'ar' ? 'صيانة' : 'Maintenance',
        out_of_service: language === 'ar' ? 'خارج الخدمة' : 'Out of Service'
      };
      return <Chip size="sm" color={colors[status]} variant="flat">{labels[status]}</Chip>;
    }

    const colors: any = { scheduled: 'default', in_progress: 'warning', completed: 'success' };
    const labels: any = {
      scheduled: language === 'ar' ? 'مجدولة' : 'Scheduled',
      in_progress: language === 'ar' ? 'جارية' : 'In Progress',
      completed: language === 'ar' ? 'مكتملة' : 'Completed'
    };

    return <Chip size="sm" color={colors[status]} variant="flat">{labels[status]}</Chip>;
  };

  /** ------------------ TopContent ------------------ **/
  const TopContent = () => (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Input
          startContent={<MagnifyingGlassIcon className="h-5 w-5 text-foreground/60" />}
          label={language === 'ar' ? 'بحث' : 'Search'}
          variant="faded"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="min-w-[240px]"
        />

        <Select
          variant="faded"
          label={language === 'ar' ? 'الحالة' : 'Status'}
          selectedKeys={[statusFilter]}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="min-w-[150px]"
        >
          <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>

          {activeTab === 'assets' && (
            <>
              <SelectItem key="active">{language === 'ar' ? 'قيد التشغيل' : 'Active'}</SelectItem>
              <SelectItem key="in_maintenance">{language === 'ar' ? 'صيانة' : 'Maintenance'}</SelectItem>
              <SelectItem key="out_of_service">{language === 'ar' ? 'خارج الخدمة' : 'Out of Service'}</SelectItem>
            </>
          )}

          {activeTab === 'maintenance' && (
            <>
              <SelectItem key="scheduled">{language === 'ar' ? 'مجدولة' : 'Scheduled'}</SelectItem>
              <SelectItem key="in_progress">{language === 'ar' ? 'جارية' : 'In Progress'}</SelectItem>
              <SelectItem key="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
            </>
          )}
        </Select>

        {activeTab === 'assets' && (
          <Select
            variant="faded"
            label={language === 'ar' ? 'النوع' : 'Type'}
            selectedKeys={[typeFilter]}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="min-w-[150px]"
          >
            <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
            <SelectItem key="Cooler">{language === 'ar' ? 'مبرد' : 'Cooler'}</SelectItem>
            <SelectItem key="POS">POS</SelectItem>
            <SelectItem key="Truck">{language === 'ar' ? 'شاحنة' : 'Truck'}</SelectItem>
            <SelectItem key="Freezer">{language === 'ar' ? 'ثلاجة' : 'Freezer'}</SelectItem>
          </Select>
        )}
      </div>

      <span className="text-sm text-foreground/70">
        {language === 'ar' ? `${totalCount} نتيجة` : `${totalCount} results`}
      </span>
    </div>
  );

  /** ------------------ BottomContent ------------------ **/
  const BottomContent = () => (
    <div className="flex flex-col gap-3 px-2 py-2 text-sm md:flex-row md:items-center md:justify-between">
      <div className="flex gap-2">
        <Button size="sm" variant="flat" onPress={() => setPage((p) => Math.max(p - 1, 1))} isDisabled={page === 1}>
          {language === 'ar' ? 'السابق' : 'Previous'}
        </Button>
        <Button size="sm" variant="flat" onPress={() => setPage((p) => Math.min(p + 1, totalPages))} isDisabled={page === totalPages}>
          {language === 'ar' ? 'التالي' : 'Next'}
        </Button>
      </div>

      <span className="text-xs text-foreground/60">
        {language === 'ar' ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
      </span>

      <Pagination
        style={{ direction: 'ltr' }}
        page={page}
        total={totalPages}
        onChange={setPage}
        showControls
        color="primary"
        size="sm"
      />
    </div>
  );

  /** ------------------ renderTable ------------------ **/
  const renderTable = () => {
    if (activeTab === 'assets') {
      return (
        <Table
          aria-label="Assets"
          classNames={{ table: 'min-w-full text-base' }}
          topContent={<TopContent />}
          bottomContent={<BottomContent />}
        >
          <TableHeader>
            <TableColumn>{language === 'ar' ? 'رقم الأصل' : 'Asset ID'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'النوع' : 'Type'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الموديل' : 'Model'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الموقع' : 'Location'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'آخر صيانة' : 'Last Maintenance'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'المندوب' : 'Employee'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'العميل' : 'Customer'}</TableColumn>
            <TableColumn className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableColumn>
          </TableHeader>

          {loading ? (
            <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={9} />} />
          ) : (
            <TableBody emptyContent={language === 'ar' ? 'لا توجد بيانات' : 'No data'}>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.asset_id}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat">{item.type}</Chip>
                  </TableCell>
                  <TableCell>{item.model}</TableCell>
                  <TableCell>{statusChip(item.status, 'asset')}</TableCell>
                  <TableCell>{language === 'ar' ? item.location_name_ar : item.location_name}</TableCell>
                  <TableCell>{moment(item.last_maintenance).format('DD MMM YYYY')}</TableCell>
                  <TableCell>{language === 'ar' ? item.employee_name_ar : item.employee_name}</TableCell>
                  <TableCell>{language === 'ar' ? item.customer_name_ar : item.customer_name}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Tooltip content={language === 'ar' ? 'التفاصيل' : 'Details'}>
                      <Button
                        isIconOnly
                        color="primary"
                        variant="flat"
                        radius="full"
                        onPress={() => {
                          setSelectedAsset(item);
                          detailsModal.onOpen();
                        }}
                      >
                        <CubeIcon className="h-5 w-5" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={language === 'ar' ? 'تحرير' : 'Edit'}>
                      <Button
                        isIconOnly
                        color="warning"
                        variant="flat"
                        radius="full"
                        onPress={() => {
                          setIsEditing(true);
                          setFormData(item);
                          editModal.onOpen();
                        }}
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={language === 'ar' ? 'حذف' : 'Delete'}>
                      <Button
                        isIconOnly
                        color="danger"
                        variant="flat"
                        radius="full"
                        onPress={() => handleDelete(item.id)}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </Button>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      );
    }

    if (activeTab === 'maintenance') {
      return (
        <Table
          aria-label="Maintenance"
          classNames={{ table: 'min-w-full text-base' }}
          topContent={<TopContent />}
          bottomContent={<BottomContent />}
        >
          <TableHeader>
            <TableColumn>{language === 'ar' ? 'رقم الأصل' : 'Asset No'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'النوع' : 'Type'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الوصف' : 'Description'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الفني' : 'Technician'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'التكلفة' : 'Cost'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
            <TableColumn className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableColumn>
          </TableHeader>

          {loading ? (
            <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={8} />} />
          ) : (
            <TableBody emptyContent="No data">
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.asset_no}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat">{item.type}</Chip>
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{language === 'ar' ? item.technician_ar : item.technician}</TableCell>
                  <TableCell>{item.cost}</TableCell>
                  <TableCell>{moment(item.date).format('DD MMM YYYY')}</TableCell>
                  <TableCell>{statusChip(item.status, 'maintenance')}</TableCell>

                  <TableCell className="flex justify-end gap-2">
                    <Button
                      isIconOnly
                      color="warning"
                      variant="flat"
                      radius="full"
                      onPress={() => {
                        setIsEditing(true);
                        setFormData(item);
                        editModal.onOpen();
                      }}
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </Button>

                    <Button
                      isIconOnly
                      color="danger"
                      variant="flat"
                      radius="full"
                      onPress={() => handleDelete(item.id)}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      );
    }

    return (
      <Table
        aria-label="Movements"
        classNames={{ table: 'min-w-full text-base' }}
        topContent={<TopContent />}
        bottomContent={<BottomContent />}
      >
        <TableHeader>
          <TableColumn>{language === 'ar' ? 'رقم الأصل' : 'Asset No'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'من' : 'From'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'إلى' : 'To'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'بواسطة' : 'Moved By'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'ملاحظات' : 'Notes'}</TableColumn>
        </TableHeader>

        {loading ? (
          <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={6} />} />
        ) : (
          <TableBody emptyContent="No data">
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.asset_no}</TableCell>
                <TableCell>{language === 'ar' ? item.from_location_ar : item.from_location}</TableCell>
                <TableCell>{language === 'ar' ? item.to_location_ar : item.to_location}</TableCell>
                <TableCell>{language === 'ar' ? item.moved_by_ar : item.moved_by}</TableCell>
                <TableCell>{moment(item.date).format('DD MMM YYYY')}</TableCell>
                <TableCell>{item.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>
    );
  };

  /** ------------------ واجهة الصفحة ------------------ **/
  useEffect(() => {
    fetchData();
  }, [activeTab, page, search, statusFilter, typeFilter, language]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">

        {/* ------------------ Header ------------------ */}
        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">
              {language === 'ar' ? 'نظام إدارة الأصول' : 'ASSET MANAGEMENT SYSTEM'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-text">
              {language === 'ar' ? 'إدارة الأصول والمعدات' : 'Asset & Equipment Management'}
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              {language === 'ar' 
                ? 'تتبع وإدارة جميع الأصول والمعدات بكفاءة عالية' 
                : 'Track and manage all assets and equipment efficiently'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="solid"
              color="primary"
              startContent={<PlusIcon className="h-4 w-4" />}
              onPress={() => {
                setIsEditing(false);
                setFormData({});
                editModal.onOpen();
              }}
            >
              {language === 'ar' ? 'أصل جديد' : 'New Asset'}
            </Button>
          </div>
        </section>

        {/* ------------------ KPIs ------------------ */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">
                  {language === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}
                </span>
                <CubeIcon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-semibold">{kpis.total}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">
                  {language === 'ar' ? 'قيد التشغيل' : 'Active'}
                </span>
                <CubeIcon className="h-5 w-5 text-success" />
              </div>
              <p className="text-2xl font-semibold text-success">{kpis.active}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">
                  {language === 'ar' ? 'صيانة' : 'Maintenance'}
                </span>
                <WrenchScrewdriverIcon className="h-5 w-5 text-warning" />
              </div>
              <p className="text-2xl font-semibold text-warning">{kpis.maintenance}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">
                  {language === 'ar' ? 'خارج الخدمة' : 'Out of Service'}
                </span>
                <CubeIcon className="h-5 w-5 text-danger" />
              </div>
              <p className="text-2xl font-semibold text-danger">{kpis.outOfService}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">
                  {language === 'ar' ? 'إجمالي القيمة' : 'Total Value'}
                </span>
                <CubeIcon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-semibold">${kpis.totalValue}</p>
            </CardBody>
          </Card>
        </section>

        {/* ------------------ Tabs ------------------ */}
        <Card>
          <CardBody>
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => { 
                setActiveTab(key.toString());
                setPage(1);
                setSearch('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              variant="underlined"
              color="primary"
            >
              <Tab
                key="assets"
                title={<div className="flex items-center gap-2">
                  <CubeIcon className="h-5 w-5" />
                  <span>{language === 'ar' ? 'الأصول' : 'Assets'}</span>
                </div>}
              >
                {renderTable()}
              </Tab>

              <Tab
                key="maintenance"
                title={<div className="flex items-center gap-2">
                  <WrenchScrewdriverIcon className="h-5 w-5" />
                  <span>{language === 'ar' ? 'الصيانة' : 'Maintenance'}</span>
                </div>}
              >
                {renderTable()}
              </Tab>

              <Tab
                key="movements"
                title={<div className="flex items-center gap-2">
                  <TruckIcon className="h-5 w-5" />
                  <span>{language === 'ar' ? 'الحركات' : 'Movements'}</span>
                </div>}
              >
                {renderTable()}
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>

      {/* ------------------ Edit/Add Modal ------------------ */}
      <Modal
        isOpen={editModal.isOpen}
        onOpenChange={editModal.onOpenChange}
        size="xl"
        scrollBehavior="inside"
        backdrop="blur"
        isDismissable={false}
      >
        <ModalContent className="bg-content1/95">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">
                {isEditing ? (language === 'ar' ? 'تحرير' : 'Edit') : (language === 'ar' ? 'إضافة جديد' : 'Add New')}
              </ModalHeader>

              <Form
                onSubmit={(e) => { e.preventDefault(); saveData(); }}
                className="w-full"
              >
                <ModalBody className="space-y-4">

                  {submitError && (
                    <Alert
                      title={language === 'ar' ? 'خطأ' : 'Error'}
                      description={Array.isArray(submitError) ? submitError.join(', ') : submitError}
                      color="danger"
                      variant="flat"
                    />
                  )}

                  {activeTab === 'assets' && (
                    <>
                      <Input
                        label={language === 'ar' ? 'رقم الأصل' : 'Asset ID'}
                        variant="faded"
                        value={formData.asset_id || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, asset_id: e.target.value }))
                        }
                        isRequired
                      />

                      <Select
                        label={language === 'ar' ? 'النوع' : 'Type'}
                        selectedKeys={[formData.type || 'Cooler']}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, type: e.target.value }))
                        }
                        variant="faded"
                        isRequired
                      >
                        <SelectItem key="Cooler">{language === 'ar' ? 'مبرد' : 'Cooler'}</SelectItem>
                        <SelectItem key="POS">POS</SelectItem>
                        <SelectItem key="Truck">{language === 'ar' ? 'شاحنة' : 'Truck'}</SelectItem>
                        <SelectItem key="Freezer">{language === 'ar' ? 'ثلاجة' : 'Freezer'}</SelectItem>
                      </Select>

                      <Input
                        label={language === 'ar' ? 'الموديل' : 'Model'}
                        variant="faded"
                        value={formData.model || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, model: e.target.value }))
                        }
                        isRequired
                      />

                      <Input
                        label={language === 'ar' ? 'الشركة المصنعة' : 'Manufacturer'}
                        variant="faded"
                        value={formData.manufacturer || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, manufacturer: e.target.value }))
                        }
                      />

                      <Input
                        label={language === 'ar' ? 'القيمة' : 'Value'}
                        type="number"
                        variant="faded"
                        value={formData.value || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, value: e.target.value }))
                        }
                        isRequired
                      />

                      <Select
                        label={language === 'ar' ? 'الحالة' : 'Status'}
                        selectedKeys={[formData.status || 'active']}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, status: e.target.value }))
                        }
                        variant="faded"
                      >
                        <SelectItem key="active">{language === 'ar' ? 'قيد التشغيل' : 'Active'}</SelectItem>
                        <SelectItem key="in_maintenance">{language === 'ar' ? 'صيانة' : 'Maintenance'}</SelectItem>
                        <SelectItem key="out_of_service">{language === 'ar' ? 'خارج الخدمة' : 'Out of Service'}</SelectItem>
                      </Select>

                      <Autocomplete
                        label={language === 'ar' ? 'الموقع' : 'Location'}
                        variant="faded"
                        selectedKey={formData.location_id}
                        onSelectionChange={(key) =>
                          setFormData((prev) => ({ ...prev, location_id: key }))
                        }
                      >
                        {MOCK_LOCATIONS.map((loc) => (
                          <AutocompleteItem key={loc.id}>
                            {language === 'ar' ? loc.name_ar : loc.name}
                          </AutocompleteItem>
                        ))}
                      </Autocomplete>

                      <Autocomplete
                        label={language === 'ar' ? 'العميل' : 'Customer'}
                        variant="faded"
                        selectedKey={formData.customer_id}
                        onSelectionChange={(key) =>
                          setFormData((prev) => ({ ...prev, customer_id: key }))
                        }
                      >
                        {MOCK_CUSTOMERS.map((c) => (
                          <AutocompleteItem key={c.id}>
                            {language === 'ar' ? c.name_ar : c.name}
                          </AutocompleteItem>
                        ))}
                      </Autocomplete>
                    </>
                  )}

                  {activeTab === 'maintenance' && (
                    <>
                      <Autocomplete
                        label={language === 'ar' ? 'رقم الأصل' : 'Asset'}
                        variant="faded"
                        selectedKey={formData.asset_id}
                        onSelectionChange={(key) =>
                          setFormData((prev) => ({ ...prev, asset_id: key }))
                        }
                        isRequired
                      >
                        {MOCK_ASSETS.map((asset) => (
                          <AutocompleteItem key={asset.id}>{asset.asset_id}</AutocompleteItem>
                        ))}
                      </Autocomplete>

                      <Select
                        label={language === 'ar' ? 'النوع' : 'Type'}
                        selectedKeys={[formData.type || 'preventive']}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, type: e.target.value }))
                        }
                        variant="faded"
                      >
                        <SelectItem key="preventive">{language === 'ar' ? 'وقائية' : 'Preventive'}</SelectItem>
                        <SelectItem key="corrective">{language === 'ar' ? 'تصحيحية' : 'Corrective'}</SelectItem>
                        <SelectItem key="emergency">{language === 'ar' ? 'طارئة' : 'Emergency'}</SelectItem>
                      </Select>

                      <Textarea
                        label={language === 'ar' ? 'الوصف' : 'Description'}
                        variant="faded"
                        value={formData.description || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, description: e.target.value }))
                        }
                        isRequired
                      />

                      <Autocomplete
                        label={language === 'ar' ? 'الفني' : 'Technician'}
                        variant="faded"
                        selectedKey={formData.technician}
                        onSelectionChange={(key) =>
                          setFormData((prev) => ({ ...prev, technician: key }))
                        }
                      >
                        {MOCK_EMPLOYEES.map((emp) => (
                          <AutocompleteItem key={emp.id}>
                            {language === 'ar' ? emp.name_ar : emp.name}
                          </AutocompleteItem>
                        ))}
                      </Autocomplete>

                      <Input
                        label={language === 'ar' ? 'التكلفة' : 'Cost'}
                        type="number"
                        variant="faded"
                        value={formData.cost || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, cost: e.target.value }))
                        }
                      />

                      <Select
                        label={language === 'ar' ? 'الحالة' : 'Status'}
                        selectedKeys={[formData.status || 'scheduled']}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, status: e.target.value }))
                        }
                        variant="faded"
                      >
                        <SelectItem key="scheduled">{language === 'ar' ? 'مجدولة' : 'Scheduled'}</SelectItem>
                        <SelectItem key="in_progress">{language === 'ar' ? 'جارية' : 'In Progress'}</SelectItem>
                        <SelectItem key="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
                      </Select>
                    </>
                  )}

                </ModalBody>

                <ModalFooter>
                  <Button variant="ghost" onPress={onClose}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>

                  <Button type="submit" isLoading={loadingForm} color="primary">
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </Button>
                </ModalFooter>
              </Form>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ------------------ Details Modal ------------------ */}
      <Modal
        isOpen={detailsModal.isOpen}
        onOpenChange={detailsModal.onOpenChange}
        size="3xl"
        scrollBehavior="inside"
        backdrop="blur"
      >
        <ModalContent className="bg-content1/95">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">
                {language === 'ar' ? 'تفاصيل الأصل' : 'Asset Details'}
              </ModalHeader>

              <ModalBody className="space-y-6">
                {selectedAsset && (
                  <>
                    {/* Basic Info */}
                    <Card>
                      <CardBody className="space-y-3">
                        <h3 className="text-lg font-semibold">
                          {language === 'ar' ? 'معلومات أساسية' : 'Basic Information'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'رقم الأصل' : 'Asset ID'}</p>
                            <p className="font-semibold">{selectedAsset.asset_id}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'النوع' : 'Type'}</p>
                            <p className="font-semibold">{selectedAsset.type}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'الموديل' : 'Model'}</p>
                            <p className="font-semibold">{selectedAsset.model}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'الشركة المصنعة' : 'Manufacturer'}</p>
                            <p className="font-semibold">{selectedAsset.manufacturer}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'القيمة' : 'Value'}</p>
                            <p className="font-semibold">${selectedAsset.value}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                            {statusChip(selectedAsset.status, 'asset')}
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'تاريخ التشغيل' : 'Operational Date'}</p>
                            <p className="font-semibold">{moment(selectedAsset.operational_date).format('DD MMM YYYY')}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'انتهاء الضمان' : 'Warranty Expiry'}</p>
                            <p className="font-semibold">{moment(selectedAsset.warranty_expiry).format('DD MMM YYYY')}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Location Info */}
                    <Card>
                      <CardBody className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <MapPinIcon className="h-5 w-5" />
                          {language === 'ar' ? 'معلومات الموقع' : 'Location Information'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'الموقع الحالي' : 'Current Location'}</p>
                            <p className="font-semibold">{language === 'ar' ? selectedAsset.location_name_ar : selectedAsset.location_name}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'العميل' : 'Customer'}</p>
                            <p className="font-semibold">{language === 'ar' ? selectedAsset.customer_name_ar : selectedAsset.customer_name}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'المندوب المسؤول' : 'Responsible Employee'}</p>
                            <p className="font-semibold">{language === 'ar' ? selectedAsset.employee_name_ar : selectedAsset.employee_name}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Maintenance Card */}
                    <Card>
                      <CardBody className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <WrenchScrewdriverIcon className="h-5 w-5" />
                          {language === 'ar' ? 'بطاقة الصيانة' : 'Maintenance Card'}
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-foreground/60">{language === 'ar' ? 'آخر صيانة' : 'Last Maintenance'}</p>
                            <p className="font-semibold">{moment(selectedAsset.last_maintenance).format('DD MMM YYYY')}</p>
                          </div>
                          <Button size="sm" color="primary" variant="flat" startContent={<PlusIcon className="h-4 w-4" />}>
                            {language === 'ar' ? 'تسجيل صيانة جديدة' : 'Register New Maintenance'}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button color="warning" variant="flat" startContent={<ArrowPathIcon className="h-4 w-4" />}>
                        {language === 'ar' ? 'تحديث الحالة' : 'Update Status'}
                      </Button>
                      <Button color="primary" variant="flat" startContent={<TruckIcon className="h-4 w-4" />}>
                        {language === 'ar' ? 'نقل الأصل' : 'Transfer Asset'}
                      </Button>
                      <Button color="success" variant="flat" startContent={<DocumentArrowDownIcon className="h-4 w-4" />}>
                        {language === 'ar' ? 'تنزيل تقرير PDF' : 'Download PDF Report'}
                      </Button>
                      <Button color="secondary" variant="flat" startContent={<PhotoIcon className="h-4 w-4" />}>
                        {language === 'ar' ? 'إضافة مرفق' : 'Add Attachment'}
                      </Button>
                    </div>
                  </>
                )}
              </ModalBody>

              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

    </div>
  );
}