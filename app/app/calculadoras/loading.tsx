import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalculadorasLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-52" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="h-32">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
            <Skeleton className="mt-4 h-3 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
