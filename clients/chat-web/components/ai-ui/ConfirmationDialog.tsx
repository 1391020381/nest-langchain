"use client";

import { buttonStyle, cardStyle, titleStyle } from "./styles";

interface Props {
  title: string;
  summary: { label: string; value: string }[];
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  title,
  summary,
  warning,
  confirmLabel,
  cancelLabel,
  disabled,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>{title}</h3>
      <dl style={{ margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
        {summary.map((item) => (
          <div key={item.label} style={{ display: "flex", gap: 8, fontSize: 14 }}>
            <dt style={{ width: 80, flexShrink: 0, color: "#64748b", margin: 0 }}>
              {item.label}
            </dt>
            <dd style={{ color: "#1e293b", margin: 0 }}>{item.value}</dd>
          </div>
        ))}
      </dl>
      {warning && (
        <p
          style={{
            margin: "12px 0 0",
            borderRadius: 6,
            background: "#fffbeb",
            padding: "8px 12px",
            fontSize: 12,
            color: "#b45309",
          }}
        >
          {warning}
        </p>
      )}
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={onConfirm}
          style={buttonStyle("primary", disabled)}
        >
          {confirmLabel ?? "确认"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          style={buttonStyle("secondary", disabled)}
        >
          {cancelLabel ?? "取消"}
        </button>
      </div>
    </div>
  );
}
