import React, { useState } from 'react';
import { MessageCircle, Settings, Users, Menu, X } from 'lucide-react';
import { clsx } from 'clsx';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar */}
      <div className={clsx(
        "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-80" : "w-16"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {sidebarOpen && (
            <h1 className="text-xl font-semibold text-gray-800">Aria AI</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-600" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <NavItem
              icon={MessageCircle}
              label="Chat"
              active={true}
              collapsed={!sidebarOpen}
            />
            <NavItem
              icon={Users}
              label="Characters"
              active={false}
              collapsed={!sidebarOpen}
            />
            <NavItem
              icon={Settings}
              label="Settings"
              active={false}
              collapsed={!sidebarOpen}
            />
          </div>
        </nav>

        {/* User Info (placeholder) */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Default User</p>
                <p className="text-xs text-gray-500">Free Plan</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, collapsed, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
        active
          ? "bg-primary-50 text-primary-600 border border-primary-200"
          : "text-gray-600 hover:bg-gray-100",
        collapsed && "justify-center"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="font-medium">{label}</span>}
    </button>
  );
};
