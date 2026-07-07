import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Shared Button system — used by both the Marketplace and Logistics platforms.
 *
 * Variants:
 *  - default / primary  → solid brand blue, electric-blue glow on hover
 *  - secondary          → ice-blue surface, dark text, electric glow on hover
 *  - active             → solid vibrant blue for selected/toggled state
 *  - outline / ghost    → transparent surfaces with subtle blue wash on hover
 *  - hero               → gradient-accent CTA with permanent soft glow
 *  - destructive / link → unchanged shadcn semantics
 *
 * Every interactive variant animates a shared `shadow-electric` glow so
 * hover / active / selected feels uniform across buttons, chips, and pills.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-electric data-[state=active]:bg-accent data-[state=active]:shadow-electric data-[state=on]:bg-accent data-[state=on]:shadow-electric",
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-electric data-[state=active]:bg-accent data-[state=active]:shadow-electric data-[state=on]:bg-accent data-[state=on]:shadow-electric",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/60 hover:bg-accent/10 hover:text-accent hover:border-accent/40 hover:shadow-electric data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:border-accent data-[state=active]:shadow-electric data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:shadow-electric",
        active:
          "bg-accent text-accent-foreground shadow-electric hover:bg-accent/90",
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-electric",
        outline:
          "border border-input bg-background hover:bg-accent/10 hover:text-accent hover:border-accent/40 hover:shadow-electric",
        ghost:
          "hover:bg-accent/10 hover:text-accent hover:shadow-electric",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline hover:text-accent",
        hero: "bg-gradient-accent text-accent-foreground shadow-glow hover:shadow-electric hover:scale-[1.03] font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
