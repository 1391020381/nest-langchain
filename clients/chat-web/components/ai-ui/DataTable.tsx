"use client";

import { cardStyle } from "./styles";

interface Props {
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  selectable?: boolean;
  disabled?: boolean;
  onRowSelect: (rowIndex: number) => void;
}

export function DataTable({
  columns,
  rows,
  selectable,
  disabled,
  onRowSelect,
}: Props) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: 12, color: "#64748b" }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: "8px 12px", fontWeight: 500 }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => {
                if (selectable && !disabled) onRowSelect(i);
              }}
              style={{
                borderTop: "1px solid #f1f5f9",
                cursor: selectable && !disabled ? "pointer" : "default",
                opacity: disabled ? 0.55 : 1,
              }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ padding: "8px 12px", color: "#334155" }}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
