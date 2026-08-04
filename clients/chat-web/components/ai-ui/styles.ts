import type { CSSProperties } from "react";

export const cardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
  padding: 16,
};

export const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  color: "#1e293b",
};

export const descStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12,
  color: "#64748b",
};

export const inputStyle: CSSProperties = {
  marginTop: 4,
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 14,
};

export function buttonStyle(
  variant: "primary" | "secondary" | "ghost" = "secondary",
  disabled?: boolean,
): CSSProperties {
  const base: CSSProperties = {
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 14,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    border: "none",
  };

  if (variant === "primary") {
    return { ...base, background: "#4f46e5", color: "#fff" };
  }
  if (variant === "ghost") {
    return { ...base, background: "transparent", color: "#4f46e5" };
  }
  return {
    ...base,
    background: "#fff",
    color: "#475569",
    border: "1px solid #cbd5e1",
  };
}
