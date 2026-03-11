"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "./utils";

// ─── Context ────────────────────────────────────────────────────────────────
interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select components must be used within <Select>");
  return ctx;
}

// Filter out Figma inspector internal props (_fgT, _fgS, _fgB, etc.)
function filterFigmaProps(props: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const key of Object.keys(props)) {
    if (!key.startsWith('_fg')) {
      filtered[key] = props[key];
    }
  }
  return filtered;
}

// ─── Select (Root) ──────────────────────────────────────────────────────────
interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  [key: string]: any;
}

function Select({ value: controlledValue, defaultValue = "", onValueChange, open: controlledOpen, onOpenChange, children, ...rest }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [internalOpen, setInternalOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const isControlledValue = controlledValue !== undefined;
  const currentValue = isControlledValue ? controlledValue : internalValue;

  const isControlledOpen = controlledOpen !== undefined;
  const currentOpen = isControlledOpen ? controlledOpen : internalOpen;

  const handleValueChange = React.useCallback((newValue: string) => {
    if (!isControlledValue) setInternalValue(newValue);
    onValueChange?.(newValue);
  }, [isControlledValue, onValueChange]);

  const handleSetOpen: React.Dispatch<React.SetStateAction<boolean>> = React.useCallback((action: React.SetStateAction<boolean>) => {
    const newOpen = typeof action === 'function' ? action(currentOpen) : action;
    if (!isControlledOpen) setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
  }, [isControlledOpen, currentOpen, onOpenChange]);

  return (
    <SelectContext.Provider value={{
      value: currentValue,
      onValueChange: handleValueChange,
      open: currentOpen,
      setOpen: handleSetOpen,
      triggerRef,
    }}>
      {children}
    </SelectContext.Provider>
  );
}

// ─── SelectGroup ────────────────────────────────────────────────────────────
const SelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, ...props }, ref) => (
  <div ref={ref} role="group" {...filterFigmaProps(props)}>
    {children}
  </div>
));
SelectGroup.displayName = "SelectGroup";

// ─── SelectValue ────────────────────────────────────────────────────────────
interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ placeholder, className, ...props }, ref) => {
    const { value } = useSelectContext();
    // We'll resolve the display text via ItemRegistry
    const registry = React.useContext(ItemRegistryContext);
    const displayText = registry?.getLabel(value);

    return (
      <span ref={ref} className={cn("block truncate", className)} {...filterFigmaProps(props)}>
        {displayText || value || placeholder || ""}
      </span>
    );
  }
);
SelectValue.displayName = "SelectValue";

// ─── Item Registry (maps value -> display label) ───────────────────────────
interface ItemRegistryContextValue {
  register: (value: string, label: string) => void;
  unregister: (value: string) => void;
  getLabel: (value: string) => string | undefined;
}

const ItemRegistryContext = React.createContext<ItemRegistryContextValue | null>(null);

function ItemRegistryProvider({ children }: { children: React.ReactNode }) {
  const mapRef = React.useRef<Map<string, string>>(new Map());
  const [, forceUpdate] = React.useState(0);

  const registry = React.useMemo<ItemRegistryContextValue>(() => ({
    register(value: string, label: string) {
      if (mapRef.current.get(value) !== label) {
        mapRef.current.set(value, label);
        forceUpdate(n => n + 1);
      }
    },
    unregister(value: string) {
      if (mapRef.current.has(value)) {
        mapRef.current.delete(value);
        forceUpdate(n => n + 1);
      }
    },
    getLabel(value: string) {
      return mapRef.current.get(value);
    },
  }), []);

  return (
    <ItemRegistryContext.Provider value={registry}>
      {children}
    </ItemRegistryContext.Provider>
  );
}

// Wrap Select to include ItemRegistry
const OriginalSelect = Select;
function SelectWithRegistry(props: SelectProps) {
  return (
    <OriginalSelect {...props}>
      <ItemRegistryProvider>
        <div className="relative">
          {props.children}
        </div>
      </ItemRegistryProvider>
    </OriginalSelect>
  );
}

// ─── SelectTrigger ──────────────────────────────────────────────────────────
const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useSelectContext();

  const composedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    },
    [ref, triggerRef]
  );

  return (
    <button
      ref={composedRef}
      type="button"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-gray-100 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(prev => !prev);
      }}
      {...filterFigmaProps(props)}
    >
      {children}
      <ChevronDownIcon className={cn("h-4 w-4 opacity-50 shrink-0 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

// ─── SelectContent ──────────────────────────────────────────────────────────
const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { position?: string }
>(({ className, children, position, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useSelectContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Click outside to close
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        contentRef.current && !contentRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    // Use a small delay to avoid the opening click triggering close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [open, setOpen, triggerRef]);

  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-2xl border border-gray-100 bg-white text-gray-950 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
      role="listbox"
      {...filterFigmaProps(props)}
    >
      <div className="p-1">
        {children}
      </div>
    </div>
  );
});
SelectContent.displayName = "SelectContent";

// ─── SelectItem ─────────────────────────────────────────────────────────────
interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled, ...props }, ref) => {
    const { value: selectedValue, onValueChange, setOpen } = useSelectContext();
    const isSelected = selectedValue === value;

    // Register label
    const registry = React.useContext(ItemRegistryContext);
    const childText = typeof children === "string" ? children : "";
    React.useEffect(() => {
      if (registry && value) {
        registry.register(value, childText);
        return () => registry.unregister(value);
      }
    }, [registry, value, childText]);

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        data-disabled={disabled || undefined}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
          isSelected ? "bg-indigo-50 text-indigo-900" : "hover:bg-gray-100 active:bg-gray-100 text-gray-900",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        onClick={() => {
          if (disabled) return;
          onValueChange(value);
          setOpen(false);
        }}
        onTouchEnd={(e) => {
          if (disabled) return;
          e.preventDefault();
          onValueChange(value);
          setOpen(false);
        }}
        {...filterFigmaProps(props)}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <CheckIcon className="h-4 w-4 text-indigo-600" />}
        </span>
        <span className="block truncate">{children}</span>
      </div>
    );
  }
);
SelectItem.displayName = "SelectItem";

// ─── SelectLabel ────────────────────────────────────────────────────────────
const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold text-gray-500", className)}
    {...filterFigmaProps(props)}
  />
));
SelectLabel.displayName = "SelectLabel";

// ─── SelectSeparator ────────────────────────────────────────────────────────
const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-gray-100", className)}
    {...filterFigmaProps(props)}
  />
));
SelectSeparator.displayName = "SelectSeparator";

// ─── Scroll buttons (no-op stubs for API compat) ───────────────────────────
const SelectScrollUpButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => null
);
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => null
);
SelectScrollDownButton.displayName = "SelectScrollDownButton";

export {
  SelectWithRegistry as Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};