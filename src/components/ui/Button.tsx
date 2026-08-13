import type { ButtonHTMLAttributes } from "react";

type Variant = "filled" | "tonal" | "outlined" | "text" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  filled: "bg-primary text-on-primary px-6 py-2.5 shadow-sm hover:shadow-md hover:brightness-110",
  tonal:
    "bg-secondary-container text-on-secondary-container px-6 py-2.5 hover:brightness-95",
  outlined:
    "border border-outline text-primary px-6 py-2.5 hover:bg-primary/5",
  text: "text-primary px-4 py-2.5 hover:bg-primary/10",
  danger: "bg-error text-on-error px-6 py-2.5 shadow-sm hover:brightness-110",
};

export function Button({
  variant = "filled",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
