import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getMyCommunities } from "@/lib/data/community";
import type { CommunityRole } from "@/lib/supabase/database.types";

const ROLE_LABEL: Record<CommunityRole, string> = {
  owner: "communities.roleOwner",
  admin: "communities.roleAdmin",
  player: "communities.rolePlayer",
};

export default async function MyCommunitiesPage() {
  const t = await getTranslations();
  const memberships = await getMyCommunities();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-section">{t("communities.title")}</h1>
          <p className="mt-1 text-body-sm text-muted">{t("communities.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/join">
            <Button variant="secondary" size="sm">
              {t("communities.join")}
            </Button>
          </Link>
          <Link href="/app/new">
            <Button variant="secondary" size="sm">
              {t("communities.createTitle")}
            </Button>
          </Link>
          <Link href="/app/quick?f=league">
            <Button variant="secondary" size="sm">
              {t("quick.leagueCta")}
            </Button>
          </Link>
          <Link href="/app/quick?f=blitz">
            <Button size="sm">{t("quick.quickCta")}</Button>
          </Link>
        </div>
      </div>

      {memberships.length === 0 ? (
        <EmptyState
          title={t("communities.empty")}
          body={t("communities.emptyCta")}
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link href="/app/quick?f=blitz">
                <Button>{t("quick.quickCta")}</Button>
              </Link>
              <Link href="/app/quick?f=league">
                <Button variant="secondary">{t("quick.leagueCta")}</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ community, role }, index) => (
            <li
              key={community.id}
              className="animate-rise"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Link href={`/c/${community.slug}`} className="block h-full">
                <Card
                  className="h-full p-5 transition-colors duration-150 ease-(--ease-standard) hover:border-brand/40"
                  style={{ "--brand-accent": community.brand_accent } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      aria-hidden="true"
                      className="size-9 shrink-0 rounded-[var(--radius-control)] bg-brand/20"
                    />
                    <Badge tone={role === "player" ? "neutral" : "brand"}>
                      {t(ROLE_LABEL[role])}
                    </Badge>
                  </div>
                  <p className="mt-4 font-display text-subtitle leading-tight">
                    {community.name}
                  </p>
                  <p className="mt-1 text-meta text-muted">/{community.slug}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
