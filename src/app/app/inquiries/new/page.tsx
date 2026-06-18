"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewInquiryRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/app/inquiries"); }, []);
  return <div className="p-8 text-center text-muted-foreground">跳转中...</div>;
}
