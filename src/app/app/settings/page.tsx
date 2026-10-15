"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIConfig } from "@/hooks/useAIConfig";
import CustomFieldsTab from "@/components/custom-fields/settings-tab";
export default function SettingsPage() {
  const [tab, setTab] = useState("system");
  const ai = useAIConfig();
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="page-kicker">SYSTEM / PREFERENCES</p>
          <h1>系统设置</h1>
          <p className="page-description">
            语言、业务字段与工作区服务配置。个人偏好、租户密钥与平台服务分开管理。
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
              <p className="mb-2 text-sm text-muted-foreground">界面语言现在作为个人偏好保存在账号中。</p>
              <Link className="text-primary underline" href="/app/account">前往个人中心设置语言 →</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>AI 与获客配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                普通租户在「AI 用量」配置自己的模型、Key 和预算；Firecrawl Cloud Key 在「AI 获客」单独配置。平台管理员的实例 AI、语音和视频服务在 API 配置中心管理。
              </p>
              <Link className="text-primary underline" href={ai.configurationUrl}>
                {ai.scope === "platform" ? "打开平台 API 配置中心 →" : "查看工作区 AI 配置与预算 →"}
              </Link>
              <p><Link className="text-primary underline" href="/app/prospecting#discovery-settings">配置工作区 Firecrawl 获客服务 →</Link></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>当前运行模式</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                CRM 核心业务、账号和工作区数据通过 PostgreSQL 按租户持久化。数据库未配置或不可用时请求明确失败，不回退内存演示数据。
              </p>
              <p>
                租户 AI、Firecrawl 和邮箱凭据加密存入数据库；平台 API 配置加密保存在服务器数据卷。营销草稿等浏览器本地偏好不等于数据库备份，媒体文件和平台加密配置需另外备份。
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
