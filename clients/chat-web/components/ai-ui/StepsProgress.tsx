"use client";

import type { CSSProperties } from "react";
import type { Step } from "@/types/ui-types";
import { cardStyle } from "./styles";

interface Props {
  steps: Step[];
  currentStep: number;
}

const dotStyle: Record<Step["status"], CSSProperties> = {
  completed: { background: "#10b981", color: "#fff" },
  current: {
    background: "#4f46e5",
    color: "#fff",
    boxShadow: "0 0 0 4px #e0e7ff",
  },
  pending: { background: "#e2e8f0", color: "#64748b" },
};

export function StepsProgress({ steps }: Props) {
  return (
    <div style={cardStyle}>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {steps.map((step, i) => (
          <li
            key={step.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "flex",
                height: 28,
                width: 28,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                fontSize: 12,
                fontWeight: 600,
                ...dotStyle[step.status],
              }}
            >
              {step.status === "completed" ? "✓" : i + 1}
            </span>
            <span
              style={{
                marginTop: 6,
                textAlign: "center",
                fontSize: 12,
                color: "#475569",
              }}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
