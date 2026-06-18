import { NextResponse } from "next/server";

const templates = [
  { id: "t1", name: "开发信-新客户", subject: "Introduction from TradePilot - Quality {product} Manufacturer", body: "Dear {company},\n\nWe are a professional manufacturer of {product} with {years} years of export experience.\n\nOur products have been exported to {country} and gained excellent feedback.\n\nPlease visit our website for more details: {website}\n\nLooking forward to cooperating with you!\n\nBest regards,\n{name}\nTradePilot Co., Ltd" },
  { id: "t2", name: "报价跟进", subject: "Re: Quotation for {product} - Following Up", body: "Dear {name},\n\nHope you are doing well.\n\nI am writing to follow up on the quotation sent on {date} for {product}.\n\nPlease let me know if you have any questions or need further information.\n\nWe look forward to your feedback.\n\nBest regards,\n{name}" },
  { id: "t3", name: "样品催促", subject: "Sample Status Update - {product}", body: "Dear {name},\n\nWe have prepared the samples for {product} as requested.\n\nThe samples are ready for shipment.\n\nCould you please confirm the shipping address and courier account?\n\nBest regards,\n{name}" },
  { id: "t4", name: "节日问候", subject: "Season's Greetings from TradePilot", body: "Dear {name},\n\nWishing you and your family a wonderful {holiday}!\n\nMay the coming year bring you success and prosperity.\n\nWe look forward to continuing our partnership in the new year.\n\nWarm regards,\n{name}" },
];

export async function GET() {
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ ok: true, template: { id: "t_" + Date.now(), ...body } });
}
