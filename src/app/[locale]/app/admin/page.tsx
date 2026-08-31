import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AdminDeleteButton } from "@/components/admin/admin-delete-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  getAdminCommunities,
  getAdminTournaments,
  getAdminUsers,
  isPlatformAdmin,
} from "@/lib/data/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platformAdmin");
  return { title: t("title") };
}

/**
 * Panel del operador de la plataforma.
 *
 * Devuelve 404 —no 403— a quien no es administrador: la existencia del panel
 * no es información que un usuario común necesite tener confirmada.
 */
export default async function PlatformAdminPage() {
  if (!(await isPlatformAdmin())) notFound();

  const t = await getTranslations();
  const [users, communities, tournaments] = await Promise.all([
    getAdminUsers(),
    getAdminCommunities(),
    getAdminTournaments(),
  ]);

  const STATUS_KEY: Record<string, string> = {
    draft: "tournaments.statusDraft",
    registration: "tournaments.statusRegistration",
    in_progress: "tournaments.statusInProgress",
    finished: "tournaments.statusFinished",
    cancelled: "tournaments.statusCancelled",
  };

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-section">{t("platformAdmin.title")}</h1>
        <p className="mt-1 text-body-sm text-muted">{t("platformAdmin.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-meta tracking-wide text-muted uppercase">
            {t("platformAdmin.usersTitle")}
          </p>
          <p className="tnum mt-1 font-display text-section text-brand">{users.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-meta tracking-wide text-muted uppercase">
            {t("platformAdmin.communitiesTitle")}
          </p>
          <p className="tnum mt-1 font-display text-section text-brand">
            {communities.length}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-meta tracking-wide text-muted uppercase">
            {t("platformAdmin.tournamentsTitle")}
          </p>
          <p className="tnum mt-1 font-display text-section text-brand">
            {tournaments.length}
          </p>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-subtitle">{t("platformAdmin.usersTitle")}</h2>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-surface-alt/60">
          <table className="w-full min-w-[38rem] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-surface-alt/60 bg-surface text-meta tracking-wide text-muted uppercase">
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {t("platformAdmin.colEmail")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {t("platformAdmin.colName")}
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  {t("platformAdmin.colCommunities")}
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  {t("platformAdmin.colMemberships")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  {t("platformAdmin.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-surface-alt/40 last:border-0"
                >
                  <td className="max-w-0 truncate px-3 py-2.5">{user.email}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      {user.display_name}
                      {user.is_admin && <Badge tone="brand">{t("platformAdmin.badge")}</Badge>}
                    </span>
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-muted">
                    {user.communities_owned}
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-muted">
                    {user.memberships}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!user.is_admin && (
                      <AdminDeleteButton kind="user" id={user.id} label={user.email} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-subtitle">{t("platformAdmin.communitiesTitle")}</h2>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-surface-alt/60">
          <table className="w-full min-w-[38rem] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-surface-alt/60 bg-surface text-meta tracking-wide text-muted uppercase">
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {t("platformAdmin.colCommunity")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {t("platformAdmin.colPlan")}
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  {t("platformAdmin.colMembers")}
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  {t("platformAdmin.colTournaments")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  {t("platformAdmin.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {communities.map((community) => (
                <tr
                  key={community.id}
                  className="border-b border-surface-alt/40 last:border-0"
                >
                  <td className="max-w-0 px-3 py-2.5">
                    <Link
                      href={`/c/${community.slug}`}
                      className="block truncate font-medium text-ink transition-colors hover:text-brand"
                    >
                      {community.name}
                      <span className="ml-2 text-meta text-muted">/{community.slug}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={community.plan === "pro" ? "brand" : "neutral"}>
                      {community.plan}
                    </Badge>
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-muted">
                    {community.members}
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-muted">
                    {community.tournaments}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <AdminDeleteButton
                      kind="community"
                      id={community.id}
                      label={community.name}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-subtitle">{t("platformAdmin.tournamentsTitle")}</h2>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-surface-alt/60">
          <table className="w-full min-w-[34rem] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-surface-alt/60 bg-surface text-meta tracking-wide text-muted uppercase">
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {t("platformAdmin.colTournament")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {t("platformAdmin.colCommunity")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {t("platformAdmin.colStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((tournament) => (
                <tr
                  key={tournament.id}
                  className="border-b border-surface-alt/40 last:border-0"
                >
                  <td className="max-w-0 px-3 py-2.5">
                    <Link
                      href={`/c/${tournament.communitySlug}/t/${tournament.id}`}
                      className="block truncate font-medium text-ink transition-colors hover:text-brand"
                    >
                      {tournament.name}
                    </Link>
                  </td>
                  <td className="max-w-0 truncate px-3 py-2.5 text-muted">
                    {tournament.communityName}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone="neutral">
                      {t(STATUS_KEY[tournament.status] ?? "platformAdmin.colStatus")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

