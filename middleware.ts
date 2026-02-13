import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from "@/lib/getSession"; 

export async function middleware(req: NextRequest) {
  const session = await getSession(); 
  const { pathname } = req.nextUrl;

  // Si no hay sesión (o no hay userId) y no está en login, al login
  if (!session?.userId && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Si ya está logueado e intenta ir al login, lo mandamos a su home
  if (session?.userId && pathname === '/login') {
    if (session.role === 'ADMIN') return NextResponse.redirect(new URL('/admin/inventory', req.url));
    return NextResponse.redirect(new URL('/pos', req.url));
  }

  // Protección de rutas: Un CASHIER no puede entrar a /admin
  if (pathname.startsWith('/admin') && session?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/pos', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/pos/:path*', '/login'],
};