import { cloneElement, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SlotProps = HTMLAttributes<HTMLElement> & { children?: ReactNode };

/** Minimal `asChild` slot: merges className/props onto the single child element. */
export function Slot({ children, className, ...props }: SlotProps) {
  if (!isValidElement(children)) return null;
  const child = children as ReactElement<HTMLAttributes<HTMLElement>>;
  return cloneElement(child, {
    ...props,
    ...child.props,
    className: cn(className, child.props.className),
  });
}
