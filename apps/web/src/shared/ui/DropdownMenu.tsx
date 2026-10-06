import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;

export function DropdownMenuContent({
  className,
  children,
  ...props
}: ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 rounded-md border border-line bg-surface p-1 shadow-pop",
          className,
        )}
        {...props}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

interface ItemProps extends ComponentProps<typeof RadixMenu.Item> {
  icon?: ReactNode;
  tone?: "default" | "danger";
}

export function DropdownMenuItem({ className, icon, tone = "default", children, ...props }: ItemProps) {
  return (
    <RadixMenu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none select-none [&_svg]:size-4",
        tone === "danger"
          ? "text-danger-600 data-highlighted:bg-danger-50"
          : "text-ink data-highlighted:bg-brand-50",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </RadixMenu.Item>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <RadixMenu.Label className="px-2.5 py-1.5 text-xs text-ink-muted">{children}</RadixMenu.Label>;
}

export function DropdownMenuSeparator() {
  return <RadixMenu.Separator className="my-1 h-px bg-line" />;
}
