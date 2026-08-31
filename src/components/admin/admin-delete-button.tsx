"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  adminDeleteCommunityAction,
  adminDeleteUserAction,
} from "@/lib/actions/admin";

/**
 * Botón de eliminación del panel de plataforma.
 *
 * Doble clic deliberado: el primero arma el botón ("¿Seguro?"), el segundo
 * ejecuta. Eliminar una cuenta o una comunidad arrastra todo su contenido y
 * no tiene deshacer, así que un solo clic no puede bastar.
 */
export function AdminDeleteButton({
  kind,
  id,
  label,
}: {
  kind: "user" | "community";
  id: string;
  /** Nombre visible de lo que se elimina, para el estado de confirmación. */
  label: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);

    if (!armed) {
      setArmed(true);
      // Se desarma solo: un botón que quedó en "¿Seguro?" de ayer es una trampa.
      setTimeout(() => setArmed(false), 4000);
      return;
    }

    startTransition(async () => {
      const action =
        kind === "user" ? adminDeleteUserAction : adminDeleteCommunityAction;
      const result = await action(id);
      if (!result.ok) {
        setError(result.error);
        setArmed(false);
        return;
      }
      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={`${t("platformAdmin.delete")} ${label}`}
        className={`rounded-[var(--radius-control)] border px-2.5 py-1 text-meta transition-colors duration-150 ease-(--ease-standard) disabled:opacity-50 ${
          armed
            ? "border-danger bg-danger/10 text-danger"
            : "border-surface-alt text-muted hover:border-danger/50 hover:text-danger"
        }`}
      >
        {pending
          ? t("platformAdmin.deleting")
          : armed
            ? t("platformAdmin.confirmDelete")
            : t("platformAdmin.delete")}
      </button>
      {error && (
        <span role="alert" className="text-meta text-danger">
          {t(error)}
        </span>
      )}
    </span>
  );
}
