import AnimeGlassesApp from "@/components/anime-glasses-app";

const GITHUB_URL = "https://github.com/your-username/anime-glasses";

function EyeMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="13" cy="11" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.56 2.36 1.11 2.93.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.97c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.6.69.49A10.3 10.3 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white">
              <EyeMark />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-zinc-950">
                Anime Gözlük
              </h1>
              <p className="truncate text-xs text-zinc-500 sm:text-sm">
                Kameranı anime sahnesine çeviren küçük bir deney.
              </p>
            </div>
          </div>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            title="GitHub deposu (yer tutucu)"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <GitHubMark />
            <span>GitHub</span>
            <span className="sr-only">(yeni sekmede açılır)</span>
          </a>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="mb-7 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
              Web kamerası deneyi
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Kameranı aç, anime karakterine dönüş.
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 sm:text-base">
              Yüzünü kameraya göster; iri gözler, yanak allığı, ışıltılar,
              kedi kulakları ve konuşma balonu gerçek zamanlı olarak çizilsin.
              Fotoğrafını çek, kişilik kartını indir.
            </p>
          </div>

          <AnimeGlassesApp />
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-5 text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            Anime Gözlük — eğlence amaçlı bir tarayıcı demosu. Görüntün
            cihazından ayrılmaz.
          </p>
          <p className="text-zinc-400">
            MediaPipe Face Landmarker · Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
