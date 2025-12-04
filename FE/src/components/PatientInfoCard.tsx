import { format } from 'date-fns';
import {
    Calendar,
    Clock,
    MapPin,
    Phone,
    Stethoscope,
    User
} from 'lucide-react';
import React from 'react';
import { Patient } from '../types';

interface PatientInfoCardProps {
  patient: Patient;
}

const PatientInfoCard: React.FC<PatientInfoCardProps> = ({ patient }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          {patient.photoUrl ? (
            <img 
              src={patient.photoUrl} 
              alt={patient.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-blue-600" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{patient.name}</h2>
          <p className="text-gray-500">Mã BN: {patient.id}</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>{patient.age} tuổi</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <User className="w-4 h-4" />
          <span>{patient.gender}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 col-span-2">
          <Phone className="w-4 h-4" />
          <span>{patient.phone}</span>
        </div>
      </div>

      {/* Current Appointment */}
      {patient.currentAppointment && (
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Lịch khám hôm nay
          </h3>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-medium">{patient.currentAppointment.roomName}</span>
              <span className="text-gray-500">- Tầng {patient.currentAppointment.floor}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <span>{patient.currentAppointment.doctorName}</span>
              <span className="text-gray-500">({patient.currentAppointment.specialty})</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>
                {format(new Date(patient.currentAppointment.appointmentTime), 'HH:mm')}
              </span>
              <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-sm">
                STT: {patient.currentAppointment.queueNumber}
              </span>
            </div>
            
            <div className={`
              inline-block px-3 py-1 rounded-full text-sm font-medium mt-2
              ${patient.currentAppointment.status === 'InProgress' 
                ? 'bg-green-200 text-green-800' 
                : 'bg-yellow-200 text-yellow-800'}
            `}>
              {patient.currentAppointment.status === 'InProgress' ? 'Đang khám' : 'Chờ khám'}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      {patient.upcomingAppointments.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Lịch khám sắp tới</h3>
          <div className="space-y-2">
            {patient.upcomingAppointments.slice(0, 3).map((apt) => (
              <div 
                key={apt.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="font-medium">{apt.roomName}</span>
                  <span className="text-gray-500 ml-2">- {apt.doctorName}</span>
                </div>
                <span className="text-gray-600">
                  {format(new Date(apt.appointmentTime), 'HH:mm dd/MM')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientInfoCard;
