import type { PoolConfig } from "pg";
export function postgresEnv(options?: { restore?: boolean }): Record<string, string>;
export function postgresProcessEnv(options?: { restore?: boolean }): Record<string, string>;
export function postgresPoolConfig(options?: { restore?: boolean }): PoolConfig;
