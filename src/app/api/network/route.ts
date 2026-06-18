import { NextResponse } from "next/server";
import { networkInterfaces } from "os";

export async function GET() {
  const nets = networkInterfaces();
  let lanIp = "localhost";
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp !== "localhost") break;
  }
  
  return NextResponse.json({
    lanIp,
    port: process.env.PORT || "3456",
    urls: {
      lan: `http://${lanIp}:3456`,
      localhost: "http://localhost:3456",
    },
  });
}
