import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

export async function GET(req: NextRequest) {
  const result = requireAdmin(req);
  if ('response' in result) return result.response;
  return NextResponse.json({ email: result.session.email, role: result.session.role });
}
