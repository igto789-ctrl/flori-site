/** @type {import('next').NextConfig} */
const nextConfig = {
  // Шрифты для PDF-счетов читаются с диска на сервере — добавляем их в сборку Vercel.
  outputFileTracingIncludes: {
    "/admin/[id]": ["./lib/fonts/**/*"],
  },
};
export default nextConfig;
