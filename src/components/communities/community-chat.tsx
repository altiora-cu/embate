"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { ChatMessage } from "@/lib/data/chat";

const MAX_LENGTH = 500;

/**
 * Chat de la comunidad, en tiempo real.
 *
 * La carga inicial llega del servidor (con RLS aplicado); a partir de ahí el
 * componente se suscribe a los INSERT de Realtime, que también respeta RLS: el
 * navegador solo recibe mensajes de comunidades donde el usuario es miembro.
 *
 * El propio envío se pinta con la respuesta del INSERT y no espera al evento;
 * el evento duplicado se descarta por id. Así el mensaje propio aparece al
 * instante aunque la suscripción esté degradada.
 */
export function CommunityChat({
  communityId,
  currentUserId,
  initialMessages,
}: {
  communityId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const [supabase] = useState(createClient);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Nombres ya conocidos, para no consultar el perfil en cada mensaje ajeno.
  const namesRef = useRef(
    new Map(initialMessages.map((m) => [m.userId, m.authorName])),
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${communityId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `community_id=eq.${communityId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            body: string;
            created_at: string;
          };

          let authorName = namesRef.current.get(row.user_id);
          if (!authorName) {
            // Miembro nuevo que escribe por primera vez en esta sesión.
            const { data } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", row.user_id)
              .maybeSingle();
            authorName = data?.display_name ?? "";
            namesRef.current.set(row.user_id, authorName);
          }

          setMessages((current) =>
            current.some((m) => m.id === row.id)
              ? current
              : [
                  ...current,
                  {
                    id: row.id,
                    userId: row.user_id,
                    authorName: authorName ?? "",
                    body: row.body,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, communityId]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(false);

    const { data, error: insertError } = await supabase
      .from("community_messages")
      .insert({ community_id: communityId, user_id: currentUserId, body })
      .select("id, user_id, body, created_at")
      .single();

    setSending(false);

    if (insertError || !data) {
      setError(true);
      return;
    }

    setDraft("");
    setMessages((current) =>
      current.some((m) => m.id === data.id)
        ? current
        : [
            ...current,
            {
              id: data.id,
              userId: data.user_id,
              authorName: namesRef.current.get(data.user_id) ?? "",
              body: data.body,
              createdAt: data.created_at,
            },
          ],
    );
  };

  return (
    <div className="flex h-[60dvh] min-h-96 flex-col rounded-[var(--radius-card)] border border-surface-alt/60">
      <div
        className="flex-1 overflow-y-auto p-4"
        role="log"
        aria-label={t("title")}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-body-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const isMe = message.userId === currentUserId;
              return (
                <li key={message.id} className={cn("flex", isMe && "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-[var(--radius-card)] px-3.5 py-2.5 sm:max-w-[70%]",
                      isMe ? "bg-brand/15" : "bg-surface",
                    )}
                  >
                    {!isMe && (
                      <p className="text-meta font-medium text-brand">
                        {message.authorName || t("unknownAuthor")}
                      </p>
                    )}
                    <p className="text-body-sm break-words whitespace-pre-wrap text-ink">
                      {message.body}
                    </p>
                    <p className="mt-1 text-right text-meta text-muted">
                      {format.dateTime(new Date(message.createdAt), {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-surface-alt/60 p-3"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter manda; Shift+Enter hace salto de línea, como en cualquier chat.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={MAX_LENGTH}
          rows={1}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[var(--radius-control)] border border-surface-alt bg-base px-3.5 py-2.5 text-body-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <Button type="submit" loading={sending} disabled={!draft.trim()}>
          {t("send")}
        </Button>
      </form>

      {error && (
        <p role="alert" className="px-4 pb-3 text-body-sm text-danger">
          {t("sendError")}
        </p>
      )}
    </div>
  );
}
