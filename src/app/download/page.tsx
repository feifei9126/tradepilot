"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Smartphone, CheckCircle, ArrowLeft, Download, Globe,
  MonitorDown, Wifi, Zap, Lock, RotateCcw,
  MessageSquare, Bot, Bell, Star, Info, Shield, Package, ExternalLink,
  SmartphoneNfc,
} from "lucide-react";
import Link from "next/link";

type Platform = "android" | "ios" | "desktop";

export default function DownloadPage() {
  const [origin, setOrigin] = useState("");
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [lanIp, setLanIp] = useState("");
  const [installed, setInstalled] = useState(false);
  const [isWechat, setIsWechat] = useState(false);
  const [isQrReady, setIsQrReady] = useState(false);

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);

    const ua = navigator.userAgent.toLowerCase();
    // Detect WeChat browser
    if (ua.includes("micromessenger") || ua.includes("wechat")) {
      setIsWechat(true);
    }
    if (/android/.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else setPlatform("desktop");

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });

    fetch("/api/network")
      .then(r => r.json())
      .then(d => { if (d.lanIp && d.lanIp !== "localhost") setLanIp(d.lanIp); })
      .catch(() => {});

    window.addEventListener("appinstalled", () => setInstalled(true));

    // Short delay to ensure QR code renders
    setTimeout(() => setIsQrReady(true), 500);
  }, []);

  const handleInstallPwa = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") setInstalled(true);
    }
  };

  const apkUrl = origin + "/apk/TradePilot-v1.0.0.apk";

  // Direct APK download - works in most browsers
  const handleDownloadApk = () => {
    const a = document.createElement("a");
    a.href = apkUrl;
    a.download = "TradePilot-v1.0.0.apk";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download via window.open fallback
  const handleOpenApk = () => {
    window.open(apkUrl, "_blank");
  };

  const pwaSteps = platform === "android"
    ? [
        { icon: Globe, text: "用 Chrome 打开此页面" },
        { icon: MonitorDown, text: "点击右上角「···」菜单" },
        { icon: Download, text: "选择「添加到主屏幕」" },
        { icon: Smartphone, text: "点击「添加」，完成！" },
      ]
    : platform === "ios"
    ? [
        { icon: Globe, text: "用 Safari 打开此页面" },
        { icon: MonitorDown, text: "点击底部「分享」按钮" },
        { icon: Download, text: "选择「添加到主屏幕」" },
        { icon: Smartphone, text: "点击「添加」，完成！" },
      ]
    : [
        { icon: Globe, text: "在手机浏览器打开此页面" },
        { icon: MonitorDown, text: "Android → Chrome「···」菜单" },
        { icon: Download, text: "iOS → Safari「分享」按钮" },
        { icon: Smartphone, text: "选择「添加到主屏幕」" },
      ];

  const location = typeof window !== "undefined" ? window.location : null;
  const qrCodeUrl = isQrReady
    ? "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
      encodeURIComponent(apkUrl)
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-2">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> 返回首页
        </Link>
      </div>

      {/* ===== WeChat Warning ===== */}
      {isWechat && (
        <div className="max-w-3xl mx-auto px-4 pb-2">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <SmartphoneNfc className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-orange-800 text-base mb-1">
                  ⚠️ 微信内无法直接下载
                </h3>
                <p className="text-sm text-orange-700 leading-relaxed">
                  由于微信限制，APK 文件无法直接在微信内下载安装。
                </p>
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-orange-800">解决方法：</p>
                  <div className="flex items-start gap-2 text-sm text-orange-700">
                    <span className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                    <span>点击右上角「<strong>···</strong>」图标</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-orange-700">
                    <span className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                    <span>选择「<strong>在浏览器中打开</strong>」</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-orange-700">
                    <span className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                    <span>在浏览器中点击下方「<strong>下载 APK</strong>」按钮</span>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code for scanning from another phone */}
            <div className="mt-4 pt-4 border-t border-orange-200">
              <p className="text-center text-sm text-orange-700 mb-3">
                或用另一部手机扫描此二维码直接下载：
              </p>
              <div className="flex justify-center">
                {qrCodeUrl ? (
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-orange-100">
                    <img
                      src={qrCodeUrl}
                      alt="APK 下载二维码"
                      className="w-40 h-40"
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">
                    加载中...
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-orange-500 mt-2">
                另一部手机扫码后直接下载 APK
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="pb-6 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium mb-4">
            <Smartphone className="h-4 w-4" />
            TradePilot 移动端
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            手机 App <span className="text-primary">两种方式</span> 安装
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto mb-4">
            Android 用户可直接下载 APK 安装包，也可用 PWA 方式添加至主屏幕。
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full">
              <CheckCircle className="h-3 w-3" /> APK 61MB
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
              <Zap className="h-3 w-3" /> PWA 免安装
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
        {/* ===== APK DOWNLOAD ===== */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-white">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-xl bg-primary/10 w-12 h-12 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">下载 APK 安装包</h2>
                <p className="text-sm text-muted-foreground">Android 原生应用，直接安装</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="text-base h-14 flex-1 shadow-lg shadow-primary/20"
                onClick={handleDownloadApk}
              >
                <Download className="h-5 w-5 mr-2" />
                下载 APK (61MB)
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base h-14 flex-1"
                onClick={handleOpenApk}
              >
                <ExternalLink className="h-5 w-5 mr-2" />
                浏览器打开
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">版本 1.0.0</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">API 34+</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">61 MB</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">调试版</span>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>APK 为调试版本，安装前请在系统设置中开启「允许安装未知来源应用」。</span>
            </div>
          </CardContent>
        </Card>

        {/* ===== PWA ===== */}
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-emerald-100 w-12 h-12 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">PWA 免安装</h2>
                <p className="text-sm text-muted-foreground">扫码即用，无需下载 APK</p>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              {pwaSteps.map((s, i) => (
                <div key={i} className="relative flex md:flex-col items-center gap-3 md:gap-2 p-3 rounded-xl bg-white/60 border">
                  {i < pwaSteps.length - 1 && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-primary/30 text-xl">→</div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center mx-auto mb-1">
                      {i + 1}
                    </div>
                    <p className="text-sm">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {installPrompt && platform === "android" && (
              <Button
                size="lg"
                className="text-base h-12 w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleInstallPwa}
                disabled={installed}
              >
                {installed ? <CheckCircle className="h-5 w-5 mr-2" /> : <Download className="h-5 w-5 mr-2" />}
                {installed ? "已安装 ✓" : "安装到主屏幕"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* LAN IP */}
        {lanIp && origin.includes("localhost") && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="p-5 flex items-start gap-4">
              <Wifi className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">手机连接指引</p>
                <p className="text-sm text-amber-700 mt-1">用手机浏览器打开：</p>
                <code className="block mt-2 px-3 py-2 bg-white rounded-lg border text-sm font-mono text-primary text-center">
                  http://{lanIp}:3456/download
                </code>
                <p className="text-xs text-amber-600 mt-2">确保手机和电脑在同一个 Wi-Fi 网络</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <Card className="bg-muted/20">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              移动端功能
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: MessageSquare, label: "消息实时同步" },
                { icon: Bot, label: "AI 自动回复" },
                { icon: Bell, label: "推送通知" },
                { icon: Smartphone, label: "扫码绑定" },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border">
                    <div className="rounded-full bg-primary/10 w-10 h-10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{f.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">扫码在手机上打开此页面</p>
          <div className="inline-block bg-white rounded-2xl shadow-sm border p-4">
            <img
              src={
                "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" +
                encodeURIComponent((lanIp ? "http://" + lanIp + ":3456" : origin) + "/download")
              }
              alt="扫码下载"
              className="w-40 h-40"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {isWechat ? "微信用户请按上方提示操作" : "扫码后选择「下载 APK」或「PWA 安装」"}
          </p>
        </div>
      </div>
    </div>
  );
}
