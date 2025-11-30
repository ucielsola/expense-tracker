export function stripMarkdownCodeFences(text: string): string {
  // Remove ```json and ``` from the response
  return text.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
}