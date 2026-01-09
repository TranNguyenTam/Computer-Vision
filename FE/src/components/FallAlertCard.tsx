import { format } from 'date-fns';
import {
  AlertTriangle,
  Check,
  Clock,
  MapPin,
  User,
  X
} from 'lucide-react';
import React from 'react';
import { FallAlert } from '../types';

interface FallAlertCardProps {
  alert: FallAlert;
  onAcknowledge?: (alertId: number) => void;
  onResolve?: (alertId: number) => void;
  onDismiss?: (alertId: number) => void;
}

const FallAlertCard: React.FC<FallAlertCardProps> = ({
  alert,
  onAcknowledge,
  onResolve,
  onDismiss
}) => {
  const isActive = alert.status === 'Active';
  const isAcknowledged = alert.status === 'Acknowledged';

  return (
    <div 
      className={`
        rounded-lg border-2 p-4 mb-4 transition-all
        ${isActive ? 'alert-flash border-red-500 bg-red-50' : ''}
        ${isAcknowledged ? 'border-yellow-500 bg-yellow-50' : ''}
        ${alert.status === 'Resolved' ? 'border-green-500 bg-green-50' : ''}
        ${alert.status === 'FalsePositive' ? 'border-gray-400 bg-gray-50' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle 
            className={`w-6 h-6 ${isActive ? 'text-red-600 animate-pulse' : 'text-gray-500'}`} 
          />
          <span className={`font-bold text-lg ${isActive ? 'text-red-700' : 'text-gray-700'}`}>
            {isActive ? 'TÉ NGÃ PHÁT HIỆN!' : 'Cảnh báo té ngã'}
          </span>
        </div>
        <span className={`
          px-3 py-1 rounded-full text-sm font-medium
          ${isActive ? 'bg-red-200 text-red-800' : ''}
          ${isAcknowledged ? 'bg-yellow-200 text-yellow-800' : ''}
          ${alert.status === 'Resolved' ? 'bg-green-200 text-green-800' : ''}
          ${alert.status === 'FalsePositive' ? 'bg-gray-200 text-gray-800' : ''}
        `}>
          {alert.status === 'Active' && 'Đang xử lý'}
          {alert.status === 'Acknowledged' && 'Đã tiếp nhận'}
          {alert.status === 'Resolved' && 'Đã giải quyết'}
          {alert.status === 'FalsePositive' && 'Báo động giả'}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-gray-700">
          <User className="w-4 h-4" />
          <span>
            <strong>Bệnh nhân:</strong> {alert.patientName || 'Không xác định'}
            {alert.patientId && <span className="text-gray-500 ml-1">({alert.patientId})</span>}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-gray-700">
          <MapPin className="w-4 h-4" />
          <span>
            <strong>Vị trí:</strong> {alert.location || 'Không xác định'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-gray-700">
          <Clock className="w-4 h-4" />
          <span>
            <strong>Thời gian:</strong> {format(new Date(alert.timestamp), 'HH:mm:ss dd/MM/yyyy')}
          </span>
        </div>
        
        <div className="text-gray-600">
          {/* <strong>Độ tin cậy:</strong> {(alert.confidence * 100).toFixed(1)}% */}
        </div>
      </div>

      {/* Actions */}
      {(isActive || isAcknowledged) && (
        <div className="flex gap-2 pt-3 border-t border-gray-200">
          {isActive && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Tiếp nhận
            </button>
          )}
          
          {onResolve && (
            <button
              onClick={() => onResolve(alert.id)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Đã xử lý
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={() => onDismiss(alert.id)}
              className="flex items-center justify-center gap-2 bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Báo động giả
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FallAlertCard;
