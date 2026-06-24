import { handlers } from "@/auth";

// Auth.js v5 가 /api/auth/* 의 모든 엔드포인트(signin, callback, signout, session 등)를 처리.
export const { GET, POST } = handlers;
