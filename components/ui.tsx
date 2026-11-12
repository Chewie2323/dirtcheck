import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-pine text-paper hover:bg-pine-2",
        secondary: "bg-moss text-pine hover:bg-[#cfe0ef]",
        outline: "border border-line bg-card text-ink hover:bg-paper-2",
        ghost: "text-ink hover:bg-black/5",
        danger: "border border-stop/30 bg-stop-soft text-stop hover:bg-[#f6d5d0]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-muted/80 focus:border-pine focus:ring-2 focus:ring-pine/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/80 focus:border-pine focus:ring-2 focus:ring-pine/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-line bg-card px-3 text-sm text-ink outline-none focus:border-pine focus:ring-2 focus:ring-pine/20",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "high" | "medium" | "low" | "example" | "stop";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-paper-2 text-ink",
    high: "bg-moss text-pine",
    medium: "bg-gold-soft text-gold",
    low: "bg-copper-soft text-copper",
    example: "bg-gold-soft text-gold",
    stop: "bg-stop-soft text-stop",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]", tones[tone])}>
      {children}
    </span>
  );
}
