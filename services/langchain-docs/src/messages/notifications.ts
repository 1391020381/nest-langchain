/**
 * https://docs.langchain.com/oss/javascript/langchain/messages
 * Notification metadata on human and tool messages.
 *
 * The metadata stays on the message. Chat model integrations do not send
 * it, and it is not a trust signal: anyone who can write to the thread can set it.
 */
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  addNotificationMetadata,
  getNotificationMetadata,
} from "@langchain/core/messages";
import { docsChatModel } from "../models/chat-model";

const user = new HumanMessage("Reply with the single word: user");
const notification = addNotificationMetadata(
  new HumanMessage("Background task t_42 finished. Reply with the single word: noted."),
  { source: "background_job", data: { task_id: "t_42", status: "success" } },
);
const toolNotification = addNotificationMetadata(
  new ToolMessage({
    content: "The user rejected this tool call.",
    tool_call_id: "call_123",
    name: "get_weather",
  }),
  { source: "hitl_interrupt_decision", data: { decision: "reject" } },
);

for (const message of [user, notification, toolNotification]) {
  const metadata = getNotificationMetadata(message);
  if (metadata === undefined) {
    console.log(`[message] ${message.type} ${message.text}`);
  } else {
    console.log(
      `[notification] ${message.type} source=${metadata.source} data=${JSON.stringify(metadata.data)}`,
    );
    console.log(`  text=${message.text}`);
  }
}

const model = await docsChatModel({ maxTokens: 32 });
const reply = await model.invoke([
  new SystemMessage("Follow the latest user message exactly."),
  notification,
]);
console.log(`[model] ${reply.text}`);
console.log(
  `[still a notification] ${JSON.stringify(getNotificationMetadata(notification))}`,
);
