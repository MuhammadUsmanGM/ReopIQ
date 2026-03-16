import { ChatMessage } from "@/types";

const MAX_MESSAGES_PER_REPO = 50;

function getStorageKey(repoId: string): string {
  return `codelens_chat_${repoId}`;
}

export function loadChatHistory(repoId: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getStorageKey(repoId));
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ChatMessage[];
    return parsed.map(m => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
    }));
  } catch {
    return [];
  }
}

export function saveChatHistory(repoId: string, messages: ChatMessage[]): void {
  try {
    // Only save messages that have actual content
    const toSave = messages
      .filter(m => m.content.trim().length > 0)
      .slice(-MAX_MESSAGES_PER_REPO);
    localStorage.setItem(getStorageKey(repoId), JSON.stringify(toSave));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function clearChatHistory(repoId: string): void {
  try {
    localStorage.removeItem(getStorageKey(repoId));
  } catch {
    // Silently fail
  }
}
