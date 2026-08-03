import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

export async function splitText(text: string): Promise<string[]> {
  return splitter.splitText(text);
}
