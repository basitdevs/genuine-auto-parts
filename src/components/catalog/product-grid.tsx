import type { ReactNode } from "react";
import { PackageSearch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductCard as ProductCardData } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

export function ProductGrid({
  products,
  empty,
  eagerCount = 0,
  className,
}: {
  products: ProductCardData[];
  empty?: ReactNode;
  eagerCount?: number;
  className?: string;
}) {
  if (products.length === 0) return <>{empty ?? <EmptyState title="No parts to show yet" />}</>;
  return (
    <ul className={cn(GRID, className)}>
      {products.map((product, i) => (
        <li key={product.id} className="flex">
          <div className="w-full [&>article]:h-full">
            <ProductCard product={product} eager={i < eagerCount} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className={GRID} aria-label="Loading parts" aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-lg border bg-card">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-4 h-7 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed bg-muted/40 px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-background text-primary shadow-sm">
        {icon ?? <PackageSearch className="size-6" aria-hidden />}
      </div>
      <p className="font-display text-xl font-bold tracking-wide uppercase">{title}</p>
      {description ? <div className="mt-2 max-w-md text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
