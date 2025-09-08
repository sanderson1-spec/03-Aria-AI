import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Chat', icon: '💬' },
    { path: '/characters', label: 'Characters', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="w-80 bg-white shadow-lg p-6">
      <h1 className="text-2xl font-bold text-blue-600 mb-6">Aria AI</h1>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`block p-3 rounded-lg font-medium transition-colors duration-200 ${
              location.pathname === item.path
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      
      <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          🧠 Aria's Mind
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Mood:</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg">😊</span>
              <span className="text-green-600 font-medium">Positive</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Engagement:</span>
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              </div>
              <span className="text-blue-600 font-medium text-xs">High</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Energy:</span>
            <div className="flex items-center space-x-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-500" style={{width: '80%'}}></div>
              </div>
              <span className="text-xs font-medium text-gray-600">80%</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Learning:</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg">📚</span>
              <span className="text-purple-600 font-medium">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
