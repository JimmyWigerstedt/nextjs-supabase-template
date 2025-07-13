import { cn } from "~/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  );
}

// Pricing Card Skeleton
export function PricingCardSkeleton() {
  return (
    <div className="border-2 border-gray-200 rounded-lg p-8 animate-pulse">
      <div className="text-center mb-6">
        <Skeleton className="h-6 w-32 mx-auto mb-4" />
        <div className="mt-4">
          <Skeleton className="h-10 w-20 mx-auto mb-2" />
          <Skeleton className="h-4 w-16 mx-auto" />
        </div>
        <Skeleton className="h-4 w-24 mx-auto mt-2" />
      </div>

      <div className="space-y-3 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start space-x-3">
            <Skeleton className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>

      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

// User Data Section Skeleton
export function UserDataSkeleton() {
  return (
    <div className="flex items-center space-x-4 animate-pulse">
      <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full border">
        <Skeleton className="w-2 h-2 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      
      <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full border">
        <Skeleton className="w-2 h-2 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  );
}

// Form Field Skeleton
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

// Form Skeleton
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: fields }).map((_, i) => (
        <FormFieldSkeleton key={i} />
      ))}
      <Skeleton className="h-10 w-full rounded-md mt-6" />
    </div>
  );
}

// Card Skeleton
export function CardSkeleton() {
  return (
    <div className="border rounded-lg p-6 animate-pulse">
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-4">
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
}

// Header Skeleton
export function HeaderSkeleton() {
  return (
    <div className="flex justify-between items-center animate-pulse">
      <div className="flex items-center space-x-8">
        <Skeleton className="h-8 w-32" />
        <div className="hidden md:flex items-center space-x-6">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-2">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// Table Skeleton
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="animate-pulse">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-2 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Text Lines Skeleton
export function TextLinesSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

// Button Skeleton
export function ButtonSkeleton({ size = "default" }: { size?: "sm" | "default" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-16",
    default: "h-10 w-20",
    lg: "h-12 w-24"
  };
  
  return <Skeleton className={`${sizeClasses[size]} rounded-md`} />;
}

// Navigation Skeleton
export function NavigationSkeleton() {
  return (
    <nav className="hidden md:flex items-center space-x-6 animate-pulse">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-20" />
    </nav>
  );
}

// Avatar Skeleton
export function AvatarSkeleton({ size = "default" }: { size?: "sm" | "default" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    default: "h-10 w-10",
    lg: "h-12 w-12"
  };
  
  return <Skeleton className={`${sizeClasses[size]} rounded-full`} />;
} 