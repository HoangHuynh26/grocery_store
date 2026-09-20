import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../utils/formatters';
import api from '../services/api';
import {
  TrendingUp,
  PieChart,
  Calendar,
  CreditCard,
  RefreshCw,
  Award
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30days');
  const [chartData, setChartData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, chartRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get(`/dashboard/chart?period=${period}`)
      ]);
      setSummary(sumRes.data);
      setChartData(chartRes.data);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Payment Breakdown Chart
  const paymentDoughnutData = {
    labels: chartData?.paymentBreakdown?.map(p => p.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản') || [],
    datasets: [{
      data: chartData?.paymentBreakdown?.map(p => parseFloat(p.total_amount)) || [],
      backgroundColor: ['#10b981', '#3b82f6'],
      borderColor: '#131b2e',
      borderWidth: 2
    }]
  };

  // Category Breakdown Chart
  const categoryBarData = {
    labels: chartData?.categoryBreakdown?.map(c => c.category_name) || [],
    datasets: [{
      label: 'Doanh thu (đ)',
      data: chartData?.categoryBreakdown?.map(c => parseFloat(c.total_revenue)) || [],
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
      borderRadius: 6
    }]
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px' }}>Thống Kê Doanh Thu & Bán Hàng</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Phân tích tỷ trọng doanh số, phương thức thanh toán và nhóm ngành hàng
          </p>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: '7days', label: '7 ngày' },
            { id: '30days', label: '30 ngày' },
            { id: 'this_month', label: 'Tháng này' },
            { id: 'this_year', label: 'Năm nay' }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Selling Highlight Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* Payment Doughnut */}
        <div className="card">
          <h3 style={{ fontSize: '15px', marginBottom: '14px' }}>Tỷ Trọng Phương Thức Thanh Toán</h3>
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {chartData?.paymentBreakdown && chartData.paymentBreakdown.length > 0 ? (
              <Doughnut
                data={paymentDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
                }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Chưa có số liệu</div>
            )}
          </div>
        </div>

        {/* Category Revenue Bar Chart */}
        <div className="card">
          <h3 style={{ fontSize: '15px', marginBottom: '14px' }}>Doanh Thu Theo Nhóm Hàng</h3>
          <div style={{ height: '220px' }}>
            {chartData?.categoryBreakdown && chartData.categoryBreakdown.length > 0 ? (
              <Bar
                data={categoryBarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: '#94a3b8', font: { size: 11 } } },
                    y: {
                      ticks: {
                        color: '#94a3b8',
                        callback: (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v
                      }
                    }
                  }
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                Chưa có dữ liệu
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Table of Top Products */}
      <div className="card">
        <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Chi Tiết Sản Phẩm Bán Chạy (Tháng Này)</h3>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Tên Sản Phẩm</th>
                <th>Mã Hàng</th>
                <th>Số Lượng Bán Ra</th>
                <th style={{ textAlign: 'right' }}>Tổng Doanh Số</th>
              </tr>
            </thead>
            <tbody>
              {summary?.topSellingProducts?.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 800, color: idx < 3 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    #{idx + 1}
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{item.product_code}</td>
                  <td>
                    <strong>{item.total_sold_units}</strong> {item.unit || 'cái'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                    {formatCurrency(item.total_sales_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
