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
  Card,
  CardBody,
} from '@heroui/react';

import {
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';

/* ---------- Recharts ---------- */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

/* ---------- Types ---------- */
type SaleRow = {
  invoice_id: string;
  customer: string;
  total_amount: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  items_count: number;
  sales_rep: string;
  date: string;
  branch?: string;
  region?: string;
  product_category?: string;
};

type InventoryRow = {
  sku: string;
  name: string;
  qty: number;
  reserved: number;
  min_level: number;
  expiry?: string | null;
  branch?: string;
};

type FieldRep = {
  id: string;
  name: string;
  visits: number;
  avg_visit_duration_mins?: number;
};

type Customer = {
  id: string;
  name: string;
  total_spent: number;
  region?: string;
  credit_limit?: number;
  outstanding?: number;
};

const pageSize = 6;

/* ---------- Local Dummy API (in-memory + localStorage) ---------- */
const STORAGE_PREFIX = 'ra_demo_v1_';

function persist(key: string, data: any) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

function restore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    return fallback;
  }
}

/* ---------- Seed Data ---------- */
const seedSales: SaleRow[] = Array.from({ length: 34 }).map((_, i) => {
  const statuses: SaleRow['payment_status'][] = ['paid', 'unpaid', 'partial'];
  return {
    invoice_id: `INV-${1000 + i}`,
    customer: `Customer ${i + 1}`,
    total_amount: Math.floor(150 + Math.random() * 20000),
    payment_status: statuses[i % statuses.length],
    items_count: Math.floor(1 + Math.random() * 12),
    sales_rep: `Rep ${(i % 6) + 1}`,
    date: `2025-11-${String((i % 28) + 1).padStart(2, '0')}`,
    branch: `Branch ${(i % 3) + 1}`,
    region: [`North`, `South`, `East`, `West`][i % 4],
    product_category: [`A`, `B`, `C`][i % 3],
  };
});

const seedInventory: InventoryRow[] = Array.from({ length: 18 }).map((_, i) => ({
  sku: `SKU-${100 + i}`,
  name: `Product ${i + 1}`,
  qty: Math.floor(Math.random() * 500),
  reserved: Math.floor(Math.random() * 30),
  min_level: Math.floor(5 + Math.random() * 20),
  expiry: Math.random() > 0.6 ? `2025-12-${String((i % 28) + 1).padStart(2, '0')}` : null,
  branch: `Branch ${(i % 3) + 1}`,
}));

const seedReps: FieldRep[] = Array.from({ length: 6 }).map((_, i) => ({
  id: `REP-${i + 1}`,
  name: `Rep ${i + 1}`,
  visits: Math.floor(Math.random() * 120),
  avg_visit_duration_mins: Math.floor(10 + Math.random() * 50),
}));

const seedCustomers: Customer[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `CUST-${i + 1}`,
  name: `Customer ${i + 1}`,
  total_spent: Math.floor(500 + Math.random() * 50000),
  region: [`North`, `South`, `East`, `West`][i % 4],
  credit_limit: 10000 + Math.floor(Math.random() * 90000),
  outstanding: Math.floor(Math.random() * 5000),
}));

/* Initialize localStorage if empty */
if (!localStorage.getItem(STORAGE_PREFIX + 'sales')) persist('sales', seedSales);
if (!localStorage.getItem(STORAGE_PREFIX + 'inventory')) persist('inventory', seedInventory);
if (!localStorage.getItem(STORAGE_PREFIX + 'field_team')) persist('field_team', seedReps);
if (!localStorage.getItem(STORAGE_PREFIX + 'customers')) persist('customers', seedCustomers);
if (!localStorage.getItem(STORAGE_PREFIX + 'reports')) persist('reports', []);

/* Dummy API wrapper that simulates network and provides CRUD */
const FakeApi = {
  async list(endpoint: string, delay = 300) {
    await new Promise((r) => setTimeout(r, delay));
    return restore(endpoint as any, []);
  },
  async get(endpoint: string, id: string) {
    const all = restore(endpoint as any, []);
    return all.find((x: any) => x.id === id || x.invoice_id === id || x.sku === id) ?? null;
  },
  async create(endpoint: string, payload: any) {
    const all = restore(endpoint as any, []);
    const item = { ...payload };
    // assign id if needed
    if (!item.id) item.id = `${endpoint.toUpperCase()}-${Date.now()}`;
    all.unshift(item);
    persist(endpoint, all);
    return item;
  },
  async update(endpoint: string, id: string, payload: any) {
    const all = restore(endpoint as any, []);
    const idx = all.findIndex((x: any) => x.id === id || x.invoice_id === id || x.sku === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...payload };
      persist(endpoint, all);
      return all[idx];
    }
    return null;
  },
  async remove(endpoint: string, id: string) {
    let all = restore(endpoint as any, []);
    all = all.filter((x: any) => !(x.id === id || x.invoice_id === id || x.sku === id));
    persist(endpoint, all);
    return true;
  },
};

/* ---------- Small Helpers ---------- */
const formatNumber = (n: number) => n.toLocaleString();

const salesOverTimeData = [
  { month: 'Jan', sales: 12500 },
  { month: 'Feb', sales: 15000 },
  { month: 'Mar', sales: 21000 },
  { month: 'Apr', sales: 18000 },
  { month: 'May', sales: 25000 },
  { month: 'Jun', sales: 27000 },
  { month: 'Jul', sales: 32000 },
  { month: 'Aug', sales: 31000 },
  { month: 'Sep', sales: 29000 },
  { month: 'Oct', sales: 35000 },
  { month: 'Nov', sales: 38000 },
  { month: 'Dec', sales: 40000 },
];

const revenueData = salesOverTimeData.map((d) => ({ month: d.month, revenue: Math.floor(d.sales * (0.8 + Math.random() * 0.4)) }));

const topProductsPieData = [
  { type: 'Product A', value: 35 },
  { type: 'Product B', value: 20 },
  { type: 'Product C', value: 15 },
  { type: 'Product D', value: 30 },
];

const PIE_COLORS = ['#1e805d', '#1b1731', '#4a3f6b', '#8cc9b0'];

/* ---------- Export Helpers (CSV / JSON / Print as PDF) ---------- */
function downloadCSV(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const csv = rows
    .map((r) => keys.map((k) => `"${String(r[k] ?? '')}"`).join(','))
    .join('\n');
  const blob = new Blob([header + '\n' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDFPrintable(contentHtml: string, title = 'Report') {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write('<html><head><title>' + title + '</title></head><body>' + contentHtml + '</body></html>');
  w.document.close();
  w.focus();
  w.print();
}

/* ---------- Main Component ---------- */
export default function ReportingAnalyticsPage() {
  const { language } = useLanguage();
  const t = (key: string, vars?: Record<string, string>) => {
    const value = lang(language, key);
    if (!vars) return value;
    return Object.keys(vars).reduce((acc, token) => acc.replace(`{{${token}}}`, vars[token]), value);
  };

  const isRTL = language === 'ar';

  /* State */
  const [sales, setSales] = useState<SaleRow[]>(() => restore('sales', seedSales));
  const [inventory, setInventory] = useState<InventoryRow[]>(() => restore('inventory', seedInventory));
  const [fieldTeam, setFieldTeam] = useState<FieldRep[]>(() => restore('field_team', seedReps));
  const [customers, setCustomers] = useState<Customer[]>(() => restore('customers', seedCustomers));

  const [loading, setLoading] = useState(false);

  /* --- Filters for Sales Reports --- */
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');

  /* Pagination */
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const filtered = sales.filter((s) => {
      if (paymentStatus !== 'all' && s.payment_status !== paymentStatus) return false;
      if (selectedRep !== 'all' && s.sales_rep !== selectedRep) return false;
      if (selectedBranch !== 'all' && s.branch !== selectedBranch) return false;
      if (selectedCustomer !== 'all' && s.customer !== selectedCustomer) return false;
      if (search && !(`${s.invoice_id} ${s.customer} ${s.sales_rep}`.toLowerCase().includes(search.toLowerCase()))) return false;
      if (dateFrom && new Date(s.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(s.date) > new Date(dateTo)) return false;
      return true;
    });
    setTotalPages(Math.max(1, Math.ceil(filtered.length / pageSize)));
  }, [sales, paymentStatus, selectedRep, selectedBranch, selectedCustomer, search, dateFrom, dateTo]);

  const filteredSales = useMemo(() => {
    let arr = sales.slice();
    if (paymentStatus !== 'all') arr = arr.filter((s) => s.payment_status === paymentStatus);
    if (selectedRep !== 'all') arr = arr.filter((s) => s.sales_rep === selectedRep);
    if (selectedBranch !== 'all') arr = arr.filter((s) => s.branch === selectedBranch);
    if (selectedCustomer !== 'all') arr = arr.filter((s) => s.customer === selectedCustomer);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((r) => `${r.invoice_id} ${r.customer} ${r.sales_rep}`.toLowerCase().includes(s));
    }
    if (dateFrom) arr = arr.filter((r) => new Date(r.date) >= new Date(dateFrom));
    if (dateTo) arr = arr.filter((r) => new Date(r.date) <= new Date(dateTo));
    return arr;
  }, [sales, paymentStatus, selectedRep, selectedBranch, selectedCustomer, search, dateFrom, dateTo]);

  const pagedSales = useMemo(() => {
    const p = Math.max(1, page);
    return filteredSales.slice((p - 1) * pageSize, p * pageSize);
  }, [filteredSales, page]);

  /* --- CRUD operations wired to FakeApi and state updates --- */
  async function refreshAll() {
    setLoading(true);
    const [s, inv, ft, cust] = await Promise.all([
      FakeApi.list('sales'),
      FakeApi.list('inventory'),
      FakeApi.list('field_team'),
      FakeApi.list('customers'),
    ]);
    setSales(s as SaleRow[]);
    setInventory(inv as InventoryRow[]);
    setFieldTeam(ft as FieldRep[]);
    setCustomers(cust as Customer[]);
    setLoading(false);
  }

  async function createSale(payload: Partial<SaleRow>) {
    const item = await FakeApi.create('sales', payload);
    setSales((prev) => [item, ...prev]);
    addToast({ title: t('toast.created'), description: t('toast.created_description'), color: 'success' });
  }

  async function updateSale(id: string, payload: Partial<SaleRow>) {
    const item = await FakeApi.update('sales', id, payload);
    if (item) setSales((prev) => prev.map((s) => (s.invoice_id === id ? item : s)));
    addToast({ title: t('toast.updated'), description: t('toast.updated_description'), color: 'success' });
  }

  async function deleteSale(id: string) {
    await FakeApi.remove('sales', id);
    setSales((prev) => prev.filter((s) => s.invoice_id !== id));
    addToast({ title: t('toast.deleted_single_title'), description: t('toast.deleted_single_description'), color: 'success' });
  }

  async function createInventory(payload: Partial<InventoryRow>) {
    const item = await FakeApi.create('inventory', payload);
    setInventory((prev) => [item, ...prev]);
  }

  async function updateInventory(sku: string, payload: Partial<InventoryRow>) {
    const item = await FakeApi.update('inventory', sku, payload);
    if (item) setInventory((prev) => prev.map((i) => (i.sku === sku ? item : i)));
  }

  async function deleteInventory(sku: string) {
    await FakeApi.remove('inventory', sku);
    setInventory((prev) => prev.filter((i) => i.sku !== sku));
  }

  async function createRep(payload: Partial<FieldRep>) {
    const item = await FakeApi.create('field_team', payload);
    setFieldTeam((prev) => [item, ...prev]);
  }

  async function updateRep(id: string, payload: Partial<FieldRep>) {
    const item = await FakeApi.update('field_team', id, payload);
    if (item) setFieldTeam((prev) => prev.map((r) => (r.id === id ? item : r)));
  }

  async function deleteRep(id: string) {
    await FakeApi.remove('field_team', id);
    setFieldTeam((prev) => prev.filter((r) => r.id !== id));
  }

  async function createCustomer(payload: Partial<Customer>) {
    const item = await FakeApi.create('customers', payload);
    setCustomers((prev) => [item, ...prev]);
  }

  async function updateCustomer(id: string, payload: Partial<Customer>) {
    const item = await FakeApi.update('customers', id, payload);
    if (item) setCustomers((prev) => prev.map((c) => (c.id === id ? item : c)));
  }

  async function deleteCustomer(id: string) {
    await FakeApi.remove('customers', id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  /* --- Small Charts components (kept style) --- */
  function SalesLineChart() {
    return (
      <div className="w-full h-48">
        <ResponsiveContainer>
          <LineChart data={salesOverTimeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="sales" stroke="#1e805d" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function RevenueBarChart() {
    return (
      <div className="w-full h-48">
        <ResponsiveContainer>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#1b1731" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function TopProductsPieChart() {
    return (
      <div className="w-full h-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={topProductsPieData} dataKey="value" nameKey="type" cx="50%" cy="50%" outerRadius={70} label>
              {topProductsPieData.map((entry, index) => (
                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function SalesAreaChart() {
    return (
      <div className="w-full h-48">
        <ResponsiveContainer>
          <AreaChart data={salesOverTimeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="sales" stroke="#1e805d" fill="#1e805d" fillOpacity={0.12} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* ---------- UI Render ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <Spinner size="lg" color="primary" />
        </div>
      )}

      <div className="mx-auto w-full space-y-8">
        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-foreground/70 mt-1 text-sm">{t('reports.hero.subtitle')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">{t('sidebar.reports')}</h1>
          </div>

          <div className="flex gap-2">
            <Button
              variant="solid"
              color="primary"
              startContent={<PlusIcon className="h-4 w-4" />}
              onPress={() => addToast({ title: t('toast.create_report'), description: t('toast.create_report_description'), color: 'success' })}
            >
              {t('reports.actions.create_report')}
            </Button>

            <Button variant="flat" onPress={() => refreshAll()} startContent={<FolderIcon className="h-4 w-4" />}>
              {t('reports.actions.refresh') || 'Refresh'}
            </Button>
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="rounded-2xl">
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-foreground/70 uppercase tracking-wide">{t('kpi.total_sales')}</p>
                <p className="mt-1 text-xl font-semibold">﷼ {formatNumber(sales.reduce((a, b) => a + b.total_amount, 0))}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-2"><ChartBarIcon className="h-5 w-5" /></div>
            </CardBody>
          </Card>

          <Card className="rounded-2xl">
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-foreground/70 uppercase tracking-wide">{t('kpi.total_invoices')}</p>
                <p className="mt-1 text-xl font-semibold">{formatNumber(sales.length)}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-2"><DocumentIcon className="h-5 w-5" /></div>
            </CardBody>
          </Card>

          <Card className="rounded-2xl">
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-foreground/70 uppercase tracking-wide">{t('kpi.collection')}</p>
                <p className="mt-1 text-xl font-semibold">﷼ {formatNumber(Math.floor(sales.reduce((a, b) => a + (b.payment_status === 'paid' ? b.total_amount : 0), 0)))}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-2"><CurrencyDollarIcon className="h-5 w-5" /></div>
            </CardBody>
          </Card>

          <Card className="rounded-2xl">
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-foreground/70 uppercase tracking-wide">{t('kpi.returns')}</p>
                <p className="mt-1 text-xl font-semibold">﷼ {formatNumber(12000)}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-2"><ExclamationTriangleIcon className="h-5 w-5" /></div>
            </CardBody>
          </Card>
        </div>

        {/* Analytics charts and tables */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="rounded-2xl">
                <CardBody>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-foreground/70">{t('charts.sales_last_12_months')}</p>
                      <p className="text-lg font-semibold">{t('charts.sales_last_12_months')}</p>
                    </div>
                    <div className="text-sm text-foreground/60">Monthly</div>
                  </div>
                  <SalesLineChart />
                </CardBody>
              </Card>

              <Card className="rounded-2xl">
                <CardBody>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-foreground/70">Best Products</p>
                      <p className="text-lg font-semibold">Best Products</p>
                    </div>
                    <div className="text-sm text-foreground/60">This Year</div>
                  </div>
                  <RevenueBarChart />
                </CardBody>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardBody>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-foreground/70">Collection & Growth</p>
                    <p className="text-xl font-semibold">Collection & Growth</p>
                  </div>
                  <div className="text-xs text-foreground/60">8 days</div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-xl bg-content2/40">
                    <p className="text-sm text-foreground/70">Avg Collection</p>
                    <p className="text-2xl font-semibold">8 days</p>
                  </div>
                  <div className="p-4 rounded-xl bg-content2/40">
                    <p className="text-sm text-foreground/70">Median</p>
                    <p className="text-2xl font-semibold">5 days</p>
                  </div>
                  <div className="p-4 rounded-xl bg-content2/40">
                    <p className="text-sm text-foreground/70">Longest</p>
                    <p className="text-2xl font-semibold">45 days</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="rounded-2xl">
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-foreground/70">Alerts</p>
                    <p className="text-lg font-semibold">Alerts</p>
                  </div>
                  <div className="text-sm text-foreground/60">{t('table.results_count', { count: String(filteredSales.length) })}</div>
                </div>

                <Table aria-label="Alerts table" classNames={{ table: 'min-w-full text-base' }}>
                  <TableHeader>
                    <TableColumn>{t('table.date')}</TableColumn>
                    <TableColumn>Message</TableColumn>
                    <TableColumn className="text-center">Severity</TableColumn>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>2025-11-04</TableCell>
                      <TableCell>Product SKU-102 stock below minimum</TableCell>
                      <TableCell className="text-center"><Chip size="sm" variant="flat">High</Chip></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>2025-11-02</TableCell>
                      <TableCell>Branch 2 returns spike</TableCell>
                      <TableCell className="text-center"><Chip size="sm">Medium</Chip></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4">
            <Card className="rounded-2xl">
              <CardBody>
                <p className="text-sm text-foreground/70">Quick Actions</p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="flat" startContent={<PlusIcon className="h-4 w-4" />}>Create Invoice</Button>
                  <Button variant="flat" startContent={<DocumentIcon className="h-4 w-4" />}>Upload Document</Button>
                  <Button variant="flat" startContent={<UserGroupIcon className="h-4 w-4" />}>View Reps</Button>
                </div>
              </CardBody>
            </Card>

            <Card className="rounded-2xl">
              <CardBody>
                <p className="text-sm text-foreground/70">Top Customers</p>
                <div className="mt-3 space-y-2">
                  {customers.slice(0, 4).map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" radius="lg" name={c.name} className="bg-primary/10 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">{c.name}</p>
                          <p className="text-xs text-foreground/60">﷼ {formatNumber(c.total_spent)}</p>
                        </div>
                      </div>
                      <Chip size="sm">Active</Chip>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="rounded-2xl">
              <CardBody>
                <p className="text-sm text-foreground/70">Top Products</p>
                <div className="mt-3">
                  <TopProductsPieChart />
                </div>
              </CardBody>
            </Card>

            <Card className="rounded-2xl">
              <CardBody>
                <p className="text-sm text-foreground/70">Field Team</p>
                <div className="mt-3 space-y-2 text-sm text-foreground/70">
                  {fieldTeam.slice(0, 4).map((r) => (
                    <div key={r.id}>{r.name} — {r.visits} visits</div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>

        {/* Sales Reports Section (filters + table + exports) */}
        <Card className="rounded-2xl">
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-foreground/70">Sales Reports</p>
                <p className="text-lg font-semibold">Sales Reports</p>
              </div>
              <div className="flex gap-2">
                <Button variant="flat" onPress={() => downloadCSV('sales_report.csv', filteredSales)}>{t('actions.export_csv')}</Button>
                <Button variant="flat" onPress={() => exportJSON('sales_report.json', filteredSales)}>{t('actions.export_json') || 'Export JSON'}</Button>
                <Button color="primary" onPress={() => exportPDFPrintable('<h1>Sales Report</h1><pre>' + JSON.stringify(filteredSales.slice(0, 50), null, 2) + '</pre>')}>Export PDF</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
              <Input label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} startContent={<MagnifyingGlassIcon className="h-4 w-4" />} />
              <Select label="Sales Rep" selectedKeys={[selectedRep]} onChange={(e) => { setSelectedRep(e.target.value); setPage(1); }}>
                <SelectItem key="all">All</SelectItem>
                {fieldTeam.map((r) => (<SelectItem key={r.name}>{r.name}</SelectItem>))}
              </Select>
              <Select label="Branch" selectedKeys={[selectedBranch]} onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}>
                <SelectItem key="all">All</SelectItem>
                <SelectItem key="Branch 1">Branch 1</SelectItem>
                <SelectItem key="Branch 2">Branch 2</SelectItem>
                <SelectItem key="Branch 3">Branch 3</SelectItem>
              </Select>
            </div>

            <Table aria-label="Sales table" classNames={{ table: 'min-w-full text-base' }}>
              <TableHeader>
                <TableColumn>{t('table.invoice_id')}</TableColumn>
                <TableColumn>{t('table.customer')}</TableColumn>
                <TableColumn>{t('table.total_amount')}</TableColumn>
                <TableColumn>{t('table.items')}</TableColumn>
                <TableColumn>{t('table.sales_rep')}</TableColumn>
                <TableColumn>{t('table.payment_status')}</TableColumn>
                <TableColumn>{t('table.date')}</TableColumn>
                <TableColumn className="text-center">{t('table.actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={t('table.empty')}>
                {pagedSales.map((s) => (
                  <TableRow key={s.invoice_id} className="hover:bg-content2/60">
                    <TableCell>{s.invoice_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" radius="lg" name={s.customer} className="bg-primary/10 text-primary" />
                        <div>
                          <p className="font-semibold text-text">{s.customer}</p>
                          <p className="text-xs text-foreground/60">Items: {s.items_count}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>﷼ {formatNumber(s.total_amount)}</TableCell>
                    <TableCell>{s.items_count}</TableCell>
                    <TableCell>{s.sales_rep}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={s.payment_status === 'paid' ? 'success' : s.payment_status === 'unpaid' ? 'danger' : 'warning'}>
                        {t(`filters.status_${s.payment_status}`)}
                      </Chip>
                    </TableCell>
                    <TableCell>{s.date}</TableCell>
                    <TableCell>
                      <div className={`flex items-center ${isRTL ? 'justify-start' : 'justify-end'} gap-2`}>
                        <Button isIconOnly variant="light" radius="full" color="primary" onPress={() => addToast({ title: 'View', description: s.invoice_id, color: 'success' })}>
                          <EyeIcon className="h-5 w-5" />
                        </Button>
                        <Button isIconOnly variant="light" radius="full" onPress={() => addToast({ title: 'Edit', description: t('toast.edit_invoice'), color: 'success' })}>
                          <PencilSquareIcon className="h-5 w-5" />
                        </Button>
                        <Button isIconOnly variant="light" radius="full" color="danger" onPress={() => deleteSale(s.invoice_id)}>
                          <TrashIcon className="h-5 w-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 px-2 py-2 text-sm md:flex-row md:items-center md:justify-between">
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.max(prev - 1, 1))} isDisabled={page === 1}>{t('pagination.prev')}</Button>
                <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))} isDisabled={page === totalPages}>{t('pagination.next')}</Button>
              </div>

              <span className="text-xs text-foreground/60">{t('pagination.page', { page: String(page), total: String(totalPages) })}</span>

              <Pagination page={page} total={totalPages} onChange={setPage} showControls color="primary" size="sm" isDisabled={filteredSales.length === 0} />
            </div>
          </CardBody>
        </Card>

        {/* Inventory Reports */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="rounded-2xl md:col-span-2">
            <CardBody>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-foreground/70">Inventory Reports</p>
                  <p className="text-lg font-semibold">Inventory Overview</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="flat" onPress={() => downloadCSV('inventory.csv', inventory)}>Export CSV</Button>
                  <Button variant="flat" onPress={() => addToast({ title: 'Report', description: 'Inventory PDF exported', color: 'success' })}>Export PDF</Button>
                </div>
              </div>

              <Table aria-label="Inventory" classNames={{ table: 'min-w-full text-base' }}>
                <TableHeader>
                  <TableColumn>SKU</TableColumn>
                  <TableColumn>Product</TableColumn>
                  <TableColumn>Qty</TableColumn>
                  <TableColumn>Reserved</TableColumn>
                  <TableColumn>Branch</TableColumn>
                </TableHeader>
                <TableBody>
                  {inventory.map((it) => (
                    <TableRow key={it.sku} className="hover:bg-content2/60">
                      <TableCell>{it.sku}</TableCell>
                      <TableCell>{it.name}</TableCell>
                      <TableCell>{it.qty}</TableCell>
                      <TableCell>{it.reserved}</TableCell>
                      <TableCell>{it.branch}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <aside className="space-y-4">
            <Card className="rounded-2xl">
              <CardBody>
                <p className="text-sm text-foreground/70">Near Expiry</p>
                <div className="mt-3 text-sm text-foreground/70 space-y-2">
                  {inventory.filter((i) => i.expiry).slice(0, 4).map((i) => (
                    <div key={i.sku}>{i.name} — {i.expiry}</div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="rounded-2xl">
              <CardBody>
                <p className="text-sm text-foreground/70">Low Stock</p>
                <div className="mt-3 text-sm text-foreground/70 space-y-2">
                  {inventory.filter((i) => i.qty <= i.min_level).slice(0, 4).map((i) => (
                    <div key={i.sku}>{i.name} — Qty {i.qty}</div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>

        {/* Advanced BI Widgets (drag/drop & save are dummy but UI present) */}
        <Card className="rounded-2xl">
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-foreground/70">Advanced BI Widgets</p>
                <p className="text-lg font-semibold">Customize Dashboard</p>
              </div>
              <div className="flex gap-2">
                <Button variant="flat" onPress={() => addToast({ title: 'Save', description: 'Dashboard saved (dummy)', color: 'success' })}>Save Dashboard</Button>
                <Button variant="flat" onPress={() => addToast({ title: 'Reset', description: 'Reset to default (dummy)', color: 'success' })}>Reset</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="p-4 rounded-xl bg-content2/40">Widget: Sales Today</div>
              <div className="p-4 rounded-xl bg-content2/40">Widget: Branch Performance</div>
              <div className="p-4 rounded-xl bg-content2/40">Widget: Top Products</div>
            </div>
          </CardBody>
        </Card>

        {/* Export Center & Smart Insights */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardBody>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-foreground/70">Export Center</p>
                  <p className="text-lg font-semibold">Export & Share</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="flat" onPress={() => downloadCSV('all_sales.csv', sales)}>Export All CSV</Button>
                  <Button variant="flat" onPress={() => exportJSON('all_sales.json', sales)}>Export JSON</Button>
                </div>
              </div>

              <div className="text-sm text-foreground/70">
                <p>Share via email (dummy):</p>
                <div className="mt-2 flex gap-2">
                  <Input placeholder="recipient@company.com" />
                  <Button onPress={() => addToast({ title: 'Share', description: 'Sent (dummy)', color: 'success' })}>Send</Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="rounded-2xl">
            <CardBody>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-foreground/70">Smart Insights</p>
                  <p className="text-lg font-semibold">Smart Insights</p>
                </div>
                <div className="text-sm text-foreground/60">Auto</div>
              </div>

              <div className="text-sm text-foreground/70 space-y-2">
                <div>Alert: Product A sales down 12% vs last month</div>
                <div>Alert: Branch 2 returns increased</div>
                <div>Recommendation: Visit Customer 7 next week</div>
              </div>
            </CardBody>
          </Card>
        </div>

      </div>
    </div>
  );
}
