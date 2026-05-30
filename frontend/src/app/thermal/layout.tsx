"use client";
import TopNav from "@/components/ui/TopNav";
import VoiceAssistant from "@/components/ui/VoiceAssistant";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="scan-line" />
      <TopNav />
      <main className="flex-1 overflow-auto">{children}</main>
      <VoiceAssistant />
    </div>
  );
}
