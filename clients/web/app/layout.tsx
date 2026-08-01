import type { ReactNode } from "react";

export const metadata = {
  title: "Requirement Extract",
  description: "AI Agents practice — LangChain chapter 3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
