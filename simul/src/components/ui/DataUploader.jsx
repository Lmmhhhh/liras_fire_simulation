// src/components/ui/DataUploader.jsx
import React from 'react';
import { UploadCloud, Map, Droplets, TreePine, Cloud } from 'lucide-react';

export default function DataUploader({
  onDemUpload,
  onFuelUpload,
  onMoistureUpload,
  onCanopyUpload,
  onWeatherUpload,
  filenames = {}   // filenames가 없으면 빈 객체로 처리
}) {
  const items = [
    {
      Icon: Map,
      label: 'DEM (.asc)',
      onChange: onDemUpload,
      accept: '.asc',
      name: filenames.dem
    },
    {
      Icon: TreePine,
      label: 'Fuel Model (.asc)',
      onChange: onFuelUpload,
      accept: '.asc',
      name: filenames.fuel
    },
    {
      Icon: Droplets,
      label: 'Fuel Moisture (.txt)',
      onChange: onMoistureUpload,
      accept: '.asc,.txt',
      name: filenames.moisture
    },
    {
      Icon: UploadCloud,
      label: 'Canopy Cover (.txt)',
      onChange: onCanopyUpload,
      accept: '.asc,.txt',
      name: filenames.canopy
    },
    {
      Icon: Cloud,
      label: 'Weather Data (.csv)',
      onChange: onWeatherUpload,
      accept: '.csv',
      name: filenames.weather
    }
  ];

  return (
    <div className="bg-purple-50 p-4 rounded-xl shadow-md">
      <h2 className="flex items-center gap-2 text-purple-700 font-bold mb-4">
        <UploadCloud className="w-6 h-6" /> 데이터 업로드
      </h2>
      <ul className="space-y-3">
        {items.map(({ Icon, label, onChange, accept, name }) => (
          <li key={label} className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-purple-400" />
            <label className="flex-1 flex items-center justify-between bg-white rounded-md px-3 py-2 hover:bg-purple-100 cursor-pointer shadow-inner">
              <span>{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {name || '선택된 파일 없음'}
                </span>
                <input
                  type="file"
                  accept={accept}
                  onChange={onChange}
                  className="sr-only"
                />
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}