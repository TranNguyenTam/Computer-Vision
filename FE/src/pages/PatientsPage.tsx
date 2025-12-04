import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Loader2,
  MapPin,
  Phone,
  Search,
  User,
  UserCircle,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { benhNhanApi } from '../services/api';
import { BenhNhan } from '../types';

const PatientsPage: React.FC = () => {
  const [patients, setPatients] = useState<BenhNhan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BenhNhan[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<BenhNhan | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await benhNhanApi.getAll(page, pageSize);
      setPatients(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.totalItems);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      setSearching(true);
      const results = await benhNhanApi.search(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Không rõ';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const getGenderText = (gender?: number) => {
    if (gender === 1) return 'Nam';
    if (gender === 2) return 'Nữ';
    return 'Không rõ';
  };

  const displayPatients = searchResults || patients;

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <Search className="w-4 h-4 text-slate-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">Tìm kiếm bệnh nhân</h2>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Nhập tên, mã y tế, số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all bg-white text-sm"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all flex items-center gap-2 text-sm font-medium"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Tìm kiếm
          </button>
        </div>
        {searchResults && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="flex items-center justify-center w-7 h-7 bg-slate-800 text-white rounded-md font-medium text-sm">
              {searchResults.length}
            </span>
            <p className="text-sm text-slate-600">
              kết quả tìm thấy cho "<span className="font-medium text-slate-800">{searchQuery}</span>"
            </p>
            <button
              onClick={clearSearch}
              className="ml-auto text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Xóa
            </button>
          </div>
        )}
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Bệnh nhân
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Mã y tế
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Giới tính
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Năm sinh
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Điện thoại
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Địa chỉ
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayPatients.map((patient) => (
                  <tr 
                    key={patient.benhNhanId} 
                    className="bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center
                          ${patient.gioiTinh === 1 
                            ? 'bg-blue-50 text-blue-600' 
                            : patient.gioiTinh === 2 
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-slate-100 text-slate-500'
                          }
                        `}>
                          {patient.hinhAnhDaiDien ? (
                            <img
                              src={patient.hinhAnhDaiDien}
                              alt={patient.tenBenhNhan}
                              className="w-10 h-10 rounded-lg object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{patient.tenBenhNhan}</p>
                          <p className="text-xs text-slate-400 font-mono">#{patient.benhNhanId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-sm">
                        {patient.maYTe || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md
                        ${patient.gioiTinh === 1 
                          ? 'bg-blue-50 text-blue-700' 
                          : patient.gioiTinh === 2 
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }
                      `}>
                        {getGenderText(patient.gioiTinh)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {patient.namSinh || <span className="text-slate-400">N/A</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {patient.soDienThoai ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {patient.soDienThoai}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {patient.diaChiThuongTru ? (
                        <div className="flex items-start gap-1.5 max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-600 line-clamp-2" title={patient.diaChiThuongTru}>
                            {patient.diaChiThuongTru}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatient(patient);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!searchResults && (
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Tổng:</span>
                <span className="font-semibold text-slate-800">{totalItems.toLocaleString()}</span>
                <span className="text-slate-500">bệnh nhân</span>
              </div>
              <div className="h-4 w-px bg-slate-300"></div>
              <p className="text-sm text-slate-500">
                Hiển thị <span className="font-medium text-slate-700">{displayPatients.length}</span> bản ghi
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Đầu
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-md text-sm">
                <span className="font-medium">{page}</span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-300">{totalPages}</span>
              </div>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            {/* Header */}
            <div className="sticky top-0 px-6 py-4 flex items-center justify-between bg-slate-50 border-b border-slate-200 rounded-t-xl">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-slate-600" />
                Chi tiết bệnh nhân
              </h3>
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Patient Header */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className={`
                  w-16 h-16 rounded-xl flex items-center justify-center
                  ${selectedPatient.gioiTinh === 1 
                    ? 'bg-blue-50 text-blue-600' 
                    : selectedPatient.gioiTinh === 2 
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-slate-100 text-slate-500'
                  }
                `}>
                  <UserCircle className="w-10 h-10" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-slate-800">{selectedPatient.tenBenhNhan}</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-200 text-slate-700 font-mono text-sm">
                      {selectedPatient.maYTe || 'N/A'}
                    </span>
                    <span className={`
                      inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-md
                      ${selectedPatient.gioiTinh === 1 
                        ? 'bg-blue-50 text-blue-700' 
                        : selectedPatient.gioiTinh === 2 
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                      }
                    `}>
                      {getGenderText(selectedPatient.gioiTinh)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-2 text-slate-500 mb-1.5">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">ID Bệnh nhân</span>
                  </div>
                  <p className="font-semibold text-slate-800">{selectedPatient.benhNhanId}</p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-2 text-slate-500 mb-1.5">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Ngày sinh</span>
                  </div>
                  <p className="font-semibold text-slate-800">
                    {selectedPatient.ngaySinh ? formatDate(selectedPatient.ngaySinh) : `Năm ${selectedPatient.namSinh || 'không rõ'}`}
                  </p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-2 text-slate-500 mb-1.5">
                    <Phone className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Số điện thoại</span>
                  </div>
                  <p className="font-semibold text-slate-800">{selectedPatient.soDienThoai || <span className="text-slate-400 font-normal">Chưa cập nhật</span>}</p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-2 text-slate-500 mb-1.5">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">CMND/CCCD</span>
                  </div>
                  <p className="font-semibold text-slate-800">{selectedPatient.cmnd || <span className="text-slate-400 font-normal">Chưa cập nhật</span>}</p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-slate-200 md:col-span-2 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-2 text-slate-500 mb-1.5">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Địa chỉ thường trú</span>
                  </div>
                  <p className="font-medium text-slate-800">{selectedPatient.diaChiThuongTru || <span className="text-slate-400 font-normal">Chưa cập nhật</span>}</p>
                </div>

                {selectedPatient.tienSuBenh && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 md:col-span-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                      <span className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Tiền sử bệnh</span>
                    </div>
                    <p className="text-slate-800 font-medium">{selectedPatient.tienSuBenh}</p>
                  </div>
                )}

                {selectedPatient.tienSuDiUng && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200 md:col-span-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      <span className="text-xs text-red-700 font-semibold uppercase tracking-wide">Tiền sử dị ứng</span>
                    </div>
                    <p className="text-slate-800 font-medium">{selectedPatient.tienSuDiUng}</p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="mt-5 pt-5 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500">Ngày tạo:</span>
                    <span className="font-medium text-slate-700">{formatDate(selectedPatient.ngayTao)}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500">Cập nhật:</span>
                    <span className="font-medium text-slate-700">{formatDate(selectedPatient.ngayCapNhat)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
