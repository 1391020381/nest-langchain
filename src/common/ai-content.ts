export function contentToText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return content == null ? '' : JSON.stringify(content);
  }

  return content
    .map((block) => {
      if (typeof block === 'string') {
        return block;
      }
      if (
        typeof block === 'object' &&
        block !== null &&
        'text' in block &&
        typeof block.text === 'string'
      ) {
        return block.text;
      }
      return JSON.stringify(block);
    })
    .join('');
}
