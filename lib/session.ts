import type { SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
  role?: "ADMIN" | "CASHIER";
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "dona_arepa_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};
