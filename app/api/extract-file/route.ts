import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Deprecated endpoint. PDF parsing is now client-side." }, { status: 410 });
}
