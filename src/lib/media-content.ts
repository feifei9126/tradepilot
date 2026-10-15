import { CrmError } from "@/lib/crm-repository";

const extensions: Record<string, string[]> = {
  "image/png": ["png"], "image/jpeg": ["jpg", "jpeg"], "image/gif": ["gif"], "image/webp": ["webp"],
  "video/mp4": ["mp4", "m4v"], "video/webm": ["webm"], "application/pdf": ["pdf"],
};
export function validatedMediaType(body: Buffer, filename: string, claimed: string): string {
  let type: string | undefined;
  if (body.length >= 24 && body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && body.toString("ascii",12,16) === "IHDR") type = "image/png";
  else if (body.length >= 4 && body[0] === 255 && body[1] === 216 && body[2] === 255) type = "image/jpeg";
  else if (body.length >= 13 && ["GIF87a", "GIF89a"].includes(body.toString("ascii",0,6))) type = "image/gif";
  else if (body.length >= 16 && body.toString("ascii",0,4) === "RIFF" && body.toString("ascii",8,12) === "WEBP") type = "image/webp";
  else if (body.length >= 16 && body.toString("ascii",4,8) === "ftyp" && body.readUInt32BE(0) >= 16 && body.readUInt32BE(0) <= body.length && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)/.test(body.toString("ascii",8,12))) type = "video/mp4";
  else if (body.length >= 8 && body.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))) type = "video/webm";
  else if (body.length >= 8 && /^%PDF-1\.[0-7]/.test(body.toString("ascii",0,8))) type = "application/pdf";
  if (!type) throw new CrmError("只支持内容可识别的 PNG/JPEG/GIF/WebP、MP4/WebM 或 PDF；不允许 HTML/SVG/脚本", 415);
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext || !extensions[type].includes(ext)) throw new CrmError("文件扩展名与真实内容不一致", 415);
  const mime = claimed.trim().toLowerCase().split(";")[0];
  if (mime && mime !== "application/octet-stream" && mime !== type) throw new CrmError("声明的文件类型与真实内容不一致", 415);
  return type;
}

export function mediaDeliveryPolicy(asset: { verifiedMimeType?: string | null; filename: string }) {
  const mime = asset.verifiedMimeType;
  const inline = Boolean(mime && extensions[mime] && mime !== "application/pdf");
  return {
    contentType: mime && extensions[mime] ? mime : "application/octet-stream",
    disposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
    csp: "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'",
  };
}
