import { CircleCheckBig, Headset, LockKeyhole, Truck } from "lucide-react";

const POINTS = [
  { icon: Truck, title: "Fast nationwide shipping", text: "Parts are packed in-house and ship quickly with tracking." },
  { icon: LockKeyhole, title: "Pay when it's confirmed", text: "We confirm fit and shipping first, then send a secure payment link." },
  { icon: CircleCheckBig, title: "Right part, first time", text: "Fitment checked by OEM part number, so it fits your vehicle." },
  { icon: Headset, title: "Real people, real help", text: "Not sure it fits? Send us your VIN and we'll check it for you." },
];

export function TrustPoints() {
  return (
    <section aria-label="Why buy from us" className="border-b bg-background">
      <ul className="mx-auto grid max-w-7xl grid-cols-1 divide-y px-4 sm:grid-cols-2 sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:divide-x">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="group flex gap-4 py-6 lg:px-6 lg:first:pl-0">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg leading-tight font-bold tracking-wide uppercase">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
