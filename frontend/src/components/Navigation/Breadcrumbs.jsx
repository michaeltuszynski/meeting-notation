import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const Breadcrumbs = ({ items = [], className }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {/* Home/Root */}
        <li>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-gray-500 hover:text-gray-700"
            onClick={items[0]?.onClick}
          >
            <Home className="h-3 w-3" />
          </Button>
        </li>

        {items.map((item, index) => (
          <li key={item.id || index} className="flex items-center">
            <ChevronRight className="h-3 w-3 text-gray-400 mx-1" />
            {index === items.length - 1 ? (
              // Current page - not clickable
              <span className="text-gray-900 dark:text-white font-medium">
                {item.label}
              </span>
            ) : (
              // Clickable breadcrumb
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-gray-500 hover:text-gray-700"
                onClick={item.onClick}
              >
                {item.label}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;