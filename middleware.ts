import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { pagePermissions } from "./lib/pagePermissions";
import { hasRole, hasPermission, isSuperAdmin } from "./lib/auth";

function getRoutePath(url: string) {
  // Extract pathname without query or hash
  return url.split("?")[0].split("#")[0];
}

// Helper to match dynamic routes like /[firmId]/dashboard
function matchRoute(pathname: string) {
  // Exact match first
  if (pagePermissions[pathname]) return pathname;
  // Check for dynamic firm dashboard
  const firmDashboardRegex = /^\/[^\/]+\/dashboard$/;
  if (firmDashboardRegex.test(pathname)) return "/[firmId]/dashboard";
  return null;
}

export default withAuth(
  async function middleware(request) {
    const { nextUrl } = request;
    const routePath = getRoutePath(nextUrl.pathname);
    const matchedRoute = matchRoute(routePath);
    console.log("Middleware check for route:", routePath, "matched as:", matchedRoute);

    // Find permissions config for this route
    const config = matchedRoute ? pagePermissions[matchedRoute] : undefined;
    if (!config) {
      // No restrictions for this page
      return NextResponse.next();
    }

    // Get user from token (populated by next-auth)
    const token = request.nextauth?.token;

    if (!token) {
      // Not authenticated
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const user = token;
    console.log("User roles:", user);

    // Super admin shortcut
    if (config.allowSuperAdmin && isSuperAdmin(user)) {
      return NextResponse.next();
    }

    // Check required roles
    if (config.roles && config.roles.length > 0) {
      const hasRequiredRole = config.roles.some(role => hasRole(user, role));
      if (!hasRequiredRole) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }

    // Check required permissions
    if (config.permissions && config.permissions.length > 0) {
      const hasRequiredPermission = config.permissions.some(permission => hasPermission(user, permission));
      if (!hasRequiredPermission) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }

    // Default allow
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: async ({ req, token }) => {
        // Always allow, actual checks are in middleware above
        return true;
      },
    },
  }
);