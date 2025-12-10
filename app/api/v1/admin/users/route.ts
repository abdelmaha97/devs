import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import argon2 from "argon2";
import { hasPermission, getUserData, hasTenantAccess } from "../../functions/permissions";

const errorMessages = {
  en: {
    tenantRequired: "Tenant ID is required.",
    missingUserIds: "User IDs are required.",
    invalidUserIds: "Invalid user_ids payload.",
    unauthorized: "Unauthorized access.",
     missingFields: "Required fields are missing.",
    serverError: "Internal server error.",
    userExists: "Email already exists.",
    success: "User created successfully.",
    missingTenantId: "Tenant ID is required.",
    noUsersFound: "No active users found.",
    deleted: (count: number) => `Deleted ${count} user(s).`,
  },
  ar: {
    tenantRequired: "معرف المنظمة مطلوب.",
    missingUserIds: "معرفات المستخدمين مطلوبة.",
    invalidUserIds: "قائمة المستخدمين غير صالحة.",
    missingFields: "الحقول المطلوبة مفقودة.",
    serverError: "خطأ في الخادم الداخلي.",
    unauthorized: "دخول غير مصرح به.",
    userExists: "البريد الإلكتروني موجود مسبقاً.",
    success: "تم إنشاء المستخدم بنجاح.",
    missingTenantId: "معرف المنظمة مطلوب.",
    noUsersFound: "لم يتم العثور على أي مستخدم نشط.",
    deleted: (count: number) => `تم حذف ${count} مستخدم${count === 1 ? "" : "ين"}.`,
  },
};

// Helper to get error message by language

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

// حقول مطلوبة
const requiredFieldLabels: Record<"full_name" | "full_name_ar" | "role_id" | "email" | "password" | "tenant_id" | "phone",
  { en: string; ar: string }> = {
  full_name: { en: "Full Name", ar: "الاسم الكامل" },
  full_name_ar: { en: "Arabic Name", ar: "الاسم العربي" },
  role_id: { en: "Role", ar: "الدور" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  password: { en: "Password", ar: "كلمة المرور" },
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  phone: { en: "Phone", ar: "رقم الهاتف" },
};

/**
 * POST /api/v1/admin/users
 *
 * Creates a new user in the system linked to a specific tenant.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" for localized responses
 *
 * Request Body:
 *   - tenant_id (number, required)     : Tenant/organization ID the user belongs to
 *   - role_id (number, required)       : Role ID assigned to the user
 *   - full_name (string, required)     : User's full name
 *   - full_name_ar (string, optional)  : User's full name in Arabic
 *   - email (string, required)         : User's email (must be unique)
 *   - phone (string, optional)         : User's phone number
 *   - password (string, required)      : User's password
 *
 * Responses:
 *   - 201: { message }                 : User created successfully
 *   - 400: { error }                   : Missing or invalid required fields
 *   - 401: { error }                   : Unauthorized access (insufficient permissions or tenant mismatch)
 *   - 409: { error }                   : Email already exists
 *   - 500: { error }                   : Internal server error
 *
 * Notes:
 *   - Password is hashed using argon2 before storing in the database.
 *   - Optional fields are stored as NULL if not provided.
 *   - Supports localized error and success messages based on the "accept-language" header.
 */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_user");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    const payload = await req.json();
    const { full_name, full_name_ar, email, phone, password, role_id, tenant_id } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // قواعد التحقق من الحقول
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
      password: [
        { required: true, label: requiredFieldLabels.password[lang] },
        { minLength: 6, label: requiredFieldLabels.password[lang] },
      ],
      role_id: [
        { required: true, label: requiredFieldLabels.role_id[lang] },
        { type: "number", label: requiredFieldLabels.role_id[lang] },
      ],
      tenant_id: [
        { required: true, label: requiredFieldLabels.tenant_id[lang] },
        { type: "number", label: requiredFieldLabels.tenant_id[lang] },
      ],
      phone: [{ phone: false, label: requiredFieldLabels.phone[lang] }],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const pool = await dbConnection();

    // تحقق من وجود البريد مسبقاً
    const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: getErrorMessage("userExists", lang) }, { status: 409 });
    }

    // تشفير كلمة المرور
    const hashedPassword = await argon2.hash(password);

    // إدخال المستخدم
    const [result]: any = await pool.query(
      `INSERT INTO users (tenant_id, role_id, full_name, full_name_ar, email, phone, password_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [tenant_id, role_id, full_name, full_name_ar || null, email, phone || null, hashedPassword,"pending_verification"]
    );

    return NextResponse.json({ message: getErrorMessage("success", lang) }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}


/**
 * GET /api/v1/admin/users
 *
 * Lists users for a tenant with pagination, search, optional filters,
 * and configurable sorting. Production requests must pass `view_users` 
 * plus tenant access checks. Deleted/inactive users are excluded.
 *
 * Query Parameters:
 *   - tenant_id (number, required)      : Tenant whose users should be returned
 *   - page (number, default = 1)        : 1-based page index
 *   - pageSize (number, default = 20)   : Items per page
 *   - search (string, optional)         : Matches full_name, full_name_ar, phone, email
 *   - sortBy (string, default = created_at)
 *   - sortOrder ("asc" | "desc", default = "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data }
 *   - 401: { error }                      : Permission or tenant access denied
 *   - 500: { error }                      : Failed to fetch users
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

    if (!tenant_id) return NextResponse.json({ error: getErrorMessage("missingTenantId", lang) }, { status: 400 });

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_users");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Build WHERE clause
    let where = "u.status != 'deleted' AND u.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (search) {
      where += " AND (u.full_name LIKE ? OR u.full_name_ar LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get total count
    const [countRows] = await pool.query(`SELECT COUNT(*) as count FROM users u WHERE ${where}`, params);
    const count = (countRows as Array<{ count: number }>)[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // Get paginated data
    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.full_name_ar, u.email, u.phone, u.status, u.created_at,
              r.id AS role_id, r.name AS role_name, r.name_ar AS role_name_ar
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${where}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json({ count, page, pageSize, totalPages, data: users }, { status: 200 });

  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET users error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/users
 *
 * Soft-deletes multiple users that belong to the provided tenant. Requests in production
 * must pass `delete_user` and confirm tenant access.
 *
 * Request Body:
 *   - tenant_id (number, required)        : Tenant whose users are being deleted
 *   - user_ids (number[], required)       : IDs of the users to soft-delete
 *
 * Responses:
 *   - 200: { message }                     : Indicates how many users were deleted
 *   - 400: { error }                       : Missing or invalid payload
 *   - 401: { error }                       : Permission or tenant access denied
 *   - 404: { error }                       : No matching active users were found
 *   - 500: { error }                       : Internal server error
 */

export async function DELETE(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const { tenant_id, user_ids } = await req.json();

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingUserIds", lang) }, { status: 400 });
    }

    const normalizedIds = user_ids
      .map((id: any) => Number(id))
      .filter((id: number) => !Number.isNaN(id));

    if (!normalizedIds.length) {
      return NextResponse.json({ error: getErrorMessage("invalidUserIds", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_user");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Ensure target users exist and belong to tenant AND not already deleted
    const [targetUsers] = await pool.query(
      `SELECT id FROM users 
       WHERE id IN (?) 
       AND tenant_id = ? 
       AND status != 'deleted'`,
      [normalizedIds, tenant_id]
    );

    const usersArr = targetUsers as Array<{ id: number }>;
    if (!usersArr.length) {
      return NextResponse.json({ error: getErrorMessage("noUsersFound", lang) }, { status: 404 });
    }

    const deletableIds = usersArr.map(u => u.id);

    await pool.query(
      `UPDATE users SET status = 'deleted'
       WHERE id IN (?) AND tenant_id = ?`,
      [deletableIds, tenant_id]
    );

    return NextResponse.json(
      { message: errorMessages[lang].deleted(deletableIds.length) },
      { status: 200 }
    );

  } catch (error) {
    console.error("DELETE users error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
