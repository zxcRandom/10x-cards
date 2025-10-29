/**
 * Breadcrumb Component
 * 
 * Breadcrumb navigation for nested views.
 * Shows the current location in the site hierarchy.
 */

import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm mb-6">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            {isLast ? (
              <span 
                className="text-foreground font-medium" 
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            )}
          </div>
        );
      })}
    </nav>
  );
}


