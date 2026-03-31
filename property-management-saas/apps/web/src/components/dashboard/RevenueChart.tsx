'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface RevenueChartProps {
  data: { name: string; revenue: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Ensure the chart looks good even if there's no data yet
  const hasData = data && data.some(d => d.revenue > 0);
  const displayData = hasData ? data : data?.map(d => ({ ...d, revenue: Math.random() * 1000 })); // dummy data if empty so the chart renders something visible for the demo, or we can just leave it empty.
  
  // Actually, let's just use the real data. If it's all 0, it renders an empty chart which is accurate.
  const chartData = [...(data || [])].reverse(); // API returns descending order, chart needs ascending

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#52525b" opacity={0.2} />
        <XAxis 
          dataKey="name" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#71717a', fontSize: 12 }}
          dy={10}
        />
        <YAxis 
          tickFormatter={(value) => `₦${value}`}
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#71717a', fontSize: 12 }}
          dx={-10}
        />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          contentStyle={{ 
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
          }}
          labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold', marginBottom: '4px' }}
          itemStyle={{ color: '#18181b', fontWeight: '500' }}
          formatter={(value: any) => [`₦${Number(value).toLocaleString()}`, 'Revenue']}
        />
        <Bar 
          dataKey="revenue" 
          fill="#000000" 
          radius={[4, 4, 0, 0]} 
          className="dark:fill-white" 
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
