import React, { useState } from 'react';
import { Plus, Zap, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const QuickActions = ({ 
  actions = [], 
  position = 'bottom-right',
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 transform -translate-x-1/2'
  };

  const primaryAction = actions.find(action => action.primary) || actions[0];
  const secondaryActions = actions.filter(action => !action.primary);

  if (!primaryAction) return null;

  return (
    <div className={cn(
      "fixed z-50 flex flex-col items-end space-y-2",
      positionClasses[position],
      className
    )}>
      {/* Secondary Actions */}
      {isExpanded && secondaryActions.length > 0 && (
        <div className="flex flex-col space-y-2 mb-2">
          {secondaryActions.map((action, index) => (
            <div
              key={action.id || index}
              className="flex items-center space-x-3 animate-in slide-in-from-bottom-2 duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Action Label */}
              <div className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                {action.label}
              </div>
              
              {/* Action Button */}
              <Button
                variant={action.variant || "default"}
                size="icon"
                onClick={() => {
                  action.onClick();
                  setIsExpanded(false);
                }}
                disabled={action.disabled}
                className="h-12 w-12 rounded-full shadow-lg"
              >
                <action.icon className="h-5 w-5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Primary Action Button */}
      <div className="relative">
        {/* Expand/Collapse Button (if secondary actions exist) */}
        {secondaryActions.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute -top-14 right-0 h-10 w-10 rounded-full bg-white shadow-lg border-2"
          >
            <ChevronUp className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded ? "rotate-180" : ""
            )} />
          </Button>
        )}

        {/* Main Action Button */}
        <Button
          variant={primaryAction.variant || "default"}
          size="icon"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
          className="h-16 w-16 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105"
        >
          <primaryAction.icon className="h-6 w-6" />
        </Button>

        {/* Pulse Animation for Recording */}
        {primaryAction.id === 'record-toggle' && isExpanded && (
          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
        )}
      </div>
    </div>
  );
};

export default QuickActions;