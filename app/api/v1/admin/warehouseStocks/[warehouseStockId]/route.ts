import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { getUserData, hasPermission, hasTenantAccess } from "../../../functions/permissions";
import { validateFields } from "../../../functions/validation";

const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    missingFields: "Required fields are missing.",
    serverError: "Internal server error.",
    success: "Stock entry updated successfully.",
    noStocksFound: "Stock entry not found.",
    productNotFoundFortenant: "Product not found for this tenant.",
    warehouseNotFoundFortenant: "Warehouse not found for this tenant.",
    duplicateStockForWarehouseProduct:"A duplicate stock entry already exists for this warehouse product",
    deletedSuccess:"Stock deleted successfully."
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    missingFields: "الحقول المطلوبة مفقودة.",
    serverError: "خطأ في الخادم الداخلي.",
    success: "تم تعديل السجل بنجاح.",
    noStocksFound: "لم يتم العثور على السجل.",
    productNotFoundFortenant: "المنتج غير موجود لهذه المنظمة.",
    warehouseNotFoundFortenant: "المخزن غير موجود لهذه المنظمة.",
    duplicateStockForWarehouseProduct:"يوجد سجل مخزون مكرر لهذا المنتج في المستودع بالفعل.",
    deletedSuccess:"تم حذف السجل بنجاح"
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
 * PUT /api/v1/admin/warehouseStocks/[warehouseStockId]
 *
 * Updates warehouse, product, or quantity for a single warehouse stock entry.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - warehouseStockId (number, required) : ID of the stock entry to update
 *
 * Request Body (JSON):
 *   - tenant_id (number, required)
 *   - warehouse_id (number, optional)
 *   - product_id (number, optional)
 *   - quantity (number, optional)
 *
 * Responses:
 *   - 200: { message }
 *   - 400: { error }
 *   - 401: { error }
 *   - 404: { error }
 *   - 500: { error }
 */
export async function PUT(req: NextRequest, { params }: any) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const warehouseStockId = params.warehouseStockId;
    const payload = await req.json();
    const { tenant_id, warehouse_id, product_id, quantity } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "update_warehouse_stock");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Validate fields
    const stockRules: any = {
      tenant_id: [{ required: true, label: stockFieldLabels.tenant_id[lang] }],
      warehouse_id: [{ required: false, label: stockFieldLabels.warehouse_id[lang] }],
      product_id: [{ required: false, label: stockFieldLabels.product_id[lang] }],
      quantity: [{ required: false, label: stockFieldLabels.quantity[lang] }],
    };
    const { valid, errors } = validateFields(payload, stockRules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    // Ensure stock exists
    const [existing] = await pool.query(
      `SELECT * FROM warehouse_stock WHERE id = ? AND tenant_id = ?`,
      [warehouseStockId, tenant_id]
    );
    const stock = (existing as any[])[0];
    if (!stock) return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 404 });

    // Validate warehouse exists if updated
    if (warehouse_id != null && warehouse_id !== stock.warehouse_id) {
      const [warehouses] = await pool.query(
        `SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?`,
        [warehouse_id, tenant_id]
      );
      if ((warehouses as any[]).length === 0) {
        return NextResponse.json({ error: getErrorMessage("warehouseNotFoundFortenant", lang) }, { status: 404 });
      }
    }

    // Validate product exists if updated
    if (product_id != null && product_id !== stock.product_id) {
      const [products] = await pool.query(
        `SELECT id FROM products WHERE id = ? AND tenant_id = ?`,
        [product_id, tenant_id]
      );
      if ((products as any[]).length === 0) {
        return NextResponse.json({ error: getErrorMessage("productNotFoundFortenant", lang) }, { status: 404 });
      }
    }

    if ((warehouse_id != null || product_id != null)) {
      const newWarehouse = warehouse_id ?? stock.warehouse_id;
      const newProduct = product_id ?? stock.product_id;

      const [dup] = await pool.query(
        `SELECT id FROM warehouse_stock 
         WHERE warehouse_id = ? AND product_id = ? AND tenant_id = ? AND id != ? LIMIT 1`,
        [newWarehouse, newProduct, tenant_id, warehouseStockId]
      );

      if ((dup as any[]).length > 0) {
        return NextResponse.json(
          { error: getErrorMessage("duplicateStockForWarehouseProduct", lang) },
          { status: 400 }
        );
      }
    }

    // Build update SQL
    const updates: string[] = [];
    const paramsArr: any[] = [];

    if (warehouse_id != null) { updates.push("warehouse_id = ?"); paramsArr.push(warehouse_id); }
    if (product_id != null) { updates.push("product_id = ?"); paramsArr.push(product_id); }
    if (quantity != null) { updates.push("quantity = ?"); paramsArr.push(quantity); }

    updates.push("updated_at = NOW()");

    await pool.query(
      `UPDATE warehouse_stock SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...paramsArr, warehouseStockId, tenant_id]
    );

    return NextResponse.json({ message: getErrorMessage("success", lang) }, { status: 200 });

  } catch (error) {
    console.error("Update stock error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * GET /api/v1/admin/warehouseStocks/[warehouseStockId]
 *
 * Returns a single warehouse stock entry by ID for a given tenant. Production requests require
 * `view_warehouse_stock` permission and tenant access verification.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - warehouseStockId (number, required)             : Stock entry ID to fetch
 *
 * Query Parameters:
 *   - tenant_id (number, required)           : Tenant to which the stock belongs
 *
 * Responses:
 *   - 200: stock object                       : All fields of the selected stock entry
 *   - 400: { error }                          : Missing stock ID or tenant ID
 *   - 401: { error }                          : Unauthorized access or tenant permission denied
 *   - 404: { error }                          : Stock entry not found
 *   - 500: { error }                          : Internal server error
 */
export async function GET(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get("tenant_id");
    const stockId = params.warehouseStockId;

    if (!tenant_id) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    if (!stockId) return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 400 });

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_warehouse_stock");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const pool = await dbConnection();
    const [rows] = await pool.query(
      `SELECT ws.*, w.name AS warehouse_name, w.name_ar AS warehouse_name_ar,
              p.product_name AS product_name, p.product_name_ar AS product_name_ar
       FROM warehouse_stock ws
       LEFT JOIN warehouses w ON w.id = ws.warehouse_id
       LEFT JOIN products p ON p.id = ws.product_id
       WHERE ws.id = ? AND ws.tenant_id = ?`,
      [stockId, tenant_id]
    );

    const stock = (rows as any[])[0];
    if (!stock) return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 404 });

    return NextResponse.json(stock, { status: 200 });
  } catch (error) {
    console.error("GET warehouse stock by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/warehouseStocks/[warehouseStockId]
 *
 * Deletes a single stock entry for a given tenant.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 * Path Parameters:
 *   - warehouseStockId (number, required)             : Stock entry ID to fetch
 *
 * Query Parameters:
 *   - tenant_id (number, required) : Tenant whose stock entry is being deleted
 *
 * Responses:
 *   - 200: { message }
 *   - 400: { error }  : Missing tenant_id or invalid warehouseStockId
 *   - 401: { error }  : Unauthorized access or tenant denied
 *   - 404: { error }  : Stock not found
 *   - 500: { error }  : Internal server error
 */

export async function DELETE(req: NextRequest, { params }: any) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const stock_id = Number(params.warehouseStockId);

    const { searchParams } = new URL(req.url);
    const tenant_id = Number(searchParams.get("tenant_id"));

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (!stock_id || isNaN(stock_id)) {
      return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_warehouse_stock");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Check if stock exists for this tenant
    const [rows] = await pool.query(
      `SELECT id FROM warehouse_stock WHERE id = ? AND tenant_id = ?`,
      [stock_id, tenant_id]
    );

    if (!(rows as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("noStocksFound", lang) }, { status: 404 });
    }

    await pool.query(
      `DELETE FROM warehouse_stock WHERE id = ? AND tenant_id = ?`,
      [stock_id, tenant_id]
    );

return NextResponse.json({ message: getErrorMessage("deletedSuccess", lang) }, { status: 200 });

  } catch (error) {
    console.error("DELETE stock error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
