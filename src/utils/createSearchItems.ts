import OpenAI from "openai";

export interface OpenAIResponse
  extends OpenAI.Chat.Completions.ChatCompletionMessage {}

export function createSearchItems(
  responses: OpenAI.Chat.Completions.ChatCompletionMessage[]
): string[] {
  let searchItems: string[] = [];

  responses.reduce((acc, response) => {
    if (response.role === "assistant") {
      const searchItem = response.content;
      const searchItemJSON = JSON.parse(searchItem || "");
      const selectors: string[] = searchItemJSON.selectors || [];
      const tags: string[] = searchItemJSON.tags || [];
      acc.push(...selectors, ...tags);
    }
    return acc;
  }, searchItems);

  // filter out duplicates
  searchItems = [...new Set(searchItems)];

  // filter out empty strings
  searchItems = searchItems.filter((item) => item !== "");

  //filter strings that start with ".css"
  searchItems = searchItems.filter((item) => !item.startsWith(".css"));

  return searchItems;
}
