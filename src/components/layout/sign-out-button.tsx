"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

export function SignOutButton() {
  const t = useTranslations("nav");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() => startTransition(() => void signOutAction())}
    >
      {t("signOut")}
    </Button>
  );
}
