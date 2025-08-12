import React, { useState } from 'react';
import { 
  Activity, 
  Settings, 
  Menu, 
  X, 
  Mic, 
  MicOff, 
  Users, 
  FileText, 
  BarChart3,
  Search,
  Plus,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const TopNavigation = ({
  isConnected,
  isRecording,
  activeMeeting,
  onStartRecording,
  onStopRecording,
  onNewMeeting,
  onOpenSettings,
  onToggleSidebar,
  sidebarOpen,
  className
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const quickActions = [
    {
      id: 'new-meeting',
      label: 'New Meeting',
      icon: Plus,
      action: onNewMeeting,
      variant: 'default',
      disabled: false,
      priority: 'high'
    },
    {
      id: 'record-toggle',
      label: isRecording ? 'Stop Recording' : 'Start Recording',
      icon: isRecording ? MicOff : Mic,
      action: isRecording ? onStopRecording : onStartRecording,
      variant: isRecording ? 'destructive' : 'default',
      disabled: !isConnected || !activeMeeting,
      priority: 'high'
    }
  ];

  const navigationItems = [
    {
      id: 'meetings',
      label: 'Meetings',
      icon: Users,
      action: () => onToggleSidebar('meetings'),
      active: sidebarOpen === 'meetings'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      action: () => onToggleSidebar('reports'),
      active: sidebarOpen === 'reports'
    },
    {
      id: 'transcripts',
      label: 'Transcripts',
      icon: FileText,
      action: () => onToggleSidebar('transcripts'),
      active: sidebarOpen === 'transcripts'
    }
  ];

  return (
    <nav className={cn(
      "bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm",
      className
    )}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section - Brand & Primary Nav */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Brand */}
            <div className="flex items-center space-x-3">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  TranscriptIQ
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  AI-Powered Meeting Intelligence
                </p>
              </div>
            </div>

            {/* Desktop Navigation Items */}
            <div className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => (
                <Button
                  key={item.id}
                  variant={item.active ? "default" : "ghost"}
                  size="sm"
                  onClick={item.action}
                  className="flex items-center space-x-2"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Center Section - Status & Context */}
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
              <span className={cn(
                "text-sm font-medium hidden sm:inline",
                isConnected ? "text-green-600" : "text-red-600"
              )}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Active Meeting Badge */}
            {activeMeeting && (
              <Badge 
                variant={activeMeeting.status === 'active' ? 'default' : 'secondary'}
                className="hidden sm:inline-flex"
              >
                {activeMeeting.title}
                {activeMeeting.status === 'active' && (
                  <span className="ml-1 animate-pulse">●</span>
                )}
              </Badge>
            )}
          </div>

          {/* Right Section - Quick Actions & Settings */}
          <div className="flex items-center space-x-2">
            {/* Quick Actions - Desktop */}
            <div className="hidden sm:flex items-center space-x-2">
              {quickActions
                .filter(action => action.priority === 'high')
                .map((action) => (
                  <Button
                    key={action.id}
                    variant={action.variant}
                    size="sm"
                    onClick={action.action}
                    disabled={action.disabled}
                    className="flex items-center space-x-2"
                  >
                    <action.icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{action.label}</span>
                  </Button>
                ))}
            </div>

            {/* Settings */}
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden lg:inline">Settings</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4">
            <div className="space-y-2">
              {/* Navigation Items */}
              {navigationItems.map((item) => (
                <Button
                  key={item.id}
                  variant={item.active ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    item.action();
                    setMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              ))}

              {/* Quick Actions */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant={action.variant}
                    className="w-full justify-start mb-2"
                    onClick={() => {
                      action.action();
                      setMobileMenuOpen(false);
                    }}
                    disabled={action.disabled}
                  >
                    <action.icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default TopNavigation;