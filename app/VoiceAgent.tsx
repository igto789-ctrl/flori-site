"use client";

import Script from "next/script";
import { useEffect } from "react";
import { ELEVENLABS_AGENT_ID, VOICE_SECTIONS } from "@/lib/voice";

// Виджет ElevenLabs с кнопкой «Поговорить». Инструмент show_section выполняется в браузере:
// прокручивает к разделу и подсвечивает его. Страница не перезагружается, поэтому разговор продолжается.
export default function VoiceAgent() {
  useEffect(() => {
    const onCall = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      detail.config.clientTools = {
        show_section: ({ section }: { section?: string }) => {
          const target = VOICE_SECTIONS[section as keyof typeof VOICE_SECTIONS];
          const el = target && document.getElementById(target.id);
          if (!el) return `Раздела «${section}» на сайте нет. Ничего не открыто.`;
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("voice-highlight");
          setTimeout(() => el.classList.remove("voice-highlight"), 2500);
          return `Показан раздел «${target.label}».`;
        },
      };
    };
    const widget = document.querySelector("elevenlabs-convai");
    widget?.addEventListener("elevenlabs-convai:call", onCall);
    return () => widget?.removeEventListener("elevenlabs-convai:call", onCall);
  }, []);

  if (!ELEVENLABS_AGENT_ID) return null;
  return (
    <>
      {/* @ts-expect-error — веб-компонент ElevenLabs */}
      <elevenlabs-convai agent-id={ELEVENLABS_AGENT_ID} action-text="Поговорить" start-call-text="Начать разговор" end-call-text="Завершить" />
      <Script src="https://unpkg.com/@elevenlabs/convai-widget-embed@0.25.1" strategy="afterInteractive" />
    </>
  );
}
