import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader } from "lucide-react";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",

        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",

        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",

        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",

        ghost: "hover:bg-accent hover:text-accent-foreground",

        frigate: "bg-[#674299] text-white hover:bg-[#532075]",

        link: "text-primary underline-offset-4 hover:underline",

        cta:
          "text-white bg-[linear-gradient(-45deg,#FFA63D,#FF3D77,#338AFF,#3CF0C5)] " +
          "bg-[length:600%_600%] animate-[gradient-animation_16s_linear_infinite] " +
          "rounded-full px-10 py-6 text-lg font-bold " +
          "before:absolute before:inset-0 before:-z-10 before:rounded-full " +
          "before:bg-[inherit] before:blur-2xl before:opacity-80",
        blueCta:
          "relative group transition-all duration-300 active:scale-95 " +
          "text-white font-bold text-lg rounded-full px-10 py-6 " +
          "bg-[linear-gradient(-45deg,#3b82f6,#2563eb,#0ea5e9)] bg-[length:200%_200%] " +
          "animate-[gradient-animation_6s_linear_infinite] " +
          "hover:shadow-[0_0_40px_8px_rgba(59,130,246,0.4)] " +
          // The Glow Effect
          "before:absolute before:inset-0 before:-z-10 before:rounded-full " +
          "before:bg-[inherit] before:blur-xl before:opacity-50 " +
          "group-hover:before:opacity-100 group-hover:before:blur-2xl before:transition-all",
        /** NEW */
        stroke:
          "bg-transparent p-0 w-[300px] h-[80px] text-[#98A5A6] " +
          "hover:text-[#BEC3C7]",
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
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isStroke = variant === "stroke";

    return (
      <Comp
        ref={ref}
        disabled={loading || props.disabled}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {isStroke && (
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                viewBox="0 0 300 80"
                aria-hidden
              >
                <rect
                  className="btn-line btn-line--outer"
                  x="4"
                  y="4"
                  width="292"
                  height="72"
                  rx="36"
                />
                <rect
                  className="btn-line btn-line--inner"
                  x="4"
                  y="4"
                  width="292"
                  height="72"
                  rx="36"
                />
              </svg>
            )}
            <span className="relative z-10 flex items-center">
              {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? (
                <span className="opacity-0">{children}</span>
              ) : (
                children
              )}
            </span>
          </>
        )}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
