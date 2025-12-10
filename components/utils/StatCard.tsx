import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color?: string;
  cardClass?: string;
}

export default function StatCard({ icon, title, value, color = '#c1912e', cardClass }: StatCardProps) {
  return (
    <div className={` rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-6 ${cardClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className=" text-sm font-medium mb-2">{title}</p>
          <p className="text-3xl font-bold  ">{value}</p>
        </div>
        <div
          className=""
          style={{ color: color }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
