import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ModelosLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-52" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="h-28">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-3 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
