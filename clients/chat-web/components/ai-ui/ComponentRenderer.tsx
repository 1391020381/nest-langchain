"use client";

import { SelectionCard } from "./SelectionCard";
import { DynamicForm } from "./DynamicForm";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { InfoCard } from "./InfoCard";
import { StepsProgress } from "./StepsProgress";
import { DataTable } from "./DataTable";
import { ActionButtons } from "./ActionButtons";
import type { UIResponse, UIAction } from "@/types/ui-types";

export function ComponentRenderer({
  component,
  onAction,
  disabled,
}: {
  component: UIResponse;
  onAction: (action: UIAction) => void;
  disabled?: boolean;
}) {
  switch (component.type) {
    case "text":
      return <div style={{ whiteSpace: "pre-wrap" }}>{component.content}</div>;
    case "selection":
      return (
        <SelectionCard
          {...component}
          disabled={disabled}
          onSelect={(selectedId) =>
            onAction({
              componentType: "selection",
              payload: { type: "select", selectedId },
            })
          }
        />
      );
    case "form":
      return (
        <DynamicForm
          {...component}
          disabled={disabled}
          onSubmit={(formData) =>
            onAction({
              componentType: "form",
              payload: { type: "submit", formData },
            })
          }
        />
      );
    case "confirmation":
      return (
        <ConfirmationDialog
          {...component}
          disabled={disabled}
          onConfirm={() =>
            onAction({
              componentType: "confirmation",
              payload: { type: "confirm", confirmed: true },
            })
          }
          onCancel={() =>
            onAction({
              componentType: "confirmation",
              payload: { type: "confirm", confirmed: false },
            })
          }
        />
      );
    case "card":
      return (
        <InfoCard
          {...component}
          disabled={disabled}
          onAction={(actionId) =>
            onAction({
              componentType: "card",
              payload: { type: "click", actionId },
            })
          }
        />
      );
    case "steps":
      return <StepsProgress {...component} />;
    case "table":
      return (
        <DataTable
          {...component}
          disabled={disabled}
          onRowSelect={(rowIndex) =>
            onAction({
              componentType: "table",
              payload: { type: "row_select", rowIndex },
            })
          }
        />
      );
    case "action_buttons":
      return (
        <ActionButtons
          {...component}
          disabled={disabled}
          onClick={(actionId) =>
            onAction({
              componentType: "action_buttons",
              payload: { type: "click", actionId },
            })
          }
        />
      );
    default:
      return (
        <div>
          [不支持的组件类型: {(component as { type: string }).type}]
        </div>
      );
  }
}
