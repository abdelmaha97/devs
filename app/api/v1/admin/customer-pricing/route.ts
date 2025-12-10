
import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import { hasPermission, getUserData, hasTenantAccess } from "../../functions/permissions";
const errorMessages = {
  en: {
    tenantRequired: "Tenant ID is required.",
    unauthorized: "Unauthorized access.",
    exists: "Pricing for this customer and product already exists.",
    success: "Customer pricing created successfully.",
    serverError: "Internal server error.",
    customerNotFoundForTenant: "Customer not found for this tenant.",
    productNotFoundForTenant: "Product not found for this tenant.",
    deleted: (count: number) => `Deleted ${count} customer pricing entry(s).`,
    invalidCustomerPricingIds: "One or more Customer Pricing IDs are invalid ",
    missingCustomerPricingIds: "Customer Pricing IDs are required",
    noCustomerPricingFound:"No customer pricing entries found for the given criteria.",
     customerPricingExists: "Customer pricing already exists for this customer and product.",
  },
  ar: {
    tenantRequired: "معرف المنظمة مطلوب.",
    unauthorized: "دخول غير مصرح به.",
    exists: "السعر الخاص لهذا الزبون والمنتج موجود مسبقاً.",
    success: "تم إنشاء السعر الخاص للزبون بنجاح.",
    serverError: "خطأ في الخادم الداخلي.",
    customerNotFoundForTenant: "الزبون غير موجود ضمن هذه المنظمة.",
    productNotFoundForTenant: "المنتج غير موجود ضمن هذه المنظمة.",
    deleted: (count: number) => `تم حذف ${count} إدخال تسعير للعميل${count === 1 ? "" : "ات"}.`,
    invalidCustomerPricingIds: "معرف واحد أو أكثر غير صالح .",
    missingCustomerPricingIds: "معرفات اسعار العملاء مطلوبة.",
    noCustomerPricingFound:"لم يتم العثور على أي إدخالات لتسعير العملاء للمعايير المحددة.",
     customerPricingExists: "تسعير العميل موجود مسبقًا لهذا العميل والمنتج.",
  },
};

function getErrorMessage(
  key: keyof typeof errorMessages["en"],
  lang: "en" | "ar" = "en"
) {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

const requiredFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  customer_id: { en: "Customer", ar: "الزبون" },
  product_id: { en: "Product", ar: "المنتج" },
  special_price: { en: "Special Price", ar: "السعر الخاص" },
};

/**
 * POST /api/v1/admin/customer-pricing
 *
 * Creates a new customer-specific pricing record.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Request Body:
 *   - tenant_id (number, required)     : Tenant ID
 *   - customer_id (number, required)   : Customer ID
 *   - product_id (number, required)    : Product ID
 *   - special_price (number, required) : Special price for this customer
 *
 * Responses:
 *   - 201: { message, id }             : Created successfully
 *   - 400: { error }                    : Missing or invalid fields
 *   - 401: { error }                    : Unauthorized / tenant access denied
 *   - 404: { error }                    : Customer or Product not found
 *   - 500: { error }                    : Internal server error
 */
export async function POST(req: NextRequest) {

const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
  try {
      
 const user: any = await getUserData(req);

    const payload = await req.json();
    const { tenant_id, customer_id, product_id, special_price } = payload;

     if (!tenant_id) {
       return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
     }
 if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_product");
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
      tenant_id: [
        { required: true, label: requiredFieldLabels.tenant_id[lang] },
        { type: "number", label: requiredFieldLabels.tenant_id[lang] },
      ],
      customer_id: [
        { required: true, label: requiredFieldLabels.customer_id[lang] },
        { type: "number", label: requiredFieldLabels.customer_id[lang] },
      ],
      product_id: [
        { required: true, label: requiredFieldLabels.product_id[lang] },
        { type: "number", label: requiredFieldLabels.product_id[lang] },
      ],
      special_price: [
        { required: true, label: requiredFieldLabels.special_price[lang] },
        { type: "number", label: requiredFieldLabels.special_price[lang] },
      ],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const pool = await dbConnection();


      const [existingSku] = await pool.query(
          "SELECT id FROM customer_pricing WHERE tenant_id=? AND customer_id=? AND product_id=?",
          [tenant_id, customer_id,product_id]
        );
    
        if ((existingSku as any[]).length > 0) {
          return NextResponse.json({ error: getErrorMessage("customerPricingExists", lang) }, { status: 409 });
        }
    // Check if customer exists
    const [customer] = await pool.query(
      `SELECT id FROM customers WHERE id = ? AND tenant_id = ?`,
      [customer_id, tenant_id]
    );
    if (!(customer as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("customerNotFoundForTenant", lang) }, { status: 404 });
    }

    // Check if product exists
    const [product] = await pool.query(
      `SELECT id FROM products WHERE id = ? AND tenant_id = ?`,
      [product_id, tenant_id]
    );
    if (!(product as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("productNotFoundForTenant", lang) }, { status: 404 });
    }

    // Insert customer pricing
    const [result]: any = await pool.query(
      `INSERT INTO customer_pricing (tenant_id, customer_id, product_id, special_price)
       VALUES (?, ?, ?, ?)`,
      [tenant_id, customer_id, product_id, special_price]
    );

    return NextResponse.json(
      { message: getErrorMessage("success", lang), id: result.insertId },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST customer_pricing error:", error);
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}
/**
 * GET /api/v1/admin/customer-pricing
 *
 * Retrieves a paginated list of customer pricing entries for a specific tenant.
 * Supports optional customer filter, search, sorting, and pagination.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" for localized responses
 *
 * Query Parameters:
 *   - tenant_id (number, required)    : Tenant/organization ID to filter
 *   - customer_id (number, optional)  : Filter by specific customer
 *   - page (number, optional)         : Page number (default: 1)
 *   - pageSize (number, optional)     : Items per page (default: 20)
 *   - search (string, optional)       : Search by product name (English/Arabic) or SKU
 *   - sortBy (string, optional)       : Column to sort by (default: created_at)
 *   - sortOrder (string, optional)    : "asc" or "desc" (default: "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data }
 *   - 401: { error } Unauthorized
 *   - 500: { error } Internal server error
 */
export async function GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "c.created_at";
    const sortOrder =
      (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const tenant_id = searchParams.get("tenant_id");
    const customer_id = searchParams.get("customer_id");

    if (!tenant_id)
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

    const user: any = await getUserData(req);

    // permission check
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_customer_pricing");
      if (!hasAccess)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // WHERE conditions
    let where = "cp.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (customer_id) {
      where += " AND cp.customer_id = ?";
      params.push(customer_id);
    }

    if (search) {
      where += ` AND (
        p.product_name LIKE ?
        OR p.product_name_ar LIKE ?
        OR p.sku LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // count records
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as count
       FROM customer_pricing cp
       JOIN products p ON cp.product_id = p.id
       WHERE ${where}`,
      params
    );
    const count = (countRows as any[])[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // data query
    const [rows] = await pool.query(
      `SELECT cp.id, cp.customer_id, cp.product_id, cp.special_price,
              p.product_name, p.product_name_ar, p.sku, p.category, p.category_ar,
              cp.tenant_id
       FROM customer_pricing cp
       JOIN products p ON cp.product_id = p.id
       WHERE ${where}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json(
      { count, page, pageSize, totalPages, data: rows },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET customer pricing error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/customer-pricing
 *
 * Deletes multiple customer pricing entries for a tenant.
 * Production requests must pass `delete_customer_pricing` permission and confirm tenant access.
 *
 * Request Body:
 *   - tenant_id (number, required)               : Tenant whose customer pricing entries are being deleted
 *   - customer_pricing_ids (number[], required)  : IDs of customer pricing entries to delete
 *
 * Responses:
 *   - 200: { message }                           : Indicates how many entries were deleted
 *   - 400: { error }                             : Missing or invalid payload
 *   - 401: { error }                             : Permission or tenant access denied
 *   - 404: { error }                             : No matching entries found
 *   - 500: { error }                             : Internal server error
 */
export async function DELETE(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const { tenant_id, customer_pricing_ids } = await req.json();

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!Array.isArray(customer_pricing_ids) || customer_pricing_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingCustomerPricingIds", lang) }, { status: 400 });
    }

    const normalizedIds = customer_pricing_ids
      .map((id: any) => Number(id))
      .filter((id: number) => !Number.isNaN(id));

    if (!normalizedIds.length) {
      return NextResponse.json({ error: getErrorMessage("invalidCustomerPricingIds", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_customer_pricing");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Ensure target customer pricing entries exist and belong to tenant
    const [targetEntries] = await pool.query(
      `SELECT id FROM customer_pricing WHERE id IN (?) AND tenant_id = ?`,
      [normalizedIds, tenant_id]
    );
    const entriesArr = targetEntries as Array<{ id: number }>;
    if (!entriesArr.length) {
      return NextResponse.json({ error: getErrorMessage("noCustomerPricingFound", lang) }, { status: 404 });
    }

    const deletableIds = entriesArr.map(e => e.id);
    await pool.query(
      `DELETE FROM customer_pricing WHERE id IN (?) AND tenant_id = ?`,
      [deletableIds, tenant_id]
    );

    return NextResponse.json(
      { message: errorMessages[lang].deleted(deletableIds.length) },
      { status: 200 }
    );

  } catch (error) {
    console.error("DELETE customer pricing error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
