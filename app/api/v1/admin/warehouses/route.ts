import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { getUserData, hasPermission, hasTenantAccess } from "../../functions/permissions";
import { validateFields } from "../../functions/validation";

const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    missingFields: "Required fields are missing.",
    serverError: "Internal server error.",
    success: "Warehouse created successfully.",
    missingTenantId: "Tenant ID is required.",
    branchNotFoundFortenant: "Branch not found for this tenant",
    WorkHouseExists:"Warehouse already Exists",
    missingWarehouseIds: "Warehouse IDs are required.",
    invalidWarehouseIds: "Invalid warehouse IDs.",
     noWarehousesFound: "No matching warehouses were found.",
    deleted: (count: number) => `Deleted ${count} warehouse(s).`,
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    missingFields: "الحقول المطلوبة مفقودة.",
    serverError: "خطأ في الخادم الداخلي.",
    missingWarehouseIds: "يجب تزويد أرقام المخازن.",
    invalidWarehouseIds: "أرقام المخازن غير صالحة.",
    success: "تم إنشاء المستودع بنجاح.",
    missingTenantId: "معرف المنظمة مطلوب.",
    branchNotFoundFortenant: "الفرع غير موجود لهذه المنظمة",
    WorkHouseExists:"المخزن هذا موجود مسبقا لهذه الشركة",
     noWarehousesFound: "لم يتم العثور على مخازن مطابقة.",
    deleted: (count: number) => `تم حذف ${count} مخزن${count === 1 ? "" : "ات"}.`,
  },
};

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

const warehouseFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  name: { en: "Warehouse Name", ar: "اسم المستودع" },
  name_ar: { en: "Warehouse Name Arabic", ar: "اسم المستودع بالعربي" },
  branch_id: { en: "Branch", ar: "الفرع" },
};

/**
 * POST /api/v1/admin/warehouses
 *
 * Creates a new warehouse record linked to a tenant and optionally a branch.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Request Body:
 *   - tenant_id (number, required)
 *   - branch_id (number, optional)
 *   - name (string, required)
 *   - name_ar (string, optional)
 *
 * Responses:
 *   - 201: { message, warehouse_id }
 *   - 400: { error } Missing required fields
 *   - 500: { error } Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const payload = await req.json();
    const { tenant_id, branch_id, name, name_ar } = payload;
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_warehouses");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
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
    if (!name) {
      return NextResponse.json({ error: getErrorMessage("missingFields", lang) }, { status: 400 });
    }

    // Check if branch exists and belongs to same tenant
    if (branch_id != null) {
      const [Branches] = await pool.query(
        `SELECT id FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [branch_id, tenant_id]
      );
      const Branch = (Branches as any[])[0];
      if (!Branch) return NextResponse.json({ error: getErrorMessage("branchNotFoundFortenant", lang) }, { status: 404 });
    }

const [existing] = await pool.query("SELECT * FROM warehouses WHERE name = ? AND tenant_id =?", [name,tenant_id]);
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: getErrorMessage("WorkHouseExists", lang) }, { status: 409 });
    }



    // Insert warehouse
    const [result] = await pool.query(
      `INSERT INTO warehouses (tenant_id, branch_id, name, name_ar, created_at) VALUES (?, ?, ?, ?,NOW())`,
      [tenant_id, branch_id || null, name, name_ar || null]
    );

    return NextResponse.json({ message: getErrorMessage("success", lang), warehouse_id: (result as any).insertId }, { status: 201 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("Create warehouse error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}


/**
 * GET /api/v1/admin/warehouses
 *
 * Lists warehouses for a tenant with pagination, search, optional filters,
 * and configurable sorting. Production requests must pass `view_warehouses` 
 * plus tenant access checks.
 *
 * Query Parameters:
 *   - tenant_id (number, required)      : Tenant whose warehouses should be returned
 *   - page (number, default = 1)        : 1-based page index
 *   - pageSize (number, default = 20)   : Items per page
 *   - search (string, optional)         : Matches name or name_ar
 *   - sortBy (string, default = created_at)
 *   - sortOrder ("asc" | "desc", default = "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data }
 *   - 401: { error }                     : Permission or tenant access denied
 *   - 500: { error }                     : Failed to fetch warehouses
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
      const hasAccess = await hasPermission(user, "view_warehouses");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Build WHERE clause
    let where = "w.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (search) {
      where += " AND (w.name LIKE ? OR w.name_ar LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const [countRows] = await pool.query(`SELECT COUNT(*) as count FROM warehouses w WHERE ${where}`, params);
    const count = (countRows as Array<{ count: number }>)[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // Get paginated data
    const [warehouses] = await pool.query(
      `SELECT w.id, w.name, w.name_ar, w.branch_id, b.name AS branch_name, b.name_ar AS branch_name_ar, w.created_at
       FROM warehouses w
       LEFT JOIN branches b ON b.id = w.branch_id
       WHERE ${where}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json({ count, page, pageSize, totalPages, data: warehouses }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET warehouses error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/warehouses
 *
 * Deletes multiple warehouses that belong to the provided tenant. Production requests
 * must pass `delete_warehouses` permission and confirm tenant access.
 *
 * Request Body:
 *   - tenant_id (number, required)        : Tenant whose warehouses are being deleted
 *   - warehouse_ids (number[], required)  : IDs of the warehouses to delete
 *
 * Responses:
 *   - 200: { message }                     : Indicates how many warehouses were deleted
 *   - 400: { error }                       : Missing or invalid payload
 *   - 401: { error }                       : Permission or tenant access denied
 *   - 404: { error }                       : No matching warehouses were found
 *   - 500: { error }                       : Internal server error
 */
export async function DELETE(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const { tenant_id, warehouse_ids } = await req.json();

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("missingTenantId", lang) }, { status: 400 });
    }
    if (!Array.isArray(warehouse_ids) || warehouse_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingWarehouseIds", lang) }, { status: 400 });
    }

    const normalizedIds = warehouse_ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id));
    if (!normalizedIds.length) {
      return NextResponse.json({ error: getErrorMessage("invalidWarehouseIds", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_warehouses");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Ensure target warehouses exist and belong to tenant
    const [targetWarehouses] = await pool.query(
      `SELECT id FROM warehouses WHERE id IN (?) AND tenant_id = ?`,
      [normalizedIds, tenant_id]
    );
    const warehousesArr = targetWarehouses as Array<{ id: number }>;
    if (!warehousesArr.length) {
      return NextResponse.json({ error: getErrorMessage("noWarehousesFound", lang) }, { status: 404 });
    }

    const deletableIds = warehousesArr.map(w => w.id);
    await pool.query(
      `DELETE FROM warehouses WHERE id IN (?) AND tenant_id = ?`,
      [deletableIds, tenant_id]
    );

    return NextResponse.json({ message: errorMessages[lang].deleted(deletableIds.length) }, { status: 200 });

  } catch (error) {
    console.error("DELETE warehouses error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}