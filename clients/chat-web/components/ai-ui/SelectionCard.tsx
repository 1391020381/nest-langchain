"use client";

import { useState } from "react";
import type { SelectionOption } from "@/types/ui-types";
import { buttonStyle, cardStyle, descStyle, titleStyle } from "./styles";

interface Props {
  title: string;
  description?: string;
  options: SelectionOption[];
  allowMultiple?: boolean;
  disabled?: boolean;
  onSelect: (selectedId: string | string[]) => void;
}

export function SelectionCard({
  title,
  description,
  options,
  allowMultiple,
  disabled,
  onSelect,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const handleClick = (id: string) => {
    if (disabled) return;
    if (allowMultiple) {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
      );
    } else {
      onSelect(id);
    }
  };

  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>{title}</h3>
      {description && <p style={descStyle}>{description}</p>}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {options.map((opt) => {
          const active = selected.includes(opt.id);
          const optDisabled = disabled || opt.disabled;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={optDisabled}
              onClick={() => handleClick(opt.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                borderRadius: 6,
                border: active ? "1px solid #6366f1" : "1px solid #e2e8f0",
                background: active ? "#eef2ff" : "#fff",
                padding: 12,
                textAlign: "left",
                cursor: optDisabled ? "not-allowed" : "pointer",
                opacity: optDisabled ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>
                {opt.icon ? `${opt.icon} ` : ""}
                {opt.label}
              </span>
              {opt.description && (
                <span style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                  {opt.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {allowMultiple && selected.length > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(selected)}
          style={{ ...buttonStyle("primary", disabled), marginTop: 12 }}
        >
          确认选择（{selected.length}）
        </button>
      )}
    </div>
  );
}
