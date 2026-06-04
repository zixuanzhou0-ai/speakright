"use client";

import { Check, FlaskConical, Globe2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { setLanguageConfig } from "@/lib/api-keys";
import { getLanguageProfiles } from "@/lib/language-profiles";
import { cn } from "@/lib/utils";
import type { LanguageId, LanguageProfile } from "@/types/language";

function statusLabel(profile: LanguageProfile): string {
  if (profile.status === "active") return "完整";
  if (profile.status === "experimental") return "实验";
  return "准备中";
}

function StatusIcon({ profile }: { profile: LanguageProfile }) {
  if (profile.status === "active") return <Check className="h-4 w-4" />;
  if (profile.status === "experimental") {
    return <FlaskConical className="h-4 w-4" />;
  }
  return <LockKeyhole className="h-4 w-4" />;
}

export function LanguageConfigCard() {
  const config = useLanguageConfig();
  const profiles = getLanguageProfiles();

  const handleSelect = (targetLanguage: LanguageId) => {
    const profile = profiles.find((item) => item.id === targetLanguage);
    setLanguageConfig({ targetLanguage });
    toast.success(`已切换到${profile?.displayName ?? targetLanguage}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="h-5 w-5" />
          训练语言
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-4">
          {profiles.map((profile) => {
            const selected = config.targetLanguage === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleSelect(profile.id)}
                className={cn(
                  "flex min-h-28 flex-col justify-between rounded-lg border-2 p-3 text-left transition-all cursor-pointer",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{profile.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {profile.nativeName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full p-1.5",
                      selected ? "bg-primary text-primary-foreground" : "bg-background",
                    )}
                  >
                    <StatusIcon profile={profile} />
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge
                    variant={
                      profile.status === "active"
                        ? "default"
                        : profile.status === "experimental"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {statusLabel(profile)}
                  </Badge>
                  {profile.readiness.requiresAzureProbe && (
                    <Badge variant="outline">Azure probe</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
