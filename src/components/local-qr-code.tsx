"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function LocalQrCode({ value, alt, size = 160, className }: {
  value: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [result, setResult] = useState({ value: "", dataUrl: "" });

  useEffect(() => {
    if (!value) return;
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then(dataUrl => { if (active) setResult({ value, dataUrl }); })
      .catch(() => { if (active) setResult({ value, dataUrl: "" }); });
    return () => { active = false; };
  }, [size, value]);

  if (!value || result.value !== value || !result.dataUrl) {
    return <div className={className} role="status"><span className="sr-only">正在生成二维码</span></div>;
  }
  return <img src={result.dataUrl} alt={alt} width={size} height={size} className={className} />;
}
