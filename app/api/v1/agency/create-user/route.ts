import { NextRequest, NextResponse } from "next/server";

// Example error messages in English and Arabic
const errorMessages = {
  en: {
    missingFields: "Required fields are missing.",
    serverError: "Internal server error.",
    unauthorized: "Unauthorized access.",
    userExists: "User already exists.",
    success: "User created successfully.",
  },
  ar: {
    missingFields: "الحقول المطلوبة مفقودة.",
    serverError: "خطأ في الخادم الداخلي.",
    unauthorized: "دخول غير مصرح به.",
    userExists: "المستخدم موجود بالفعل.",
    success: "تم إنشاء المستخدم بنجاح.",
  },
};

// Helper to get error message by language
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

/**
 * POST /api/v1/admin/create-user
 * Creates a new user (admin only).
 * 
 * Request Body:
 *   - username (string, required): The new user's username.
 *   - password (string, required): The new user's password.
 *   - role (string, optional): The user's role (default: "user").
 * 
 * Headers:
 *   - accept-language (string, optional): Used to determine error message language ("en" or "ar").
 *   - authorization (string, required): Bearer token for admin authentication.
 * 
 * Response:
 *   - 201: { message: "User created successfully." }
 *   - 400: { error: "Required fields are missing." }
 *   - 401: { error: "Unauthorized access." }
 *   - 409: { error: "User already exists." }
 *   - 500: { error: "Internal server error." }
 */
export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    // Dummy admin token check
    if (!authHeader || authHeader !== "Bearer admin-token") {
      return NextResponse.json(
        { error: getErrorMessage("unauthorized", lang) },
        { status: 401 }
      );
    }

    // Check for required fields
    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: getErrorMessage("missingFields", lang) },
        { status: 400 }
      );
    }

    // Dummy user exists check
    if (body.username === "existinguser") {
      return NextResponse.json(
        { error: getErrorMessage("userExists", lang) },
        { status: 409 }
      );
    }

    // Success response
    return NextResponse.json(
      { message: getErrorMessage("success", lang) },
      { status: 201 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/admin/create-user
 * Health check endpoint for the admin create-user API.
 * 
 * Request Body: None
 * 
 * Response:
 *   - 200: { message: "Admin create-user API route is working." }
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "Admin create-user API route is working." });
}