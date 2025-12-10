import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import argon2 from "argon2";
import { hasPermission, getUserData, hasTenantAccess } from "../../functions/permissions";

const errorMessages = {
  en: {

    unauthorized: "Unauthorized access.",
    missingFields: "Required fields are missing.",
    serverError: "Internal server error.",
    success: "Customer created successfully.",
    missingTenantId: "Tenant ID is required.",
    branchNotFoundFortenant: "Branch not found For this tenant",
    tenantRequired: "Tenant ID is required.",
    missingCustomerIds: "Customer IDs are required.",
    invalidCustomerIds: "Invalid customer IDs.",
    noCustomersFound: "No matching active customers were found.",
    deleted: (count: number) => `Deleted ${count} user(s).`,

  },
  ar: {

    tenantRequired: "رقم المستأجر (المنظمة) مطلوب.",
    missingCustomerIds: "يجب تزويد أرقام العملاء.",
    invalidCustomerIds: "أرقام العملاء غير صالحة.",
    missingFields: "الحقول المطلوبة مفقودة.",
    branchNotFoundFortenant: "الفرع غير موجود لهذه الشركة.",
    serverError: "خطأ في الخادم الداخلي.",
    unauthorized: "دخول غير مصرح به.",
    success: "تم إنشاء المستخدم بنجاح.",
    noCustomersFound: "لم يتم العثور على عملاء مطابقين.",
    missingTenantId: "معرف المنظمة مطلوب.",
    deleted: (count: number) => `تم حذف ${count} مستخدم${count === 1 ? "" : "ين"}.`,
  },
};

// Helper to get error message by language

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

// حقول مطلوبة
const requiredFieldLabels: Record<
  "tenant_id" | "branch_id" | "full_name" | "full_name_ar" | "phone" | "email" | "address" | "address_ar" | "credit_limit",
  { en: string; ar: string }
> = {
  full_name: { en: "Full Name", ar: "الاسم الكامل" },
  full_name_ar: { en: "Arabic Name", ar: "الاسم العربي" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  phone: { en: "Phone", ar: "رقم الهاتف" },
  branch_id: { en: "Branch", ar: "الفرع" },
  address: { en: "Address", ar: "العنوان" },
  address_ar: { en: "Arabic Address", ar: "العنوان العربي" },
  credit_limit: { en: "Credit Limit", ar: "الحد الائتماني" },
};
/**
 * POST /api/v1/admin/customers
 *
 * Creates a new customer record in the system.
 * The customer is linked to a tenant and optionally to a branch.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" for localized responses
 *
 * Request Body:
 *   - tenant_id (number, required)      : Tenant/organization ID the customer belongs to
 *   - branch_id (number, optional)      : Branch ID the customer belongs to
 *   - full_name (string, required)      : Customer full name
 *   - full_name_ar (string, optional)   : Customer full name in Arabic
 *   - email (string, optional)          : Customer email
 *   - phone (string, optional)          : Customer phone number
 *   - address (string, optional)        : Customer address
 *   - address_ar (string, optional)     : Customer address in Arabic
 *   - credit_limit (number, optional)   : Customer credit limit (default 0)
 *
 * Responses:
 *   - 201: { message, customer_id }     : Customer created successfully, returns the new ID
 *   - 400: { error }                    : Missing required fields (tenant_id, full_name)
 *   - 500: { error }                    : Internal server error
 *
 * Notes:
 *   - Optional fields are stored as NULL if not provided.
 *   - credit_limit defaults to 0 when not specified.
 *   - Supports localized success message in English or Arabic.
 */

export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const payload = await req.json();
    const { tenant_id, branch_id, full_name, full_name_ar, email, phone, address, address_ar, credit_limit } = payload;
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_customers");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      };
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }
 // قواعد التحقق من الحقول للكستمر
const rules: any = {
  full_name: [
    { required: true, label: requiredFieldLabels.full_name[lang] },
    { minLength: 3, label: requiredFieldLabels.full_name[lang] },
    { maxLength: 200, label: requiredFieldLabels.full_name[lang] },
  ],
  full_name_ar: [
    { required: false, label: requiredFieldLabels.full_name_ar[lang] },
    { minLength: 3, label: requiredFieldLabels.full_name_ar[lang] },
    { maxLength: 200, label: requiredFieldLabels.full_name_ar[lang] },
  ],
  email: [
    { required: true, label: requiredFieldLabels.email[lang] },
    { type: "email", label: requiredFieldLabels.email[lang] },
  ],
  tenant_id: [
    { required: true, label: requiredFieldLabels.tenant_id[lang] },
    { type: "number", label: requiredFieldLabels.tenant_id[lang] },
  ],
  branch_id: [
    { required: false, label: requiredFieldLabels.branch_id[lang] },
    { type: "number", label: requiredFieldLabels.branch_id[lang] },
  ],
  phone: [
    { required: false, label: requiredFieldLabels.phone[lang] },
    { phone: true, label: requiredFieldLabels.phone[lang] },
  ],
  address: [
    { required: false, label: requiredFieldLabels.address[lang] },
    { maxLength: 255, label: requiredFieldLabels.address[lang] },
  ],
  address_ar: [
    { required: false, label: requiredFieldLabels.address_ar[lang] },
    { maxLength: 255, label: requiredFieldLabels.address_ar[lang] },
  ],
  credit_limit: [
    { required: false, label: requiredFieldLabels.credit_limit[lang] },
    { type: "number", label: requiredFieldLabels.credit_limit[lang] },
  ],
};

// تنفيذ التحقق
const { valid, errors } = validateFields(payload, rules, lang);
if (!valid) {
  return NextResponse.json({ error: errors }, { status: 400 });
}

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (!full_name) {
      return NextResponse.json({ error: getErrorMessage("missingFields", lang) }, { status: 400 });
    }
  // Check if branch exists and belongs to same tenant
      if(branch_id!=null){
        const [Branches] = await pool.query(
      `SELECT id FROM branches WHERE id = ? AND tenant_id= ? LIMIT 1`,
      [branch_id, tenant_id]
    );
    const Branch = (Branches as any[])[0];
    if (!Branch) return NextResponse.json({ error: getErrorMessage("branchNotFoundFortenant", lang) }, { status: 404 });
  }
    const [result] = await pool.query(
      `INSERT INTO customers (tenant_id,branch_id, full_name, full_name_ar, email, phone, address, address_ar,credit_limit) 
       VALUES (?, ?, ?, ?, ?, ?, ?,?,?)`,
      [tenant_id, branch_id || null, full_name, full_name_ar || null, email || null, phone || null, address || null, address_ar || null, credit_limit !== undefined ? credit_limit : 0
      ]
    );

    return NextResponse.json({ error: getErrorMessage("success", lang) }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("Create customer error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * GET /api/v1/admin/customers
 *
 * Lists customers for a tenant with pagination, search, optional filters,
 * and configurable sorting. Production requests must pass `view_customers` 
 * plus tenant access checks.
 *
 * Query Parameters:
 *   - tenant_id (number, required)      : Tenant whose customers should be returned
 *   - page (number, default = 1)        : 1-based page index
 *   - pageSize (number, default = 20)   : Items per page
 *   - search (string, optional)         : Matches full_name, full_name_ar, phone, email
 *   - sortBy (string, default = created_at)
 *   - sortOrder ("asc" | "desc", default = "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data }
 *   - 401: { error }                     : Permission or tenant access denied
 *   - 500: { error }                     : Failed to fetch customers
 */
export async function GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const tenant_id = searchParams.get("tenant_id");

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_customers");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Build WHERE clause
    let where = "c.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (search) {
      where += " AND (c.full_name LIKE ? OR c.full_name_ar LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get total count
    const [countRows] = await pool.query(`SELECT COUNT(*) as count FROM customers c WHERE ${where}`, params);
    const count = (countRows as Array<{ count: number }>)[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // Get paginated data
    const [customers] = await pool.query(
      `SELECT c.id, c.full_name, c.full_name_ar, c.phone, c.email, c.address, c.address_ar, c.credit_limit, c.created_at,
              b.id AS branch_id, b.name AS branch_name
       FROM customers c
       LEFT JOIN branches b ON b.id = c.branch_id
       WHERE ${where}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json({ count, page, pageSize, totalPages, data: customers }, { status: 200 });

  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/customers
 *
 * Soft-deletes multiple customers that belong to the provided tenant. Production requests
 * must pass `delete_customer` permission and confirm tenant access.
 *
 * Request Body:
 *   - tenant_id (number, required)        : Tenant whose customers are being deleted
 *   - customer_ids (number[], required)   : IDs of the customers to soft-delete
 *
 * Responses:
 *   - 200: { message }                     : Indicates how many customers were deleted
 *   - 400: { error }                       : Missing or invalid payload
 *   - 401: { error }                       : Permission or tenant access denied
 *   - 404: { error }                       : No matching active customers were found
 *   - 500: { error }                       : Internal server error
 */
export async function DELETE(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const { tenant_id, customer_ids } = await req.json();

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingCustomerIds", lang) }, { status: 400 });
    }

    const normalizedIds = customer_ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id));
    if (!normalizedIds.length) {
      return NextResponse.json({ error: getErrorMessage("invalidCustomerIds", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_customers");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Ensure target customers exist and belong to tenant
    const [targetCustomers] = await pool.query(
      `SELECT id FROM customers WHERE id IN (?) AND tenant_id = ?`,
      [normalizedIds, tenant_id]
    );
    const customersArr = targetCustomers as Array<{ id: number }>;
    if (!customersArr.length) {
      return NextResponse.json({ error: getErrorMessage("noCustomersFound", lang) }, { status: 404 });
    }

    const deletableIds = customersArr.map(c => c.id);
    await pool.query(
      `DELETE FROM customers WHERE id IN (?) AND tenant_id = ?`,
      [deletableIds, tenant_id]
    );

    return NextResponse.json({ message: errorMessages[lang].deleted(deletableIds.length) }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
