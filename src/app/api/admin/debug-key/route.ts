import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Key not found in process.env' });
  }

  const parts = key.split('.');
  if (parts.length !== 3) {
    return NextResponse.json({ error: 'Key is not a valid JWT' });
  }

  try {
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    const json = JSON.parse(payload);
    return NextResponse.json({
      key_present: true,
      role: json.role,
      iss: json.iss,
      ref: json.ref,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to parse JWT' });
  }
}
