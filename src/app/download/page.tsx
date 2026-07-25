"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  FileText,
  Globe,
  Info,
  MonitorDown,
  Package,
  Smartphone,
  Wifi,
} from "lucide-react";

import { LocalQrCode } from "@/components/local-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Platform = "android" | "ios" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface ApkStatus {
  ready: boolean;
  url?: string;
  size?: number;
  updatedAt?: string;
}

function formatBytes(value?: number) {
  if (!value) return "";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function DownloadPage() {
  const [origin, setOrigin] = useState("");
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [lanIp, setLanIp] = useState("");
  const [lanBaseUrl, setLanBaseUrl] = useState("");
  const [installed, setInstalled] = useState(false);
  const [apkStatus, setApkStatus] = useState<ApkStatus>({ ready: false });
  const [statusErrors, setStatusErrors] = useState<string[]>([]);

  useEffect(() => {
    const environmentTimer = window.setTimeout(() => {
      setOrigin(window.location.origin);
      const userAgent = navigator.userAgent.toLowerCase();
      if (/android/.test(userAgent)) setPlatform("android");
      else if (/iphone|ipad|ipod/.test(userAgent)) setPlatform("ios");
    }, 0);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    void Promise.allSettled([fetch("/api/network"), fetch("/api/build/status")])
      .then(async ([networkResult, buildResult]) => {
        const errors: string[] = [];
        if (networkResult.status === "fulfilled" && networkResult.value.ok) {
          const network = await networkResult.value.json();
          if (network.lanIp && network.lanIp !== "localhost")
            setLanIp(network.lanIp);
          if (network.urls?.lan) setLanBaseUrl(network.urls.lan);
        } else {
          errors.push("局域网访问地址检测失败");
        }
        if (buildResult.status === "fulfilled" && buildResult.value.ok) {
          setApkStatus(await buildResult.value.json());
        } else {
          setApkStatus({ ready: false });
          errors.push("APK 发布状态检测失败");
        }
        setStatusErrors(errors);
      })
      .catch(() => {
        setApkStatus({ ready: false });
        setStatusErrors(["下载环境状态加载失败"]);
      });

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
      window.clearTimeout(environmentTimer);
    };
  }, []);

  async function handleInstallPwa() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setInstalled(true);
  }

  const pwaSteps =
    platform === "android"
      ? ["使用 Chrome 打开", "打开浏览器菜单", "选择添加到主屏幕", "确认安装"]
      : platform === "ios"
        ? ["使用 Safari 打开", "点击分享按钮", "选择添加到主屏幕", "确认添加"]
        : [
            "用手机浏览器打开",
            "打开浏览器菜单",
            "选择添加到主屏幕",
            "确认安装",
          ];
  const pageUrl = origin ? `${lanBaseUrl || origin}/download` : "";
  const apkUrl =
    apkStatus.ready && apkStatus.url && origin
      ? new URL(apkStatus.url, origin).toString()
      : "";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>

        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Smartphone className="h-4 w-4" />
            TradePilot 移动访问
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            将后台添加到手机主屏幕
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            PWA 直接复用当前 TradePilot 服务和登录状态，不需要额外安装包。APK
            只有在部署目录真实存在文件时才提供下载。
          </p>
        </header>

        {statusErrors.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {statusErrors.join("；")}。PWA 安装步骤仍可正常使用。
          </div>
        )}

        <Card className="border-emerald-200">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50">
                <Smartphone className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold">PWA 安装</h2>
                <p className="text-sm text-muted-foreground">
                  推荐方式，无需下载 APK
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {pwaSteps.map((step, index) => (
                <div key={step} className="rounded-md border p-3 text-sm">
                  <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
            {installPrompt && platform === "android" ? (
              <Button
                className="w-full"
                size="lg"
                onClick={handleInstallPwa}
                disabled={installed}
              >
                {installed ? (
                  <CheckCircle className="mr-2 h-5 w-5" />
                ) : (
                  <Download className="mr-2 h-5 w-5" />
                )}
                {installed ? "已安装" : "安装到主屏幕"}
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                请按上方步骤使用浏览器菜单安装。浏览器支持一键安装时，这里会自动出现安装按钮。
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold">Android APK</h2>
                <p className="text-sm text-muted-foreground">
                  {apkUrl ? "部署目录已检测到安装包" : "当前部署未发布 APK"}
                </p>
              </div>
            </div>
            {apkUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  render={<a href={apkUrl} download />}
                  nativeButton={false}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载 APK {formatBytes(apkStatus.size)}
                </Button>
                {apkStatus.updatedAt && (
                  <span className="text-xs text-muted-foreground">
                    更新于{" "}
                    {new Date(apkStatus.updatedAt).toLocaleString("zh-CN")}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                仓库中没有 APK 文件，因此下载按钮已停用，避免打开 404
                地址。发布者可将文件放到 public/apk/tradepilot.apk。
              </div>
            )}
          </CardContent>
        </Card>

        {lanIp && origin.includes("localhost") && (
          <Card className="border-amber-200">
            <CardContent className="flex items-start gap-3 p-5">
              <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">同一局域网访问</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  手机与电脑连接同一 Wi-Fi 后打开：
                </p>
                <code className="mt-2 block rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {pageUrl}
                </code>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 border-t pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="font-semibold">在手机上打开</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              二维码只包含当前下载页地址，不会发送到第三方二维码服务。
            </p>
          </div>
          <div className="w-fit rounded-md border bg-white p-3">
            <LocalQrCode
              value={pageUrl}
              alt="TradePilot 移动访问二维码"
              className="h-36 w-36 bg-gray-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          <MonitorDown className="h-3.5 w-3.5" />
          PWA 与桌面端使用同一套网页功能。
        </div>
      </div>
    </main>
  );
}
