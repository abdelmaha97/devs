import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import { hasPermission, getUserData, hasTenantAccess } from "../../functions/permissions";

const salesOrderFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  customer_id: { en: "Customer", ar: "الزبون" },
  user_id: { en: "User", ar: "المستخدم" },
  branch_id: { en: "Branch", ar: "الفرع" },
  order_status: { en: "Order Status", ar: "حالة الطلب" },
  total_amount: { en: "Total Amount", ar: "المبلغ الإجمالي" },
};

const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    missingFields: "Required fields are missing.",
    customerNotFound: "Customer not found for this tenant.",
    userNotFound: "User not found for this tenant.",
    branchNotFound: "Branch not found for this tenant.",
    success: "Sales order created successfully",
    deletedSuccess:"Sales orders deleted successfully",
    missingOrderIds: "Sales order IDs are required",
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    missingFields: "الحقول المطلوبة مفقودة.",
    customerNotFound: "الزبون غير موجود ضمن هذه المنظمة.",
    userNotFound: "المستخدم غير موجود ضمن هذه المنظمة.",
    branchNotFound: "الفرع غير موجود ضمن هذه المنظمة.",
    success: "تم إنشاء طلب المبيعات بنجاح",
    deletedSuccess:"تم حذف طلبات المبيعات بنجاح",
     missingOrderIds: "معرفات طلبات المبيعات مطلوبة",
  },
};

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}
/**
 * POST /api/v1/admin/sales-orders
 *
 * Creates a new sales order for a tenant.
 * Validates tenant ownership, customer, user, and branch.
 * Requires `create_sales_orders` permission and tenant access in production mode.
 *
 * Request Body (JSON):
 *   - tenant_id (number, required)       : Tenant to which the order belongs
 *   - customer_id (number, required)     : Customer placing the order
 *   - user_id (number, required)         : User creating the order
 *   - branch_id (number, optional)       : Branch associated with the order
 *   - order_status (string, optional)    : Order status (draft, submitted, approved, invoiced)
 *   - total_amount (number, optional)    : Total order amount
 *
 * Validation:
 *   - Ensures required fields exist and are numeric
 *   - Checks customer, user, and branch belong to the tenant
 *
 * Responses:
 *   - 201: { message, sales_order_id }   : Order created successfully
 *   - 400: { error }                     : Missing or invalid fields
 *   - 401: { error }                     : Unauthorized (permission or tenant access failure)
 *   - 404: { error }                     : Customer, user, or branch not found
 *   - 500: { error }                     : Internal server error
 */

export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const payload = await req.json();
    const { tenant_id, customer_id, user_id, branch_id, order_status, total_amount } = payload;

    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_sales_orders");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Validation rules
    const rules: any = {
      tenant_id: [{ required: true, label: salesOrderFieldLabels.tenant_id[lang] }, { type: "number" }],
      customer_id: [{ required: true, label: salesOrderFieldLabels.customer_id[lang] }, { type: "number" }],
      user_id: [{ required: true, label: salesOrderFieldLabels.user_id[lang] }, { type: "number" }],
      branch_id: [{ required: false, label: salesOrderFieldLabels.branch_id[lang] }, { type: "number" }],
      total_amount: [{ required: false, label: salesOrderFieldLabels.total_amount[lang] }, { type: "number" }],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    // Check if customer exists for this tenant
    const [customers] = await pool.query(`SELECT id FROM customers WHERE id = ? AND tenant_id = ?`, [customer_id, tenant_id]);
    if (!(customers as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("customerNotFound", lang) }, { status: 404 });
    }

    // Check if user exists for this tenant
    const [users] = await pool.query(`SELECT id FROM users WHERE id = ? AND tenant_id = ?`, [user_id, tenant_id]);
    if (!(users as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("userNotFound", lang) }, { status: 404 });
    }

    // Check if branch exists (optional)
    if (branch_id != null) {
      const [branches] = await pool.query(`SELECT id FROM branches WHERE id = ? AND tenant_id = ?`, [branch_id, tenant_id]);
      if (!(branches as any[]).length) {
        return NextResponse.json({ error: getErrorMessage("branchNotFound", lang) }, { status: 404 });
      }
    }

    // Insert sales order
    const [result] = await pool.query(
      `INSERT INTO sales_orders (tenant_id, customer_id, user_id, branch_id, order_status, total_amount, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [tenant_id, customer_id, user_id, branch_id || null, order_status || "draft", total_amount || 0]
    );

    return NextResponse.json({ message: getErrorMessage("success", lang), sales_order_id: (result as any).insertId }, { status: 201 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("Create sales order error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * GET /api/v1/admin/sales-orders
 *
 * Retrieves a list of sales orders with optional filtering, sorting, and pagination.
 * Includes customer, branch, and user names.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Query Parameters:
 *   - tenant_id (number, required)     : The tenant to which the orders belong
 *   - customer_id (number, optional)   : Filter orders by specific customer
 *   - branch_id (number, optional)     : Filter orders by specific branch
 *   - order_status (string, optional)  : Filter orders by status ('draft','submitted','approved','invoiced')
 *   - page (number, optional)          : Page number for pagination (default: 1)
 *   - pageSize (number, optional)      : Number of records per page (default: 20)
 *   - sortBy (string, optional)        : Column to sort by (default: created_at)
 *   - sortOrder (string, optional)     : Sort direction: ASC or DESC (default: DESC)
 *
 * Responses:
 *   - 200: { total, page, pageSize, data } : Returns paginated sales orders with customer, branch, and user names
 *   - 400: { error }                        : Missing required tenant_id
 *   - 401: { error }                        : Unauthorized access (permission or tenant mismatch)
 *   - 500: { error }                        : Internal server error
 *
 * Notes:
 *   - Filters are optional except tenant_id which is required
 *   - Pagination and sorting are applied on the filtered dataset
 *   - Only accessible by users with 'view_sales_orders' permission in production
 */
export async function GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);
    const pool = await dbConnection();

    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get("tenant_id");
    const customer_id = searchParams.get("customer_id");
    const branch_id = searchParams.get("branch_id");
    const order_status = searchParams.get("order_status");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "DESC";

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_sales_orders");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Build WHERE conditions dynamically with alias 'so'
    const whereClauses: string[] = ["so.tenant_id = ?"];
    const params: any[] = [tenant_id];

    if (customer_id) {
      whereClauses.push("so.customer_id = ?");
      params.push(customer_id);
    }
    if (branch_id) {
      whereClauses.push("so.branch_id = ?");
      params.push(branch_id);
    }
    if (order_status) {
      whereClauses.push("so.order_status = ?");
      params.push(order_status);
    }

    const where = whereClauses.join(" AND ");

    // Get total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN branches b ON so.branch_id = b.id
       LEFT JOIN users u ON so.user_id = u.id
       WHERE ${where}`,
      params
    );
    const total = (countRows as any[])[0]?.count || 0;

    // Get paginated data with language support
    const customerNameField = lang === "ar" ? "c.full_name_ar" : "c.full_name";
    const branchNameField = lang === "ar" ? "b.name_ar" : "b.name";
    const userNameField = lang === "ar" ? "u.full_name_ar" : "u.full_name";

    const [rows] = await pool.query(
      `SELECT so.*, 
              ${customerNameField} AS customer_name, 
              ${branchNameField} AS branch_name, 
              ${userNameField} AS user_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN branches b ON so.branch_id = b.id
       LEFT JOIN users u ON so.user_id = u.id
       WHERE ${where}
       ORDER BY so.${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json({ total, page, pageSize, data: rows }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET sales orders error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}




/**
 * DELETE /api/v1/admin/sales-orders
 *
 * Deletes multiple sales orders for a specific tenant.
 * Requires `delete_sales_orders` permission and valid tenant access in production.
 *
 * Request Body:
 *   - tenant_id (number, required)        : ID of the tenant to which the orders belong
 *   - sales_order_ids (number[], required): List of sales order IDs to delete
 *
 * Responses:
 *   - 200: { message } : Sales orders deleted successfully
 *   - 400: { error }   : Missing required parameters or invalid list
 *   - 401: { error }   : Unauthorized (permission or tenant access failure)
 *   - 500: { error }   : Internal server error
 *
 * Notes:
 *   - Only orders belonging to the specified tenant will be deleted
 *   - The list of IDs must be passed in the request body as an array of numbers
 */

export async function DELETE(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const user: any = await getUserData(req);

    const payload = await req.json();
    const { tenant_id, sales_order_ids } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!sales_order_ids || !Array.isArray(sales_order_ids) || sales_order_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingOrderIds", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_sales_orders");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }
  // تحقق من وجود الطلبات ضمن الـ tenant
    const [existing] = await pool.query(
      `SELECT id FROM sales_orders WHERE id IN (?) AND tenant_id = ?`,
      [sales_order_ids, tenant_id]
    );
    const existingIds = (existing as any[]).map(row => row.id);

    if (existingIds.length === 0) {
      return NextResponse.json({ error: "No matching sales orders found for deletion" }, { status: 404 });
    }

    // حذف الطلبات الموجودة فقط ضمن tenant
    await pool.query(
      `DELETE FROM sales_orders WHERE id IN (?) AND tenant_id = ?`,
      [sales_order_ids, tenant_id]
    );

    return NextResponse.json({ message: getErrorMessage("deletedSuccess", lang) }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("DELETE multiple sales orders error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
