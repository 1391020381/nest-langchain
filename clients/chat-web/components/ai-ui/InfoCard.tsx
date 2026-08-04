"use client";

import type { CardAction, CardField } from "@/types/ui-types";
import { buttonStyle, cardStyle, titleStyle } from "./styles";

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  fields: CardField[];
  actions?: CardAction[];
  disabled?: boolean;
  onAction: (actionId: string) => void;
}

export function InfoCard({
  title,
  subtitle,
  icon,
  fields,
  actions,
  disabled,
  onAction,
}: Props) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <div>
          <h3 style={titleStyle}>{title}</h3>
          {subtitle && (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{subtitle}</p>
          )}
        </div>
      </div>
      <dl
        style={{
          margin: "12px 0 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {fields.map((field) => (
          <div key={field.label} style={{ fontSize: 14 }}>
            <dt style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{field.label}</dt>
            <dd
              style={
                field.type === "status"
                  ? {
                      margin: "2px 0 0",
                      display: "inline-block",
                      borderRadius: 999,
                      background: "#f1f5f9",
                      padding: "2px 8px",
                      fontSize: 12,
                      color: "#334155",
                    }
                  : { margin: "2px 0 0", color: "#1e293b" }
              }
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
      {actions && actions.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={() => onAction(action.id)}
              style={buttonStyle(action.variant ?? "secondary", disabled)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
