import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const { quotationId } = await req.json();
  return NextResponse.json({
    success: true, downloadUrl: `/api/quotations/${quotationId}/pdf`,
    fileName: `QTN-${quotationId.slice(-6)}.pdf`,
  });
}
