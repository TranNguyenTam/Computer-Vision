import {
    AlertTriangle,
    Calendar,
    Camera,
    Users
} from 'lucide-react';
import React from 'react';
import { DashboardStats } from '../types';

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  const cards = [
    {
      title: 'Tổng bệnh nhân',
      value: stats?.totalPatients || 0,
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-700'
    },
    {
      title: 'Lịch khám hôm nay',
      value: stats?.todayAppointments || 0,
      icon: Calendar,
      color: 'green',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      textColor: 'text-green-700'
    },
    {
      title: 'Cảnh báo đang xử lý',
      value: stats?.activeAlerts || 0,
      icon: AlertTriangle,
      color: 'red',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      textColor: 'text-red-700'
    },
    {
      title: 'BN phát hiện hôm nay',
      value: stats?.patientsDetectedToday || 0,
      icon: Camera,
      color: 'purple',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      textColor: 'text-purple-700'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div 
          key={card.title}
          className={`${card.bgColor} rounded-xl shadow-sm p-6 transition-transform hover:scale-105`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className={`${card.textColor} font-medium`}>{card.title}</span>
            <card.icon className={`w-6 h-6 ${card.iconColor}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold ${card.textColor}`}>
              {card.value}
            </span>
            {card.title === 'Cảnh báo đang xử lý' && card.value > 0 && (
              <span className="animate-pulse bg-red-500 w-2 h-2 rounded-full"></span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
