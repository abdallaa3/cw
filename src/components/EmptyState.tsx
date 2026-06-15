export function EmptyState({ emoji = "📭", text }: { emoji?: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="emoji">{emoji}</span>
      {text}
    </div>
  );
}
