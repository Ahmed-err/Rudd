export default function ConversationDetailLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-2xl mx-auto">
      <div className="flex items-center gap-3 pb-4 border-b shrink-0 animate-pulse">
        <div className="h-4 w-16 bg-muted rounded" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="h-6 w-16 bg-muted rounded" />
      </div>
      <div className="flex-1 py-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"} animate-pulse`}>
            <div className="h-10 w-48 bg-muted rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
