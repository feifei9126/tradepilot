"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, name, email, password }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/auth/login");
      } else {
        alert(data.error || "注册失败");
      }
    } catch {
      alert("注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Ship className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>&#x521b;&#x5efa;&#x8d26;&#x53f7;</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">&#x516c;&#x53f8;&#x540d;</Label>
              <Input id="company" placeholder="&#x4f60;&#x7684;&#x5916;&#x8d38;&#x516c;&#x53f8;" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">&#x59d3;&#x540d;</Label>
              <Input id="name" placeholder="&#x738b;&#x603b;" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">&#x90ae;&#x7bb1;</Label>
              <Input id="email" type="email" placeholder="your@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">&#x5bc6;&#x7801;</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "&#x6ce8;&#x518c;&#x4e2d;..." : "&#x6ce8;&#x518c;&#x5e76;&#x5f00;&#x59cb;&#x4f7f;&#x7528;"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              &#x5df2;&#x6709;&#x8d26;&#x53f7;&#xff1f;{" "}
              <Link href="/auth/login" className="text-primary hover:underline">&#x53bb;&#x767b;&#x5f55;</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
