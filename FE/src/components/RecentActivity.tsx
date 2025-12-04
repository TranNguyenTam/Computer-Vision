import { format } from 'date-fns';
import { AlertTriangle, Clock, MapPin, User } from 'lucide-react';
import React from 'react';
import { RecentAlert, RecentDetection } from '../types';

interface RecentActivityProps {
  recentAlerts: RecentAlert[];
  recentDetections: RecentDetection[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ 
  recentAlerts, 
  recentDetections 
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Alerts */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Cảnh báo gần đây
        </h3>
        
        <div className="space-y-3">
          {recentAlerts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Không có cảnh báo</p>
          ) : (
            recentAlerts.map((alert) => (
              <div 
                key={alert.id}
                className={`
                  p-3 rounded-lg border-l-4
                  ${alert.status === 'Active' ? 'border-red-500 bg-red-50' : ''}
                  ${alert.status === 'Acknowledged' ? 'border-yellow-500 bg-yellow-50' : ''}
                  ${alert.status === 'Resolved' ? 'border-green-500 bg-green-50' : ''}
                  ${alert.status === 'FalsePositive' ? 'border-gray-400 bg-gray-50' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">
                    {alert.patientName || 'Không xác định'}
                  </span>
                  <span className={`
                    text-xs px-2 py-1 rounded-full
                    ${alert.status === 'Active' ? 'bg-red-200 text-red-800' : ''}
                    ${alert.status === 'Acknowledged' ? 'bg-yellow-200 text-yellow-800' : ''}
                    ${alert.status === 'Resolved' ? 'bg-green-200 text-green-800' : ''}
                    ${alert.status === 'FalsePositive' ? 'bg-gray-200 text-gray-800' : ''}
                  `}>
                    {alert.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {alert.location || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(alert.timestamp), 'HH:mm')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Detections */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          Bệnh nhân phát hiện gần đây
        </h3>
        
        <div className="space-y-3">
          {recentDetections.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Chưa có phát hiện</p>
          ) : (
            recentDetections.map((detection, index) => (
              <div 
                key={`${detection.patientId}-${index}`}
                className="p-3 rounded-lg bg-blue-50 border-l-4 border-blue-500"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">
                    {detection.patientName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {detection.patientId}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {detection.location || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(detection.timestamp), 'HH:mm')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;
