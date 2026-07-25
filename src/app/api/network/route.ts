import { NextRequest, NextResponse } from "next/server";
import { networkInterfaces } from "os";

export async function GET(req: NextRequest) {
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
  
  const requestUrl = new URL(req.url);
  const forwardedProtocol = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
  const host = req.headers.get("host") || requestUrl.host;
  const port = host.match(/:(\d+)$/)?.[1] || requestUrl.port;
  const portSuffix = port ? `:${port}` : "";

  return NextResponse.json({
    lanIp,
    port,
    urls: {
      lan: `${protocol}://${lanIp}${portSuffix}`,
      localhost: `${protocol}://${host}`,
    },
  });
}
