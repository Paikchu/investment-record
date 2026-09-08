"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel, FieldDescription, FieldSeparator } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "../theme-control";
import { useLanguage } from "../language-provider";

export default function SettingsPage() {
  const { mode, choose } = useTheme();
  const { language, chooseLanguage, t } = useLanguage();
  return <main className="settings-page" aria-labelledby="settings-title">
    <h1 id="settings-title">{t("设置")}</h1>
    <Card>
      <CardHeader><CardTitle>{t("外观与语言")}</CardTitle><CardDescription>{t("按你的习惯调整显示方式。")}</CardDescription></CardHeader>
      <CardContent><FieldGroup>
        <Field>
          <FieldLabel id="theme-label">{t("主题")}</FieldLabel>
          <ToggleGroup type="single" variant="outline" value={mode} onValueChange={choose} aria-labelledby="theme-label" className="flex-wrap">
            <ToggleGroupItem value="light"><Sun />{t("日间模式")}</ToggleGroupItem>
            <ToggleGroupItem value="dark"><Moon />{t("夜间模式")}</ToggleGroupItem>
            <ToggleGroupItem value="system"><Monitor />{t("跟随系统")}</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <FieldSeparator />
        <Field>
          <FieldLabel id="language-label">{t("语言")}</FieldLabel>
          <ToggleGroup type="single" variant="outline" value={language} onValueChange={chooseLanguage} aria-labelledby="language-label">
            <ToggleGroupItem value="zh-CN" lang="zh-CN">中文</ToggleGroupItem>
            <ToggleGroupItem value="en" lang="en">English</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>{t("研究正文与自行填写的内容保留原文。")}</FieldDescription>
        </Field>
      </FieldGroup></CardContent>
      <CardFooter><p className="text-muted-foreground" role="status">{t("更改即时生效，并保存在此浏览器。")}</p></CardFooter>
    </Card>
  </main>;
}
