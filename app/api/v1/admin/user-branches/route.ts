// userBranches.ts
import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import argon2 from "argon2";
import { hasPermission, getUserData, hasTenantAccess } from "../../functions/permissions";
// Error messages
const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    userNotFoundFortenant: "User not found For this tenant",
    branchNotFoundFortenant: "Branch not found For this tenant",
    alreadyAssigned: "User already assigned to this branch.",
    assignedSuccess: "User assigned to branch successfully.",
    deletedSuccess: "User unassigned from branch successfully.",
    missingUserId: "User ID is missing.",
    missingBranchId: "Branch ID is missing.",
    missingTenantId: "Tenant ID is missing.",
    missingBranchIds: "Branch user IDs are missing.",
    tenantMismatch: "At least one user does not belong to the provided tenant.",
    UserbranchNotFoundFortenant:"User Branch not found For this tenant"

  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    userNotFoundFortenant: "المستخدم غير موجود لهذه الشركة.",
    branchNotFoundFortenant: "الفرع غير موجود لهذه الشركة.",
    alreadyAssigned: "المستخدم مرتبط بالفعل بهذا الفرع.",
    assignedSuccess: "تم ربط المستخدم بالفرع بنجاح.",
    deletedSuccess: "تم إزالة المستخدم من الفرع بنجاح.",
    missingTenantId: "معرّف المنظمة مفقود.",
    missingUserId: "معرّف المستخدم مفقود.",
    missingBranchId: "معرّف الفرع مفقود.",
    missingBranchIds: "معرّفات مستخدمين الفروع مفقودة.",
    tenantMismatch: "يوجد على الاقل يوزر واحد لا ينتمي للشركة المدخلة",
    UserbranchNotFoundFortenant:"المعرف غير موجود لهذه الشركة."
  },
};
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

// Required labels
const userBranchRequiredLabels: Record<"user_id" | "branch_id" | "tenant_id", { en: string; ar: string }> = {
  user_id: { en: "User", ar: "المستخدم" },
  branch_id: { en: "Branch", ar: "الفرع" },
  tenant_id: { en: "Tenant", ar: "المنظمة" },
};


/**
 * POST /api/v1/admin/user-branches
 *
 * Assigns a user to a branch. Both user and branch must belong to the same tenant.
 * Production traffic requires `assign_user_branch` permission and tenant access.
 *
 * Request Body:
 *   - tenant_id (number, required)  : Tenant to which both user and branch belong
 *   - user_id (number, required)    : ID of the user to assign
 *   - branch_id (number, required)  : ID of the branch to assign the user to
 *
 * Validation:
 *   - Ensures tenant_id, user_id, and branch_id are provided and are numbers
 *   - Confirms user exists, is active, and belongs to the specified tenant
 *   - Confirms branch exists and belongs to the specified tenant
 *   - Prevents duplicate assignment if the user is already assigned to the branch
 *
 * Responses:
 *   - 201: { message } : Assignment created successfully
 *   - 400: { error }   : Missing or invalid fields, or tenant mismatch
 *   - 401: { error }   : Unauthorized (missing permission or tenant access)
 *   - 404: { error }   : User or branch not found for the tenant
 *   - 409: { error }   : User is already assigned to the branch
 *   - 500: { error }   : Internal server error
 */

export async function POST(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const payload = await req.json();
    const { tenant_id, user_id, branch_id } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    // Validation rules
    const rules: any = {
      tenant_id: [
        { required: true, label: userBranchRequiredLabels.tenant_id[lang] },
        { type: "number", label: userBranchRequiredLabels.tenant_id[lang] },
      ],
      user_id: [
        { required: true, label: userBranchRequiredLabels.user_id[lang] },
        { type: "number", label: userBranchRequiredLabels.user_id[lang] },
      ],
      branch_id: [
        { required: true, label: userBranchRequiredLabels.branch_id[lang] },
        { type: "number", label: userBranchRequiredLabels.branch_id[lang] },
      ],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    // Auth user
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "create_user_branch");
      if (!hasAccess)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Check if user exists
    const [foundUsers] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND tenant_id= ? AND status != 'deleted' LIMIT 1`,
      [user_id, tenant_id]
    );
    const foundUser = (foundUsers as any[])[0];
    if (!foundUser) return NextResponse.json({ error: getErrorMessage("userNotFoundFortenant", lang) }, { status: 404 });

    // Check if branch exists and belongs to same tenant
    const [foundBranches] = await pool.query(
      `SELECT id FROM branches WHERE id = ? AND tenant_id= ? LIMIT 1`,
      [branch_id, tenant_id]
    );
    const foundBranch = (foundBranches as any[])[0];
    if (!foundBranch) return NextResponse.json({ error: getErrorMessage("branchNotFoundFortenant", lang) }, { status: 404 });



    // Check if already assigned
    const [existingAssignment] = await pool.query(
      `SELECT id FROM user_branches WHERE user_id = ? AND branch_id = ?`,
      [user_id, branch_id]
    );
    if ((existingAssignment as any[]).length > 0) {
      return NextResponse.json({ error: getErrorMessage("alreadyAssigned", lang) }, { status: 409 });
    }

    // Insert assignment
    await pool.query(
      `INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)`,
      [user_id, branch_id]
    );

    return NextResponse.json({ message: getErrorMessage("assignedSuccess", lang) }, { status: 201 });
  } catch (error) {
    console.error("Assign user to branch error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/user-branches
 *
 * Unassigns one or multiple users from branches. Production traffic
 * must pass `delete_user_branch` permission and confirm tenant access.
 *
 * Request Body:
 *   - user_branch_ids (number[], required)
 *   - tenant_id (number, required)
 *
 * Responses:
 *   - 200: { message }  : Assignment(s) deleted successfully
 *   - 400: { error }    : Missing payload or tenant mismatch
 *   - 401: { error }    : Permission denied
 *   - 404: { error }    : Assignment(s) not found
 *   - 500: { error }    : Internal server error
 */
export async function DELETE(req: NextRequest) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const { user_branch_ids, tenant_id } = await req.json();

    // Validate input
    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!Array.isArray(user_branch_ids) || user_branch_ids.length === 0) {
      return NextResponse.json({ error: getErrorMessage("missingBranchIds", lang) }, { status: 400 });
    }

    // Authenticated user
    const user: any = await getUserData(req);

    //  permission 
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_user_branch");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Check all assignments exist and belong to the tenant
    const [existingAssignments] = await pool.query(
      `SELECT ub.id, b.tenant_id
       FROM user_branches ub
       JOIN branches b ON ub.branch_id = b.id
       WHERE ub.id IN (?)`,
      [user_branch_ids]
    );

    const assignmentsArr = existingAssignments as any[];
// تحقق إذا فيه أي assignment مش موجود
const missingAssignments = user_branch_ids.filter(id => !assignmentsArr.some(a => a.id === id));
if (missingAssignments.length > 0) {
  return NextResponse.json({
    error: getErrorMessage("UserbranchNotFoundFortenant", lang),
    missing_ids: missingAssignments
  }, { status: 404 });
}
    // تحقق إذا فيه أي assignment مش بنفس التينانت
    const invalidAssignments = assignmentsArr.filter(a => a.tenant_id !== tenant_id);

    if (invalidAssignments.length > 0) {
      return NextResponse.json({
        error: getErrorMessage("tenantMismatch", lang),
        invalid_ids: invalidAssignments.map(a => a.id)
      }, { status: 400 });
    }


    // Delete all assignments
    await pool.query(
      `DELETE FROM user_branches WHERE id IN (?)`,
      [user_branch_ids]
    );

    return NextResponse.json({ message: getErrorMessage("deletedSuccess", lang) }, { status: 200 });

  } catch (error) {
    console.error("Unassign user(s) from branch error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}


/**
 * GET /api/v1/admin/user-branches
 *
 * Lists assigned user branches for a tenant with pagination, search,
 * optional filters, and sorting. Production requests require
 * `view_user_branches` permission and tenant access validation.
 *
 * Query Parameters:
 *   - tenant_id (number, required)      : Tenant to filter branch assignments
 *   - page (number, default = 1)
 *   - pageSize (number, default = 20)
 *   - search (string, optional)         : Matches user name, branch name
 *   - sortBy (string)
 *   - sortOrder ("asc" | "desc", default = "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data }
 *   - 400: { error }
 *   - 401: { error }
 *   - 500: { error }
 */
export async function GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();

    const { searchParams } = new URL(req.url);

    const tenant_id = searchParams.get("tenant_id");
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    let sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_user_branches");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // WHERE conditions
    let where = "b.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (search) {
      where += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR b.name LIKE ? OR b.name_ar LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Count
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM user_branches ub
      JOIN users u ON ub.user_id = u.id
      JOIN branches b ON ub.branch_id = b.id
      WHERE ${where}
      `,
      params
    );

    const count = (countRows as Array<{ count: number }>)[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // تحديد العمود للفرز بشكل آمن
    let sortColumn = "b.created_at"; // default
    const sortByParam = searchParams.get("sortBy");

    if (sortByParam === "user_name") sortColumn = "u.full_name";
    else if (sortByParam === "user_email") sortColumn = "u.email";
    else if (sortByParam === "branch_name") sortColumn = "b.name";
    else if (sortByParam === "branch_name_ar") sortColumn = "b.name_ar";

    // Data
    const [data] = await pool.query(
      `
      SELECT 
        ub.id,
        b.created_at,
        u.id AS user_id,
        u.full_name AS user_name,
        u.full_name_ar AS user_name_ar,
        u.email AS user_email,
        b.id AS branch_id,
        b.name AS branch_name,
        b.name_ar AS branch_name_ar
      FROM user_branches ub
      JOIN users u ON ub.user_id = u.id
      JOIN branches b ON ub.branch_id = b.id
      WHERE ${where}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json(
      {
        count,
        page,
        pageSize,
        totalPages,
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET user branches error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

