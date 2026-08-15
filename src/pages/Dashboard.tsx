import React, { useState } from 'react';
import { ChatDashboard } from '../components/chat/ChatDashboard';
import { AdminLogin } from '../components/auth/AdminLogin';

const Dashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  return <ChatDashboard />;
};

export default Dashboard;
