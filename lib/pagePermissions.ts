// Define required permissions for each page route
export const pagePermissions: {
  [route: string]: {
    permissions?: string[];
    roles?: string[];
    allowSuperAdmin?: boolean;
  };
} = {
 "/[firmId]/dashboard": {
    permissions: ["dashboard.access"],
    allowSuperAdmin: true,
  }
  // Dynamic firm dashboard route
 
  // Add more routes and their required permissions/roles here
};