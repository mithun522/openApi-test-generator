/* Shared types. Contracts are untrusted user input, so schema-shaped values stay loosely typed. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Schema = Record<string, any>;
export type OpenApiDoc = Schema;

export const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
export type Method = (typeof METHODS)[number];

export type Category = "positive" | "negative" | "boundary" | "security";

export interface Options {
  positive: boolean;
  negative: boolean;
  boundary: boolean;
  security: boolean;
  nulls: boolean;
  contentType: boolean;
  emptyStrings: boolean;
}

export type AuthMode = "contract" | "bearer" | "apikey" | "basic" | "oauth2" | "none";
export interface AuthSettings {
  mode: AuthMode;
  apiKeyName: string;
  apiKeyIn: "header" | "query";
}

export type VarKey = "baseUrl" | "token" | "apiKey" | "username" | "password";
export type VarNames = Record<VarKey, string>;

export type AuthType = "apikey" | "basic" | "oauth2" | "bearer";
export interface Auth {
  type: AuthType;
  key?: string;
  in?: "header" | "query" | "cookie";
  scheme?: string;
}
export type Cred = "valid" | "invalid" | "lowPrivilege" | null;

export type AuthJson =
  | { type: "noauth" }
  | { type: "apikey"; key: string; in: string; value: string }
  | { type: "basic"; username: string; password: string }
  | { type: "oauth2"; accessToken: string; headerPrefix: "Bearer" }
  | { type: "bearer"; token: string };

export interface TestCase {
  id: string;
  operationId: string | null;
  tag: string;
  category: Category;
  name: string;
  method: string;
  path: string;
  request: {
    auth: AuthJson;
    pathParams: Record<string, unknown>;
    queryParams: Record<string, unknown>;
    headers: Record<string, unknown>;
    cookies?: Record<string, unknown>;
    body: unknown;
  };
  expected: { status: number; strict: boolean; responseSchema: Schema | null; json: boolean };
}

export interface OpEntry {
  key: string;
  method: string;
  path: string;
  summary: string;
}
