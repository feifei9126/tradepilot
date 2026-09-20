"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CustomFieldsTab from "@/components/custom-fields/settings-tab";
import { useTranslation, type Locale } from "@/lib/i18n";
export default function SettingsPage() {
  const { locale, setLocale } = useTranslation();
  const [tab, setTab] = useState("system");
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="page-kicker">SYSTEM / PREFERENCES</p>
          <h1>系统设置</h1>
          <p className="page-description">
            语言、业务字段与运行状态。AI 接口统一在独立的 API 配置中心管理。
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant={tab === "system" ? "default" : "outline"}
          onClick={() => setTab("system")}
        >
          系统
        </Button>
        <Button
          variant={tab === "fields" ? "default" : "outline"}
          onClick={() => setTab("fields")}
        >
          自定义字段
        </Button>
      </div>
      {tab === "fields" ? (
        <CustomFieldsTab />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>语言</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3">
                界面语言
                <select
                  className="rounded-md border p-2"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </label>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>API 配置已迁移</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                询盘、邮件、获客、文字/语音客服、产品视频共用系统中的 API
                配置入口。
              </p>
              <Link className="text-primary underline" href="/app/api-config">
                打开 API 配置中心与引导 →
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>当前运行模式</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                CRM
                核心业务数据仍为内存演示模式，重启会恢复种子数据，请勿存入重要客户资料。
              </p>
              <p>
                API
                配置单独加密保存在服务器数据卷，浏览器不保存密钥。当前配置中心面向单实例部署管理员，不是多租户密钥管理服务。
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
