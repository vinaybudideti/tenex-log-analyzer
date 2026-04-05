export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-zinc-400 mt-4">{message}</p>}
    </div>
  );
}
