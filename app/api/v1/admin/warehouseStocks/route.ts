import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { getUserData, hasPermission, hasTenantAccess } from "../../functions/permissions";
import { validateFields } from "../../functions/validation";

const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    missingFields: "Required fields are missing.",
    serverError: "Internal server error.",
    success: "Stock entry created successfully.",
    missingWarehouseId: "Warehouse ID is required.",
    missingProductId: "Product ID is required.",
    noStocksFound: "No matching stock entries were found.",
    deleted: (count: number) => `Deleted ${count} stock entry(s).`,
    productNotFoundFortenant: "Product not found for this tenant.",
       warehouseNotFoundFortenant: "Warehouse not found for this tenant.",
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    missingFields: "الحقول المطلوبة مفقودة.",
    serverError: "خطأ في الخادم الداخلي.",
    success: "تم إنشاء السجل بنجاح.",
    missingWarehouseId: "معرف المخزن مطلوب.",
    missingProductId: "معرف المنتج مطلوب.",
    noStocksFound: "لم يتم العثور على سجلات مطابقة.",
    deleted: (count: number) => `تم حذف ${count} سجل${count === 1 ? "" : "وص"}.`,
     productNotFoundFortenant: "المنتج غير موجود لهذه المنظمة.",
    warehouseNotFoundFortenant: "المخزن غير موجود لهذه المنظمة.",
  },
};

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

const stockFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  warehouse_id: { en: "Warehouse", ar: "المخزن" },
  product_id: { en: "Product", ar: "المنتج" },
  quantity: { en: "Quantity", ar: "الكمية" },
};

/**
 * POST /api/v1/admin/warehouseStocks
 *
 * Creates a new stock entry for a specific warehouse and product under a tenant.
 * 
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" (used for localized error/messages)
 * 
 * Request Body (JSON):
 *   - tenant_id (number, required)      : ID of the tenant to which the stock belongs
 *   - warehouse_id (number, required)   : ID of the warehouse where stock is added
 *   - product_id (number, required)     : ID of the product for which stock is added
 *   - quantity (number, optional)       : Initial quantity (default is 0 if not provided)
 *
 * Responses:
 *   - 201: { message, stock_id }        : Successfully created stock entry
 *   - 400: { error }                    : Missing required fields or validation errors
 *   - 401: { error }                    : Unauthorized access or tenant permission denied
 *   - 409: { error }                    : Stock entry already exists
 *   - 500: { error }                    : Internal server error
 */

export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const payload = await req.json();
    const { tenant_id, warehouse_id, product_id, quantity } = payload;
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_warehouse_stock");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const stockRules: any = {
      tenant_id: [{ required: true, label: stockFieldLabels.tenant_id[lang] }],
      warehouse_id: [{ required: true, label: stockFieldLabels.warehouse_id[lang] }],
      product_id: [{ required: true, label: stockFieldLabels.product_id[lang] }],
      quantity: [{ required: false, label: stockFieldLabels.quantity[lang] }],
    };

    const { valid, errors } = validateFields(payload, stockRules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    const [existing] = await pool.query(
      `SELECT * FROM warehouse_stock WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?`,
      [tenant_id, warehouse_id, product_id]
    );

    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: "Stock entry already exists." }, { status: 409 });
    }


 // Check if warehouse exists and belongs to same tenant
    if (warehouse_id != null) {
      const [warehouses] = await pool.query(
        `SELECT id FROM warehouses WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [warehouse_id, tenant_id]
      );
      const warehouse = (warehouses as any[])[0];
      if (!warehouse) return NextResponse.json({ error: getErrorMessage("warehouseNotFoundFortenant", lang) }, { status: 404 });
    }


    if (product_id != null) {
      const [products] = await pool.query(
        `SELECT id FROM products WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [product_id, tenant_id]
      );
      const product = (products as any[])[0];
      if (!product) return NextResponse.json({ error: getErrorMessage("productNotFoundFortenant", lang) }, { status: 404 });
    }



    const [result] = await pool.query(
      `INSERT INTO warehouse_stock (tenant_id, warehouse_id, product_id, quantity) VALUES (?, ?, ?, ?)`,
      [tenant_id, warehouse_id, product_id, quantity || 0]
    );

    return NextResponse.json({ message: getErrorMessage("success", lang), stock_id: (result as any).insertId }, { status: 201 });
  } catch (error) {
    console.error("Create stock error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}/**
 * GET /api/v1/admin/warehouseStocks
 *
 * Lists stock entries for a tenant with pagination, search, optional filters,
 * and configurable sorting. Production requests must pass `view_warehouse_stock` 
 * plus tenant access checks.
 *
 * Query Parameters:
 *   - tenant_id (number, required)      : Tenant whose stock entries should be returned
 *   - page (number, default = 1)        : 1-based page index
 *   - pageSize (number, default = 20)   : Items per page
 *   - search (string, optional)         : Matches product_name
 *   - warehouse_id (number, optional)   : Filter by warehouse
 *   - product_id (number, optional)     : Filter by product
 *   - sortBy (string, default = updated_at)
 *   - sortOrder ("asc" | "desc", default = "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data }
 *   - 401: { error }                     : Permission or tenant access denied
 *   - 500: { error }                     : Failed to fetch stock entries
 */
export async function GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "updated_at";
    const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const tenant_id = searchParams.get("tenant_id");
    const warehouse_id = searchParams.get("warehouse_id");
    const product_id = searchParams.get("product_id");

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_warehouse_stock");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Build WHERE clause
    let where = "ws.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (warehouse_id) {
      where += " AND ws.warehouse_id = ?";
      params.push(warehouse_id);
    }

    if (product_id) {
      where += " AND ws.product_id = ?";
      params.push(product_id);
    }

    if (search) {
      where += " AND p.product_name LIKE ?";
      params.push(`%${search}%`);
    }

    // Get total count
    const [countRows] = await pool.query(`SELECT COUNT(*) as count 
                                          FROM warehouse_stock ws 
                                          LEFT JOIN products p ON p.id = ws.product_id
                                          WHERE ${where}`, params);
    const count = (countRows as Array<{ count: number }>)[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // Get paginated data
    const [stocks] = await pool.query(
      `SELECT ws.*, w.name AS warehouse_name, w.name_ar AS warehouse_name_ar, 
              p.product_name AS product_name, p.product_name_ar AS product_name_ar
       FROM warehouse_stock ws
       LEFT JOIN warehouses w ON w.id = ws.warehouse_id
       LEFT JOIN products p ON p.id = ws.product_id
       WHERE ${where}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json({ count, page, pageSize, totalPages, data: stocks }, { status: 200 });

  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET warehouse stocks error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}


/**
 * DELETE /api/v1/admin/warehouseStocks
 *
 * Deletes one or multiple stock entries for a given tenant.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" (used for localized error/messages)
 *
 * Request Body:
 *   - tenant_id (number, required)      : Tenant whose stock entries are being deleted
 *   - stock_ids (number[], required)    : IDs of the stock entries to delete
 *
 * Responses:
 *   - 200: { message }                  : Indicates how many stock entries were deleted
 *   - 400: { error }                     : Missing tenant_id or invalid stock_ids
 *   - 401: { error }                     : Unauthorized access or tenant permission denied
 *   - 404: { error }                     : No matching stock entries were found
 *   - 500: { error }                     : Internal server error
 */

export async function DELETE(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
  try {
    const pool = await dbConnection();
    const { tenant_id, stock_ids } = await req.json();

    if (!tenant_id) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    if (!Array.isArray(stock_ids) || stock_ids.length === 0) return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 400 });

    const normalizedIds = stock_ids.map((id: any) => Number(id)).filter(id => !isNaN(id));
    if (!normalizedIds.length) return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 400 });

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_warehouse_stock");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const [targetStocks] = await pool.query(
      `SELECT id FROM warehouse_stock WHERE id IN (?) AND tenant_id = ?`,
      [normalizedIds, tenant_id]
    );

    const stocksArr = targetStocks as Array<{ id: number }>;
    if (!stocksArr.length) return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 404 });

    const deletableIds = stocksArr.map(s => s.id);
    await pool.query(`DELETE FROM warehouse_stock WHERE id IN (?) AND tenant_id = ?`, [deletableIds, tenant_id]);

    return NextResponse.json({ message: errorMessages[lang].deleted(deletableIds.length) }, { status: 200 });
  } catch (error) {
    console.error("DELETE stock error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
