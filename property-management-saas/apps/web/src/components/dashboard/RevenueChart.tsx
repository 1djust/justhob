'use client';

import * as React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  defs,
  linearGradient,
  stop
} from 'recharts';

interface RevenueChartProps {
  data: { name: string; revenue: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = React.useMemo(
    () => [...(data || [])].reverse(),
    [data]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{
          top: 10,
          right: 10,
          left: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#52525b" opacity={0.1} />
        <XAxis 
          dataKey="name" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }}
          dy={10}
        />
        <YAxis 
          tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }}
          dx={-10}
          width={60}
        />
        <Tooltip
          cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-2xl border border-white/20 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 shadow-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">
                    ₦{Number(payload[0].value).toLocaleString()}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Area 
          type="monotone" 
          dataKey="revenue" 
          stroke="#10b981" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorRevenue)" 
          animationDuration={1500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
