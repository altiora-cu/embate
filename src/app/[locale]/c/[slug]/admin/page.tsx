import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandingForm } from "@/components/admin/branding-form";
import { PublicPageToggle } from "@/components/admin/public-page-toggle";
import { InviteCode } from "@/components/communities/invite-code";
import { Link } from "@/i18n/navigation";
import { getCommunityMembers, requireCommunityAdmin } from "@/lib/data/community";
import { getOpenDisputes } from "@/lib/data/dispute";
import { listTournaments } from "@/lib/data/tournament";
import { absoluteUrl } from "@/lib/utils/url";
import type { CommunityRole } from "@/lib/supabase/database.types";

const ROLE_LABEL: Record<CommunityRole, string> = {
  owner: "communities.roleOwner",
  admin: "communities.roleAdmin",
  player: "communities.rolePlayer",
};

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();
  const { community } = await requireCommunityAdmin(slug);

  const [members, disputes, tournaments] = await Promise.all([
    getCommunityMembers(community.id),
    getOpenDisputes(community.id),
    listTournaments(community.id),
  ]);

  const isPro = community.plan === "pro";
  const activeTournaments = tournaments.filter(
    (item) =>
      item.tournament.status === "draft" ||
      item.tournament.status === "registration" ||
      item.tournament.status === "in_progress",
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-section">{t("admin.title")}</h1>
        <p className="mt-1 text-body-sm text-muted">
          {t("admin.subtitle", { community: community.name })}
        </p>
      </header>

      <InviteCode code={community.invite_code} />

      {/* Plan de la comunidad. Mientras el cobro sea manual, el organizador ve
          en qué plan está pero no puede cambiarlo desde acá. */}
      <Card className={isPro ? "border-brand/40" : undefined}>
        <CardHeader
          title={t("admin.plan")}
          description={t("admin.activeTournaments", { count: activeTournaments })}
          action={
            <Badge tone={isPro ? "brand" : "neutral"}>
              {isPro ? t("admin.planPro") : t("admin.planFree")}
            </Badge>
          }
        />
        <CardBody>
          <p className="text-body-sm text-muted">
            {isPro ? t("admin.planProHint") : t("admin.planFreeHint")}
          </p>
        </CardBody>
      </Card>

      {/* Las disputas van primero: es lo único que bloquea a los jugadores. */}
      <Card className={disputes.length > 0 ? "border-danger/40" : undefined}>
        <CardHeader
          title={t("admin.disputes")}
          description={t("admin.pendingDisputes", { count: disputes.length })}
          action={
            disputes.length > 0 ? (
              <Link href={`/c/${slug}/admin/disputes`}>
                <Button size="sm" variant="danger">
                  {t("admin.resolve")}
                </Button>
              </Link>
            ) : undefined
          }
        />
        {disputes.length === 0 && (
          <CardBody>
            <p className="text-body-sm text-muted">{t("admin.noDisputes")}</p>
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title={t("admin.publicPage")} />
        <CardBody>
          <PublicPageToggle
            communityId={community.id}
            slug={slug}
            initialIsPublic={community.is_public}
            publicUrl={await absoluteUrl(`/v/${slug}`)}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader
            title={t("admin.branding")}
            description={t("admin.brandingSubtitle")}
          />
          <CardBody>
            <BrandingForm
              communityId={community.id}
              slug={slug}
              defaultName={community.name}
              defaultAccent={community.brand_accent}
              defaultLogoUrl={community.logo_url}
            />
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader
            title={t("admin.entries")}
            description={t("communities.members", { count: members.length })}
            action={
              <Link href={`/c/${slug}/admin/tournaments/new`}>
                <Button size="sm">{t("tournaments.createTitle")}</Button>
              </Link>
            }
          />
          <CardBody>
            <ul className="flex flex-col divide-y divide-surface-alt/50">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <Link
                    href={`/c/${slug}/p/${member.userId}`}
                    className="min-w-0 truncate font-medium hover:text-brand"
                  >
                    {member.displayName}
                  </Link>
                  <Badge tone={member.role === "player" ? "neutral" : "brand"}>
                    {t(ROLE_LABEL[member.role])}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
