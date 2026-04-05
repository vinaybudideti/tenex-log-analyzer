export function EmptyState({ logCount }: { logCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-zinc-200 mb-2">No threats detected</h3>
      <p className="text-zinc-500 max-w-md">
        Analyzed {logCount.toLocaleString()} log entries. No suspicious patterns
        matched the detection rules for beaconing, data exfiltration, credential
        attacks, or high-risk allowed traffic.
      </p>
    </div>
  );
}
