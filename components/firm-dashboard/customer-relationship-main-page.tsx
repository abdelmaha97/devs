'use client';
import { useEffect, useState } from 'react';
import {
  Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn,
  TableHeader, TableRow, useDisclosure, addToast, Alert, Form, Tooltip,
  Tabs, Tab, Card, CardBody, Textarea, Autocomplete, AutocompleteItem,
  Avatar, Drawer, DrawerContent, DrawerBody, AvatarGroup
} from '@heroui/react';
import {
  UsersIcon, PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon,
  MapIcon, CalendarDaysIcon, BoltIcon, ChartBarIcon, CreditCardIcon,
  DocumentTextIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/solid';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';
import { TableSkeleton } from "@/lib/Skeletons";
import moment from 'moment';

const pageSize = 8;

/**
 * Customer Relationship & Route Planning Page
 * - يتبع نفس نمط صفحة WarehousePage تماماً (layout, components, styling)
 * - يحتوي Mock data + dummy API endpoints comments
 * - يدعم CRUD على Customers, Routes, Visits, CRM entities
 * - يحتوي Dashboard KPIs + simple SVG charts (embedded, lightweight)
 * - Contains map placeholder (to be replaced by Google Maps in real integration)
 * - Export CSV / Print(PDF) minimal implementations
 */

export default function CustomerRelationshipRoutePage() {
  const { language } = useLanguage();
  const t = (key: string) => lang(language, key);

  /** ------------------ states ------------------ **/
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('last_visit'); // last_visit | top_sales
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // data stores
  const [customers, setCustomers] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // modals/drawers
  const customerModal = useDisclosure();
  const deleteModal = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const profileDrawer = useDisclosure();
  const routeModal = useDisclosure();
  const calendarDrawer = useDisclosure();
  const visitModal = useDisclosure();

  // forms
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string[] | string>([]);

  // route planning
  const [reps, setReps] = useState<any[]>([]);
  const [selectedRep, setSelectedRep] = useState<any>('all');
  const [routeCandidates, setRouteCandidates] = useState<any[]>([]);
  const [todayRoute, setTodayRoute] = useState<any[]>([]);

  // visits/calendar
  const [visits, setVisits] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);

  // loading forms
  const [loadingForm, setLoadingForm] = useState(false);

  /** ------------------ MOCK data (fallback) ------------------ **/
  const MOCK_REGIONS = [
    { id: 'all', name: language === 'ar' ? 'الكل' : 'All' },
    { id: 'north', name: 'North' },
    { id: 'south', name: 'South' },
    { id: 'east', name: 'East' },
    { id: 'west', name: 'West' },
  ];

  const MOCK_REPS = [
    { id: 1, name: 'Ahmed', name_ar: 'أحمد' },
    { id: 2, name: 'Fatima', name_ar: 'فاطمة' },
    { id: 3, name: 'Khalid', name_ar: 'خالد' },
  ];

  const MOCK_CUSTOMERS = Array.from({ length: 36 }, (_, i) => {
    const visitsCount = Math.max(0, Math.round(Math.random() * 12));
    const lastVisit = moment().subtract(Math.round(Math.random() * 60), 'days').format('YYYY-MM-DD');
    const creditLimit = [500, 1000, 2000, 5000][i % 4];
    const balance = Math.round(Math.random() * creditLimit);
    const status = (i % 7 === 0) ? 'at_risk' : (i % 5 === 0 ? 'dormant' : 'active');
    const region = MOCK_REGIONS[(i % (MOCK_REGIONS.length - 1)) + 1].id;
    return {
      id: i + 1,
      name: `Customer ${i + 1}`,
      name_ar: `عميل ${i + 1}`,
      type: i % 3 === 0 ? 'Retail' : 'Wholesale',
      last_visit: lastVisit,
      balance,
      credit_limit: creditLimit,
      region,
      status,
      avg_visit_days: Math.round(Math.random() * 20) + 1,
      total_purchases: Math.round(Math.random() * 20000) / 100,
      top_products: [
        { sku: `SKU-${100 + i}`, qty: Math.round(Math.random() * 50) },
        { sku: `SKU-${200 + i}`, qty: Math.round(Math.random() * 30) },
      ],
      location: { lat: 23.6 + Math.random() * 0.5, lng: 58.5 + Math.random() * 0.5 },
      images: []
    };
  });

  const MOCK_VISITS = [
    // sample visit
    { id: 1, customer_id: 1, rep_id: 1, date: moment().format('YYYY-MM-DD'), time: '10:30', status: 'upcoming', note: '' }
  ];

  /** ------------------ API helpers (CRUD dummy) ------------------ **/
  // NOTE: update endpoints to your backend if available:
  // GET  /api/crm/customers?{page,pageSize,search,region,status,sort}
  // GET  /api/crm/customers/:id
  // POST /api/crm/customers
  // PUT  /api/crm/customers/:id
  // DELETE /api/crm/customers/:id
  // GET  /api/crm/kpis
  // GET  /api/crm/alerts
  // GET  /api/crm/reps
  // GET  /api/crm/visits
  const safeFetch = async (url: string, opts: any = {}) => {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText || 'Request failed');
      }
      return await res.json();
    } catch (err: any) {
      throw new Error(err?.message || 'Network error');
    }
  };

  /** ------------------ fetch list & auxiliaries ------------------ **/
  const fetchAuxiliary = async () => {
    try {
      // const r = await safeFetch('/api/crm/reps');
      // const reg = await safeFetch('/api/crm/regions');
      // const k = await safeFetch('/api/crm/kpis');
      // const a = await safeFetch('/api/crm/alerts');

      // fallback mocks
      setReps(MOCK_REPS);
      setRegions(MOCK_REGIONS);
      setKpis({
        total_customers: MOCK_CUSTOMERS.length,
        new_customers: MOCK_CUSTOMERS.filter(c => moment(c.last_visit).isAfter(moment().subtract(30, 'days'))).length,
        dormant_customers: MOCK_CUSTOMERS.filter(c => c.status === 'dormant').length,
        customers_at_risk: MOCK_CUSTOMERS.filter(c => c.status === 'at_risk').length,
        avg_visit_days: Math.round(MOCK_CUSTOMERS.reduce((s, c) => s + c.avg_visit_days, 0) / MOCK_CUSTOMERS.length),
        top_customer: MOCK_CUSTOMERS.reduce((p, c) => c.total_purchases > (p?.total_purchases || 0) ? c : p, null)
      });

      setAlerts(MOCK_CUSTOMERS.filter(c => c.status === 'at_risk').slice(0, 6));
    } catch (err: any) {
      // ignore for now
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // build query string
      const params: any = { page, pageSize, search, region: regionFilter !== 'all' ? regionFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, sort: sortBy };
      const q = Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
      // const resp = await safeFetch(`/api/crm/customers?${q}`);
      // setCustomers(resp.items); setTotalPages(resp.totalPages); setTotalCount(resp.total);

      // fallback: filter MOCK_CUSTOMERS
      let items = [...MOCK_CUSTOMERS];
      if (search) {
        const s = search.toLowerCase();
        items = items.filter(it => `${it.name} ${it.name_ar}`.toLowerCase().includes(s));
      }
      if (regionFilter !== 'all') items = items.filter(it => it.region === regionFilter);
      if (statusFilter !== 'all') items = items.filter(it => it.status === statusFilter);
      if (sortBy === 'top_sales') items = items.sort((a, b) => (b.total_purchases || 0) - (a.total_purchases || 0));
      else items = items.sort((a, b) => (+new Date(b.last_visit) - +new Date(a.last_visit)));

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      setCustomers(paginated);
      setTotalPages(Math.ceil(items.length / pageSize));
      setTotalCount(items.length);
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerDetail = async (id: number) => {
    setLoading(true);
    try {
      // const resp = await safeFetch(`/api/crm/customers/${id}`);
      const found = MOCK_CUSTOMERS.find(c => c.id === id);
      setSelectedCustomer(found || null);
      profileDrawer.onOpen();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async (payload: any) => {
    setLoadingForm(true);
    try {
      // const resp = await safeFetch('/api/crm/customers', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      const newItem = { ...payload, id: Date.now(), last_visit: payload.last_visit || moment().format('YYYY-MM-DD') };
      MOCK_CUSTOMERS.unshift(newItem);
      addToast({ title: language === 'ar' ? 'تم الإنشاء' : 'Created', description: language === 'ar' ? 'تم إضافة العميل' : 'Customer created', color: 'success' });
      customerModal.onClose();
      setFormData({});
      await fetchAuxiliary();
      await fetchCustomers();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoadingForm(false);
    }
  };

  const updateCustomer = async (id: number, payload: any) => {
    setLoadingForm(true);
    try {
      // const resp = await safeFetch(`/api/crm/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      const idx = MOCK_CUSTOMERS.findIndex(c => c.id === id);
      if (idx !== -1) MOCK_CUSTOMERS[idx] = { ...MOCK_CUSTOMERS[idx], ...payload };
      setCustomers(prev => prev.map(it => it.id === id ? { ...it, ...payload } : it));
      addToast({ title: language === 'ar' ? 'تم التحديث' : 'Updated', description: language === 'ar' ? 'تم تحديث العميل' : 'Customer updated', color: 'success' });
      customerModal.onClose();
      setFormData({});
      await fetchAuxiliary();
      await fetchCustomers();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoadingForm(false);
    }
  };

  const deleteCustomer = async (id: number) => {
    try {
      // const resp = await safeFetch(`/api/crm/customers/${id}`, { method: 'DELETE' });
      const idx = MOCK_CUSTOMERS.findIndex(c => c.id === id);
      if (idx !== -1) MOCK_CUSTOMERS.splice(idx, 1);
      setCustomers(prev => prev.filter(it => it.id !== id));
      addToast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted', description: language === 'ar' ? 'تم حذف العميل' : 'Customer deleted', color: 'success' });
      await fetchAuxiliary();
      await fetchCustomers();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    }
  };

  /** ------------------ Route planning helpers ------------------ **/
  const fetchRouteCandidates = async (repId: any) => {
    // in real: GET /api/crm/routes/candidates?rep=repId
    const lines = MOCK_CUSTOMERS.filter(c => repId === 'all' ? true : (c.id % 3 + 1) === Number(repId)).slice(0, 30);
    setRouteCandidates(lines);
  };

  const createRoutePlan = async (payload: any) => {
    // POST /api/crm/routes
    // payload { type: 'daily'|'weekly'|'auto', rep_id, customers: [...] }
    // fallback: save todayRoute
    setTodayRoute(payload.customers || []);
    addToast({ title: language === 'ar' ? 'تم إنشاء الخطة' : 'Plan Created', description: language === 'ar' ? 'تم إنشاء خطة الزيارات' : 'Route plan created', color: 'success' });
    routeModal.onClose();
  };

  /** ------------------ Visits (Calendar) ------------------ **/
  const fetchVisits = async () => {
    // GET /api/crm/visits
    setVisits(MOCK_VISITS);
  };

  const startVisit = async (visitId: number) => {
    // simulate check-in via geolocation
    try {
      const pos = await new Promise((res, rej) => {
        if (!navigator.geolocation) return rej(new Error('No geo'));
        navigator.geolocation.getCurrentPosition(p => res(p), e => rej(e));
      });
      addToast({ title: language === 'ar' ? 'تم البدء' : 'Check-in', description: language === 'ar' ? 'تم تسجيل الدخول الجغرافي' : 'GPS check-in recorded', color: 'success' });
      // In real: POST /api/crm/visits/:id/checkin {lat,lng}
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'تحذير' : 'Warning', description: language === 'ar' ? 'لم يتم الحصول على الموقع' : 'Geolocation unavailable', color: 'warning' });
    }
  };

  /** ------------------ Smart Recommendations (basic heuristics) ------------------ **/
  const getRecommendations = (customer: any) => {
    // simple rules: if last_visit > 30 days => recommend visit
    const recs: any[] = [];
    if (!customer) return recs;
    const daysSince = moment().diff(moment(customer.last_visit), 'days');
    if (daysSince > 30) recs.push({ type: 'visit', text: language === 'ar' ? 'لم تتم زيارة هذا العميل منذ مدة' : 'Customer not visited recently' });
    if (customer.balance > customer.credit_limit) recs.push({ type: 'credit', text: language === 'ar' ? 'تجاوز حد الائتمان' : 'Credit limit exceeded' });
    if ((customer.top_products?.length || 0) > 0) recs.push({ type: 'order', text: language === 'ar' ? 'اقتراح طلب حسب المنتجات الأكثر شراءً' : 'Suggest order based on top products' });
    return recs;
  };

  /** ------------------ Export helpers ------------------ **/
  const exportCSV = (rows: any[], filename = 'export.csv') => {
    if (!rows || !rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => `"${String(r[k] ?? '')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = (contentSelector = '#crm-page') => {
    // simple print approach: open print window focused on content
    const el = document.querySelector(contentSelector);
    if (!el) return window.print();
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.write(`<html><head><title>Export</title><style>body{font-family:system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding:20px;}</style></head><body>${el.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  /** ------------------ simple inline charts (SVG) ------------------ **/
  const MiniBarChart = ({ values = [] as number[] }: { values: number[] }) => {
    const max = Math.max(...values, 1);
    const width = 120, height = 40;
    const barW = width / values.length;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {values.map((v, i) => {
          const h = (v / max) * height;
          return <rect key={i} x={i * barW + 2} y={height - h} width={barW - 4} height={h} rx={2} ry={2} fill="#2563eb" />;
        })}
      </svg>
    );
  };

  const MiniPie = ({ values = [] as number[] }: { values: number[] }) => {
    const total = values.reduce((s, v) => s + v, 0) || 1;
    const r = 18;
    let acc = 0;
    return (
      <svg width={48} height={48} viewBox="-24 -24 48 48">
        {values.map((v, i) => {
          const start = (acc / total) * 2 * Math.PI;
          acc += v;
          const end = (acc / total) * 2 * Math.PI;
          const x1 = Math.sin(start) * r, y1 = -Math.cos(start) * r;
          const x2 = Math.sin(end) * r, y2 = -Math.cos(end) * r;
          const large = end - start > Math.PI ? 1 : 0;
          const d = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
          return <path key={i} d={d} fill={colors[i % colors.length]} opacity={0.95} />;
        })}
      </svg>
    );
  };

  /** ------------------ UI small components ------------------ **/
  const KPIGrid = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}</p>
              <h3 className="text-lg font-semibold">{kpis.total_customers || 0}</h3>
            </div>
            <UsersIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-3">
            <MiniBarChart values={[5, 8, 12, 6, 10]} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'عملاء جدد' : 'New Customers'}</p>
              <h3 className="text-lg font-semibold">{kpis.new_customers || 0}</h3>
            </div>
            <BoltIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-3">
            <MiniPie values={[kpis.new_customers || 1, (kpis.total_customers - (kpis.new_customers || 0)) || 1]} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'العملاء المتراجعون' : 'Declining Customers'}</p>
              <h3 className="text-lg font-semibold">{kpis.dormant_customers || 0}</h3>
            </div>
            <ChartBarIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-3">
            <MiniBarChart values={[2, 1, 4, 3, 2]} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'متوسط أيام الزيارة' : 'Avg Visit (days)'}</p>
              <h3 className="text-lg font-semibold">{kpis.avg_visit_days || 0}</h3>
            </div>
            <CalendarDaysIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-3">
            <MiniBarChart values={[kpis.avg_visit_days || 5, 7, 6, 8, 5]} />
          </div>
        </CardBody>
      </Card>
    </div>
  );

  /** ------------------ Top content (search & controls) ------------------ **/
  const CustomersTop = () => (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Input
          startContent={<MagnifyingGlassIcon className="h-5 w-5 text-foreground/60" />}
          label={language === 'ar' ? 'بحث عن عميل' : 'Search customer'}
          variant="faded"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="min-w-[260px]"
        />

        <Select
          variant="faded"
          label={language === 'ar' ? 'المنطقة' : 'Region'}
          selectedKeys={[String(regionFilter)]}
          onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}
          className="min-w-[160px]"
        >
          {regions.map(r => <SelectItem key={r.id}>{language === 'ar' ? r.name_ar || r.name : r.name}</SelectItem>)}
        </Select>

        <Select
          variant="faded"
          label={language === 'ar' ? 'حالة العميل' : 'Status'}
          selectedKeys={[String(statusFilter)]}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="min-w-[160px]"
        >
          <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
          <SelectItem key="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
          <SelectItem key="dormant">{language === 'ar' ? 'متراجع' : 'Dormant'}</SelectItem>
          <SelectItem key="at_risk">{language === 'ar' ? 'في خطر' : 'At Risk'}</SelectItem>
        </Select>

        <Select
          variant="faded"
          label={language === 'ar' ? 'ترتيب' : 'Sort By'}
          selectedKeys={[String(sortBy)]}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="min-w-[160px]"
        >
          <SelectItem key="last_visit">{language === 'ar' ? 'آخر زيارة' : 'Last Visit'}</SelectItem>
          <SelectItem key="top_sales">{language === 'ar' ? 'أعلى مبيعات' : 'Top Sales'}</SelectItem>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="flat" onPress={() => { exportCSV(customers.map(c => ({ id: c.id, name: language === 'ar' ? c.name_ar || c.name : c.name, last_visit: c.last_visit, balance: c.balance })), 'customers.csv'); }}>
          {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
        </Button>

        <Button
          variant="solid"
          color="primary"
          startContent={<PlusIcon className="h-4 w-4" />}
          onPress={() => {
            setIsEditing(false);
            setFormData({});
            customerModal.onOpen();
          }}
        >
          {language === 'ar' ? 'عميل جديد' : 'New Customer'}
        </Button>
      </div>
    </div>
  );

  const CustomersBottom = () => (
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

  /** ------------------ render Customers table ------------------ **/
  const renderCustomersTable = () => (
    <Table
      aria-label="Customers"
      classNames={{ table: 'min-w-full text-base' }}
      topContent={<CustomersTop />}
      bottomContent={<CustomersBottom />}
    >
      <TableHeader>
        <TableColumn>{language === 'ar' ? 'اسم العميل' : 'Customer'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'النوع' : 'Type'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'آخر زيارة' : 'Last Visit'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'الرصيد' : 'Balance'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'حد الائتمان' : 'Credit Limit'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'المنطقة' : 'Region'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
        <TableColumn className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableColumn>
      </TableHeader>

      {loading ? (
        <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={8} />} />
      ) : (
        <TableBody emptyContent={language === 'ar' ? 'لا توجد بيانات' : 'No data'}>
          {customers.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar name={language === 'ar' ? item.name_ar || item.name : item.name} size="sm" />
                  <div className="flex flex-col">
                    <span>{language === 'ar' ? item.name_ar || item.name : item.name}</span>
                    <small className="text-foreground/60">{item.total_purchases ? `${item.total_purchases} OMR` : ''}</small>
                  </div>
                </div>
              </TableCell>

              <TableCell>{item.type}</TableCell>
              <TableCell>{moment(item.last_visit).format('DD MMM YYYY')}</TableCell>
              <TableCell>{item.balance}</TableCell>
              <TableCell>{item.credit_limit}</TableCell>
              <TableCell>{regions.find(r => r.id === item.region)?.name || item.region}</TableCell>
              <TableCell>{item.status === 'active' ? <Chip size="sm" color="success" variant="flat">{language === 'ar' ? 'نشط' : 'Active'}</Chip> : item.status === 'dormant' ? <Chip size="sm" color="warning" variant="flat">{language === 'ar' ? 'متراجع' : 'Dormant'}</Chip> : <Chip size="sm" color="danger" variant="flat">{language === 'ar' ? 'في خطر' : 'At Risk'}</Chip>}</TableCell>

              <TableCell className="flex justify-end gap-2">
                <Button isIconOnly color="primary" variant="flat" radius="full" onPress={() => fetchCustomerDetail(item.id)}>
                  <DocumentTextIcon className="h-5 w-5" />
                </Button>

                <Button isIconOnly color="warning" variant="flat" radius="full" onPress={() => { setIsEditing(true); setFormData(item); customerModal.onOpen(); }}>
                  <PencilSquareIcon className="h-5 w-5" />
                </Button>

                <Button isIconOnly color="danger" variant="flat" radius="full" onPress={() => { setDeleteTarget(item); deleteModal.onOpen(); }}>
                  <TrashIcon className="h-5 w-5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      )}
    </Table>
  );

  /** ------------------ Customer Profile (Drawer) ------------------ **/
  const CustomerProfile = () => {
    if (!selectedCustomer) return null;
    const recs = getRecommendations(selectedCustomer);
    return (
      <>
        <div className="p-4 flex gap-4 items-start">
          <div className="w-36">
            <Avatar name={language === 'ar' ? selectedCustomer.name_ar || selectedCustomer.name : selectedCustomer.name} size="xl" />
            <div className="mt-3">
              <Button size="sm" variant="flat" onPress={() => exportCSV([selectedCustomer], `customer-${selectedCustomer.id}.csv`)}>{language === 'ar' ? 'تصدير' : 'Export'}</Button>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-semibold">{language === 'ar' ? selectedCustomer.name_ar || selectedCustomer.name : selectedCustomer.name}</h2>
            <p className="text-foreground/70">{selectedCustomer.type} • {regions.find(r => r.id === selectedCustomer.region)?.name}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'حد الائتمان' : 'Credit Limit'}</div>
                <div>{selectedCustomer.credit_limit}</div>
              </div>

              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'الرصيد' : 'Balance'}</div>
                <div>{selectedCustomer.balance}</div>
              </div>

              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'متوسط زيارات' : 'Avg Visit Days'}</div>
                <div>{selectedCustomer.avg_visit_days}</div>
              </div>

              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'آخر زيارة' : 'Last Visit'}</div>
                <div>{moment(selectedCustomer.last_visit).format('DD MMM YYYY')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'الموقع' : 'Location'}</h3>
          <div className="mt-2 h-36 bg-content2/40 rounded-md flex items-center justify-center">
            {/* Map placeholder - replace with Google Maps integration in real system */}
            <div>{language === 'ar' ? 'موقع الخريطة هنا (Google Map)' : 'Map location placeholder (Google Map)'}</div>
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'السجل المالي' : 'Financials'}</h3>
          <Table>
            <TableHeader>
              <TableColumn>{language === 'ar' ? 'البيان' : 'Item'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
            </TableHeader>

            <TableBody>
              <TableRow>
                <TableCell>{language === 'ar' ? 'الرصيد الحالي' : 'Balance'}</TableCell>
                <TableCell>{selectedCustomer.balance}</TableCell>
                <TableCell>{moment().format('DD MMM YYYY')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'سجل الشراء' : 'Purchase History'}</h3>
          <Table>
            <TableHeader>
              <TableColumn>{language === 'ar' ? 'المنتج' : 'Product'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'الكمية' : 'Qty'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'مجموع' : 'Total'}</TableColumn>
            </TableHeader>

            <TableBody>
              {selectedCustomer.top_products?.map((p: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{p.sku}</TableCell>
                  <TableCell>{p.qty}</TableCell>
                  <TableCell>{(p.qty * 1.5).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'اقتراحات ذكية' : 'Smart Recommendations'}</h3>
          <div className="mt-2 space-y-2">
            {getRecommendations(selectedCustomer).map((r, i) => (
              <Card key={i}><CardBody>{r.text}</CardBody></Card>
            ))}
            {!getRecommendations(selectedCustomer).length && <div className="text-foreground/60">{language === 'ar' ? 'لا اقتراحات حالياً' : 'No recommendations'}</div>}
          </div>
        </div>
      </>
    );
  };

  /** ------------------ Effects ------------------ **/
  useEffect(() => {
    fetchAuxiliary();
    fetchVisits();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [page, search, regionFilter, statusFilter, sortBy, language]);

  /** ------------------ Form save handler ------------------ **/
  const saveCustomer = async () => {
    setLoadingForm(true);
    try {
      if (!formData.name && !formData.name_ar) {
        setSubmitError(language === 'ar' ? 'اسم العميل مطلوب' : 'Customer name required');
        return;
      }
      setSubmitError([]);
      if (isEditing && formData.id) {
        await updateCustomer(formData.id, formData);
      } else {
        await createCustomer({ ...formData, status: formData.status || 'active' });
      }
    } finally {
      setLoadingForm(false);
    }
  };

  /** ------------------ Render page ------------------ **/
  return (
    <div id="crm-page" className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">

        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">
              {language === 'ar' ? 'علاقات العملاء وتخطيط المسارات' : 'CUSTOMER RELATIONSHIP & ROUTE PLANNING'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-text">
              {language === 'ar' ? 'إدارة العملاء وتخطيط الزيارات' : 'Customer Relationship & Route Planning'}
            </h1>
          </div>

          <div className="flex gap-2">
            <Button
              variant="solid"
              color="primary"
              startContent={<PlusIcon className="h-4 w-4" />}
              onPress={() => {
                setIsEditing(false);
                setFormData({});
                customerModal.onOpen();
              }}
            >
              {language === 'ar' ? 'عميل جديد' : 'New Customer'}
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardBody>
                <Tabs
                  selectedKey={activeTab}
                  onSelectionChange={(key) => {
                    setActiveTab(key.toString());
                    setPage(1);
                    setSearch('');
                    setRegionFilter('all');
                    setStatusFilter('all');
                    setSortBy('last_visit');
                  }}
                  variant="underlined"
                  color="primary"
                >
                  <Tab
                    key="dashboard"
                    title={<div className="flex items-center gap-2">
                      <ChartBarIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'لوحة القيادة' : 'Dashboard'}</span>
                    </div>}
                  >
                    <div className="p-4 space-y-4">
                      <KPIGrid />

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <Card>
                          <CardBody>
                            <h3 className="text-sm text-foreground/60">{language === 'ar' ? 'أفضل العملاء' : 'Top Customers'}</h3>
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <AvatarGroup>
                                    <Avatar name={kpis.top_customer?.name || '—'} size="sm" />
                                  </AvatarGroup>
                                  <div>
                                    <div className="font-semibold">{language === 'ar' ? (kpis.top_customer?.name_ar || kpis.top_customer?.name) : (kpis.top_customer?.name || '')}</div>
                                    <div className="text-foreground/60 text-xs">{kpis.top_customer?.total_purchases ? `${kpis.top_customer.total_purchases} OMR` : ''}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardBody>
                        </Card>

                        <Card>
                          <CardBody>
                            <h3 className="text-sm text-foreground/60">{language === 'ar' ? 'تنبيهات' : 'Alerts'}</h3>
                            <div className="mt-3 space-y-2">
                              {alerts.length ? alerts.map((a, i) => (
                                <div key={i} className="flex items-center justify-between">
                                  <div>{language === 'ar' ? a.name_ar || a.name : a.name}</div>
                                  <div className="text-sm text-foreground/60">{a.status}</div>
                                </div>
                              )) : <div className="text-foreground/60">{language === 'ar' ? 'لا توجد تنبيهات' : 'No alerts'}</div>}
                            </div>
                          </CardBody>
                        </Card>

                        <Card>
                          <CardBody>
                            <h3 className="text-sm text-foreground/60">{language === 'ar' ? 'مخطط زيارات' : 'Visit Trend'}</h3>
                            <div className="mt-3">
                              <MiniBarChart values={[2, 5, 6, 4, 8, 7]} />
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="customers"
                    title={<div className="flex items-center gap-2">
                      <UsersIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'العملاء' : 'Customers'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      {renderCustomersTable()}
                    </div>
                  </Tab>

                  <Tab
                    key="profile"
                    title={<div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'الملف الكامل' : 'Customer 360'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <p className="text-sm">{language === 'ar' ? 'افتح أي ملف عميل لعرض تفاصيل 360°' : 'Open a customer profile to view 360° details'}</p>
                      <div className="mt-4">
                        <Button onPress={() => profileDrawer.onOpen()}>{language === 'ar' ? 'فتح ملف عشوائي' : 'Open sample profile'}</Button>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="routes"
                    title={<div className="flex items-center gap-2">
                      <MapIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'تخطيط المسارات' : 'Route Planning'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Select label={language === 'ar' ? 'المندوب' : 'Representative'} selectedKeys={[String(selectedRep)]} onChange={(e) => { setSelectedRep(e.target.value); fetchRouteCandidates(e.target.value); }}>
                          <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                          {reps.map(r => <SelectItem key={r.id}>{language === 'ar' ? r.name_ar || r.name : r.name}</SelectItem>)}
                        </Select>

                        <Select label={language === 'ar' ? 'نوع الخطة' : 'Plan Type'} selectedKeys={['daily']} onChange={() => { }}>
                          <SelectItem key="daily">{language === 'ar' ? 'يومية' : 'Daily'}</SelectItem>
                          <SelectItem key="weekly">{language === 'ar' ? 'أسبوعية' : 'Weekly'}</SelectItem>
                          <SelectItem key="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</SelectItem>
                        </Select>

                        <div className="flex items-center gap-2">
                          <Button onPress={() => routeModal.onOpen()}>{language === 'ar' ? 'فتح مُخطط' : 'Open Planner'}</Button>
                          <Button variant="flat" onPress={() => exportPDF()}>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</Button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <Card>
                          <CardBody>
                            <h3 className="text-sm text-foreground/60">{language === 'ar' ? 'العملاء المختارين' : 'Selected Customers'}</h3>
                            <div className="mt-3 space-y-2">
                              {todayRoute.length ? todayRoute.map((c: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between">
                                  <div>{language === 'ar' ? c.name_ar || c.name : c.name}</div>
                                  <div className="text-foreground/60">{c.region}</div>
                                </div>
                              )) : <div className="text-foreground/60">{language === 'ar' ? 'لم يتم اختيار عملاء' : 'No customers selected'}</div>}
                            </div>
                          </CardBody>
                        </Card>

                        <Card>
                          <CardBody>
                            <h3 className="text-sm text-foreground/60">{language === 'ar' ? 'خريطة' : 'Map'}</h3>
                            <div className="mt-3 h-48 bg-content2/40 rounded-md flex items-center justify-center">
                              <div>{language === 'ar' ? 'خريطة Google هنا (نقاط ملونة حسب الحالة)' : 'Google Map placeholder with colored points'}</div>
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="calendar"
                    title={<div className="flex items-center gap-2">
                      <CalendarDaysIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'الزيارات' : 'Visits'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <p className="text-sm">{language === 'ar' ? 'التقويم والزيارات المجدولة' : 'Calendar and scheduled visits'}</p>
                      <div className="mt-4">
                        <Button onPress={() => calendarDrawer.onOpen()}>{language === 'ar' ? 'فتح التقويم' : 'Open Calendar'}</Button>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="execution"
                    title={<div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'تنفيذ الزيارة' : 'Visit Execution'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <p className="text-sm">{language === 'ar' ? 'أدوات تنفيذ الزيارة: Check-in, photos, notes, orders' : 'Visit tools: check-in, photos, notes, orders'}</p>
                      <div className="mt-4">
                        <Button onPress={() => visitModal.onOpen()}>{language === 'ar' ? 'فتح تنفيذ زيارة' : 'Open Visit Executor'}</Button>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="recommendations"
                    title={<div className="flex items-center gap-2">
                      <BoltIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'اقتراحات ذكية' : 'Smart Recommendations'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <p className="text-sm">{language === 'ar' ? 'اقتراحات مبنية على قواعد بسيطة' : 'Simple rule-based recommendations'}</p>
                      <div className="mt-4 space-y-3">
                        {MOCK_CUSTOMERS.slice(0, 6).map((c: any) => (
                          <Card key={c.id}><CardBody className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{language === 'ar' ? c.name_ar || c.name : c.name}</div>
                              <div className="text-foreground/60 text-sm">{language === 'ar' ? `آخر زيارة: ${moment(c.last_visit).format('DD MMM YYYY')}` : `Last visit: ${moment(c.last_visit).format('DD MMM YYYY')}`}</div>
                            </div>
                            <div>
                              {getRecommendations(c).map((r, i) => <Chip key={i} size="sm" variant="flat">{r.text}</Chip>)}
                            </div>
                          </CardBody></Card>
                        ))}
                      </div>
                    </div>
                  </Tab>

                </Tabs>
              </CardBody>
            </Card>
          </div>

          <aside className="lg:col-span-1">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'تنبيهات العملاء' : 'Customer Alerts'}</p>
                    <h3 className="text-lg font-semibold">{language === 'ar' ? 'تنبيهات سريعة' : 'Quick Alerts'}</h3>
                  </div>
                  <ExclamationTriangleIcon className="h-6 w-6 text-warning" />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between">
                    <span>{language === 'ar' ? 'عملاء في خطر' : 'Customers at risk'}</span>
                    <span className="font-semibold">{alerts.length}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>{language === 'ar' ? 'عملاء متراجعون' : 'Dormant customers'}</span>
                    <span className="font-semibold">{kpis.dormant_customers || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>{language === 'ar' ? 'أعلى عميل شراءً' : 'Top customer'}</span>
                    <span className="font-semibold">{language === 'ar' ? (kpis.top_customer?.name_ar || kpis.top_customer?.name) : (kpis.top_customer?.name || '')}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="mt-4">
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'مؤشرات' : 'KPIs'}</p>
                    <h3 className="text-lg font-semibold">{language === 'ar' ? 'مقاييس العملاء' : 'Customer Metrics'}</h3>
                  </div>
                  <MapIcon className="h-6 w-6 text-primary" />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between">
                    <span>{language === 'ar' ? 'إجمالي العملاء' : 'Total customers'}</span>
                    <span className="font-semibold">{kpis.total_customers || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>{language === 'ar' ? 'العملاء الجدد' : 'New customers'}</span>
                    <span className="font-semibold">{kpis.new_customers || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>{language === 'ar' ? 'متوسط الزيارة (أيام)' : 'Avg visit (days)'}</span>
                    <span className="font-semibold">{kpis.avg_visit_days || 0}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>

      {/* ------------------ Customer create/edit Modal ------------------ */}
      <Modal isOpen={customerModal.isOpen} onOpenChange={customerModal.onOpenChange} size="lg" backdrop="blur" scrollBehavior="inside" isDismissable={false}>
        <ModalContent className="bg-content1/95">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">
                {isEditing ? (language === 'ar' ? 'تحرير العميل' : 'Edit Customer') : (language === 'ar' ? 'إضافة عميل جديد' : 'Add New Customer')}
              </ModalHeader>

              <Form onSubmit={(e) => { e.preventDefault(); saveCustomer(); }} className="w-full">
                <ModalBody className="space-y-4">

                  {submitError && (
                    <Alert title={language === 'ar' ? 'خطأ' : 'Error'} description={Array.isArray(submitError) ? submitError.join(', ') : submitError} color="danger" variant="flat" />
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input label={language === 'ar' ? 'اسم العميل (عربي)' : 'Customer Name (AR)'} variant="faded" value={formData.name_ar || ''} onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))} />
                    <Input label={language === 'ar' ? 'اسم العميل (انجليزي)' : 'Customer Name (EN)'} variant="faded" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
                    <Select label={language === 'ar' ? 'المنطقة' : 'Region'} selectedKeys={[String(formData.region || 'all')]} variant="faded" onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}>
                      {regions.map(r => <SelectItem key={r.id}>{language === 'ar' ? r.name_ar || r.name : r.name}</SelectItem>)}
                    </Select>
                    <Input label={language === 'ar' ? 'حد الائتمان' : 'Credit Limit'} type="number" variant="faded" value={formData.credit_limit || ''} onChange={(e) => setFormData(prev => ({ ...prev, credit_limit: Number(e.target.value) }))} />
                    <Input label={language === 'ar' ? 'الرصيد الحالي' : 'Balance'} type="number" variant="faded" value={formData.balance || ''} onChange={(e) => setFormData(prev => ({ ...prev, balance: Number(e.target.value) }))} />
                    <Select label={language === 'ar' ? 'الحالة' : 'Status'} selectedKeys={[String(formData.status || 'active')]} variant="faded" onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}>
                      <SelectItem key="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                      <SelectItem key="dormant">{language === 'ar' ? 'متراجع' : 'Dormant'}</SelectItem>
                      <SelectItem key="at_risk">{language === 'ar' ? 'في خطر' : 'At Risk'}</SelectItem>
                    </Select>

                    <Textarea label={language === 'ar' ? 'ملاحظات' : 'Notes'} variant="faded" value={formData.note || ''} onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))} />
                  </div>

                </ModalBody>

                <ModalFooter>
                  <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                  <Button type="submit" isLoading={loadingForm} color="primary">{language === 'ar' ? 'حفظ' : 'Save'}</Button>
                </ModalFooter>
              </Form>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ------------------ delete modal ------------------ */}
      <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange} size="sm" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</ModalHeader>
              <ModalBody>{language === 'ar' ? 'هل أنت متأكد من حذف هذا العميل؟' : 'Are you sure to delete this customer?'}</ModalBody>

              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                <Button color="danger" onPress={() => { deleteCustomer(deleteTarget?.id); deleteModal.onClose(); }}>
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ------------------ Profile Drawer ------------------ */}
      <Drawer isOpen={profileDrawer.isOpen} onOpenChange={profileDrawer.onOpenChange} size="lg" placement={language === 'ar' ? 'left' : 'right'}>
        <DrawerContent className="bg-content1/95">
          <DrawerBody>
            {CustomerProfile()}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* ------------------ Route Planner Modal (drag & drop simple) ------------------ */}
      <Modal isOpen={routeModal.isOpen} onOpenChange={routeModal.onOpenChange} size="xl" backdrop="blur" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'مخطط المسار' : 'Route Planner'}</ModalHeader>

              <ModalBody className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm text-foreground/60">{language === 'ar' ? 'عملاء متوفرون' : 'Available Customers'}</h4>
                    <div className="mt-2 max-h-64 overflow-auto space-y-2 bg-content2/10 p-2 rounded">
                      {routeCandidates.map((c) => (
                        <div key={c.id} draggable onDragStart={(e) => { e.dataTransfer?.setData('text/plain', String(c.id)); }} className="p-2 bg-content1 rounded flex items-center justify-between">
                          <div>{language === 'ar' ? c.name_ar || c.name : c.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm text-foreground/60">{language === 'ar' ? 'خط السير اليوم' : 'Today Route'}</h4>
                    <div className="mt-2 max-h-64 overflow-auto bg-content2/10 p-2 rounded"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const id = Number(e.dataTransfer.getData('text/plain'));
                        const item = routeCandidates.find(rc => rc.id === id);
                        if (item && !todayRoute.find((r: any) => r.id === id)) setTodayRoute(prev => [...prev, item]);
                      }}
                    >
                      {todayRoute.map((c: any) => (
                        <div key={c.id} className="p-2 bg-content1 rounded flex items-center justify-between">
                          <div>{language === 'ar' ? c.name_ar || c.name : c.name}</div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="flat" onPress={() => setTodayRoute(prev => prev.filter((x: any) => x.id !== c.id))}>{language === 'ar' ? 'حذف' : 'Remove'}</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ModalBody>

              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
                <Button color="primary" onPress={() => createRoutePlan({ type: 'daily', rep_id: selectedRep, customers: todayRoute })}>{language === 'ar' ? 'حفظ الخطة' : 'Save Plan'}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ------------------ Calendar Drawer (simple list) ------------------ */}
      <Drawer isOpen={calendarDrawer.isOpen} onOpenChange={calendarDrawer.onOpenChange} size="lg" placement={language === 'ar' ? 'left' : 'right'}>
        <DrawerContent className="bg-content1/95">
          <DrawerBody>
            <div className="p-4">
              <h2 className="text-2xl font-semibold">{language === 'ar' ? 'تقويم الزيارات' : 'Visit Calendar'}</h2>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableColumn>{language === 'ar' ? 'العميل' : 'Customer'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'الوقت' : 'Time'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
                  </TableHeader>

                  <TableBody>
                    {visits.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>{MOCK_CUSTOMERS.find(c => c.id === v.customer_id)?.name || `Customer ${v.customer_id}`}</TableCell>
                        <TableCell>{v.date}</TableCell>
                        <TableCell>{v.time}</TableCell>
                        <TableCell>{v.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="p-4">
              <Button onPress={() => calendarDrawer.onClose()}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* ------------------ Visit Execution Modal ------------------ */}
      <Modal isOpen={visitModal.isOpen} onOpenChange={visitModal.onOpenChange} size="lg" backdrop="blur" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'تنفيذ الزيارة' : 'Visit Execution'}</ModalHeader>

              <Form onSubmit={(e) => { e.preventDefault(); /* in real send visit report */ addToast({ title: language==='ar' ? 'تم' : 'Done', description: language==='ar' ? 'تم إرسال تقرير الزيارة' : 'Visit report sent', color: 'success' }); visitModal.onClose(); }}>
                <ModalBody className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Select label={language === 'ar' ? 'اختر العميل' : 'Select Customer'} selectedKeys={[String(selectedVisit?.customer_id || 'all')]} onChange={(e) => setSelectedVisit(prev => ({ ...prev, customer_id: e.target.value }))}>
                      <SelectItem key="all">{language === 'ar' ? 'اختر' : 'Select'}</SelectItem>
                      {MOCK_CUSTOMERS.map(c => <SelectItem key={c.id}>{language === 'ar' ? c.name_ar || c.name : c.name}</SelectItem>)}
                    </Select>

                    <Select label={language === 'ar' ? 'المندوب' : 'Representative'} selectedKeys={[String(selectedVisit?.rep_id || reps[0]?.id || '1')]} onChange={(e) => setSelectedVisit(prev => ({ ...prev, rep_id: e.target.value }))}>
                      {reps.map(r => <SelectItem key={r.id}>{language === 'ar' ? r.name_ar || r.name : r.name}</SelectItem>)}
                    </Select>

                    <Input label={language === 'ar' ? 'الوقت المتوقع' : 'Expected Time'} type="time" variant="faded" value={selectedVisit?.time || ''} onChange={(e) => setSelectedVisit(prev => ({ ...prev, time: e.target.value }))} />

                    <Input label={language === 'ar' ? 'تاريخ الزيارة' : 'Visit Date'} type="date" variant="faded" value={selectedVisit?.date || moment().format('YYYY-MM-DD')} onChange={(e) => setSelectedVisit(prev => ({ ...prev, date: e.target.value }))} />

                    <Textarea label={language === 'ar' ? 'ملاحظات الزيارة' : 'Visit Notes'} variant="faded" value={selectedVisit?.note || ''} onChange={(e) => setSelectedVisit(prev => ({ ...prev, note: e.target.value }))} />

                    <div>
                      <div className="text-sm text-foreground/60">{language === 'ar' ? 'صور الأرفف' : 'Shelf Photos'}</div>
                      <Input type="file" variant="faded" onChange={(e) => {
                        // store files in selectedVisit.photos in real app; here we do minimal
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          setSelectedVisit(prev => ({ ...prev, photos: [...(prev?.photos || []), file.name] }));
                        }
                      }} />
                      <div className="mt-2 text-xs text-foreground/60">
                        {selectedVisit?.photos?.length ? selectedVisit.photos.join(', ') : ''}
                      </div>
                    </div>
                  </div>

                </ModalBody>

                <ModalFooter>
                  <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                  <Button type="submit" color="primary">{language === 'ar' ? 'إرسال التقرير' : 'Submit Report'}</Button>
                </ModalFooter>
              </Form>
            </>
          )}
        </ModalContent>
      </Modal>

    </div>
  );
}
