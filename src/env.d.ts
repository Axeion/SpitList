declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts on authenticated /admin requests. */
    admin?: {
      email: string;
      displayName: string | null;
      expiresAt: Date;
    };
  }
}
