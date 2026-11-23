import Link from "next/link";
import { QuickAddButton } from "@/components/cart/add-to-cart";
import { Badge } from "@/components/ui/badge";
import { conditionLabel, formatPrice } from "@/lib/format";
import { getFlags } from "@/lib/settings/server";
import type { ProductCard as ProductCardData } from "@/lib/catalog/types";
import { PartImage } from "./part-image";

function StockBadge({ product }: { product: ProductCardData }) {
  if (product.status === "sold" || product.quantity === 0) return <Badge variant="dark">Sold out</Badge>;
  if (product.quantity === 1) return <Badge>Only 1 left</Badge>;
  if (product.quantity <= 3) return <Badge>Only {product.quantity} left</Badge>;
  return <Badge variant="success">In stock</Badge>;
}

export async function ProductCard({ product, eager = false }: { product: ProductCardData; eager?: boolean }) {
  const { showPrices } = await getFlags();
  const soldOut = product.status === "sold" || product.quantity === 0;
  const href = `/parts/${product.slug}`;
  const onSale = product.compareAtPrice !== null && product.compareAtPrice > product.price;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-xl hover:shadow-black/5">
      <div className="relative">
        <PartImage
          image={product.image}
          icon={product.categoryIcon}
          sizes="(min-width: 1280px) 290px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          eager={eager}
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <StockBadge product={product} />
          {onSale ? <Badge variant="dark">Sale</Badge> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {conditionLabel[product.condition]}
          {product.placement ? ` · ${product.placement}` : ""}
        </p>
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-foreground">
          {/* Stretched link: the whole card is clickable, the cart button stays separate. */}
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {product.title}
          </Link>
        </h3>
        {product.oemPartNumber ? (
          <p className="font-mono text-xs text-muted-foreground">
            OEM # <span className="text-foreground">{product.oemPartNumber}</span>
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {showPrices ? (
          <p className="flex flex-col leading-none">
            {onSale && product.compareAtPrice !== null ? (
              <span className="mb-1 text-xs text-muted-foreground line-through">{formatPrice(product.compareAtPrice)}</span>
            ) : null}
            <span className="font-display text-2xl font-bold tracking-tight">{formatPrice(product.price)}</span>
          </p>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">Call for price</p>
          )}
          <QuickAddButton productId={product.id} title={product.title} soldOut={soldOut} href={href} />
        </div>
      </div>
    </article>
  );
}
