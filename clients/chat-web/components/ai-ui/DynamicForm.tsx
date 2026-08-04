"use client";

import { useState, type FormEvent } from "react";
import type { FormField } from "@/types/ui-types";
import { buttonStyle, cardStyle, descStyle, inputStyle, titleStyle } from "./styles";

interface Props {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (formData: Record<string, unknown>) => void;
}

export function DynamicForm({
  title,
  description,
  fields,
  submitLabel,
  disabled,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <h3 style={titleStyle}>{title}</h3>
      {description && <p style={descStyle}>{description}</p>}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {fields.map((field) => (
          <div key={field.name}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}>
              {field.label}
              {field.required && <span style={{ color: "#f43f5e" }}> *</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea
                rows={3}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                disabled={disabled}
                onChange={(e) => setValue(field.name, e.target.value)}
                style={inputStyle}
              />
            ) : field.type === "select" ? (
              <select
                required={field.required}
                value={values[field.name] ?? ""}
                disabled={disabled}
                onChange={(e) => setValue(field.name, e.target.value)}
                style={inputStyle}
              >
                <option value="">请选择</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={
                  field.type === "number"
                    ? "number"
                    : field.type === "date"
                      ? "date"
                      : "text"
                }
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                disabled={disabled}
                onChange={(e) => setValue(field.name, e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={disabled}
        style={{ ...buttonStyle("primary", disabled), marginTop: 16 }}
      >
        {submitLabel ?? "提交"}
      </button>
    </form>
  );
}
