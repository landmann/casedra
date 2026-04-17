import { auth, currentUser } from "@clerk/nextjs/server";

export const getAuthSession = auth;
export const getCurrentUser = currentUser;
