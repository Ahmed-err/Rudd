/**
 * Aggressively strips markdown and normalises whitespace for WhatsApp delivery.
 * WhatsApp renders plain text only — any markdown symbols appear as literal characters.
 */
export const stripMarkdown = (text: string): string =>
  text
    // Code fences (remove entirely including content)
    .replace(/```[\s\S]*?```/g, "")
    // Inline code
    .replace(/`([^`]+)`/g, "$1")
    // Bold: **text** or __text__
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/__(.*?)__/gs, "$1")
    // Italic: *text* or _text_
    .replace(/\*(.*?)\*/gs, "$1")
    .replace(/_(.*?)_/gs, "$1")
    // Headers
    .replace(/^#{1,6}\s+/gm, "")
    // Blockquotes
    .replace(/^>\s*/gm, "")
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Bullet points (-, *, •, +) at start of line
    .replace(/^[ \t]*[-*•+]\s+/gm, "")
    // Numbered / lettered lists: "1. ", "2) ", "a. ", "a) "
    .replace(/^[ \t]*(?:\d+|[a-zA-Z])[.)]\s+/gm, "")
    // Trailing colons that introduce a list ("Here are your options:")
    // — join the next lines into the sentence instead of leaving a dangling colon
    .replace(/:\n+/g, ": ")
    // Collapse multiple blank lines → single newline
    .replace(/\n{2,}/g, "\n")
    // Llama text-format tool calls that leaked into content
    .replace(/<function=[^>]*>[\s\S]*?<\/function>/g, "")
    .replace(/<\|[^|]*\|>/g, "")
    // Remove leading/trailing whitespace per line
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
