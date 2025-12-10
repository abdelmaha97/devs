
import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import { hasPermission, getUserData, hasTenantAccess } from "../../functions/permissions";
const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    salesOrderNotFound: "Sales order not found for this tenant.",
    productNotFound: "Product not found.",
    deletedSuccess: "Sales order item deleted successfully",
    updateSuccess: "Sales order item updated successfully",
    noDataToUpdate: "No data to update",
      success: "Sales order item created successfully",
    missingItemId: "Sales order item ID is required",
    duplicateItem: "This product already exists in the sales order.",
    noItemFound:"No matching sales order items found"
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    salesOrderNotFound: "طلب المبيعات غير موجود ضمن هذه المنظمة.",
    productNotFound: "المنتج غير موجود.",
    deletedSuccess: "تم حذف عنصر طلب المبيعات بنجاح",
    updateSuccess: "تم تعديل عنصر طلب المبيعات بنجاح",
    noDataToUpdate: "لا يوجد بيانات للتعديل",
      success: "تم إنشاء عنصر طلب المبيعات بنجاح",
    missingItemId: "معرف عنصر طلب المبيعات مطلوب",
     duplicateItem: "هذا المنتج موجود مسبقًا ضمن طلب المبيعات.",
      noItemFound:"لا يوجد عناصر طلب مبيعات مطابقة"
  }
};

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}
/**
 * POST /api/v1/admin/sales-order-items
 *
 * Creates a new sales order item for a specific sales order.
 * Validates tenant ownership, checks that the sales order and product exist,
 * prevents duplicate items for the same sales order, and validates numeric fields.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Query Parameters:
 *   - tenant_id (number, required): Tenant ID to which the sales order belongs
 *
 * Request Body (JSON):
 *   - sales_order_id (number, required) : Sales order to which the item belongs
 *   - product_id (number, required)     : Product being added
 *   - quantity (number, required)       : Quantity of the product
 *   - price (number, optional)          : Unit price of the product
 *   - total (number, optional)          : Total price for this item (calculated if not provided)
 *
 * Validation:
 *   ✔ Ensures required fields exist and are numeric
 *   ✔ Checks that sales order exists under the tenant
 *   ✔ Checks that product exists
 *   ✔ Prevents duplicate product in the same sales order
 *   ✔ Validates optional fields (price, total)
 *
 * Responses:
 *   - 201: { message, item_id } : Item created successfully
 *   - 400: { error }             : Missing/invalid fields or duplicate item
 *   - 401: { error }             : Unauthorized access or tenant mismatch
 *   - 404: { error }             : Sales order or product not found
 *   - 500: { error }             : Internal server error
 */


export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const user: any = await getUserData(req);

    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get("tenant_id"); // هنا tenant_id من query params

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const payload = await req.json();
    const { sales_order_id, product_id, quantity, price, total } = payload;
const rules: any = {
  sales_order_id: [
    { required: true, label: { en: "Sales Order ID", ar: "معرف طلب المبيعات" } },
    { type: "number" }
  ],
  product_id: [
    { required: true, label: { en: "Product ID", ar: "معرف المنتج" } },
    { type: "number" }
  ],
  quantity: [
    { required: true, label: { en: "Quantity", ar: "الكمية" } },
    { type: "number" }
  ],
  price: [
    { required: false, label: { en: "Price", ar: "السعر" } },
    { type: "number" }
  ],
  total: [
    { required: false, label: { en: "Total", ar: "الإجمالي" } },
    { type: "number" }
  ],
};


    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    // Permission + tenant access check
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_sales_orders");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }
const [existingItems] = await pool.query(
  `SELECT id FROM sales_order_items WHERE sales_order_id = ? AND product_id = ?`,
  [sales_order_id, product_id]
);

if ((existingItems as any[]).length > 0) {
  return NextResponse.json(
    { error: getErrorMessage("duplicateItem", lang) },
    { status: 400 }
  );
}

    // Check sales order existence
    const [orders] = await pool.query(
      `SELECT id FROM sales_orders WHERE id = ? AND tenant_id = ?`,
      [sales_order_id, tenant_id]
    );
    if (!(orders as any[]).length) return NextResponse.json({ error: getErrorMessage("salesOrderNotFound", lang) }, { status: 404 });

    // Check product existence
    const [products] = await pool.query(
      `SELECT id FROM products WHERE id = ?`,
      [product_id]
    );
    if (!(products as any[]).length) return NextResponse.json({ error: getErrorMessage("productNotFound", lang) }, { status: 404 });

    // Insert sales order item
    const [result] = await pool.query(
      `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, price, total) VALUES (?, ?, ?, ?, ?)`,
      [sales_order_id, product_id, quantity, price || 0, total || (quantity * (price || 0))]
    );

    return NextResponse.json({ message: getErrorMessage("success", lang), item_id: (result as any).insertId }, { status: 201 });

  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("POST sales order item error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/sales-order-items
 *
 * Deletes one or multiple sales order items for a specific tenant.
 * Requires `delete_sales_orders` permission and valid tenant access in production.
 *
 * Request Body:
 *   - tenant_id (number, required)         : ID of the tenant to which the sales order belongs
 *   - sales_order_item_ids (number[], required): List of sales order item IDs to delete
 *
 * Responses:
 *   - 200: { message } : Sales order items deleted successfully
 *   - 400: { error }   : Missing required parameters or invalid list
 *   - 401: { error }   : Unauthorized (permission or tenant access failure)
 *   - 404: { error }   : No matching items found
 *   - 500: { error }   : Internal server error
 *
 * Notes:
 *   - Only items belonging to the specified tenant will be deleted
 *   - The list of IDs must be passed in the request body as an array of numbers
 */

export async function DELETE(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const user: any = await getUserData(req);

    const payload = await req.json();
    const { tenant_id, sales_order_item_ids } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!sales_order_item_ids || !Array.isArray(sales_order_item_ids) || sales_order_item_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingItemId", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_sales_orders");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // تحقق من وجود العناصر ضمن الـ tenant
    const [existing] = await pool.query(
      `SELECT id FROM sales_order_items WHERE id IN (?) AND sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = ?)`,
      [sales_order_item_ids, tenant_id]
    );
    const existingIds = (existing as any[]).map(row => row.id);

    if (existingIds.length === 0) {
      return NextResponse.json({ message: getErrorMessage("noItemFound", lang) }, { status: 404 });
    }

    // حذف العناصر الموجودة فقط ضمن tenant
    await pool.query(
      `DELETE FROM sales_order_items WHERE id IN (?) AND sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = ?)`,
      [sales_order_item_ids, tenant_id]
    );

    return NextResponse.json({ message: getErrorMessage("deletedSuccess", lang) }, { status: 200 });
  } catch (error) {
    console.error("DELETE sales order items error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * GET /api/v1/admin/sales-order-items
 *
 * Retrieves a list of sales order items with optional filtering, sorting, and pagination.
 * Includes product and sales order info.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Query Parameters:
 *   - tenant_id (number, required)       : The tenant to which the orders belong
 *   - sales_order_id (number, optional)  : Filter items by specific sales order
 *   - product_id (number, optional)      : Filter items by specific product
 *   - page (number, optional)            : Page number for pagination (default: 1)
 *   - pageSize (number, optional)        : Number of records per page (default: 20)
 *   - sortBy (string, optional)          : Column to sort by (default: id)
 *   - sortOrder (string, optional)       : Sort direction: ASC or DESC (default: DESC)
 *
 * Responses:
 *   - 200: { total, page, pageSize, data } : Returns paginated sales order items with product info
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
    const sales_order_id = searchParams.get("sales_order_id");
    const product_id = searchParams.get("product_id");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const sortBy = searchParams.get("sortBy") || "id";
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

    // Build WHERE conditions dynamically with alias 'soi'
    const whereClauses: string[] = ["so.tenant_id = ?"];
    const params: any[] = [tenant_id];

    if (sales_order_id) {
      whereClauses.push("soi.sales_order_id = ?");
      params.push(sales_order_id);
    }
    if (product_id) {
      whereClauses.push("soi.product_id = ?");
      params.push(product_id);
    }

    const where = whereClauses.join(" AND ");

    // Get total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM sales_order_items soi
       LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
       LEFT JOIN products p ON soi.product_id = p.id
       WHERE ${where}`,
      params
    );
    const total = (countRows as any[])[0]?.count || 0;

    // Get paginated data with language support
    const productNameField = lang === "ar" ? "p.product_name_ar" : "p.product_name";

    const [rows] = await pool.query(
      `SELECT soi.*, so.id AS sales_order_id, ${productNameField} AS product_name
       FROM sales_order_items soi
       LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
       LEFT JOIN products p ON soi.product_id = p.id
       WHERE ${where}
       ORDER BY soi.${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json({ total, page, pageSize, data: rows }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET sales order items error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
