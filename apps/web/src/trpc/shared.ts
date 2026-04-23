"use client";

import type { AppRouter } from "@casedra/api";
import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();
