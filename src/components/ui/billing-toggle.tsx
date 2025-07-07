'use client';

import { Button } from "./button";
import { cn } from "~/lib/utils";

export type BillingInterval = 'monthly' | 'yearly';

interface BillingToggleProps {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
  yearlyLabel?: string;
  monthlyLabel?: string;
}

export function BillingToggle({ 
  value, 
  onChange, 
  className,
  yearlyLabel = "Annual",
  monthlyLabel = "Monthly"
}: BillingToggleProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
        <Button
          variant={value === 'monthly' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange('monthly')}
          className={cn(
            "relative h-8 px-3 text-sm font-medium transition-all",
            value === 'monthly'
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          {monthlyLabel}
        </Button>
        <Button
          variant={value === 'yearly' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange('yearly')}
          className={cn(
            "relative h-8 px-3 text-sm font-medium transition-all",
            value === 'yearly'
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          {yearlyLabel}
        </Button>
      </div>
    </div>
  );
}

interface BillingToggleWithSavingsProps extends BillingToggleProps {
  savings?: number;
  showSavings?: boolean;
}

export function BillingToggleWithSavings({
  savings,
  showSavings = true,
  yearlyLabel = "Annual",
  ...props
}: BillingToggleWithSavingsProps) {
  const displayLabel = showSavings && savings && savings > 0
    ? `${yearlyLabel} (Save ${savings}%)`
    : yearlyLabel;

  return (
    <div className="flex flex-col items-center space-y-2">
      <BillingToggle
        {...props}
        yearlyLabel={displayLabel}
      />
      {showSavings && savings && savings > 0 && (
        <div className="text-sm text-green-600 font-medium">
          Save {savings}% with annual billing
        </div>
      )}
    </div>
  );
} 