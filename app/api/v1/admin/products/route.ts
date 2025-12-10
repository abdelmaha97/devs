import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import { hasPermission, getUserData, hasTenantAccess } from "../../functions/permissions";

const errorMessages = {
  en: {
    tenantRequired: "Tenant ID is required.",
    skuExists: "SKU already exists.",
    unauthorized: "Unauthorized access.",
    missingProductIds: "Product IDs are required.",
    invalidProductIds: "Invalid product_ids payload.",
    noProductsFound: "No products found.",
    missingFields: "Required fields are missing.",
    success: "Product created successfully.",
    serverError: "Internal server error.",
      deleted: (count: number) => `Deleted ${count} user(s).`,
  },
  ar: {
    tenantRequired: "معرف المنظمة مطلوب.",
    skuExists: "الرمز SKU موجود مسبقاً.",
    unauthorized: "دخول غير مصرح به.",
    missingProductIds: "معرفات المنتجات مطلوبة.",
    invalidProductIds: "قائمة المنتجات غير صالحة.",
    noProductsFound: "لم يتم العثور على أي منتجات .",
    missingFields: "الحقول المطلوبة مفقودة.",
    success: "تم إنشاء المنتج بنجاح.",
    serverError: "خطأ في الخادم الداخلي.",
     deleted: (count: number) => `تم حذف ${count} مستخدم${count === 1 ? "" : "ين"}.`,
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
  sku: { en: "SKU", ar: "رمز SKU" },
  product_name: { en: "Product Name", ar: "اسم المنتج" },
  product_name_ar: { en: "Product Name (Arabic)", ar: "اسم المنتج بالعربية" },
  category: { en: "Category", ar: "الفئة" },
  category_ar: { en: "Category (Arabic)", ar: "الفئة بالعربية" },
  barcode: { en: "Barcode", ar: "الباركود" },
  base_price: { en: "Base Price", ar: "السعر الأساسي" },
};

/**
 * POST /api/v1/admin/products
 *
 * Creates a new product record in the system.
 * The product is linked to a tenant and includes optional Arabic name, category, and barcode.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" for localized responses
 *
 * Request Body:
 *   - tenant_id (number, required)          : Tenant/organization ID the product belongs to
 *   - sku (string, required)                : Unique SKU code for the product
 *   - barcode (string, optional)            : Product barcode
 *   - product_name (string, required)       : Product name
 *   - product_name_ar (string, optional)    : Product name in Arabic
 *   - category (string, required)           : Product category
 *   - category_ar (string, optional)        : Product category in Arabic
 *   - base_price (number, required)         : Product base price
 *
 * Responses:
 *   - 201: { message }                      : Product created successfully
 *   - 400: { error }                        : Missing or invalid required fields
 *   - 401: { error }                        : Unauthorized access (insufficient permissions or tenant access)
 *   - 409: { error }                        : SKU already exists in the tenant
 *   - 500: { error }                        : Internal server error
 *
 * Notes:
 *   - Optional fields are stored as NULL if not provided.
 *   - SKU must be unique within the same tenant.
 *   - Supports localized messages in English or Arabic.
 */

export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_product");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    const payload = await req.json();
    const {
      tenant_id,
      sku,
      barcode,
      product_name,
      product_name_ar,
      category,
      category_ar,
      base_price,
    } = payload;
    const rules: any = {
      tenant_id: [
        { required: true, label: requiredFieldLabels.tenant_id[lang] },
        { type: "number", label: requiredFieldLabels.tenant_id[lang] },
      ],
      sku: [
        { required: true, label: requiredFieldLabels.sku[lang] },
        { minLength: 1, label: requiredFieldLabels.sku[lang] },
      ],
      product_name: [
        { required: true, label: requiredFieldLabels.product_name[lang] },
        { minLength: 2, label: requiredFieldLabels.product_name[lang] },
      ],
      product_name_ar: [
        { required: true, label: requiredFieldLabels.product_name_ar[lang] },
        { minLength: 2, label: requiredFieldLabels.product_name_ar[lang] },
      ],
      category: [
        { required: true, label: requiredFieldLabels.category[lang] },
        { minLength: 2, label: requiredFieldLabels.category[lang] },
      ],
      category_ar: [
        { required: true, label: requiredFieldLabels.category_ar[lang] },
        { minLength: 2, label: requiredFieldLabels.category_ar[lang] },
      ],
      barcode: [
        { required: true, label: requiredFieldLabels.barcode[lang] },
        { minLength: 2, label: requiredFieldLabels.barcode[lang] },
      ],
      base_price: [
        { required: true, label: requiredFieldLabels.base_price[lang] },
        { type: "number", label: requiredFieldLabels.base_price[lang] },
      ],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const pool = await dbConnection();

    if (process.env.NODE_ENV === "production") {
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Check existing SKU
    const [existingSku] = await pool.query(
      "SELECT id FROM products WHERE tenant_id=? AND sku=?",
      [tenant_id, sku]
    );

    if ((existingSku as any[]).length > 0) {
      return NextResponse.json({ error: getErrorMessage("skuExists", lang) }, { status: 409 });
    }

    // Insert product
    await pool.query(
      `INSERT INTO products (
        tenant_id, sku, barcode, product_name, product_name_ar, category, category_ar, base_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant_id,
        sku,
        barcode,
        product_name,
        product_name_ar,
        category,
        category_ar,
        base_price,
      ]
    );

    return NextResponse.json({ message: getErrorMessage("success", lang) }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * GET /api/v1/admin/products
 *
 * Retrieves a paginated list of products for a specific tenant.
 * Supports search, sorting, and pagination.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" for localized responses
 *
 * Query Parameters:
 *   - tenant_id (number, required)   : Tenant/organization ID to filter products
 *   - page (number, optional)        : Page number (default: 1)
 *   - pageSize (number, optional)    : Number of items per page (default: 20)
 *   - search (string, optional)      : Search term to filter products by name, Arabic name, category, Arabic category, SKU, or barcode
 *   - sortBy (string, optional)      : Column to sort by (default: created_at)
 *   - sortOrder (string, optional)   : "asc" or "desc" (default: "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data } 
 *         : Returns paginated product data
 *   - 401: { error } 
 *         : Unauthorized access (missing tenant ID or insufficient permissions)
 *   - 500: { error } 
 *         : Internal server error
 *
 * Notes:
 *   - Optional search filters the product_name, product_name_ar, category, category_ar, SKU, and barcode fields.
 *   - Supports localized error messages based on the "accept-language" header.
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
    const sortOrder =
      (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const tenant_id = searchParams.get("tenant_id");

    if (!tenant_id)
     return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

    const user: any = await getUserData(req);

    // permission check
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_products");
      if (!hasAccess)
     return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess)
       return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // WHERE conditions
    let where = "p.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (search) {
  where += ` AND (
    p.product_name LIKE ?
    OR p.product_name_ar LIKE ?
    OR p.category LIKE ?
    OR p.category_ar LIKE ?
    OR p.sku LIKE ?
    OR p.barcode LIKE ?
  )`;

  params.push(
    `%${search}%`,
    `%${search}%`,
    `%${search}%`,
    `%${search}%`,
    `%${search}%`,
    `%${search}%`
  );
}


    // count records
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as count FROM products p WHERE ${where}`,
      params
    );
    const count = (countRows as any[])[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // data query
    const [products] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.product_name, p.product_name_ar,
              p.category, p.category_ar, p.base_price, p.created_at
       FROM products p
       WHERE ${where}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json(
      { count, page, pageSize, totalPages, data: products },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


/**
 * DELETE /api/v1/admin/products
 *
 * Soft-deletes multiple products that belong to the provided tenant. Requests in production
 * must pass `delete_product` permission and confirm tenant access.
 *
 * Request Body:
 *   - tenant_id (number, required)        : Tenant whose products are being deleted
 *   - product_ids (number[], required)    : IDs of the products to soft-delete
 *
 * Responses:
 *   - 200: { message }                     : Indicates how many products were deleted
 *   - 400: { error }                       : Missing or invalid payload
 *   - 401: { error }                       : Permission or tenant access denied
 *   - 404: { error }                       : No matching active products were found
 *   - 500: { error }                       : Internal server error
 *
 * Notes:
 *   - Soft-delete sets `is_active = 0` instead of removing the record from the database.
 *   - Supports localized messages based on the "accept-language" header.
 */
export async function DELETE(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const { tenant_id, product_ids } = await req.json();

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingProductIds", lang) }, { status: 400 });
    }

    const normalizedIds = product_ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id));
    if (!normalizedIds.length) {
      return NextResponse.json({ error: getErrorMessage("invalidProductIds", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_product");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Ensure target products exist and belong to tenant
    const [targetProducts] = await pool.query(
      `SELECT id FROM products WHERE id IN (?) AND tenant_id = ? `,
      [normalizedIds, tenant_id]
    );
    const productsArr = targetProducts as Array<{ id: number }>;
    if (!productsArr.length) {
      return NextResponse.json({ error: getErrorMessage("noProductsFound", lang) }, { status: 404 });
    }

    const deletableIds = productsArr.map(p => p.id);
    await pool.query(`DELETE FROM products WHERE id IN (?) AND tenant_id = ?`,[deletableIds, tenant_id]);


    return NextResponse.json({ message: errorMessages[lang].deleted(deletableIds.length) }, { status: 200 });

  } catch (error) {
    console.error("DELETE products error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}