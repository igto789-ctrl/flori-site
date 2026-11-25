// Защитные заголовки (ДЗ N4, S4).
const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Микрофон не ограничиваем: он нужен голосовому агенту ElevenLabs.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Шрифты для PDF-счетов читаются с диска на сервере — добавляем их в сборку Vercel.
  outputFileTracingIncludes: {
    "/admin/[id]": ["./lib/fonts/**/*"],
  },
  async headers() {
    return [
      // Все страницы, кроме Mini App: встраивать сайт в чужие фреймы нельзя (защита от кликджекинга).
      {
        source: "/((?!tg(?:/|$)).*)",
        headers: [
          ...common,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      // Mini App открывается во фрейме веб-версии Telegram — разрешаем только его.
      {
        source: "/tg/:path*",
        headers: [
          ...common,
          { key: "Content-Security-Policy", value: "frame-ancestors https://web.telegram.org https://*.telegram.org" },
        ],
      },
      {
        source: "/tg",
        headers: [
          ...common,
          { key: "Content-Security-Policy", value: "frame-ancestors https://web.telegram.org https://*.telegram.org" },
        ],
      },
    ];
  },
};
export default nextConfig;
