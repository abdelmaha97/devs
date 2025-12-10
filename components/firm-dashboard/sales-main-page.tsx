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
  ClipboardDocumentListIcon, DocumentTextIcon, BanknotesIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/solid';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';
import { TableSkeleton } from "@/lib/Skeletons";
import moment from 'moment';

const pageSize = 6;

export default function SalesPage() {
  const { language } = useLanguage();
  const t = (key: string) => lang(language, key);

  const [activeTab, setActiveTab] = useState('sales_orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string[] | string>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const editModal = useDisclosure();
  const deleteModal = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  /** ------------------ بيانات افتراضية ------------------ **/
  const MOCK_CUSTOMERS = [
    { id: 1, name: 'Ali', name_ar: 'علي' },
    { id: 2, name: 'Sara', name_ar: 'سارة' },
    { id: 3, name: 'Omar', name_ar: 'عمر' }
  ];

  const MOCK_DATA: any = {
    sales_orders: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      order_no: `SO-${1000 + i}`,
      customer_id: (i % 3) + 1,
      customer_name: MOCK_CUSTOMERS[i % 3].name,
      customer_name_ar: MOCK_CUSTOMERS[i % 3].name_ar,
      total: (Math.random() * 900 + 100).toFixed(2),
      status: ['draft','submitted','approved','invoiced','rejected'][i % 5],
      created_by: 'Admin'
    })),
    invoices: Array.from({ length: 18 }, (_, i) => ({
      id: i + 1,
      invoice_no: `INV-${2000 + i}`,
      customer_id: (i % 3) + 1,
      customer_name: MOCK_CUSTOMERS[i % 3].name,
      customer_name_ar: MOCK_CUSTOMERS[i % 3].name_ar,
      total: (Math.random() * 1000).toFixed(2),
      paid: (Math.random() * 800).toFixed(2),
      balance: (Math.random() * 200).toFixed(2),
      status: ['paid','partially_paid','unpaid'][i % 3]
    })),
    payments: Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      invoice_id: (i % 18) + 1,
      invoice_no: `INV-${2000 + (i % 18)}`,
      amount: (Math.random() * 500).toFixed(2),
      payment_method: ['cash','credit','bank_transfer','pos'][i % 4],
      reference_number: `REF-${3000 + i}`,
      created_at: new Date()
    })),
    ledger: Array.from({ length: 14 }, (_, i) => ({
      id: i + 1,
      date: new Date(),
      type: ['invoice','payment'][i % 2],
      description: `Entry ${i+1}`,
      debit: (Math.random() * 500).toFixed(2),
      credit: (Math.random() * 500).toFixed(2),
      balance: (Math.random() * 1000).toFixed(2)
    }))
  };

  /** ------------------ محاكاة استدعاء API ------------------ **/
  const fetchData = async () => {
    setLoading(true);
    try {
      let tabData = [...MOCK_DATA[activeTab]];

      if (search) {
        tabData = tabData.filter((row: any) =>
          Object.values(row).some((value: any) =>
            String(value).toLowerCase().includes(search.toLowerCase())
          )
        );
      }

      if (statusFilter !== 'all') {
        if (activeTab === 'sales_orders' || activeTab === 'invoices') {
          tabData = tabData.filter((row) => row.status === statusFilter);
        }
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

  const fetchCustomers = async () => {
    setCustomers(MOCK_CUSTOMERS);
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
  const statusChip = (status: string, type: 'order' | 'invoice') => {
    if (type === 'order') {
      const colors: any = {
        draft: 'default',
        submitted: 'warning',
        approved: 'success',
        invoiced: 'primary',
        rejected: 'danger'
      };
      const labels: any = {
        draft: language === 'ar' ? 'مسودة' : 'Draft',
        submitted: language === 'ar' ? 'مقدم' : 'Submitted',
        approved: language === 'ar' ? 'موافق عليه' : 'Approved',
        invoiced: language === 'ar' ? 'مفوتر' : 'Invoiced',
        rejected: language === 'ar' ? 'مرفوض' : 'Rejected'
      };
      return <Chip size="sm" color={colors[status]} variant="flat">{labels[status]}</Chip>;
    }

    const colors: any = { paid: 'success', partially_paid: 'warning', unpaid: 'danger' };
    const labels: any = {
      paid: language === 'ar' ? 'مدفوعة' : 'Paid',
      partially_paid: language === 'ar' ? 'مدفوعة جزئيًا' : 'Partially Paid',
      unpaid: language === 'ar' ? 'غير مدفوعة' : 'Unpaid'
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
        {activeTab !== 'ledger' && activeTab !== 'payments' && (
          <Select
            variant="faded"
            label={language === 'ar' ? 'الحالة' : 'Status'}
            selectedKeys={[statusFilter]}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="min-w-[150px]"
          >
            <SelectItem key="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>

            {activeTab === 'sales_orders' && (
              <>
                <SelectItem key="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</SelectItem>
                <SelectItem key="submitted">{language === 'ar' ? 'مقدم' : 'Submitted'}</SelectItem>
                <SelectItem key="approved">{language === 'ar' ? 'موافق عليه' : 'Approved'}</SelectItem>
                <SelectItem key="invoiced">{language === 'ar' ? 'مفوتر' : 'Invoiced'}</SelectItem>
                <SelectItem key="rejected">{language === 'ar' ? 'مرفوض' : 'Rejected'}</SelectItem>
              </>
            )}

            {activeTab === 'invoices' && (
              <>
                <SelectItem key="paid">{language === 'ar' ? 'مدفوعة' : 'Paid'}</SelectItem>
                <SelectItem key="partially_paid">{language === 'ar' ? 'مدفوعة جزئيًا' : 'Partially Paid'}</SelectItem>
                <SelectItem key="unpaid">{language === 'ar' ? 'غير مدفوعة' : 'Unpaid'}</SelectItem>
              </>
            )}
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
    if (activeTab === 'sales_orders') {
      return (
        <Table
          aria-label="Sales Orders"
          classNames={{ table: 'min-w-full text-base' }}
          topContent={<TopContent />}
          bottomContent={<BottomContent />}
        >
          <TableHeader>
            <TableColumn>{language === 'ar' ? 'رقم الأمر' : 'Order No'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'العميل' : 'Customer'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'أنشئ بواسطة' : 'Created By'}</TableColumn>
            <TableColumn className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableColumn>
          </TableHeader>

          {loading ? (
            <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={6} />} />
          ) : (
            <TableBody emptyContent={language === 'ar' ? 'لا توجد بيانات' : 'No data'}>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.order_no}</TableCell>
                  <TableCell>{language === 'ar' ? item.customer_name_ar : item.customer_name}</TableCell>
                  <TableCell>{item.total}</TableCell>
                  <TableCell>{statusChip(item.status, 'order')}</TableCell>
                  <TableCell>{item.created_by}</TableCell>
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

    if (activeTab === 'invoices') {
      return (
        <Table
          aria-label="Invoices"
          classNames={{ table: 'min-w-full text-base' }}
          topContent={<TopContent />}
          bottomContent={<BottomContent />}
        >
          <TableHeader>
            <TableColumn>{language === 'ar' ? 'رقم الفاتورة' : 'Invoice No'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'العميل' : 'Customer'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'المدفوع' : 'Paid'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الرصيد' : 'Balance'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'الحالة' : 'Status'}</TableColumn>
            <TableColumn className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableColumn>
          </TableHeader>

          {loading ? (
            <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={7} />} />
          ) : (
            <TableBody emptyContent="No data">
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.invoice_no}</TableCell>
                  <TableCell>{language === 'ar' ? item.customer_name_ar : item.customer_name}</TableCell>
                  <TableCell>{item.total}</TableCell>
                  <TableCell>{item.paid}</TableCell>
                  <TableCell>{item.balance}</TableCell>
                  <TableCell>{statusChip(item.status, 'invoice')}</TableCell>

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

    if (activeTab === 'payments') {
      return (
        <Table
          aria-label="Payments"
          classNames={{ table: 'min-w-full text-base' }}
          topContent={<TopContent />}
          bottomContent={<BottomContent />}
        >
          <TableHeader>
            <TableColumn>{language === 'ar' ? 'رقم الفاتورة' : 'Invoice No'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'المرجع' : 'Reference'}</TableColumn>
            <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
            <TableColumn className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableColumn>
          </TableHeader>

          {loading ? (
            <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={6} />} />
          ) : (
            <TableBody emptyContent="No data">
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.invoice_no}</TableCell>
                  <TableCell>{item.amount}</TableCell>

                  <TableCell>
                    <Chip size="sm" variant="flat">
                      {item.payment_method}
                    </Chip>
                  </TableCell>

                  <TableCell>{item.reference_number}</TableCell>
                  <TableCell>{moment(item.created_at).format('DD MMM YYYY')}</TableCell>

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
        aria-label="Ledger"
        classNames={{ table: 'min-w-full text-base' }}
        topContent={<TopContent />}
        bottomContent={<BottomContent />}
      >
        <TableHeader>
          <TableColumn>{language === 'ar' ? 'التاريخ' : 'Date'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'النوع' : 'Type'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'الوصف' : 'Description'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'مدين' : 'Debit'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'دائن' : 'Credit'}</TableColumn>
          <TableColumn>{language === 'ar' ? 'الرصيد' : 'Balance'}</TableColumn>
        </TableHeader>

        {loading ? (
          <TableBody isLoading loadingContent={<TableSkeleton rows={6} columns={6} />} />
        ) : (
          <TableBody emptyContent="No data">
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{moment(item.date).format('DD MMM YYYY')}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">{item.type}</Chip>
                </TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{item.debit}</TableCell>
                <TableCell>{item.credit}</TableCell>
                <TableCell>{item.balance}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>
    );
  };

  /** ------------------ واجهة الصفحة ------------------ **/
  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, page, search, statusFilter, language]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-8">

        <section className="flex flex-col gap-4 pt-5 ring-1 ring-content2/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">
              {language === 'ar' ? 'نظام المبيعات' : 'SALES MANAGEMENT'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-text">
              {language === 'ar' ? 'إدارة المبيعات' : 'Sales Management'}
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

        <Card>
          <CardBody>
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => { 
                setActiveTab(key.toString());
                setPage(1);
                setSearch('');
                setStatusFilter('all');
              }}
              variant="underlined"
              color="primary"
            >
              <Tab
                key="sales_orders"
                title={<div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5" />
                  <span>{language === 'ar' ? 'أوامر البيع' : 'Sales Orders'}</span>
                </div>}
              >
                {renderTable()}
              </Tab>

              <Tab
                key="invoices"
                title={<div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5" />
                  <span>{language === 'ar' ? 'الفواتير' : 'Invoices'}</span>
                </div>}
              >
                {renderTable()}
              </Tab>

              <Tab
                key="payments"
                title={<div className="flex items-center gap-2">
                  <BanknotesIcon className="h-5 w-5" />
                  <span>{language === 'ar' ? 'المدفوعات' : 'Payments'}</span>
                </div>}
              >
                {renderTable()}
              </Tab>

              <Tab
                key="ledger"
                title={<div className="flex items-center gap-2">
                  <CurrencyDollarIcon className="h-5 w-5" />
                  <span>{language === 'ar' ? 'دفتر العميل' : 'Customer Ledger'}</span>
                </div>}
              >
                {renderTable()}
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>

      {/* ------------------ Modal ------------------ */}
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

                  {/* sales orders */}
                  {activeTab === 'sales_orders' && (
                    <>
                      <Autocomplete
                        label={language === 'ar' ? 'العميل' : 'Customer'}
                        variant="faded"
                        selectedKey={formData.customer_id}
                        onSelectionChange={(key) =>
                          setFormData((prev) => ({ ...prev, customer_id: key }))
                        }
                        isRequired
                      >
                        {customers.map((c) => (
                          <AutocompleteItem key={c.id}>
                            {language === 'ar' ? c.name_ar : c.name}
                          </AutocompleteItem>
                        ))}
                      </Autocomplete>

                      <Input
                        label={language === 'ar' ? 'الإجمالي' : 'Total'}
                        type="number"
                        variant="faded"
                        value={formData.total || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, total: e.target.value }))
                        }
                        isRequired
                      />

                      <Select
                        label={language === 'ar' ? 'الحالة' : 'Status'}
                        selectedKeys={[formData.status || 'draft']}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, status: e.target.value }))
                        }
                        variant="faded"
                      >
                        <SelectItem key="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</SelectItem>
                        <SelectItem key="submitted">{language === 'ar' ? 'مقدم' : 'Submitted'}</SelectItem>
                        <SelectItem key="approved">{language === 'ar' ? 'موافق عليه' : 'Approved'}</SelectItem>
                      </Select>
                    </>
                  )}

                  {/* invoices */}
                  {activeTab === 'invoices' && (
                    <>
                      <Autocomplete
                        label={language === 'ar' ? 'العميل' : 'Customer'}
                        variant="faded"
                        selectedKey={formData.customer_id}
                        onSelectionChange={(key) =>
                          setFormData((prev) => ({ ...prev, customer_id: key }))
                        }
                        isRequired
                      >
                        {customers.map((c) => (
                          <AutocompleteItem key={c.id}>
                            {language === 'ar' ? c.name_ar : c.name}
                          </AutocompleteItem>
                        ))}
                      </Autocomplete>

                      <Input
                        label={language === 'ar' ? 'الإجمالي' : 'Total'}
                        type="number"
                        variant="faded"
                        value={formData.total || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, total: e.target.value }))
                        }
                        isRequired
                      />

                      <Select
                        label={language === 'ar' ? 'الحالة' : 'Status'}
                        selectedKeys={[formData.status || 'unpaid']}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, status: e.target.value }))
                        }
                        variant="faded"
                      >
                        <SelectItem key="paid">{language === 'ar' ? 'مدفوعة' : 'Paid'}</SelectItem>
                        <SelectItem key="partially_paid">{language === 'ar' ? 'مدفوعة جزئيًا' : 'Partially Paid'}</SelectItem>
                        <SelectItem key="unpaid">{language === 'ar' ? 'غير مدفوعة' : 'Unpaid'}</SelectItem>
                      </Select>
                    </>
                  )}

                  {/* payments */}
                  {activeTab === 'payments' && (
                    <>
                      <Autocomplete
                        label={language === 'ar' ? 'رقم الفاتورة' : 'Invoice No'}
                        variant="faded"
                        selectedKey={formData.invoice_id}
                        onSelectionChange={(key) =>
                          setFormData((prev) => ({ ...prev, invoice_id: key }))
                        }
                        isRequired
                      >
                        {MOCK_DATA.invoices.map((inv) => (
                          <AutocompleteItem key={inv.id}>{inv.invoice_no}</AutocompleteItem>
                        ))}
                      </Autocomplete>

                      <Input
                        label={language === 'ar' ? 'المبلغ' : 'Amount'}
                        type="number"
                        variant="faded"
                        value={formData.amount || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, amount: e.target.value }))
                        }
                        isRequired
                      />

                      <Select
                        label={language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                        selectedKeys={[formData.payment_method || 'cash']}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, payment_method: e.target.value }))
                        }
                        variant="faded"
                      >
                        <SelectItem key="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</SelectItem>
                        <SelectItem key="credit">{language === 'ar' ? 'آجل' : 'Credit'}</SelectItem>
                        <SelectItem key="bank_transfer">{language === 'ar' ? 'تحويل بنكي' : 'Bank Transfer'}</SelectItem>
                        <SelectItem key="pos">POS</SelectItem>
                      </Select>

                      <Input
                        label={language === 'ar' ? 'رقم المرجع' : 'Reference'}
                        variant="faded"
                        value={formData.reference_number || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, reference_number: e.target.value }))
                        }
                      />
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

      {/* ------------------ delete modal ------------------ */}
      <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange} size="sm" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</ModalHeader>
              <ModalBody>{language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}</ModalBody>

              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                <Button color="danger" onPress={() => { handleDelete(deleteTarget?.id); deleteModal.onClose(); }}>
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

    </div>
  );
}
