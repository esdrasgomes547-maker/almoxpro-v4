import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "outline" | "destructive" | "success" }>(({ className, variant = "default", ...props }, ref) => (
  <div ref={ref} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
    "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/80": variant === "default",
    "border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80": variant === "secondary",
    "text-[hsl(var(--foreground))]": variant === "outline",
    "border-transparent bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive))]/80": variant === "destructive",
    "border-transparent bg-emerald-500 text-white hover:bg-emerald-600": variant === "success",
  }, className)} {...props} />
))
Badge.displayName = "Badge"

export { Badge }
