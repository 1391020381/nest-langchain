import type { ReactNode } from "react";

export const metadata = {
  title: "llm",
  description: "AI Agents practice chat-web",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
