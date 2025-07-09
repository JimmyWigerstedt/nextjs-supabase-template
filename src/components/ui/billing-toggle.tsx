'use client';

import { Button } from "./button";
import { cn } from "~/lib/utils";

export type BillingInterval = 'monthly' | 'yearly';

interface BillingToggleProps {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
}

export function BillingToggle({ 
  value, 
  onChange, 
  className
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
          Monthly
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
          Annual
        </Button>
      </div>
    </div>
  );
} 