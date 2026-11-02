import type { Metadata } from "next";
import MiniApp from "./MiniApp";

export const metadata: Metadata = { title: "Floria — заказ цветов в Telegram" };

export default function TelegramPage() {
  return <MiniApp />;
}
