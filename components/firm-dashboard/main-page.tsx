'use client';
import React from 'react';
import StatCard from '@/components/utils/StatCard';
import {
	BriefcaseIcon,
	CalendarIcon,
	DocumentIcon,
	CreditCardIcon,
	SparklesIcon,
	ChartBarIcon,
	CheckCircleIcon,
	ShoppingCartIcon,
	UserGroupIcon,
	ExclamationTriangleIcon,
	TagIcon,
} from '@heroicons/react/24/outline';
import { useLanguage } from "../context/LanguageContext";
import { lang } from '../Lang/lang';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Pagination, Button } from "@heroui/react";
import moment from 'moment';

export default function DashboardPage() {
	const { language } = useLanguage();

	// --- إحصائيات الملخص اليومي ---
	const stats = [
		{
			title: lang(language, 'sales_dashboard.total_sales'), // "إجمالي المبيعات"
			value: '1,250,000',
			icon: <ChartBarIcon className="w-6 h-6 text-primary" />,
		},
		{
			title: lang(language, 'sales_dashboard.orders_count'), // "عدد الطلبات"
			value: 342,
			icon: <ShoppingCartIcon className="w-6 h-6 text-primary" />,
		},
		{
			title: lang(language, 'sales_dashboard.invoices_count'), // "عدد الفواتير"
			value: 298,
			icon: <DocumentIcon className="w-6 h-6 text-primary" />,
		},
		{
			title: lang(language, 'sales_dashboard.collections_today'), // "تحصيلات اليوم"
			value: '45,200',
			icon: <CreditCardIcon className="w-6 h-6 text-primary" />,
		},
	];

	// --- بيانات الطلبات الحديثة (كمثال) ---
	const recentOrders = [
		{
			id: 'SO-1001',
			customer: language === 'ar' ? 'مؤسسة النسمه' : 'Al-Nasmah Co.',
			total: '4,500',
			status: language === 'ar' ? 'مكتمل' : 'Completed',
			date: moment('2025-12-02').format('LL'),
		},
		{
			id: 'SO-1002',
			customer: language === 'ar' ? 'محلات الراية' : 'Al Raya Stores',
			total: '2,100',
			status: language === 'ar' ? 'قيد التوصيل' : 'Out for Delivery',
			date: moment('2025-12-02').format('LL'),
		},
		{
			id: 'SO-1003',
			customer: language === 'ar' ? 'سوبرماركت الخليج' : 'Gulf Supermarket',
			total: '7,800',
			status: language === 'ar' ? 'ملغي' : 'Cancelled',
			date: moment('2025-12-01').format('LL'),
		},
	];

	// --- بيانات العملاء الجدد (كمثال) ---
	const newCustomers = [
		{ id: 1, name: language === 'ar' ? 'عبدالله سالم' : 'Abdullah Salem', joined: moment('2025-12-01').format('LL') },
		{ id: 2, name: language === 'ar' ? 'مكتبة الأجيال' : 'Ajyal Bookstore', joined: moment('2025-11-30').format('LL') },
	];

	// --- تنبيهات النظام (مخزون منخفض، منتجات قرب الانتهاء، فواتير غير مسددة) ---
	const alerts = [
		{ id: 1, type: 'low_stock', title: language === 'ar' ? 'مخزون منخفض: مشروب طاقة 330مل' : 'Low stock: Energy Drink 330ml', badge: language === 'ar' ? 'الكمية: 5' : 'Qty: 5' },
		{ id: 2, type: 'near_expiry', title: language === 'ar' ? 'منتج قريب الانتهاء: بسكويت حافظ' : 'Near expiry: Hafiz Biscuits', badge: language === 'ar' ? 'تنتهي بعد 10 أيام' : 'Expires in 10 days' },
		{ id: 3, type: 'unpaid_invoice', title: language === 'ar' ? 'فاتورة غير مسددة: INV-887' : 'Unpaid invoice: INV-887', badge: language === 'ar' ? 'المبلغ: 2,000' : 'Amount: 2,000' },
	];

	// مهام صغيرة كمثال (يمكن ربطها لاحقًا بالـ API)
	const tasks = [
		{ id: 1, text: language === 'ar' ? 'متابعة تحصيل من عميل - INV-887' : 'Follow up collection - INV-887', done: false },
		{ id: 2, text: language === 'ar' ? 'جدولة جولة ميدانية للمنسق' : 'Schedule field visit for route', done: true },
		{ id: 3, text: language === 'ar' ? 'تجديد أمر شراء لمورد الفواكه' : 'Reorder purchase for fruit supplier', done: false },
	];

	const [page, setPage] = React.useState(1);
	const rowsPerPage = 3;
	const paginatedOrders = recentOrders.slice((page - 1) * rowsPerPage, page * rowsPerPage);
	const totalPages = Math.ceil(recentOrders.length / rowsPerPage);

	return (
		<div className="min-h-screen bg-content2">
			<main className="p-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-text mb-2">
						{lang(language, 'sales_dashboard.welcome')} محمد
					</h1>
					<p className="text-text">{lang(language, 'sales_dashboard.overview')}</p>
				</div>

				{/* --- ملخص اليوم --- */}
				<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					{stats.map((stat, index) => (
						<StatCard key={index} {...stat} cardClass="bg-content1 text-text" />
					))}
				</div>

				{/* --- مساحة للـ AI / Insights أو اقتراحات ذكية (تم الحفاظ على نفس البنية) --- */}
				<div className="bg-content1 rounded-xl shadow-md p-6 mb-8 border border-divider">
					<div className="flex items-center gap-3 mb-6">
						<SparklesIcon className="w-6 h-6 text-primary" />
						<h2 className="text-xl font-bold text-text">
							{lang(language, 'sales_dashboard.smart_insights')}
						</h2>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="p-4 bg-content2 rounded-lg border border-blue-200">
							<h3 className="font-semibold text-text mb-2">
								{lang(language, 'sales_dashboard.forecast_sales')}
							</h3>
							<p className="text-sm text-text">
								{lang(language, 'sales_dashboard.forecast_sales_desc')}
							</p>
						</div>

						<div className="p-4 bg-content2 rounded-lg border border-green-200">
							<h3 className="font-semibold text-text mb-2">
								{lang(language, 'sales_dashboard.restock_suggestions')}
							</h3>
							<p className="text-sm text-text">
								{lang(language, 'sales_dashboard.restock_suggestions_desc')}
							</p>
						</div>

						<div className="p-4 bg-content2 rounded-lg border border-purple-200">
							<h3 className="font-semibold text-text mb-2">
								{lang(language, 'sales_dashboard.top_routes')}
							</h3>
							<p className="text-sm text-text">
								{lang(language, 'sales_dashboard.top_routes_desc')}
							</p>
						</div>
					</div>
				</div>

				{/* --- المخططات والتنبيهات والأنشطة --- */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* المنطقة الكبيرة للمخططات */}
					<div className="lg:col-span-2 bg-content1 rounded-xl shadow-md p-6 border border-divider">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-bold text-text">
								{lang(language, 'sales_dashboard.charts_overview')}
							</h2>
							<button className="text-primary hover:text-secondary font-medium text-sm">
								{lang(language, 'sales_dashboard.view_reports')}
							</button>
						</div>

						{/* مكان رسم المخططات — احتفظت بالبنية لتسهيل ربط مكتبة رسوم لاحقًا */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="p-4 bg-content2 rounded-lg border border-divider min-h-[220px] flex flex-col">
								<h3 className="font-semibold text-text mb-2">
									{lang(language, 'sales_dashboard.weekly_sales_chart')}
								</h3>
								{/* هنا يمكن إدراج مكوّن الرسم البياني (recharts / chart.js) لاحقًا */}
								<div className="flex-1 flex items-center justify-center text-sm text-text/60">
									{lang(language, 'sales_dashboard.chart_placeholder')}
								</div>
							</div>

							<div className="p-4 bg-content2 rounded-lg border border-divider min-h-[220px] flex flex-col">
								<h3 className="font-semibold text-text mb-2">
									{lang(language, 'sales_dashboard.top_products_chart')}
								</h3>
								<div className="flex-1 flex items-center justify-center text-sm text-text/60">
									{lang(language, 'sales_dashboard.chart_placeholder')}
								</div>
							</div>
						</div>

						{/* جدول الأنشطة الحديثة */}
						<div className="mt-6 overflow-x-auto">
							<Table
								aria-label="Recent Orders Table"
								className="mb-4"
								shadow='none'
								bottomContent={
									<div className="flex w-full justify-between gap-2 mt-2">
										<Pagination
											style={{ direction: "ltr" }}
											isCompact
											showControls
											page={page}
											total={totalPages}
											onChange={setPage}
											color="secondary"
											variant="flat"
										/>
										<div className='flex items-center gap-1'>
											<Button
												isDisabled={page === 1}
												size="sm"
												variant="flat"
												onPress={() => setPage(page - 1)}
											>
												{lang(language, "Previous")}
											</Button>

											<Button
												isDisabled={page === totalPages}
												size="sm"
												variant="flat"
												onPress={() => setPage(page + 1)}
											>
												{lang(language, "Next")}
											</Button>
										</div>
									</div>
								}
							>
								<TableHeader>
									<TableColumn>{lang(language, 'sales_dashboard.order_id')}</TableColumn>
									<TableColumn>{lang(language, 'sales_dashboard.customer')}</TableColumn>
									<TableColumn>{lang(language, 'sales_dashboard.total')}</TableColumn>
									<TableColumn>{lang(language, 'sales_dashboard.status')}</TableColumn>
									<TableColumn>{lang(language, 'sales_dashboard.date')}</TableColumn>
								</TableHeader>
								<TableBody>
									{paginatedOrders.map((order) => (
										<TableRow key={order.id}>
											<TableCell>{order.id}</TableCell>
											<TableCell>{order.customer}</TableCell>
											<TableCell>{order.total}</TableCell>
											<TableCell>
												<span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
													{order.status}
												</span>
											</TableCell>
											<TableCell>{order.date}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>

					{/* عمود التنبيهات والمهام والملخص الصغير */}
					<div className="bg-content1 rounded-xl shadow-md p-6 border border-divider">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-bold text-text">
								{lang(language, 'sales_dashboard.alerts_tasks')}
							</h2>
							<button className="text-primary hover:text-secondary">
								<span className="text-2xl">+</span>
							</button>
						</div>

						{/* التنبيهات */}
						<div className="space-y-3 mb-4">
							{alerts.map((a) => (
								<div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-content2 transition-colors">
									<div className="w-10 h-10 bg-content2 rounded-md flex items-center justify-center">
										<ExclamationTriangleIcon className="w-5 h-5 text-primary" />
									</div>
									<div className="flex-1">
										<div className="font-medium text-text">{a.title}</div>
										<div className="text-xs text-text/60">{a.badge}</div>
									</div>
									<div className="text-sm text-primary/90">{lang(language, 'sales_dashboard.view')}</div>
								</div>
							))}
						</div>

						{/* المهام */}
						<div className="mb-4">
							<h3 className="font-semibold text-text mb-2">{lang(language, 'sales_dashboard.tasks')}</h3>
							<div className="space-y-2">
								{tasks.map((task) => (
									<div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-content2 transition-colors">
										<input type="checkbox" checked={task.done} readOnly className="w-4 h-4 accent-primary" />
										<span className={`text-sm ${task.done ? 'line-through text-gray-500' : 'text-text'}`}>{task.text}</span>
									</div>
								))}
							</div>
						</div>

						{/* ملخص شهري صغير */}
						<div className="mt-4">
							<div className="flex items-center gap-3 mb-3">
								<div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
									<UserGroupIcon className="w-6 h-6 text-white" />
								</div>
								<div>
									<div className="text-sm text-text/60">{lang(language, 'sales_dashboard.customers_visited')}</div>
									<div className="text-2xl font-bold text-primary">24</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<div className="text-center p-3 bg-content2 rounded-lg">
									<div className="text-sm text-text/60">{lang(language, 'sales_dashboard.new_customers')}</div>
									<div className="text-lg font-semibold text-text"> {newCustomers.length} </div>
								</div>
								<div className="text-center p-3 bg-content2 rounded-lg">
									<div className="text-sm text-text/60">{lang(language, 'sales_dashboard.pending_invoices')}</div>
									<div className="text-lg font-semibold text-text"> 12 </div>
								</div>
							</div>
						</div>
					</div>
				</div>

			</main>
		</div>
	);
}
