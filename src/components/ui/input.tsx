import * as React from "react"

import { cn } from "@/lib/utils"

const nonNavigableTypes = new Set(['submit', 'button', 'checkbox', 'radio', 'file', 'reset', 'image', 'hidden'])

function focusNextInput(current: HTMLInputElement) {
  const focusable = Array.from(
    document.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="reset"]), select:not([disabled]), textarea:not([disabled])'
    )
  ).filter(el => el.offsetParent !== null)

  const index = focusable.indexOf(current)
  if (index >= 0 && index < focusable.length - 1) {
    focusable[index + 1].focus()
  }
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, ...props }, ref) => {
    const isDateOrTimeInput = type === 'date' || type === 'time' || type === 'datetime-local'

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !nonNavigableTypes.has(type ?? 'text')) {
        event.preventDefault()
        focusNextInput(event.currentTarget)
      }
      onKeyDown?.(event)
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full min-w-0 rounded-lg border border-input bg-white/90 px-3 py-2 text-[15px] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-action-primary/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]',
          isDateOrTimeInput &&
            'pr-2 [&::-webkit-date-and-time-value]:min-h-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer',
          className
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
