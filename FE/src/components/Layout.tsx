import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  ClipboardList,
  Home,
  Menu,
  Scan,
  UserCircle,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import React from 'react';
import { PageType } from '../types';

export interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  isConnected: boolean;
  activeAlerts: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

const navItems: { id: PageType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: <Home className="w-5 h-5" /> },
  { id: 'patients', label: 'Bệnh nhân', icon: <Users className="w-5 h-5" /> },
  { id: 'fall-detection', label: 'Phát hiện té ngã', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'face-recognition', label: 'Đăng ký khuôn mặt', icon: <UserCircle className="w-5 h-5" /> },
  { id: 'face-identify', label: 'Nhận diện khuôn mặt', icon: <Scan className="w-5 h-5" /> },
  { id: 'cameras', label: 'Camera', icon: <Camera className="w-5 h-5" /> },
  { id: 'alerts-history', label: 'Lịch sử cảnh báo', icon: <ClipboardList className="w-5 h-5" /> },
  // { id: 'settings', label: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
];

const Layout: React.FC<LayoutProps> = ({
  children,
  currentPage,
  onPageChange,
  isConnected,
  activeAlerts,
  soundEnabled = true,
  onToggleSound,
}) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-slate-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-slate-900 text-white transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-20'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-800">
          <div className="w-9 h-9 bg-slate-700 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="font-semibold text-base">Hospital Vision</h1>
              <p className="text-xs text-slate-400">AI Monitoring</p>
            </div>
          )}
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 items-center justify-center bg-slate-700 rounded-full text-slate-300 hover:bg-slate-600 hover:text-white"
        >
          <Menu className="w-3.5 h-3.5" />
        </button>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onPageChange(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                currentPage === item.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              {item.icon}
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
              {item.id === 'fall-detection' && activeAlerts > 0 && sidebarOpen && (
                <span className="ml-auto px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-md">
                  {activeAlerts}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Connection status */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className={`flex items-center gap-2 ${sidebarOpen ? '' : 'justify-center'}`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                {sidebarOpen && <span className="text-xs text-emerald-400">Đã kết nối</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-400" />
                {sidebarOpen && <span className="text-xs text-red-400">Mất kết nối</span>}
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-60' : 'lg:ml-20'
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="lg:hidden w-10" />
            
            <h2 className="text-base font-semibold text-slate-800">
              {navItems.find((item) => item.id === currentPage)?.label}
            </h2>

            <div className="flex items-center gap-3">
              {/* Sound toggle */}
              {onToggleSound && (
                <button
                  onClick={onToggleSound}
                  className={`p-2 rounded-lg transition-colors ${
                    soundEnabled
                      ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {/* Alert bell */}
              <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <Bell className="w-5 h-5" />
                {activeAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[10px] bg-red-500 text-white rounded-full">
                    {activeAlerts}
                  </span>
                )}
              </button>

              {/* User */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                  A
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-700">Admin</p>
                  <p className="text-xs text-slate-400">Quản trị viên</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
