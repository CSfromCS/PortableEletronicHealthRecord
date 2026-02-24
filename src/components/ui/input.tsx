import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, ...props }, ref) => {
    const isDateOrTimeInput = type === 'date' || type === 'time' || type === 'datetime-local'
    const isEnterNavigationInputType =
      type === undefined ||
      type === 'text' ||
      type === 'number' ||
      type === 'search' ||
      type === 'email' ||
      type === 'url' ||
      type === 'tel' ||
      type === 'password'

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented) return
      if (!isEnterNavigationInputType) return
      if (event.nativeEvent.isComposing || event.key !== 'Enter') return
      if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return

      const allFocusableInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([disabled])')
      ).filter((input) => !input.readOnly && input.tabIndex >= 0)

      const currentIndex = allFocusableInputs.indexOf(event.currentTarget)
      if (currentIndex < 0) return

      const nextInput = allFocusableInputs[currentIndex + 1]
      if (!nextInput) return

      event.preventDefault()
      nextInput.focus()
      nextInput.select()
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          isDateOrTimeInput &&
            'pr-2 [&::-webkit-date-and-time-value]:min-h-[1lh] [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer',
          className
        )}
        ref={ref}
        {...props}
        onKeyDown={handleKeyDown}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
