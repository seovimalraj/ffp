import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      organizationId: string;
    };
    error?: string;
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    role: string;
    organizationId: string;
    refreshToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    organizationId: string;
    refreshToken: string;
    accessTokenExpires: number;
    error?: string;
  }
}
