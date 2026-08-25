import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function IntegracoesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-64" />
      <Card className="space-y-4">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-5 w-40" />
          ))}
        </div>
        <Skeleton className="h-9 w-36" />
      </Card>
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Card key={i} className="h-24">
            <Skeleton className="h-3 w-72" />
            <Skeleton className="mt-3 h-3 w-40" />
          </Card>
        ))}
      </div>
    </div>
  );
}
