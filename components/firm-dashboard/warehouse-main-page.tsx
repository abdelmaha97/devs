'use client';
import { useEffect, useState } from 'react';
import {
  Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn,
  TableHeader, TableRow, useDisclosure, addToast, Alert, Form, Tooltip,
  Tabs, Tab, Card, CardBody, Textarea, Autocomplete, AutocompleteItem,
  Avatar, Drawer, DrawerContent, DrawerBody
} from '@heroui/react';
import {
  PencilSquareIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon,
  ClipboardDocumentListIcon, DocumentTextIcon, BanknotesIcon,
  CurrencyDollarIcon, ExclamationTriangleIcon, MapIcon
} from '@heroicons/react/24/solid';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';
import { TableSkeleton } from "@/lib/Skeletons";
import moment from 'moment';

const pageSize = 6;

export default function WarehousePage() {
  const { language } = useLanguage();
  const t = (key: string) => lang(language, key);

  /** ------------------ states ------------------ **/
  const [activeTab, setActiveTab] = useState('inventory');
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all'); // available / low / out
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string[] | string>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [kpis, setKpis] = useState<any>({});
  const [alerts, setAlerts] = useState<any>({ lowStock: [], expired: [], outOfStock: [], overReserved: [] });

  const editModal = useDisclosure();
  const deleteModal = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const productDrawer = useDisclosure(); // details drawer
  const [detailProduct, setDetailProduct] = useState<any>(null);

  // Stock Count modal
  const stockCountModal = useDisclosure();
  const [stockCountData, setStockCountData] = useState<any[]>([]);
  const [stockCountWarehouse, setStockCountWarehouse] = useState<number | string>('all');
  const [stockCountType, setStockCountType] = useState<'full' | 'partial'>('full');

  // Expiry modal
  const expiryModal = useDisclosure();
  const [expiryFilters, setExpiryFilters] = useState({ warehouse: 'all', dateFrom: '', dateTo: '' });
  const [expiryData, setExpiryData] = useState<any[]>([]);

  // Returns & Damages modal
  const returnsModal = useDisclosure();
  const [returnsFilter, setReturnsFilter] = useState('all');
  const [returnsData, setReturnsData] = useState<any[]>([]);

  /** ------------------ بيانات افتراضية (fallback) ------------------ **/
  const MOCK_WAREHOUSES = [
    { id: 1, name: 'Main Warehouse', name_ar: 'المستودع الرئيسي' },
    { id: 2, name: 'Branch A', name_ar: 'الفرع أ' },
    { id: 3, name: 'Branch B', name_ar: 'الفرع ب' },
  ];

  const MOCK_CATEGORIES = [
    { id: 'all', name: language === 'ar' ? 'الكل' : 'All' },
    { id: 1, name: 'Beverages' }, { id: 2, name: 'Snacks' }
  ];

  const MOCK_BRANDS = [
    { id: 'all', name: language === 'ar' ? 'الكل' : 'All' },
    { id: 1, name: 'Brand A' }, { id: 2, name: 'Brand B' }
  ];

  const MOCK_INVENTORY = Array.from({ length: 24 }, (_, i) => {
    const qtyAvailable = Math.max(0, Math.round(50 - i * 2 + (Math.random() * 10 - 5)));
    const reserved = Math.round((i % 5) * 1.5);
    const damaged = Math.round((i % 3) * 0.5);
    const minStock = 10;
    const status = qtyAvailable <= 0 ? 'out' : (qtyAvailable <= minStock ? 'low' : 'available');
    return {
      id: i + 1,
      image: '',
      name: `Product ${i + 1}`,
      name_ar: `منتج ${i + 1}`,
      sku: `SKU-${1000 + i}`,
      barcode: `BC${2000 + i}`,
      warehouse: MOCK_WAREHOUSES[i % MOCK_WAREHOUSES.length],
      warehouse_id: MOCK_WAREHOUSES[i % MOCK_WAREHOUSES.length].id,
      qty_available: qtyAvailable,
      qty_reserved: reserved,
      qty_damaged: damaged,
      qty_expired: (i % 7 === 0) ? Math.round(Math.random() * 5) : 0,
      min_stock: minStock,
      status,
      brand: MOCK_BRANDS[(i % MOCK_BRANDS.length) || 0],
      category: MOCK_CATEGORIES[(i % MOCK_CATEGORIES.length) || 0],
      price: (Math.random() * 100).toFixed(2),
      special_price: ((Math.random() * 80)).toFixed(2),
      promo_price: '',
      batches: Array.from({ length: (i % 3) + 1 }, (__ , bi) => ({
        batch_no: `BATCH-${i}-${bi}`,
        qty: Math.max(0, Math.round((qtyAvailable / ((i % 3) + 1)))),
        expiry: moment().add((bi + 1) * (i % 6 + 1), 'days').format('YYYY-MM-DD')
      }))
    };
  });

  /** ------------------ API helpers (CRUD) ------------------ **/
  // NOTE: adjust endpoints to your backend. I used RESTful patterns:
  // GET  /api/warehouse/items         -> list (with query params for filters, pagination, search)
  // GET  /api/warehouse/items/:id     -> read single item (details + per-warehouse rows + batches)
  // POST /api/warehouse/items         -> create item
  // PUT  /api/warehouse/items/:id     -> update item
  // DELETE /api/warehouse/items/:id   -> delete item
  // GET  /api/warehouses              -> list warehouses
  // GET  /api/sales/reservations      -> reserved quantities per sku/product (to sync with sales)
  // GET  /api/warehouse/kpis          -> summary KPIs
  // GET  /api/warehouse/alerts        -> alerts (low/expired/out/over_reserved)
  // GET  /api/warehouse/expiry        -> expiry data
  // GET  /api/warehouse/returns       -> returns & damages list
  // POST /api/warehouse/stockcount    -> submit stock count

  const safeFetch = async (url: string, opts: any = {}) => {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText || 'Request failed');
      }
      return await res.json();
    } catch (err: any) {
      // Bubble up error message
      throw new Error(err?.message || 'Network error');
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      // build query params from filters
      const params: any = {
        page, pageSize,
        search,
        warehouse: warehouseFilter !== 'all' ? warehouseFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        brand: brandFilter !== 'all' ? brandFilter : undefined,
        stock_status: stockStatusFilter !== 'all' ? stockStatusFilter : undefined
      };

      // remove undefined
      const q = Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

      // replace with actual backend call:
      // const resp = await safeFetch(`/api/warehouse/items?${q}`);
      // setData(resp.items); setTotalPages(resp.totalPages); setTotalCount(resp.total);

      // fallback to mock filter logic if API not available
      let items = [...MOCK_INVENTORY];

      if (search) {
        const s = search.toLowerCase();
        items = items.filter(it =>
          `${it.name} ${it.name_ar} ${it.sku} ${it.barcode}`.toLowerCase().includes(s)
        );
      }
      if (warehouseFilter !== 'all') items = items.filter(it => String(it.warehouse_id) === String(warehouseFilter));
      if (categoryFilter !== 'all') items = items.filter(it => String(it.category?.id) === String(categoryFilter));
      if (brandFilter !== 'all') items = items.filter(it => String(it.brand?.id) === String(brandFilter));
      if (stockStatusFilter !== 'all') items = items.filter(it => it.status === stockStatusFilter);

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      setData(paginated);
      setTotalPages(Math.ceil(items.length / pageSize));
      setTotalCount(items.length);

    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliary = async () => {
    try {
      // warehouses, categories, brands, KPIs, alerts
      // const w = await safeFetch('/api/warehouses');
      // const c = await safeFetch('/api/warehouse/categories');
      // const b = await safeFetch('/api/warehouse/brands');
      // const k = await safeFetch('/api/warehouse/kpis');
      // const a = await safeFetch('/api/warehouse/alerts');

      // fallback to mocks
      setWarehouses(MOCK_WAREHOUSES);
      setCategories(MOCK_CATEGORIES);
      setBrands(MOCK_BRANDS);
      setKpis({
        total_items: MOCK_INVENTORY.length,
        total_value: MOCK_INVENTORY.reduce((s, it) => s + (Number(it.price) * Number(it.qty_available)), 0).toFixed(2),
        low_stock_count: MOCK_INVENTORY.filter(i => i.status === 'low').length,
        out_of_stock_count: MOCK_INVENTORY.filter(i => i.status === 'out').length,
        reserved_count: MOCK_INVENTORY.reduce((s, it) => s + it.qty_reserved, 0)
      });
      setAlerts({
        lowStock: MOCK_INVENTORY.filter(i => i.status === 'low'),
        expired: MOCK_INVENTORY.filter(i => i.qty_expired > 0),
        outOfStock: MOCK_INVENTORY.filter(i => i.status === 'out'),
        overReserved: MOCK_INVENTORY.filter(i => i.qty_reserved > i.qty_available)
      });

    } catch (err: any) {
      // ignore for now
    }
  };

  const fetchDetail = async (id: number) => {
    setLoading(true);
    try {
      // const resp = await safeFetch(`/api/warehouse/items/${id}`);
      // setDetailProduct(resp);

      const found = MOCK_INVENTORY.find(it => it.id === id);
      setDetailProduct(found || null);
      productDrawer.onOpen();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (payload: any) => {
    setLoadingForm(true);
    try {
      // const resp = await safeFetch('/api/warehouse/items', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      // addToast success + refresh

      // fallback: add locally
      const newItem = { ...payload, id: Date.now(), warehouse: warehouses.find(w => w.id === payload.warehouse_id) || MOCK_WAREHOUSES[0] };
      setData(prev => [newItem, ...prev]);
      addToast({ title: language === 'ar' ? 'تم الإنشاء' : 'Created', description: language === 'ar' ? 'تم إضافة الصنف' : 'Item created', color: 'success' });
      editModal.onClose();
      setFormData({});
      await fetchAuxiliary();
      await fetchInventory();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoadingForm(false);
    }
  };

  const updateItem = async (id: number, payload: any) => {
    setLoadingForm(true);
    try {
      // const resp = await safeFetch(`/api/warehouse/items/${id}`, { method: 'PUT', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });

      setData(prev => prev.map(it => it.id === id ? { ...it, ...payload } : it));
      addToast({ title: language === 'ar' ? 'تم التحديث' : 'Updated', description: language === 'ar' ? 'تم تحديث البيانات' : 'Item updated', color: 'success' });
      editModal.onClose();
      setFormData({});
      await fetchAuxiliary();
      await fetchInventory();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    } finally {
      setLoadingForm(false);
    }
  };

  const deleteItem = async (id: number) => {
    try {
      // const resp = await safeFetch(`/api/warehouse/items/${id}`, { method: 'DELETE' });
      setData(prev => prev.filter(it => it.id !== id));
      addToast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted', description: language === 'ar' ? 'تم حذف الصنف' : 'Item deleted', color: 'success' });
      await fetchAuxiliary();
      await fetchInventory();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    }
  };

  /** ------------------ Stock Count submit ------------------ **/
  const submitStockCount = async (payload: any) => {
    try {
      // await safeFetch('/api/warehouse/stockcount', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      addToast({ title: language === 'ar' ? 'تم الإرسال' : 'Submitted', description: language === 'ar' ? 'تم إرسال الجرد للمراجعة' : 'Stock count submitted', color: 'success' });
      stockCountModal.onClose();
    } catch (err: any) {
      addToast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.message || err, color: 'danger' });
    }
  };

  /** ------------------ UI bits: chips/status ------------------ **/
  const stockStatusChip = (status: string) => {
    const colors: any = { available: 'success', low: 'warning', out: 'danger' };
    const labels: any = {
      available: language === 'ar' ? 'متوفر' : 'Available',
      low: language === 'ar' ? 'منخفض' : 'Low',
      out: language === 'ar' ? 'نفد' : 'Out'
    };
    return <Chip size="sm" color={colors[status] || 'default'} variant="flat">{labels[status] || status}</Chip>;
  };

  /** ------------------ TopContent for inventory ------------------ **/
  const InventoryTop = () => (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Input
          startContent={<MagnifyingGlassIcon className="h-5 w-5 text-foreground/60" />}
          label={language === 'ar' ? 'بحث عن منتج / SKU / باركود' : 'Search product / SKU / barcode'}
          variant="faded"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="min-w-[260px]"
        />

        <Select
          variant="faded"
          label={language === 'ar' ? 'المستودع' : 'Warehouse'}
          selectedKeys={[String(warehouseFilter)]}
          onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
          className="min-w-[160px]"
        >
          <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
          {warehouses.map(w => <SelectItem key={w.id}>{language === 'ar' ? w.name_ar || w.name : w.name}</SelectItem>)}
        </Select>

        <Select
          variant="faded"
          label={language === 'ar' ? 'التصنيف' : 'Category'}
          selectedKeys={[String(categoryFilter)]}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="min-w-[160px]"
        >
          {categories.map(c => <SelectItem key={c.id}>{c.name}</SelectItem>)}
        </Select>

        <Select
          variant="faded"
          label={language === 'ar' ? 'العلامة التجارية' : 'Brand'}
          selectedKeys={[String(brandFilter)]}
          onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
          className="min-w-[160px]"
        >
          {brands.map(b => <SelectItem key={b.id}>{b.name}</SelectItem>)}
        </Select>

        <Select
          variant="faded"
          label={language === 'ar' ? 'حالة المخزون' : 'Stock Status'}
          selectedKeys={[stockStatusFilter]}
          onChange={(e) => { setStockStatusFilter(e.target.value); setPage(1); }}
          className="min-w-[140px]"
        >
          <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
          <SelectItem key="available">{language === 'ar' ? 'متوفر' : 'Available'}</SelectItem>
          <SelectItem key="low">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
          <SelectItem key="out">{language === 'ar' ? 'نفد' : 'Out'}</SelectItem>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="flat" onPress={() => { stockCountModal.onOpen(); }}>
          {language === 'ar' ? 'جرد' : 'Stock Count'}
        </Button>

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
          {language === 'ar' ? 'جديد' : 'New'}
        </Button>
      </div>
    </div>
  );

  /** ------------------ BottomContent ------------------ **/
  const InventoryBottom = () => (
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

  /** ------------------ renderInventoryTable ------------------ **/
  const renderInventoryTable = () => (
    <Table
      aria-label="Inventory"
      classNames={{ table: 'min-w-full text-base' }}
      topContent={<InventoryTop />}
      bottomContent={<InventoryBottom />}
    >
      <TableHeader>
        <TableColumn>{language === 'ar' ? 'صورة' : 'Image'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'اسم المنتج' : 'Product'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'SKU' : 'SKU'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'المستودع' : 'Warehouse'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'الكمية المتاحة' : 'Qty Available'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'المحجوزة' : 'Qty Reserved'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'التالفة' : 'Damaged'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'المنتهية' : 'Expired'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'الحد الأدنى' : 'Min Stock'}</TableColumn>
        <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
        <TableColumn className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableColumn>
      </TableHeader>

      {loading ? (
        <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={11} />} />
      ) : (
        <TableBody emptyContent={language === 'ar' ? 'لا توجد بيانات' : 'No data'}>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Avatar src={item.image} name={language === 'ar' ? item.name_ar : item.name} />
              </TableCell>

              <TableCell>
                <div className="flex flex-col">
                  <span>{language === 'ar' ? item.name_ar : item.name}</span>
                  <small className="text-foreground/60">{item.brand?.name || ''} • {item.category?.name || ''}</small>
                </div>
              </TableCell>

              <TableCell>{item.sku}</TableCell>
              <TableCell>{language === 'ar' ? item.warehouse?.name_ar || item.warehouse?.name : item.warehouse?.name}</TableCell>
              <TableCell>{item.qty_available}</TableCell>
              <TableCell>{item.qty_reserved}</TableCell>
              <TableCell>{item.qty_damaged}</TableCell>
              <TableCell>{item.qty_expired}</TableCell>
              <TableCell>{item.min_stock}</TableCell>
              <TableCell>{stockStatusChip(item.status)}</TableCell>

              <TableCell className="flex justify-end gap-2">
                <Button
                  isIconOnly
                  color="primary"
                  variant="flat"
                  radius="full"
                  onPress={() => fetchDetail(item.id)}
                >
                  <ClipboardDocumentListIcon className="h-5 w-5" />
                </Button>

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
                  onPress={() => { setDeleteTarget(item); deleteModal.onOpen(); }}
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

  /** ------------------ Alerts sidebar ------------------ **/
  const AlertsPanel = () => (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'تنبيهات المخزون' : 'Stock Alerts'}</p>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'حالة سريعة' : 'Quick Overview'}</h3>
            </div>
            <ExclamationTriangleIcon className="h-6 w-6 text-warning" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'المنتجات منخفضة المخزون' : 'Low stock'}</span>
              <span className="font-semibold">{alerts.lowStock?.length || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'المنتجات منتهية الصلاحية' : 'Expired'}</span>
              <span className="font-semibold">{alerts.expired?.length || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'المنتجات النافدة' : 'Out of stock'}</span>
              <span className="font-semibold">{alerts.outOfStock?.length || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'المحجوزة أعلى من المتاح' : 'Over-reserved'}</span>
              <span className="font-semibold">{alerts.overReserved?.length || 0}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-foreground/60">{language === 'ar' ? 'مؤشرات' : 'KPIs'}</p>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'مقاييس المخزون' : 'Inventory Metrics'}</h3>
            </div>
            <MapIcon className="h-6 w-6 text-primary" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'إجمالي الأصناف' : 'Total items'}</span>
              <span className="font-semibold">{kpis.total_items || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'إجمالي قيمة المخزون' : 'Total stock value'}</span>
              <span className="font-semibold">{kpis.total_value || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'الأصناف منخفضة المخزون' : 'Low stock count'}</span>
              <span className="font-semibold">{kpis.low_stock_count || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'المنتجات النافدة' : 'Out of stock'}</span>
              <span className="font-semibold">{kpis.out_of_stock_count || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{language === 'ar' ? 'المحجوزة في الطلبات' : 'Reserved in sales'}</span>
              <span className="font-semibold">{kpis.reserved_count || 0}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  /** ------------------ Detail Drawer content ------------------ **/
  const ProductDetail = () => {
    if (!detailProduct) return null;

    return (
      <>
        <div className="p-4 flex gap-4 items-start">
          <div className="w-40">
            <Avatar src={detailProduct.image} name={language === 'ar' ? detailProduct.name_ar : detailProduct.name} size="xl" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">{language === 'ar' ? detailProduct.name_ar : detailProduct.name}</h2>
            <p className="text-foreground/70">{detailProduct.sku} • {detailProduct.barcode}</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'الفئة' : 'Category'}</div>
                <div>{detailProduct.category?.name}</div>
              </div>

              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'العلامة التجارية' : 'Brand'}</div>
                <div>{detailProduct.brand?.name}</div>
              </div>

              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'السعر الأساسي' : 'Base Price'}</div>
                <div>{detailProduct.price}</div>
              </div>

              <div>
                <div className="text-sm text-foreground/60">{language === 'ar' ? 'السعر الخاص' : 'Special Price'}</div>
                <div>{detailProduct.special_price}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'مخزون حسب المستودع' : 'Stock per Warehouse'}</h3>
          <Table classNames={{ table: 'min-w-full text-base' }}>
            <TableHeader>
              <TableColumn>{language === 'ar' ? 'المستودع' : 'Warehouse'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'المتاحة' : 'Available'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'المحجوزة' : 'Reserved'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'التالفة' : 'Damaged'}</TableColumn>
              <TableColumn>{language === 'ar' ? 'المنتهية' : 'Expired'}</TableColumn>
            </TableHeader>

            <TableBody>
              <TableRow>
                <TableCell>{language === 'ar' ? detailProduct.warehouse?.name_ar || detailProduct.warehouse?.name : detailProduct.warehouse?.name}</TableCell>
                <TableCell>{detailProduct.qty_available}</TableCell>
                <TableCell>{detailProduct.qty_reserved}</TableCell>
                <TableCell>{detailProduct.qty_damaged}</TableCell>
                <TableCell>{detailProduct.qty_expired}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="p-4">
          <Tabs selectedKey="movements" variant="underlined" color="primary">
            <Tab key="movements" title={language === 'ar' ? 'سجل الحركات' : 'Movements'}>
              <div className="p-3">
                {/* Placeholder movement list */}
                <Table>
                  <TableHeader>
                    <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'النوع' : 'Type'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'الكمية' : 'Qty'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'المستودع' : 'Warehouse'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'ملاحظة' : 'Note'}</TableColumn>
                  </TableHeader>

                  <TableBody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>{moment().subtract(i, 'days').format('DD MMM YYYY')}</TableCell>
                        <TableCell>{i % 2 === 0 ? (language === 'ar' ? 'IN' : 'IN') : (language === 'ar' ? 'OUT' : 'OUT')}</TableCell>
                        <TableCell>{Math.round(Math.random() * 10)}</TableCell>
                        <TableCell>{detailProduct.warehouse?.name}</TableCell>
                        <TableCell>{language === 'ar' ? 'ملاحظة' : 'Note'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="batches" title={language === 'ar' ? 'دفعات الصلاحية' : 'Batches'}>
              <div className="p-3">
                <Table>
                  <TableHeader>
                    <TableColumn>{language === 'ar' ? 'رقم الدفعة' : 'Batch No'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'الكمية' : 'Qty'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {detailProduct.batches?.map((b: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{b.batch_no}</TableCell>
                        <TableCell>{b.qty}</TableCell>
                        <TableCell>{b.expiry}</TableCell>
                        <TableCell>{moment(b.expiry).isBefore(moment()) ? <Chip size="sm" color="danger" variant="flat">{language === 'ar' ? 'منتهي' : 'Expired'}</Chip> : <Chip size="sm" color="warning" variant="flat">{language === 'ar' ? 'قريب' : 'Near'}</Chip>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="reserved_orders" title={language === 'ar' ? 'الأوامر المحجوزة' : 'Reserved Sales'}>
              <div className="p-3">
                <Table>
                  <TableHeader>
                    <TableColumn>{language === 'ar' ? 'رقم الأمر' : 'Order No'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'الكمية' : 'Qty'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
                    <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
                  </TableHeader>

                  <TableBody>
                    {/* Should be populated by API reserved orders for this product */}
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>{`SO-${3000 + i}`}</TableCell>
                        <TableCell>{Math.round(Math.random() * 5)}</TableCell>
                        <TableCell>{language === 'ar' ? 'مفتوح' : 'Open'}</TableCell>
                        <TableCell>{moment().subtract(i, 'days').format('DD MMM YYYY')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>
          </Tabs>
        </div>
      </>
    );
  };

  /** ------------------ Effects ------------------ **/
  useEffect(() => {
    fetchAuxiliary();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [page, search, warehouseFilter, categoryFilter, brandFilter, stockStatusFilter, language]);

  /** ------------------ Form save handler (creates or updates) ------------------ **/
  const saveData = async () => {
    setLoadingForm(true);
    try {
      // validate minimal fields
      if (!formData.name && !formData.name_ar) {
        setSubmitError(language === 'ar' ? 'اسم المنتج مطلوب' : 'Product name required');
        return;
      }
      setSubmitError([]);

      if (isEditing && formData.id) {
        await updateItem(formData.id, formData);
      } else {
        await createItem(formData);
      }
    } finally {
      setLoadingForm(false);
    }
  };

  /** ------------------ Render page ------------------ **/
  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">

        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">
              {language === 'ar' ? 'نظام المخزون' : 'INVENTORY MANAGEMENT'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-text">
              {language === 'ar' ? 'إدارة المخزون' : 'Warehouse Management'}
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
                editModal.onOpen();
              }}
            >
              {language === 'ar' ? 'جديد' : 'New'}
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
                    setWarehouseFilter('all');
                    setCategoryFilter('all');
                    setBrandFilter('all');
                    setStockStatusFilter('all');
                  }}
                  variant="underlined"
                  color="primary"
                >
                  <Tab
                    key="inventory"
                    title={<div className="flex items-center gap-2">
                      <ClipboardDocumentListIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'المخزون' : 'Inventory'}</span>
                    </div>}
                  >
                    {renderInventoryTable()}
                  </Tab>

                  <Tab
                    key="stock_count"
                    title={<div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'الجرد' : 'Stock Count'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <p className="text-sm">{language === 'ar' ? 'قم بفتح نافذة الجرد لإجراء عملية الجرد وحفظ النتائج' : 'Open Stock Count modal to perform count and submit differences.'}</p>
                      <div className="mt-4">
                        <Button onPress={() => stockCountModal.onOpen()}>{language === 'ar' ? 'فتح الجرد' : 'Open Stock Count'}</Button>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="expiry"
                    title={<div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'صلاحية' : 'Expiry Dashboard'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <p className="text-sm">{language === 'ar' ? 'لوحة إدارة الصلاحيات' : 'Expiry management and batches overview'}</p>
                      <div className="mt-4">
                        <Button onPress={() => expiryModal.onOpen()}>{language === 'ar' ? 'عرض الصلاحيات' : 'Open Expiry Dashboard'}</Button>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="returns"
                    title={<div className="flex items-center gap-2">
                      <BanknotesIcon className="h-5 w-5" />
                      <span>{language === 'ar' ? 'مرتجعات' : 'Returns & Damages'}</span>
                    </div>}
                  >
                    <div className="p-4">
                      <p className="text-sm">{language === 'ar' ? 'ادارة المرتجعات والمواد التالفة' : 'Manage returns and damaged items'}</p>
                      <div className="mt-4">
                        <Button onPress={() => returnsModal.onOpen()}>{language === 'ar' ? 'عرض المرتجعات' : 'Open Returns'}</Button>
                      </div>
                    </div>
                  </Tab>

                </Tabs>
              </CardBody>
            </Card>
          </div>

          <aside className="lg:col-span-1">
            <AlertsPanel />
          </aside>
        </div>
      </div>

      {/* ------------------ Edit / Create Modal ------------------ */}
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
                {isEditing ? (language === 'ar' ? 'تحرير صنف' : 'Edit Item') : (language === 'ar' ? 'إضافة صنف جديد' : 'Add New Item')}
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      label={language === 'ar' ? 'اسم المنتج (عربي)' : 'Product Name (AR)'}
                      variant="faded"
                      value={formData.name_ar || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                    />

                    <Input
                      label={language === 'ar' ? 'اسم المنتج (انجليزي)' : 'Product Name (EN)'}
                      variant="faded"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />

                    <Input
                      label="SKU"
                      variant="faded"
                      value={formData.sku || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    />

                    <Input
                      label={language === 'ar' ? 'الباركود' : 'Barcode'}
                      variant="faded"
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    />

                    <Select
                      label={language === 'ar' ? 'المستودع' : 'Warehouse'}
                      selectedKeys={[String(formData.warehouse_id || 'all')]}
                      onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: e.target.value }))}
                      variant="faded"
                    >
                      <SelectItem key="all">{language === 'ar' ? 'اختر' : 'Select'}</SelectItem>
                      {warehouses.map(w => <SelectItem key={w.id}>{language === 'ar' ? w.name_ar || w.name : w.name}</SelectItem>)}
                    </Select>

                    <Select
                      label={language === 'ar' ? 'التصنيف' : 'Category'}
                      selectedKeys={[String(formData.category?.id || 'all')]}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: categories.find(c => String(c.id) === e.target.value) }))}
                      variant="faded"
                    >
                      {categories.map(c => <SelectItem key={c.id}>{c.name}</SelectItem>)}
                    </Select>

                    <Select
                      label={language === 'ar' ? 'العلامة التجارية' : 'Brand'}
                      selectedKeys={[String(formData.brand?.id || 'all')]}
                      onChange={(e) => setFormData(prev => ({ ...prev, brand: brands.find(b => String(b.id) === e.target.value) }))}
                      variant="faded"
                    >
                      {brands.map(b => <SelectItem key={b.id}>{b.name}</SelectItem>)}
                    </Select>

                    <Input
                      label={language === 'ar' ? 'الكمية المتاحة' : 'Qty Available'}
                      type="number"
                      variant="faded"
                      value={formData.qty_available || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, qty_available: Number(e.target.value) }))}
                    />

                    <Input
                      label={language === 'ar' ? 'الحد الأدنى للمخزون' : 'Min Stock'}
                      type="number"
                      variant="faded"
                      value={formData.min_stock || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_stock: Number(e.target.value) }))}
                    />

                    <Input
                      label={language === 'ar' ? 'السعر' : 'Price'}
                      type="number"
                      variant="faded"
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    />

                    <Textarea
                      label={language === 'ar' ? 'ملاحظة' : 'Note'}
                      variant="faded"
                      value={formData.note || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    />
                  </div>

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

      {/* ------------------ delete modal ------------------ */}
      <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange} size="sm" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</ModalHeader>
              <ModalBody>{language === 'ar' ? 'هل أنت متأكد من حذف هذا الصنف؟' : 'Are you sure to delete this item?'}</ModalBody>

              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                <Button color="danger" onPress={() => { deleteItem(deleteTarget?.id); deleteModal.onClose(); }}>
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ------------------ Product Detail Drawer ------------------ */}
      <Drawer isOpen={productDrawer.isOpen} onOpenChange={productDrawer.onOpenChange} size="lg" placement="right">
        <DrawerContent className="bg-content1/95">
          <DrawerBody>
            {ProductDetail()}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* ------------------ Stock Count Modal ------------------ */}
      <Modal isOpen={stockCountModal.isOpen} onOpenChange={stockCountModal.onOpenChange} size="xl" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'شاشة الجرد' : 'Stock Count'}</ModalHeader>

              <Form onSubmit={(e) => { e.preventDefault(); submitStockCount({ warehouse: stockCountWarehouse, type: stockCountType, lines: stockCountData }); }}>
                <ModalBody className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Select
                      label={language === 'ar' ? 'المستودع' : 'Warehouse'}
                      selectedKeys={[String(stockCountWarehouse)]}
                      onChange={(e) => setStockCountWarehouse(e.target.value)}
                      variant="faded"
                    >
                      <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                      {warehouses.map(w => <SelectItem key={w.id}>{language === 'ar' ? w.name_ar || w.name : w.name}</SelectItem>)}
                    </Select>

                    <Select
                      label={language === 'ar' ? 'نوع الجرد' : 'Type'}
                      selectedKeys={[stockCountType]}
                      onChange={(e) => setStockCountType(e.target.value as any)}
                      variant="faded"
                    >
                      <SelectItem key="full">{language === 'ar' ? 'كامل' : 'Full'}</SelectItem>
                      <SelectItem key="partial">{language === 'ar' ? 'جزئي' : 'Partial'}</SelectItem>
                    </Select>

                    <Input
                      label={language === 'ar' ? 'بحث' : 'Search'}
                      variant="faded"
                      startContent={<MagnifyingGlassIcon className="h-5 w-5" />}
                      onChange={(e) => {
                        // For demo, we populate stockCountData with filtered inventory
                        const s = e.target.value.toLowerCase();
                        const lines = MOCK_INVENTORY.filter(it => `${it.name} ${it.name_ar} ${it.sku}`.toLowerCase().includes(s)).slice(0, 20).map(it => ({
                          id: it.id,
                          product: language === 'ar' ? it.name_ar : it.name,
                          qty_system: it.qty_available,
                          qty_counted: it.qty_available,
                          diff: 0,
                          note: ''
                        }));
                        setStockCountData(lines);
                      }}
                    />
                  </div>

                  <div>
                    <Table>
                      <TableHeader>
                        <TableColumn>{language === 'ar' ? 'المنتج' : 'Product'}</TableColumn>
                        <TableColumn>{language === 'ar' ? 'الكمية في النظام' : 'System Qty'}</TableColumn>
                        <TableColumn>{language === 'ar' ? 'الكمية الفعلية' : 'Actual Qty'}</TableColumn>
                        <TableColumn>{language === 'ar' ? 'الفارق' : 'Difference'}</TableColumn>
                        <TableColumn>{language === 'ar' ? 'ملاحظات' : 'Notes'}</TableColumn>
                      </TableHeader>

                      <TableBody emptyContent={language === 'ar' ? 'لا توجد أسطر' : 'No lines'}>
                        {stockCountData.map((line, idx) => (
                          <TableRow key={line.id || idx}>
                            <TableCell>{line.product}</TableCell>
                            <TableCell>{line.qty_system}</TableCell>
                            <TableCell>
                              <Input
                                variant="faded"
                                value={line.qty_counted}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setStockCountData(prev => prev.map(p => p.id === line.id ? ({ ...p, qty_counted: val, diff: val - p.qty_system }) : p));
                                }}
                              />
                            </TableCell>
                            <TableCell>{line.diff}</TableCell>
                            <TableCell>
                              <Input variant="faded" value={line.note || ''} onChange={(e) => setStockCountData(prev => prev.map(p => p.id === line.id ? ({ ...p, note: e.target.value }) : p))} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                </ModalBody>

                <ModalFooter>
                  <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
                  <Button type="submit" color="primary">{language === 'ar' ? 'إرسال للمراجعة' : 'Submit for Review'}</Button>
                </ModalFooter>
              </Form>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ------------------ Expiry Modal ------------------ */}
      <Modal isOpen={expiryModal.isOpen} onOpenChange={expiryModal.onOpenChange} size="xl" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'لوحة الصلاحية' : 'Expiry Dashboard'}</ModalHeader>

              <ModalBody>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Select label={language === 'ar' ? 'المستودع' : 'Warehouse'} selectedKeys={[expiryFilters.warehouse]} onChange={(e) => setExpiryFilters(prev => ({ ...prev, warehouse: e.target.value }))}>
                    <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    {warehouses.map(w => <SelectItem key={w.id}>{language === 'ar' ? w.name_ar || w.name : w.name}</SelectItem>)}
                  </Select>

                  <Input label={language === 'ar' ? 'من تاريخ' : 'Date From'} variant="faded" value={expiryFilters.dateFrom} onChange={(e) => setExpiryFilters(prev => ({ ...prev, dateFrom: e.target.value }))} />
                  <Input label={language === 'ar' ? 'إلى تاريخ' : 'Date To'} variant="faded" value={expiryFilters.dateTo} onChange={(e) => setExpiryFilters(prev => ({ ...prev, dateTo: e.target.value }))} />
                </div>

                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableColumn>{language === 'ar' ? 'المنتج' : 'Product'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'رقم الدفعة' : 'Batch No'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'الكمية' : 'Qty'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
                    </TableHeader>

                    <TableBody emptyContent={language === 'ar' ? 'لا توجد بيانات' : 'No data'}>
                      {expiryData.length ? expiryData.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.product}</TableCell>
                          <TableCell>{r.batch_no}</TableCell>
                          <TableCell>{r.expiry}</TableCell>
                          <TableCell>{r.qty}</TableCell>
                          <TableCell>{r.status}</TableCell>
                        </TableRow>
                      )) : (
                        // fallback demo rows
                        Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>{`Product ${i+1}`}</TableCell>
                            <TableCell>{`BATCH-${i}`}</TableCell>
                            <TableCell>{moment().add(i * 5, 'days').format('YYYY-MM-DD')}</TableCell>
                            <TableCell>{Math.round(Math.random()*20)}</TableCell>
                            <TableCell>{i % 2 === 0 ? (language === 'ar' ? 'قريب' : 'Near') : (language === 'ar' ? 'منتهي' : 'Expired')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ModalBody>

              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ------------------ Returns Modal ------------------ */}
      <Modal isOpen={returnsModal.isOpen} onOpenChange={returnsModal.onOpenChange} size="xl" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'المرتجعات والمواد التالفة' : 'Returns & Damages'}</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Select label={language === 'ar' ? 'النوع' : 'Type'} selectedKeys={[returnsFilter]} onChange={(e) => setReturnsFilter(e.target.value)}>
                    <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    <SelectItem key="damaged">{language === 'ar' ? 'تالف' : 'Damaged'}</SelectItem>
                    <SelectItem key="expired">{language === 'ar' ? 'منتهي' : 'Expired'}</SelectItem>
                    <SelectItem key="customer_return">{language === 'ar' ? 'مرتجع عميل' : 'Customer Return'}</SelectItem>
                    <SelectItem key="unsold">{language === 'ar' ? 'غير مباع' : 'Unsold'}</SelectItem>
                  </Select>
                </div>

                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableColumn>{language === 'ar' ? 'المنتج' : 'Product'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'الكمية' : 'Qty'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'النوع' : 'Type'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'المستودع' : 'Warehouse'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
                      <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
                    </TableHeader>

                    <TableBody emptyContent={language === 'ar' ? 'لا توجد بيانات' : 'No data'}>
                      {returnsData.length ? returnsData.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.product}</TableCell>
                          <TableCell>{r.qty}</TableCell>
                          <TableCell>{r.type}</TableCell>
                          <TableCell>{r.warehouse}</TableCell>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.status}</TableCell>
                        </TableRow>
                      )) : (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>{`Product ${i+1}`}</TableCell>
                            <TableCell>{Math.round(Math.random()*10)}</TableCell>
                            <TableCell>{i%2===0 ? (language === 'ar' ? 'تالف' : 'Damaged') : (language === 'ar' ? 'مرتجع' : 'Return')}</TableCell>
                            <TableCell>{MOCK_WAREHOUSES[i % MOCK_WAREHOUSES.length].name}</TableCell>
                            <TableCell>{moment().subtract(i, 'days').format('DD MMM YYYY')}</TableCell>
                            <TableCell>{language === 'ar' ? 'مراجع' : 'Reviewed'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ModalBody>

              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

    </div>
  );
}
