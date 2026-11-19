"use client";

import { useEffect, useRef, useState } from "react";

import type { Archetype } from "@/lib/anime";
import {
  createShareCardBlob,
  downloadBlob,
  timestampedFileName,
} from "@/lib/share-card";

export interface PersonalityCardData {
  imageUrl: string;
  archetype: Archetype;
  phrase: string;
}

interface PersonalityCardProps {
  open: boolean;
  data: PersonalityCardData | null;
  onClose: () => void;
}

const primaryButton =
  "inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600";
const secondaryButton =
  "inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export function PersonalityCard({ open, data, onClose }: PersonalityCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !data) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [open, data]);

  useEffect(() => {
    setDownloading(false);
    setError(null);
  }, [data]);

  async function handleDownload() {
    if (!data) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await createShareCardBlob({
        imageUrl: data.imageUrl,
        archetype: data.archetype,
        phrase: data.phrase,
      });
      downloadBlob(blob, timestampedFileName("anime-gozluk-kart"));
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Kart indirilemedi. Tekrar deneyin.",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (!open || !data) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="personality-card-title"
      aria-describedby="personality-card-description"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(92vw,56rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/50"
    >
      <div className="grid sm:grid-cols-[1.08fr_1fr]">
        <div className="relative min-h-44 bg-zinc-100">
          {/* A data URL cannot be routed through the image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl}
            alt="Anime efekti uygulanmış anlık görüntü"
            className="h-52 w-full object-cover sm:h-full sm:min-h-[28rem]"
          />
          <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-700">
            Anlık görüntü
          </span>
        </div>

        <div className="flex flex-col p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
            Kişilik kartı
          </p>

          <h2
            id="personality-card-title"
            className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950"
          >
            {data.archetype.name}
          </h2>
          <p
            id="personality-card-description"
            className="mt-3 text-sm leading-6 text-zinc-600"
          >
            {data.archetype.tagline}
          </p>

          <blockquote className="mt-6 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            “{data.phrase}”
          </blockquote>

          <p className="mt-5 text-xs leading-5 text-zinc-500">
            Arketip ve kart cihazında üretildi. Fotoğraf hiçbir sunucuya
            gönderilmedi.
          </p>

          <div className="mt-auto pt-7">
            {error ? (
              <p role="alert" className="mb-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className={`${primaryButton} flex-1`}
              >
                {downloading ? "Kart hazırlanıyor…" : "Kartı indir (PNG)"}
              </button>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className={secondaryButton}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
