/**
 * https://docs.langchain.com/oss/javascript/langchain/structured-output
 * Error handling
 *
 * The page's traces depend on the model emitting an invalid tool call.
 * `FakeToolCallingModel` supplies those calls so the retry is deterministic.
 *
 * langchain 1.6.7 raises `StructuredOutputParsingError` and
 * `MultipleStructuredOutputsError`. The page's `ToolInputParsingException`
 * is not what `toolStrategy` throws. A multiple-output mistake is reported
 * on the first tool call only. `handleError: false` throws instead of retrying.
 */
import {
  createAgent,
  FakeToolCallingModel,
  MultipleStructuredOutputsError,
  StructuredOutputParsingError,
  toolStrategy,
} from "langchain";

const ProductRating = {
  title: "ProductRating",
  description: "Rating from 1-5 with a comment",
  type: "object" as const,
  properties: {
    rating: { type: "number", minimum: 1, maximum: 5 },
    comment: { type: "string" },
  },
  required: ["rating", "comment"],
};

const ContactInfo = {
  title: "ContactInfo",
  description: "Contact information",
  type: "object" as const,
  properties: {
    name: { type: "string" },
    email: { type: "string" },
  },
  required: ["name", "email"],
};

const EventDetails = {
  title: "EventDetails",
  description: "Event details",
  type: "object" as const,
  properties: {
    event_name: { type: "string" },
    date: { type: "string" },
  },
  required: ["event_name", "date"],
};

type ScriptedCall = { name: string; args: Record<string, unknown>; id: string };

function scripted(toolCalls: ScriptedCall[][]) {
  return new FakeToolCallingModel({ toolCalls });
}

function textOf(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function trace(label: string, messages: Array<{ type: string; content: unknown }>) {
  console.log(`\n== ${label} ==`);
  for (const message of messages) {
    if (message.type !== "tool") continue;
    console.log(`[tool] ${textOf(message.content)}`);
  }
}

const invalidRating: ScriptedCall = {
  name: "ProductRating",
  args: { rating: 10, comment: "Amazing product" },
  id: "call_1",
};
const validRating: ScriptedCall = {
  name: "ProductRating",
  args: { rating: 5, comment: "Amazing product" },
  id: "call_2",
};

const validated = await createAgent({
  model: scripted([[invalidRating], [validRating]]),
  tools: [],
  responseFormat: toolStrategy(ProductRating),
}).invoke({ messages: [{ role: "user", content: "Parse this: Amazing product, 10/10!" }] });
trace("schema validation", validated.messages);
console.log(`[structured] ${JSON.stringify(validated.structuredResponse)}`);
const validationError = textOf(validated.messages.find((message) => message.type === "tool")?.content);
if (!validationError.includes("Failed to parse structured output")) {
  throw new Error(`expected a schema retry, tool message was ${validationError}`);
}
if (validated.structuredResponse?.rating !== 5) {
  throw new Error(`expected the retried rating, got ${JSON.stringify(validated.structuredResponse)}`);
}

const multiple = await createAgent({
  model: scripted([
    [
      { name: "ContactInfo", args: { name: "John Doe", email: "john@email.com" }, id: "call_1" },
      { name: "EventDetails", args: { event_name: "Tech Conference", date: "March 15th" }, id: "call_2" },
    ],
    [{ name: "ContactInfo", args: { name: "John Doe", email: "john@email.com" }, id: "call_3" }],
  ]),
  tools: [],
  responseFormat: toolStrategy([ContactInfo, EventDetails]),
}).invoke({
  messages: [
    {
      role: "user",
      content: "Extract info: John Doe (john@email.com) is organizing Tech Conference on March 15th",
    },
  ],
});
trace("multiple structured outputs", multiple.messages);
console.log(`[structured] ${JSON.stringify(multiple.structuredResponse)}`);
const multipleError = textOf(multiple.messages.find((message) => message.type === "tool")?.content);
if (!multipleError.includes("multiple tools")) {
  throw new Error(`expected a multiple-output retry, tool message was ${multipleError}`);
}
if (multiple.structuredResponse?.name !== "John Doe") {
  throw new Error(`expected one contact, got ${JSON.stringify(multiple.structuredResponse)}`);
}

const customError = "Please provide a valid rating between 1-5 and include a comment.";

const custom = await createAgent({
  model: scripted([[invalidRating], [validRating]]),
  tools: [],
  responseFormat: toolStrategy(ProductRating, { handleError: customError }),
}).invoke({ messages: [{ role: "user", content: "Parse this: Amazing product, 10/10!" }] });
trace("handleError string", custom.messages);
const customTool = textOf(custom.messages.find((message) => message.type === "tool")?.content);
if (customTool !== customError) {
  throw new Error(`handleError string was not the tool message: ${customTool}`);
}
if (custom.structuredResponse?.rating !== 5) {
  throw new Error(`expected a retry after the custom message, got ${JSON.stringify(custom.structuredResponse)}`);
}

const handled = await createAgent({
  model: scripted([[invalidRating], [validRating]]),
  tools: [],
  responseFormat: toolStrategy(ProductRating, {
    handleError: (error: StructuredOutputParsingError | MultipleStructuredOutputsError) => {
      if (error instanceof StructuredOutputParsingError) return customError;
      return error.message;
    },
  }),
}).invoke({ messages: [{ role: "user", content: "Parse this: Amazing product, 10/10!" }] });
trace("handleError function", handled.messages);
const handledTool = textOf(handled.messages.find((message) => message.type === "tool")?.content);
if (handledTool !== customError || handled.structuredResponse?.rating !== 5) {
  throw new Error(`handleError function did not retry: ${handledTool}`);
}

console.log("\n== handleError false ==");
let thrown: unknown;
try {
  await createAgent({
    model: scripted([[invalidRating]]),
    tools: [],
    responseFormat: toolStrategy(ProductRating, { handleError: false }),
  }).invoke({ messages: [{ role: "user", content: "Parse this: Amazing product, 10/10!" }] });
} catch (error) {
  thrown = error;
}
let current = thrown;
let parsing: StructuredOutputParsingError | undefined;
while (current instanceof Error) {
  if (current instanceof StructuredOutputParsingError) {
    parsing = current;
    break;
  }
  current = current.cause;
}
if (!parsing) {
  throw new Error(
    `handleError: false did not throw StructuredOutputParsingError (${thrown instanceof Error ? thrown.message : String(thrown)})`,
  );
}
console.log(`[thrown] ${parsing.message}`);
