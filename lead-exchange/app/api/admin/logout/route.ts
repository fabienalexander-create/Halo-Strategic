import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '../../../../lib/adminSession';

export async function POST() {
  const res = NextResponse.json({ loggedOut: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
