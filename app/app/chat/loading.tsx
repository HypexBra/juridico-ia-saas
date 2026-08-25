import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="flex-1 space-y-4 rounded-xl border border-ink/10 bg-navy-2/60 p-5">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-16 w-3/5" />
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
