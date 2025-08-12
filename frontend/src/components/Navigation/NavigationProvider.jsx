import React, { createContext, useContext, useState, useCallback } from 'react';

const NavigationContext = createContext();

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export const NavigationProvider = ({ children }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [navigationHistory, setNavigationHistory] = useState(['dashboard']);

  const navigate = useCallback((view, options = {}) => {
    const { addToBreadcrumbs = true, closeSidebar = true } = options;

    setCurrentView(view);
    
    if (closeSidebar) {
      setSidebarOpen(null);
    }

    // Update navigation history
    setNavigationHistory(prev => {
      const newHistory = [...prev, view];
      return newHistory.slice(-10); // Keep last 10 items
    });

    // Update breadcrumbs if requested
    if (addToBreadcrumbs && options.breadcrumb) {
      setBreadcrumbs(prev => [...prev, options.breadcrumb]);
    }
  }, []);

  const goBack = useCallback(() => {
    if (navigationHistory.length > 1) {
      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current
      const previousView = newHistory[newHistory.length - 1];
      
      setNavigationHistory(newHistory);
      setCurrentView(previousView);
      
      // Update breadcrumbs
      setBreadcrumbs(prev => prev.slice(0, -1));
    }
  }, [navigationHistory]);

  const toggleSidebar = useCallback((sidebarType) => {
    setSidebarOpen(current => current === sidebarType ? null : sidebarType);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(null);
  }, []);

  const updateBreadcrumbs = useCallback((newBreadcrumbs) => {
    setBreadcrumbs(newBreadcrumbs);
  }, []);

  const clearBreadcrumbs = useCallback(() => {
    setBreadcrumbs([]);
  }, []);

  const value = {
    // State
    currentView,
    sidebarOpen,
    breadcrumbs,
    navigationHistory,
    
    // Actions
    navigate,
    goBack,
    toggleSidebar,
    closeSidebar,
    updateBreadcrumbs,
    clearBreadcrumbs,
    
    // Utilities
    canGoBack: navigationHistory.length > 1,
    isViewActive: (view) => currentView === view,
    isSidebarOpen: (type) => sidebarOpen === type
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};