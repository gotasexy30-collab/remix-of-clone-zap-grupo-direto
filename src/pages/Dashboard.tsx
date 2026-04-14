import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatDashboard } from '../components/chat/ChatDashboard';
import { AdminLogin } from '../components/auth/AdminLogin';
import { Loader2 } from 'lucide-react';

const Dashboard = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <Loader2 className="text-[#00a884] animate-spin" size={32} />
      </div>
    );
  }

  if (!session) {
    return <AdminLogin onLogin={() => {}} />;
  }

  return <ChatDashboard />;
};

export default Dashboard;
