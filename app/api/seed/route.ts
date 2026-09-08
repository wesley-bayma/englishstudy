import { NextResponse } from 'next/server';
import seedData from '../../../data/seed-data.json';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json(seedData, {
    headers: {
      'Cache-Control': 'private, max-age=3600'
    }
  });
}
