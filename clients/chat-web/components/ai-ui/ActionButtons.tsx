"use client";

import type { ActionButton } from "@/types/ui-types";
import { buttonStyle, cardStyle, titleStyle } from "./styles";

interface Props {
  title?: string;
  buttons: ActionButton[];
  layout?: "horizontal" | "vertical";
  disabled?: boolean;
  onClick: (actionId: string) => void;
}

export function ActionButtons({
  title,
  buttons,
  layout,
  disabled,
  onClick,
}: Props) {
  return (
    <div style={cardStyle}>
      {title && <h3 style={{ ...titleStyle, marginBottom: 12 }}>{title}</h3>}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexDirection: layout === "vertical" ? "column" : "row",
          flexWrap: layout === "vertical" ? undefined : "wrap",
        }}
      >
        {buttons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            disabled={disabled}
            onClick={() => onClick(btn.id)}
            style={buttonStyle(btn.variant ?? "secondary", disabled)}
          >
            {btn.icon ? `${btn.icon} ` : ""}
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
