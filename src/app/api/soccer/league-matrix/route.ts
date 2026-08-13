import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'download', 'league-traffic-light.json');
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json({ matrix: data });
  } catch {
    return NextResponse.json(
      { error: 'League matrix data not found. Run scripts/league-traffic-light.ts first.' },
      { status: 404 }
    );
  }
}
