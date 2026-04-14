import React, { useState, useEffect } from 'react';
import { ChatDashboard } from '../components/chat/ChatDashboard';
import { AdminLogin } from '../components/auth/AdminLogin';

const Dashboard = () => {
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem('admin_auth') === 'true'
  );

  if (!authenticated) {
    return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  return <ChatDashboard />;
};

export default Dashboard;
