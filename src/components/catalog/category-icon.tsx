import {
  Armchair,
  CarFront,
  CircleDot,
  Cog,
  Cpu,
  Disc,
  Fuel,
  Lightbulb,
  MoveVertical,
  Package,
  Radio,
  Settings2,
  Shield,
  Snowflake,
  type LucideIcon,
} from "lucide-react";

/** Keys match `categories.icon` (see src/lib/import/category-groups.ts). */
const ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  lightbulb: Lightbulb,
  cpu: Cpu,
  radio: Radio,
  cog: Cog,
  "settings-2": Settings2,
  "move-vertical": MoveVertical,
  disc: Disc,
  snowflake: Snowflake,
  fuel: Fuel,
  "circle-dot": CircleDot,
  armchair: Armchair,
  "car-front": CarFront,
  package: Package,
};

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Package;
  return <Icon aria-hidden className={className} />;
}
