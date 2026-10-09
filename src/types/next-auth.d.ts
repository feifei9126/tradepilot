import "next-auth";

declare module "next-auth" {
  interface User {
    companyId?: string;
    role?: string;
    sessionVersion?: string;
    isDeploymentWorkspace?: boolean;
    isPlatformAdmin?: boolean;
    databaseUnavailable?: boolean;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      id?: string;
      email?: string;
      name?: string;
      companyId?: string;
      role?: string;
      isDeploymentWorkspace?: boolean;
      isPlatformAdmin?: boolean;
      databaseUnavailable?: boolean;
      mustChangePassword?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    companyId?: string;
    role?: string;
    sessionVersion?: string;
    isDeploymentWorkspace?: boolean;
    isPlatformAdmin?: boolean;
    databaseUnavailable?: boolean;
    mustChangePassword?: boolean;
    invalidated?: boolean;
  }
}
