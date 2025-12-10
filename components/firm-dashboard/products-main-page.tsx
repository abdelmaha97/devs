'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  CardBody,
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

type Product = {
  id: number;
  tenant_id: number;
  sku: string;
  barcode?: string | null;
  product_name: string;
  product_name_ar?: string | null;
  category?: string | null;
  category_ar?: string | null;
  base_price?: number | null;
  created_at?: string | null;
};

type ProductForm = Omit<Product, 'id' | 'tenant_id' | 'created_at'> & { id?: number; tenant_id?: number };

const pageSize = 6;

export default function ProductsPage() {
  const { language } = useLanguage();
  const t = (key: string, vars?: Record<string, string>) => {
    const value = lang(language, key);
    if (!vars) return value;
    return Object.keys(vars).reduce((acc, token) => acc.replace(`{{${token}}}`, vars[token]), value);
  };
  const isRTL = language === 'ar';

  // بيانات تجريبية مؤقتة تعرض قبل عمل API
  const seededProducts: Product[] = [
    {
      id: 1,
      tenant_id: 1,
      sku: 'PRD-1001',
      barcode: '6281001234567',
      product_name: 'Chocolate Bar',
      product_name_ar: 'لوح شوكولاتة',
      category: 'Snacks',
      category_ar: 'الوجبات الخفيفة',
      base_price: 3.5,
      created_at: '2025-01-01',
    },
    {
      id: 2,
      tenant_id: 1,
      sku: 'PRD-1002',
      barcode: '6281009876543',
      product_name: 'Bottled Water',
      product_name_ar: 'مياه معبأة',
      category: 'Beverages',
      category_ar: 'مشروبات',
      base_price: 0.75,
      created_at: '2025-02-10',
    },
  ];

  const [products, setProducts] = useState<Product[]>(seededProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductForm>({
    sku: '',
    barcode: '',
    product_name: '',
    product_name_ar: '',
    category: '',
    category_ar: '',
    base_price: 0,
    tenant_id: undefined,
  });

  const viewModal = useDisclosure();
  const editModal = useDisclosure();

  const API_BASE = '/api/products';

  // ---------- API helpers ----------
  async function fetchProductsFromApi() {
    setLoading(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : seededProducts);
    } catch (err) {
      // fallback to seeded
      setProducts(seededProducts);
    } finally {
      setLoading(false);
    }
  }

  async function createProductApi(payload: ProductForm) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Create failed');
      const created: Product = await res.json();
      return created;
    } catch (err) {
      // fallback محلي
      const fallback: Product = {
        id: Date.now(),
        tenant_id: payload.tenant_id ?? 1,
        sku: payload.sku,
        barcode: payload.barcode ?? '',
        product_name: payload.product_name,
        product_name_ar: payload.product_name_ar ?? '',
        category: payload.category ?? '',
        category_ar: payload.category_ar ?? '',
        base_price: payload.base_price ?? 0,
        created_at: new Date().toISOString(),
      };
      return fallback;
    }
  }

  async function updateProductApi(id: number, payload: ProductForm) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH', // كما طلبت استخدام PATCH
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated: Product = await res.json();
      return updated;
    } catch (err) {
      // fallback محلي
      const fallback: Product = {
        id,
        tenant_id: payload.tenant_id ?? 1,
        sku: payload.sku,
        barcode: payload.barcode ?? '',
        product_name: payload.product_name,
        product_name_ar: payload.product_name_ar ?? '',
        category: payload.category ?? '',
        category_ar: payload.category_ar ?? '',
        base_price: payload.base_price ?? 0,
        created_at: new Date().toISOString(),
      };
      return fallback;
    }
  }

  async function deleteProductApi(id: number) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Delete failed');
      return true;
    } catch (err) {
      // fallback محلي: نعيد true حتى تتم العملية محلياً
      return true;
    }
  }

  // ---------- lifecycle ----------
  useEffect(() => {
    fetchProductsFromApi();
  }, []);

  useEffect(() => {
    setProducts(seededProducts);
  }, [language]);

  // ---------- filtering / pagination ----------
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !term ||
        p.sku.toLowerCase().includes(term) ||
        p.product_name.toLowerCase().includes(term) ||
        (p.product_name_ar ?? '').toLowerCase().includes(term) ||
        (p.barcode ?? '').toLowerCase().includes(term) ||
        (p.category ?? '').toLowerCase().includes(term);
      const matchesCategory = categoryFilter === 'all' || (p.category ?? '') === categoryFilter;
      const matchesDate =
        (!dateFrom && !dateTo) ||
        (() => {
          if (!p.created_at) return true;
          const created = new Date(p.created_at);
          if (dateFrom && created < new Date(dateFrom)) return false;
          if (dateTo && created > new Date(dateTo)) return false;
          return true;
        })();
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [products, search, categoryFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  useEffect(() => setPage(1), [search, categoryFilter, dateFrom, dateTo]);
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page]);

  // ---------- form / actions ----------
  const resetForm = () => {
    setFormData({
      sku: '',
      barcode: '',
      product_name: '',
      product_name_ar: '',
      category: '',
      category_ar: '',
      base_price: 0,
      tenant_id: undefined,
    });
  };

  const openCreateProduct = () => {
    setIsEditing(false);
    resetForm();
    editModal.onOpen();
  };

  const openEditProduct = (product: Product) => {
    setIsEditing(true);
    setFormData({
      id: product.id,
      tenant_id: product.tenant_id,
      sku: product.sku,
      barcode: product.barcode ?? '',
      product_name: product.product_name,
      product_name_ar: product.product_name_ar ?? '',
      category: product.category ?? '',
      category_ar: product.category_ar ?? '',
      base_price: product.base_price ?? 0,
    });
    editModal.onOpen();
  };

  const handleDeleteProduct = async (id: number) => {
    if (window.confirm(t('products.delete.confirmation'))) {
      const ok = await deleteProductApi(id);
      if (ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      } else {
        // لاحقاً: عرض رسالة خطأ
      }
    }
  };

  const saveProduct = async () => {
    if (!formData.sku || !formData.sku.trim()) return;
    if (!formData.product_name || !formData.product_name.trim()) return;

    const payload: ProductForm = {
      tenant_id: formData.tenant_id ?? 1,
      sku: formData.sku,
      barcode: formData.barcode ?? '',
      product_name: formData.product_name,
      product_name_ar: formData.product_name_ar ?? '',
      category: formData.category ?? '',
      category_ar: formData.category_ar ?? '',
      base_price: formData.base_price ?? 0,
    };

    if (isEditing && formData.id) {
      const updated = await updateProductApi(formData.id, payload);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const created = await createProductApi(payload);
      setProducts((prev) => [...prev, created]);
    }

    editModal.onClose();
    resetForm();
  };

  // ---------- helper: unique categories for filter ----------
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">
        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">{t('products.hero.tag')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">{t('products.hero.title')}</h1>
          </div>
          <Button
            variant="solid"
            color="primary"
            startContent={<PlusIcon className="h-4 w-4" />}
            onPress={openCreateProduct}
          >
            {t('products.hero.button_new')}
          </Button>
        </section>

        <Table
          aria-label={t('products.table.aria')}
          classNames={{ table: 'min-w-full text-base' }}
          topContent={
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Input
                  radius="lg"
                  label={t('products.search.placeholder')}
                  variant="faded"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-[240px]"
                />

                <Select
                  radius="lg"
                  variant="faded"
                  label={t('products.filter.category')}
                  selectedKeys={[categoryFilter]}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="min-w-[220px]"
                >
                  <SelectItem key="all">{t('products.filter.category_all')}</SelectItem>
                  {uniqueCategories.map((c) => (
                    <SelectItem key={c}>{language === 'ar' ? c : c}</SelectItem>
                  ))}
                </Select>

                <div className="flex items-center gap-2">
                  <Input
                    radius="lg"
                    variant="faded"
                    label={t('products.filter.date_from')}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="min-w-[160px]"
                  />
                  <Input
                    radius="lg"
                    variant="faded"
                    label={t('products.filter.date_to')}
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="min-w-[160px]"
                  />
                </div>
              </div>
              <span className="text-sm text-foreground/70">
                {t('products.table.results', { count: filteredProducts.length.toString() })}
              </span>
            </div>
          }
          bottomContent={
            <div className="flex flex-col gap-3 px-2 py-2 text-sm md:flex-row md:items-center md:justify-between">
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button size="sm" variant="flat" onPress={() => setPage((prev) => Math.max(prev - 1, 1))} isDisabled={page === 1}>
                  {t('products.pagination.prev')}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  isDisabled={page === totalPages || filteredProducts.length === 0}
                >
                  {t('products.pagination.next')}
                </Button>
              </div>
              <span className="text-xs text-foreground/60">
                {t('products.pagination.page', { page: page.toString(), total: totalPages.toString() })}
              </span>
              <Pagination page={page} total={totalPages} onChange={setPage} showControls color="primary" size="sm" isDisabled={filteredProducts.length === 0} />
            </div>
          }
        >
          <TableHeader>
            <TableColumn>{t('products.table.column.id')}</TableColumn>
            <TableColumn>{t('products.table.column.sku')}</TableColumn>
            <TableColumn>{t('products.table.column.name')}</TableColumn>
            <TableColumn>{t('products.table.column.name_ar')}</TableColumn>
            <TableColumn>{t('products.table.column.category')}</TableColumn>
            <TableColumn>{t('products.table.column.barcode')}</TableColumn>
            <TableColumn>{t('products.table.column.base_price')}</TableColumn>
            <TableColumn>{t('products.table.column.created_at')}</TableColumn>
            <TableColumn className="text-center">{t('products.table.column.actions')}</TableColumn>
          </TableHeader>

          <TableBody emptyContent={t('products.table.empty')}>
            {paginatedProducts.map((product) => (
              <TableRow key={product.id} className="hover:bg-content2/60">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" radius="lg" name={product.product_name} className="bg-primary/10 text-primary" />
                    <div>
                      <p className="font-semibold text-text">{product.sku}</p>
                      {product.created_at && <p className="text-xs text-foreground/60">{new Date(product.created_at).toLocaleDateString()}</p>}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">{product.sku}</div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">{language === 'ar' ? (product.product_name_ar || product.product_name) : product.product_name}</div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">{product.product_name_ar ?? ''}</div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">{(product.category ?? '') + (product.category_ar ? ` / ${product.category_ar}` : '')}</div>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">{product.barcode ?? ''}</div>
                </TableCell>

                <TableCell>
                  <Chip size="sm" variant="flat">{(product.base_price ?? 0).toFixed(2)}</Chip>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-foreground/70">{product.created_at ? new Date(product.created_at).toLocaleDateString() : ''}</div>
                </TableCell>

                <TableCell>
                  <div className={`flex items-center justify-${isRTL ? 'start' : 'end'} gap-2`}>
                    <Button isIconOnly variant="light" radius="full" onPress={() => { setActiveProduct(product); viewModal.onOpen(); }}>
                      <EyeIcon className="h-5 w-5" />
                    </Button>
                    <Button isIconOnly variant="light" radius="full" onPress={() => openEditProduct(product)}>
                      <PencilSquareIcon className="h-5 w-5" />
                    </Button>
                    <Button isIconOnly variant="light" radius="full" color="danger" onPress={() => handleDeleteProduct(product.id)}>
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
            activeProduct && (
              <>
                <ModalHeader className="flex items-center gap-3">
                  <Avatar size="md" radius="lg" name={activeProduct.product_name} />
                  <div>
                    <p className="text-lg font-semibold">{language === 'ar' ? (activeProduct.product_name_ar || activeProduct.product_name) : activeProduct.product_name}</p>
                    <p className="text-sm text-foreground/70">{activeProduct.sku}</p>
                  </div>
                </ModalHeader>

                <ModalBody className="space-y-4">
                  <Divider />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground/60">{t('products.modal.basic_info')}</p>
                    <div className="grid gap-2 md:grid-cols-2 mt-2">
                      <div>
                        <p className="text-xs text-foreground/60">{t('products.modal.sku')}</p>
                        <p className="text-sm">{activeProduct.sku}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/60">{t('products.modal.barcode')}</p>
                        <p className="text-sm">{activeProduct.barcode}</p>
                      </div>

                      <div>
                        <p className="text-xs text-foreground/60">{t('products.modal.category')}</p>
                        <p className="text-sm">{(activeProduct.category ?? '') + (activeProduct.category_ar ? ` / ${activeProduct.category_ar}` : '')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/60">{t('products.modal.base_price')}</p>
                        <p className="text-sm">{(activeProduct.base_price ?? 0).toFixed(2)}</p>
                      </div>

                      <div>
                        <p className="text-xs text-foreground/60">{t('products.modal.created_at')}</p>
                        <p className="text-sm">{activeProduct.created_at ? new Date(activeProduct.created_at).toLocaleString() : ''}</p>
                      </div>
                    </div>
                  </div>

                  <Divider />

                  {/* Additional sections (placeholders) */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardBody>
                        <p className="font-semibold">{t('products.extra.images')}</p>
                        <p className="text-sm text-foreground/60 mt-2">{t('products.extra.images_hint')}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="flat">{t('products.extra.add_image')}</Button>
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <p className="font-semibold">{t('products.extra.stock')}</p>
                        <p className="text-sm text-foreground/60 mt-2">{t('products.extra.stock_hint')}</p>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <p className="font-semibold">{t('products.extra.units')}</p>
                        <p className="text-sm text-foreground/60 mt-2">{t('products.extra.units_hint')}</p>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <p className="font-semibold">{t('products.extra.price_lists')}</p>
                        <p className="text-sm text-foreground/60 mt-2">{t('products.extra.price_lists_hint')}</p>
                      </CardBody>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardBody>
                        <p className="font-semibold">{t('products.extra.specs')}</p>
                        <p className="text-sm text-foreground/60 mt-2">{t('products.extra.specs_hint')}</p>
                      </CardBody>
                    </Card>
                  </div>
                </ModalBody>

                <ModalFooter>
                  <Button radius="lg" variant="light" onPress={viewModal.onClose}>
                    {t('products.modal.close')}
                  </Button>
                </ModalFooter>
              </>
            )
          )}
        </ModalContent>
      </Modal>

      {/* Edit / Create Modal */}
      <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="xl" scrollBehavior="inside" backdrop="blur">
        <ModalContent className="bg-content1/95">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">{isEditing ? t('products.form.edit_title') : t('products.form.create_title')}</ModalHeader>
              <ModalBody className="space-y-4">
                <Input
                  label={t('products.form.sku')}
                  variant="faded"
                  radius="lg"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                />
                <Input
                  label={t('products.form.product_name')}
                  variant="faded"
                  radius="lg"
                  value={formData.product_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, product_name: e.target.value }))}
                />
                <Input
                  label={t('products.form.product_name_ar')}
                  variant="faded"
                  radius="lg"
                  value={formData.product_name_ar || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, product_name_ar: e.target.value }))}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={t('products.form.category')}
                    variant="faded"
                    radius="lg"
                    value={formData.category || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  />
                  <Input
                    label={t('products.form.category_ar')}
                    variant="faded"
                    radius="lg"
                    value={formData.category_ar || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category_ar: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={t('products.form.barcode')}
                    variant="faded"
                    radius="lg"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                  />
                  <Input
                    label={t('products.form.base_price')}
                    variant="faded"
                    radius="lg"
                    type="number"
                    value={String(formData.base_price ?? 0)}
                    onChange={(e) => setFormData((prev) => ({ ...prev, base_price: Number(e.target.value) }))}
                  />
                </div>

                <Textarea
                  label={t('products.form.notes')}
                  variant="faded"
                  radius="lg"
                  minRows={3}
                  value={''}
                  onChange={() => {}}
                />
              </ModalBody>

              <ModalFooter>
                <Button variant="light" radius="lg" onPress={() => { onClose(); resetForm(); }}>
                  {t('products.form.cancel')}
                </Button>
                <Button color="primary" radius="lg" onPress={saveProduct}>
                  {t('products.form.save')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
