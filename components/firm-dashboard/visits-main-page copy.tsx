'use client';
import { useEffect, useState } from 'react';
import {
  Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Card, CardBody, useDisclosure, addToast, Alert, Form, Textarea,
  Tabs, Tab, Checkbox, CheckboxGroup, Progress, Divider, Avatar
} from '@heroui/react';
import {
  MapPinIcon, ClockIcon, CheckCircleIcon, XCircleIcon, CameraIcon,
  ClipboardDocumentCheckIcon, ArrowPathIcon, ChartBarIcon, 
  DocumentMagnifyingGlassIcon, ChatBubbleBottomCenterTextIcon,
  DocumentTextIcon, PlayIcon, StopIcon
} from '@heroicons/react/24/solid';
import { useLanguage } from '../context/LanguageContext';
import { lang } from '../Lang/lang';
import moment from 'moment';

export default function VisitsPage() {
  const { language } = useLanguage();
  const t = (key: string) => lang(language, key);

  const [activeTab, setActiveTab] = useState('pre_audit');
  const [visitStarted, setVisitStarted] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [visitStatus, setVisitStatus] = useState<'active' | 'completed' | 'failed'>('active');
  const [uploadedImages, setUploadedImages] = useState<any>({
    pre_audit: [],
    post_audit: [],
    competitor: []
  });
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string[] | string>([]);

  const imageUploadModal = useDisclosure();
  const [currentImageSection, setCurrentImageSection] = useState('');

  /** ------------------ بيانات افتراضية للزيارة ------------------ **/
  const VISIT_DATA = {
    customer: {
      name: 'City Supermarket',
      name_ar: 'سوبر ماركت المدينة',
      location: 'Downtown, Branch #42',
      location_ar: 'وسط المدينة، فرع رقم 42',
      lat: 23.8859,
      lng: 45.0792
    }
  };

  const MOCK_PRODUCTS = [
    { id: 1, sku: 'P-001', name: 'Product A', name_ar: 'منتج أ', status: 'available', facings: 3 },
    { id: 2, sku: 'P-002', name: 'Product B', name_ar: 'منتج ب', status: 'not_available', facings: 0 },
    { id: 3, sku: 'P-003', name: 'Product C', name_ar: 'منتج ج', status: 'wrong_display', facings: 2 },
    { id: 4, sku: 'P-004', name: 'Product D', name_ar: 'منتج د', status: 'available', facings: 5 },
    { id: 5, sku: 'P-005', name: 'Product E', name_ar: 'منتج هـ', status: 'available', facings: 4 }
  ];

  const [preAuditData, setPreAuditData] = useState(MOCK_PRODUCTS.map(p => ({ ...p })));
  const [replenishmentData, setReplenishmentData] = useState([
    { id: 1, product: 'Product A', suggested: 20, available: 50, filled: 0, reason: '' },
    { id: 2, product: 'Product B', suggested: 15, available: 30, filled: 0, reason: '' },
    { id: 3, product: 'Product C', suggested: 10, available: 25, filled: 0, reason: '' },
    { id: 4, product: 'Product D', suggested: 25, available: 60, filled: 0, reason: '' },
    { id: 5, product: 'Product E', suggested: 18, available: 40, filled: 0, reason: '' }
  ]);

  const [postAuditData, setPostAuditData] = useState({
    facingCorrect: false,
    planogramApplied: false,
    promoMaterialsInstalled: false
  });

  const [competitorData, setCompetitorData] = useState([
    { id: 1, competitor: 'Competitor A', product: 'Product X', price: '', promotion: '', discount: '' }
  ]);

  const [surveyData, setSurveyData] = useState([
    { id: 1, question: 'Is the store clean?', question_ar: 'هل المتجر نظيف؟', answer: '', type: 'yes_no' },
    { id: 2, question: 'Customer satisfaction level', question_ar: 'مستوى رضا العميل', answer: '', type: 'rating' },
    { id: 3, question: 'Additional notes', question_ar: 'ملاحظات إضافية', answer: '', type: 'text' }
  ]);

  const [visitNotes, setVisitNotes] = useState('');

  /** ------------------ بدء/إنهاء الزيارة ------------------ **/
  const handleStartVisit = () => {
    setVisitStarted(true);
    setCheckInTime(new Date());
    setVisitStatus('active');
    addToast({
      title: language === 'ar' ? 'تم تسجيل الوصول' : 'Checked In',
      description: language === 'ar' ? 'بدأت الزيارة' : 'Visit started',
      color: 'success'
    });
  };

  const handleEndVisit = () => {
    setCheckOutTime(new Date());
    setVisitStatus('completed');
    addToast({
      title: language === 'ar' ? 'تم تسجيل الخروج' : 'Checked Out',
      description: language === 'ar' ? 'انتهت الزيارة' : 'Visit completed',
      color: 'success'
    });
  };

  /** ------------------ رفع الصور ------------------ **/
  const handleImageUpload = (e: any) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map((file: any) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      url: URL.createObjectURL(file),
      timestamp: new Date()
    }));

    setUploadedImages((prev: any) => ({
      ...prev,
      [currentImageSection]: [...prev[currentImageSection], ...newImages]
    }));

    addToast({
      title: language === 'ar' ? 'تم رفع الصور' : 'Images Uploaded',
      color: 'success'
    });

    imageUploadModal.onClose();
  };

  /** ------------------ حساب التقدم ------------------ **/
  const calculateProgress = () => {
    let completed = 0;
    const total = 6;

    if (preAuditData.every(p => p.status)) completed++;
    if (replenishmentData.some(r => r.filled > 0)) completed++;
    if (postAuditData.facingCorrect || postAuditData.planogramApplied || postAuditData.promoMaterialsInstalled) completed++;
    if (competitorData.some(c => c.price || c.promotion)) completed++;
    if (surveyData.some(s => s.answer)) completed++;
    if (visitNotes) completed++;

    return (completed / total) * 100;
  };

  /** ------------------ شريحة الحالة ------------------ **/
  const statusChip = (status: 'active' | 'completed' | 'failed') => {
    const colors: any = { active: 'primary', completed: 'success', failed: 'danger' };
    const labels: any = {
      active: language === 'ar' ? 'نشطة' : 'Active',
      completed: language === 'ar' ? 'مكتملة' : 'Completed',
      failed: language === 'ar' ? 'فاشلة' : 'Failed'
    };
    return <Chip size="sm" color={colors[status]} variant="flat">{labels[status]}</Chip>;
  };

  /** ------------------ رأس الصفحة ------------------ **/
  const VisitHeader = () => (
    <Card className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20">
      <CardBody className="gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar
                size="lg"
                name={language === 'ar' ? VISIT_DATA.customer.name_ar : VISIT_DATA.customer.name}
                className="bg-primary text-white"
              />
              <div>
                <h2 className="text-2xl font-bold">
                  {language === 'ar' ? VISIT_DATA.customer.name_ar : VISIT_DATA.customer.name}
                </h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-foreground/70">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{language === 'ar' ? VISIT_DATA.customer.location_ar : VISIT_DATA.customer.location}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-black/20">
                <ClockIcon className="h-5 w-5 text-success" />
                <div className="text-xs">
                  <p className="font-medium">{language === 'ar' ? 'تسجيل الوصول' : 'Check-In'}</p>
                  <p className="text-foreground/70">
                    {checkInTime ? moment(checkInTime).format('HH:mm') : '--:--'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-black/20">
                <ClockIcon className="h-5 w-5 text-danger" />
                <div className="text-xs">
                  <p className="font-medium">{language === 'ar' ? 'تسجيل الخروج' : 'Check-Out'}</p>
                  <p className="text-foreground/70">
                    {checkOutTime ? moment(checkOutTime).format('HH:mm') : '--:--'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-black/20">
                <ChartBarIcon className="h-5 w-5 text-primary" />
                <div className="text-xs">
                  <p className="font-medium">{language === 'ar' ? 'التقدم' : 'Progress'}</p>
                  <p className="text-foreground/70">{Math.round(calculateProgress())}%</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-black/20">
                <DocumentTextIcon className="h-5 w-5 text-warning" />
                <div className="text-xs">
                  <p className="font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                  <div className="mt-1">{statusChip(visitStatus)}</div>
                </div>
              </div>
            </div>

            <Progress
              value={calculateProgress()}
              color="primary"
              size="sm"
              className="max-w-full"
            />
          </div>

          <div className="flex gap-2">
            {!visitStarted ? (
              <Button
                color="success"
                variant="shadow"
                startContent={<PlayIcon className="h-4 w-4" />}
                onPress={handleStartVisit}
                size="lg"
              >
                {language === 'ar' ? 'بدء الزيارة' : 'Start Visit'}
              </Button>
            ) : visitStatus === 'active' ? (
              <Button
                color="danger"
                variant="shadow"
                startContent={<StopIcon className="h-4 w-4" />}
                onPress={handleEndVisit}
                size="lg"
              >
                {language === 'ar' ? 'إنهاء الزيارة' : 'End Visit'}
              </Button>
            ) : (
              <Chip color="success" size="lg" variant="shadow">
                {language === 'ar' ? '✓ مكتملة' : '✓ Completed'}
              </Chip>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );

  /** ------------------ TAB 1: Pre-Audit ------------------ **/
  const PreAuditTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {language === 'ar' ? 'قائمة المنتجات - قبل التعبئة' : 'Product List - Pre-Audit'}
        </h3>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          startContent={<CameraIcon className="h-4 w-4" />}
          onPress={() => {
            setCurrentImageSection('pre_audit');
            imageUploadModal.onOpen();
          }}
        >
          {language === 'ar' ? 'رفع صور' : 'Upload Images'}
        </Button>
      </div>

      <div className="grid gap-3">
        {preAuditData.map((product, index) => (
          <Card key={product.id}>
            <CardBody className="gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{language === 'ar' ? product.name_ar : product.name}</p>
                  <p className="text-xs text-foreground/60">SKU: {product.sku}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color={product.status === 'available' ? 'success' : 'default'}
                    variant={product.status === 'available' ? 'flat' : 'bordered'}
                    onPress={() => {
                      const newData = [...preAuditData];
                      newData[index].status = 'available';
                      setPreAuditData(newData);
                    }}
                  >
                    {language === 'ar' ? '✔ موجود' : '✔ Available'}
                  </Button>

                  <Button
                    size="sm"
                    color={product.status === 'not_available' ? 'danger' : 'default'}
                    variant={product.status === 'not_available' ? 'flat' : 'bordered'}
                    onPress={() => {
                      const newData = [...preAuditData];
                      newData[index].status = 'not_available';
                      setPreAuditData(newData);
                    }}
                  >
                    {language === 'ar' ? '✖ غير موجود' : '✖ Not Available'}
                  </Button>

                  <Button
                    size="sm"
                    color={product.status === 'wrong_display' ? 'warning' : 'default'}
                    variant={product.status === 'wrong_display' ? 'flat' : 'bordered'}
                    onPress={() => {
                      const newData = [...preAuditData];
                      newData[index].status = 'wrong_display';
                      setPreAuditData(newData);
                    }}
                  >
                    {language === 'ar' ? '⭕ عرض خاطئ' : '⭕ Wrong Display'}
                  </Button>
                </div>
              </div>

              <Input
                type="number"
                label={language === 'ar' ? 'عدد Facings' : 'Number of Facings'}
                variant="faded"
                size="sm"
                value={product.facings.toString()}
                onChange={(e) => {
                  const newData = [...preAuditData];
                  newData[index].facings = parseInt(e.target.value) || 0;
                  setPreAuditData(newData);
                }}
              />
            </CardBody>
          </Card>
        ))}
      </div>

      {uploadedImages.pre_audit.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-medium">
              {language === 'ar' ? 'الصور المرفوعة' : 'Uploaded Images'}
            </p>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {uploadedImages.pre_audit.map((img: any) => (
                <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg">
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  /** ------------------ TAB 2: Replenishment ------------------ **/
  const ReplenishmentTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        {language === 'ar' ? 'التعبئة والضخ' : 'Replenishment'}
      </h3>

      <div className="grid gap-3">
        {replenishmentData.map((item, index) => (
          <Card key={item.id}>
            <CardBody className="gap-3">
              <p className="font-semibold">{item.product}</p>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-primary-50 p-2 dark:bg-primary-900/20">
                  <p className="text-xs text-foreground/70">{language === 'ar' ? 'مقترحة' : 'Suggested'}</p>
                  <p className="font-semibold">{item.suggested}</p>
                </div>

                <div className="rounded-lg bg-success-50 p-2 dark:bg-success-900/20">
                  <p className="text-xs text-foreground/70">{language === 'ar' ? 'متوفرة' : 'Available'}</p>
                  <p className="font-semibold">{item.available}</p>
                </div>

                <div className="rounded-lg bg-warning-50 p-2 dark:bg-warning-900/20">
                  <p className="text-xs text-foreground/70">{language === 'ar' ? 'آخر طلبية' : 'Last Order'}</p>
                  <p className="font-semibold">{Math.floor(Math.random() * 30 + 10)}</p>
                </div>
              </div>

              <Input
                type="number"
                label={language === 'ar' ? 'الكمية المعبأة' : 'Filled Quantity'}
                variant="faded"
                size="sm"
                value={item.filled.toString()}
                onChange={(e) => {
                  const newData = [...replenishmentData];
                  newData[index].filled = parseInt(e.target.value) || 0;
                  setReplenishmentData(newData);
                }}
              />

              {item.filled === 0 && (
                <Textarea
                  label={language === 'ar' ? 'سبب عدم التعبئة' : 'Reason for not filling'}
                  variant="faded"
                  size="sm"
                  value={item.reason}
                  onChange={(e) => {
                    const newData = [...replenishmentData];
                    newData[index].reason = e.target.value;
                    setReplenishmentData(newData);
                  }}
                />
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );

  /** ------------------ TAB 3: Post-Audit ------------------ **/
  const PostAuditTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {language === 'ar' ? 'بعد التعبئة' : 'Post-Audit'}
        </h3>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          startContent={<CameraIcon className="h-4 w-4" />}
          onPress={() => {
            setCurrentImageSection('post_audit');
            imageUploadModal.onOpen();
          }}
        >
          {language === 'ar' ? 'رفع صور' : 'Upload Images'}
        </Button>
      </div>

      <Card>
        <CardBody className="gap-4">
          <Checkbox
            isSelected={postAuditData.facingCorrect}
            onValueChange={(checked) =>
              setPostAuditData((prev) => ({ ...prev, facingCorrect: checked }))
            }
          >
            {language === 'ar' ? 'Facing صحيح؟' : 'Facing Correct?'}
          </Checkbox>

          <Checkbox
            isSelected={postAuditData.planogramApplied}
            onValueChange={(checked) =>
              setPostAuditData((prev) => ({ ...prev, planogramApplied: checked }))
            }
          >
            {language === 'ar' ? 'تم تطبيق Planogram؟' : 'Planogram Applied?'}
          </Checkbox>

          <Checkbox
            isSelected={postAuditData.promoMaterialsInstalled}
            onValueChange={(checked) =>
              setPostAuditData((prev) => ({ ...prev, promoMaterialsInstalled: checked }))
            }
          >
            {language === 'ar' ? 'تم تركيب مواد ترويجية؟' : 'Promo Materials Installed?'}
          </Checkbox>
        </CardBody>
      </Card>

      {uploadedImages.post_audit.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-medium">
              {language === 'ar' ? 'صور بعد التعبئة' : 'Post-Audit Images'}
            </p>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {uploadedImages.post_audit.map((img: any) => (
                <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg">
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  /** ------------------ TAB 4: Competitor ------------------ **/
  const CompetitorTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {language === 'ar' ? 'معلومات المنافسين' : 'Competitor Intelligence'}
        </h3>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          startContent={<CameraIcon className="h-4 w-4" />}
          onPress={() => {
            setCurrentImageSection('competitor');
            imageUploadModal.onOpen();
          }}
        >
          {language === 'ar' ? 'رفع صور' : 'Upload Images'}
        </Button>
      </div>

      <div className="grid gap-3">
        {competitorData.map((comp, index) => (
          <Card key={comp.id}>
            <CardBody className="gap-3">
              <Input
                label={language === 'ar' ? 'اسم المنافس' : 'Competitor Name'}
                variant="faded"
                size="sm"
                value={comp.competitor}
                onChange={(e) => {
                  const newData = [...competitorData];
                  newData[index].competitor = e.target.value;
                  setCompetitorData(newData);
                }}
              />

              <Input
                label={language === 'ar' ? 'المنتج' : 'Product'}
                variant="faded"
                size="sm"
                value={comp.product}
                onChange={(e) => {
                  const newData = [...competitorData];
                  newData[index].product = e.target.value;
                  setCompetitorData(newData);
                }}
              />

              <div className="grid grid-cols-3 gap-2">
                <Input
                  label={language === 'ar' ? 'السعر' : 'Price'}
                  variant="faded"
                  size="sm"
                  value={comp.price}
                  onChange={(e) => {
                    const newData = [...competitorData];
                    newData[index].price = e.target.value;
                    setCompetitorData(newData);
                  }}
                />

                <Input
                  label={language === 'ar' ? 'العروض' : 'Promotion'}
                  variant="faded"
                  size="sm"
                  value={comp.promotion}
                  onChange={(e) => {
                    const newData = [...competitorData];
                    newData[index].promotion = e.target.value;
                    setCompetitorData(newData);
                  }}
                />

                <Input
                  label={language === 'ar' ? 'التخفيض %' : 'Discount %'}
                  variant="faded"
                  size="sm"
                  value={comp.discount}
                  onChange={(e) => {
                    const newData = [...competitorData];
                    newData[index].discount = e.target.value;
                    setCompetitorData(newData);
                  }}
                />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Button
        size="sm"
        variant="bordered"
        onPress={() =>
          setCompetitorData([
            ...competitorData,
            { id: Date.now(), competitor: '', product: '', price: '', promotion: '', discount: '' }
          ])
        }
      >
        {language === 'ar' ? '+ إضافة منافس' : '+ Add Competitor'}
      </Button>

      {uploadedImages.competitor.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-medium">
              {language === 'ar' ? 'صور المنافسين' : 'Competitor Images'}
            </p>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {uploadedImages.competitor.map((img: any) => (
                <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg">
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  /** ------------------ TAB 5: Surveys ------------------ **/
  const SurveysTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        {language === 'ar' ? 'الاستبيانات' : 'Surveys'}
      </h3>

      <div className="grid gap-3">
        {surveyData.map((survey, index) => (
          <Card key={survey.id}>
            <CardBody className="gap-3">
              <p className="font-medium">
                {language === 'ar' ? survey.question_ar : survey.question}
              </p>

              {survey.type === 'yes_no' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color={survey.answer === 'yes' ? 'success' : 'default'}
                    variant={survey.answer === 'yes' ? 'flat' : 'bordered'}
                    onPress={() => {
                      const newData = [...surveyData];
                      newData[index].answer = 'yes';
                      setSurveyData(newData);
                    }}
                  >
                    {language === 'ar' ? 'نعم' : 'Yes'}
                  </Button>

                  <Button
                    size="sm"
                    color={survey.answer === 'no' ? 'danger' : 'default'}
                    variant={survey.answer === 'no' ? 'flat' : 'bordered'}
                    onPress={() => {
                      const newData = [...surveyData];
                      newData[index].answer = 'no';
                      setSurveyData(newData);
                    }}
                  >
                    {language === 'ar' ? 'لا' : 'No'}
                  </Button>
                </div>
              )}

              {survey.type === 'rating' && (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      isIconOnly
                      size="sm"
                      color={parseInt(survey.answer) >= star ? 'warning' : 'default'}
                      variant="flat"
                      onPress={() => {
                        const newData = [...surveyData];
                        newData[index].answer = star.toString();
                        setSurveyData(newData);
                      }}
                    >
                      ⭐
                    </Button>
                  ))}
                </div>
              )}

              {survey.type === 'text' && (
                <Textarea
                  variant="faded"
                  size="sm"
                  value={survey.answer}
                  onChange={(e) => {
                    const newData = [...surveyData];
                    newData[index].answer = e.target.value;
                    setSurveyData(newData);
                  }}
                />
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );

  /** ------------------ TAB 6: Visit Summary ------------------ **/
  const VisitSummaryTab = () => {
    const duration = checkInTime && checkOutTime
      ? Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 1000 / 60)
      : 0;

    const completedTasks = [
      preAuditData.every(p => p.status) ? 1 : 0,
      replenishmentData.some(r => r.filled > 0) ? 1 : 0,
      (postAuditData.facingCorrect || postAuditData.planogramApplied || postAuditData.promoMaterialsInstalled) ? 1 : 0,
      competitorData.some(c => c.price || c.promotion) ? 1 : 0,
      surveyData.some(s => s.answer) ? 1 : 0,
      visitNotes ? 1 : 0
    ].reduce((a, b) => a + b, 0);

    const totalImages = uploadedImages.pre_audit.length + uploadedImages.post_audit.length + uploadedImages.competitor.length;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {language === 'ar' ? 'ملخص الزيارة' : 'Visit Summary'}
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardBody className="gap-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-primary" />
                <p className="font-medium">{language === 'ar' ? 'مدة الزيارة' : 'Visit Duration'}</p>
              </div>
              <p className="text-2xl font-bold">{duration} {language === 'ar' ? 'دقيقة' : 'minutes'}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="gap-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-success" />
                <p className="font-medium">{language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}</p>
              </div>
              <p className="text-2xl font-bold">{completedTasks} / 6</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="gap-3">
              <div className="flex items-center gap-2">
                <CameraIcon className="h-5 w-5 text-warning" />
                <p className="font-medium">{language === 'ar' ? 'الصور المرفوعة' : 'Uploaded Images'}</p>
              </div>
              <p className="text-2xl font-bold">{totalImages}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="gap-3">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-primary" />
                <p className="font-medium">{language === 'ar' ? 'درجة الامتثال' : 'Compliance Score'}</p>
              </div>
              <p className="text-2xl font-bold">{Math.round(calculateProgress())}%</p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="gap-3">
            <p className="font-medium">{language === 'ar' ? 'تقرير الرف' : 'Shelf Report'}</p>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'منتجات متوفرة' : 'Available Products'}</span>
                <span className="font-semibold">
                  {preAuditData.filter(p => p.status === 'available').length} / {preAuditData.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'منتجات غير متوفرة' : 'Unavailable Products'}</span>
                <span className="font-semibold">
                  {preAuditData.filter(p => p.status === 'not_available').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'عرض خاطئ' : 'Wrong Display'}</span>
                <span className="font-semibold">
                  {preAuditData.filter(p => p.status === 'wrong_display').length}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-3">
            <p className="font-medium">{language === 'ar' ? 'الملاحظات العامة' : 'General Notes'}</p>
            <Textarea
              variant="faded"
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              placeholder={language === 'ar' ? 'أضف ملاحظاتك هنا...' : 'Add your notes here...'}
              minRows={4}
            />
          </CardBody>
        </Card>

        <Card className="border-2 border-primary/20 bg-primary-50 dark:bg-primary-900/20">
          <CardBody className="gap-3">
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-primary" />
              <p className="font-medium">{language === 'ar' ? 'الموقع الجغرافي' : 'Location'}</p>
            </div>
            <p className="text-sm">
              Lat: {VISIT_DATA.customer.lat}, Lng: {VISIT_DATA.customer.lng}
            </p>
          </CardBody>
        </Card>

        <Button
          color="success"
          variant="shadow"
          size="lg"
          className="w-full"
          onPress={() => {
            addToast({
              title: language === 'ar' ? 'تم الحفظ' : 'Saved',
              description: language === 'ar' ? 'تم حفظ الزيارة بنجاح' : 'Visit saved successfully',
              color: 'success'
            });
          }}
        >
          {language === 'ar' ? 'حفظ التقرير النهائي' : 'Save Final Report'}
        </Button>
      </div>
    );
  };

  /** ------------------ الواجهة الرئيسية ------------------ **/
  return (
    <div className="min-h-screen bg-gradient-to-b from-content2 via-content2 to-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full space-y-6">
        <section className="flex flex-col gap-4 pt-5">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">
              {language === 'ar' ? 'نظام الزيارات' : 'VISIT MANAGEMENT'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-text">
              {language === 'ar' ? 'تنفيذ الزيارة' : 'Visit Execution'}
            </h1>
          </div>
        </section>

        <VisitHeader />

        <Card>
          <CardBody>
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key.toString())}
              variant="underlined"
              color="primary"
              isDisabled={!visitStarted}
            >
              <Tab
                key="pre_audit"
                title={
                  <div className="flex items-center gap-2">
                    <ClipboardDocumentCheckIcon className="h-5 w-5" />
                    <span>{language === 'ar' ? 'قبل التعبئة' : 'Pre-Audit'}</span>
                  </div>
                }
              >
                <div className="py-4">
                  <PreAuditTab />
                </div>
              </Tab>

              <Tab
                key="replenishment"
                title={
                  <div className="flex items-center gap-2">
                    <ArrowPathIcon className="h-5 w-5" />
                    <span>{language === 'ar' ? 'التعبئة' : 'Replenishment'}</span>
                  </div>
                }
              >
                <div className="py-4">
                  <ReplenishmentTab />
                </div>
              </Tab>

              <Tab
                key="post_audit"
                title={
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>{language === 'ar' ? 'بعد التعبئة' : 'Post-Audit'}</span>
                  </div>
                }
              >
                <div className="py-4">
                  <PostAuditTab />
                </div>
              </Tab>

              <Tab
                key="competitor"
                title={
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5" />
                    <span>{language === 'ar' ? 'المنافسين' : 'Competitors'}</span>
                  </div>
                }
              >
                <div className="py-4">
                  <CompetitorTab />
                </div>
              </Tab>

              <Tab
                key="surveys"
                title={
                  <div className="flex items-center gap-2">
                    <DocumentMagnifyingGlassIcon className="h-5 w-5" />
                    <span>{language === 'ar' ? 'الاستبيانات' : 'Surveys'}</span>
                  </div>
                }
              >
                <div className="py-4">
                  <SurveysTab />
                </div>
              </Tab>

              <Tab
                key="summary"
                title={
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5" />
                    <span>{language === 'ar' ? 'الملخص' : 'Summary'}</span>
                  </div>
                }
              >
                <div className="py-4">
                  <VisitSummaryTab />
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>

      {/* ------------------ Image Upload Modal ------------------ */}
      <Modal
        isOpen={imageUploadModal.isOpen}
        onOpenChange={imageUploadModal.onOpenChange}
        size="md"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {language === 'ar' ? 'رفع الصور' : 'Upload Images'}
              </ModalHeader>

              <ModalBody>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-primary/40">
                    <label className="flex cursor-pointer flex-col items-center gap-2">
                      <CameraIcon className="h-8 w-8 text-primary" />
                      <span className="text-sm text-foreground/70">
                        {language === 'ar' ? 'اختر الصور' : 'Choose Images'}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>
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