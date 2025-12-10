



import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { getUserData, hasPermission, hasTenantAccess } from "../../../functions/permissions";
import { validateFields } from "../../../functions/validation";

const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    branchNotFoundFortenant: "Branch not found for this tenant",
    WorkHouseExists:"Warehouse already Exists",
    missingWarehouseId: "Warehouse ID are required.",
    invalidWarehouseIds: "Invalid warehouse IDs.",
    noWarehousesFound: "No matching warehouses were found.",
    updatedSuccess: "warehouse updated successfully",
    deletedSuccess: "warehouse deleted successfully",
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    missingWarehouseId: "يجب تزويد رقم المخازن.",
    invalidWarehouseIds: "أرقام المخازن غير صالحة.",
    branchNotFoundFortenant: "الفرع غير موجود لهذه المنظمة",
    WorkHouseExists:"المخزن هذا موجود مسبقا لهذه الشركة",
    noWarehousesFound: "لم يتم العثور على مخازن مطابقة.",
    updatedSuccess: "تم تحديث بيانات المخزن بنجاح",
    deletedSuccess:"تم حذف المخزن بنجاح"
  },
};

function getWarehouseErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

const warehouseFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  name: { en: "Warehouse Name", ar: "اسم المستودع" },
  name_ar: { en: "Warehouse Name Arabic", ar: "اسم المستودع بالعربي" },
  branch_id: { en: "Branch", ar: "الفرع" },
};




/**
 * PUT /api/v1/admin/warehouses/[warehouseId]
 *
 * Updates an existing warehouse record. Tenant and optional branch validation
 * are performed, and duplicate names are prevented.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - warehouseId (number, required) : Warehouse ID to update
 *
 * Request Body:
 *   - tenant_id (number, required)
 *   - branch_id (number, optional)
 *   - name (string, optional)
 *   - name_ar (string, optional)
 *
 * Responses:
 *   - 200: { message, warehouse_id }
 *   - 400: { error } : Missing required fields or invalid payload
 *   - 404: { error } : Warehouse or branch not found
 *   - 409: { error } : Warehouse name already exists for this tenant
 *   - 500: { error } : Internal server error
 */
export async function PUT(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const warehouseId = params.warehouseId;
    const payload = await req.json();
    const { tenant_id, branch_id, name, name_ar } = payload;
    const user: any = await getUserData(req);

    if (!tenant_id) {
      return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 400 });
    }
if(!warehouseId) {
 return NextResponse.json({ error: getWarehouseErrorMessage("missingWarehouseId", lang) }, { status: 400 });

}
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "update_warehouses");
      if (!hasAccess) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 401 });
    }
const warehouseRules: any = {
  tenant_id: [
    { required: true, label: warehouseFieldLabels.tenant_id[lang] },
    { type: "number", label: warehouseFieldLabels.tenant_id[lang] },
  ],
  branch_id: [
    { required: false, label: warehouseFieldLabels.branch_id[lang] },
    { type: "number", label: warehouseFieldLabels.branch_id[lang] },
  ],
  name: [
    { required: true, label: warehouseFieldLabels.name[lang] },
    { minLength: 3, label: warehouseFieldLabels.name[lang] },
    { maxLength: 200, label: warehouseFieldLabels.name[lang] },
  ],
  name_ar: [
    { required: false, label: warehouseFieldLabels.name_ar[lang] },
    { minLength: 3, label: warehouseFieldLabels.name_ar[lang] },
    { maxLength: 200, label: warehouseFieldLabels.name_ar[lang] },
  ],
};

    const { valid, errors } = validateFields(payload, warehouseRules, lang);
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }
    // Check if warehouse exists
    const [warehouses] = await pool.query(`SELECT * FROM warehouses WHERE id = ? AND tenant_id = ?`, [warehouseId, tenant_id]);
    const warehouse = (warehouses as any[])[0];
    if (!warehouse) return NextResponse.json({ error: getWarehouseErrorMessage("noWarehousesFound", lang) }, { status: 404 });

    // Check if branch exists and belongs to tenant
    if (branch_id != null) {
      const [Branches] = await pool.query(
        `SELECT id FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [branch_id, tenant_id]
      );
      const Branch = (Branches as any[])[0];
      if (!Branch) return NextResponse.json({ error: getWarehouseErrorMessage("branchNotFoundFortenant", lang) }, { status: 404 });
    }

    // Check for duplicate name
    if (name) {
      const [existing] = await pool.query(
        `SELECT id FROM warehouses WHERE name = ? AND tenant_id = ? AND id != ?`,
        [name, tenant_id, warehouseId]
      );
      if ((existing as any[]).length > 0) {
        return NextResponse.json({ error: getWarehouseErrorMessage("WorkHouseExists", lang) }, { status: 409 });
      }
    }

    // Build dynamic update
    const fields: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { fields.push("name = ?"); values.push(name); }
    if (name_ar !== undefined) { fields.push("name_ar = ?"); values.push(name_ar); }
    if (branch_id !== undefined) { fields.push("branch_id = ?"); values.push(branch_id); }

    values.push(warehouseId, tenant_id);

    await pool.query(
      `UPDATE warehouses SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
      values
    );

    return NextResponse.json({ message: getWarehouseErrorMessage("updatedSuccess", lang), warehouse_id: warehouseId }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("Update warehouse error:", error);
    return NextResponse.json({ error: getWarehouseErrorMessage("serverError", lang) }, { status: 500 });
  }
}



/**
 * GET /api/v1/admin/warehouses/[warehouseId]
 *
 * Returns a single warehouse by ID for a given tenant. Production requests require
 * `view_warehouses` permission and tenant access verification.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - warehouseId (number, required)        : Warehouse ID to fetch
 *
 * Query Parameters:
 *   - tenant_id (number, required)          : Tenant to which the warehouse belongs
 *
 * Responses:
 *   - 200: warehouse object                 : All fields of the selected warehouse
 *   - 400: { error }                        : Missing warehouse ID or tenant ID
 *   - 401: { error }                        : Unauthorized access or tenant permission denied
 *   - 404: { error }                        : Warehouse not found
 *   - 500: { error }                        : Internal server error
 */
export async function GET(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get("tenant_id");
    const warehouseId = params.warehouseId;

    if (!tenant_id) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 400 });
    if (!warehouseId) return NextResponse.json({ error: getWarehouseErrorMessage("missingWarehouseId", lang) }, { status: 400 });

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_warehouses");
      if (!hasAccess) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const pool = await dbConnection();
   const [rows] = await pool.query(
  `SELECT 
      w.id,
      w.name,
      w.name_ar,
      w.branch_id,
      w.tenant_id,
      w.created_at,
      b.name      AS branch_name,
      b.name_ar   AS branch_name_ar
   FROM warehouses w
   LEFT JOIN branches b ON b.id = w.branch_id
   WHERE w.id = ? AND w.tenant_id = ?
   LIMIT 1`,
  [warehouseId, tenant_id]
);


    const warehouse = (rows as any[])[0];
    if (!warehouse) return NextResponse.json({ error: getWarehouseErrorMessage("noWarehousesFound", lang) }, { status: 404 });

    return NextResponse.json(warehouse, { status: 200 });
  } catch (error) {
    console.error("GET warehouse by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getWarehouseErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/warehouses/[warehouseId]
 *
 * Deletes a single warehouse from the database. Production requests require
 * `delete_warehouses` permission and tenant access verification.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - warehouseId (number, required)        : Warehouse ID to delete
 *
 * Request Body:
 *   - tenant_id (number, required)          : Tenant to which the warehouse belongs
 *
 * Responses:
 *   - 200: { message }                       : Indicates warehouse was successfully deleted
 *   - 400: { error }                         : Missing warehouse ID or tenant ID
 *   - 401: { error }                         : Unauthorized access or tenant permission denied
 *   - 404: { error }                         : Warehouse not found
 *   - 500: { error }                         : Internal server error
 */
export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const { tenant_id } = await req.json();
    const warehouseId = params.warehouseId;

    if (!tenant_id) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 400 });
    if (!warehouseId) return NextResponse.json({ error: getWarehouseErrorMessage("missingWarehouseId", lang) }, { status: 400 });

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_warehouses");
      if (!hasAccess) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getWarehouseErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Ensure warehouse exists
    const [targetWarehouses] = await pool.query(
      `SELECT id, tenant_id FROM warehouses WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [warehouseId, tenant_id]
    );

    const warehousesArr = targetWarehouses as any[];
    if (!warehousesArr.length) return NextResponse.json({ error: getWarehouseErrorMessage("noWarehousesFound", lang) }, { status: 404 });

    await pool.query(`DELETE FROM warehouses WHERE id = ? AND tenant_id = ?`, [warehouseId, tenant_id]);

    return NextResponse.json({ message: getWarehouseErrorMessage("deletedSuccess", lang) }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("DELETE warehouse error:", error);
    return NextResponse.json({ error: getWarehouseErrorMessage("serverError", lang) }, { status: 500 });
  }
}
