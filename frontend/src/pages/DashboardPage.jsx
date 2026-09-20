import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../utils/formatters';
import api from '../services/api';
import {
  TrendingUp,
  CreditCard,
  Package,
  AlertTriangle,
  Calendar,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  ShoppingBag,
  Bot
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Link } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [period, setPeriod] = useState('7days');
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, chartRes, fcRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get(`/dashboard/chart?period=${period}`),
        api.get('/ai/forecast')
      ]);
      setSummary(sumRes.data);
      setChartData(chartRes.data);
      setForecast(fcRes.data?.currentForecast || null);
    } catch (err) {
      console.error('Fetch dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Chart configuration
  const lineChartConfig = {
    labels: chartData?.dailyTrend?.map((d) => d.display_date) || [],
    datasets: [
      {
        label: 'Doanh thu (đ)',
        data: chartData?.dailyTrend?.map((d) => parseFloat(d.total_revenue)) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#10b981',
        pointRadius: 4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { size: 12 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value) => {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
            return value;
          }
        }
      }
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px' }}>Bảng Điều Khiển Kinh Doanh</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              Dữ liệu doanh thu & hoạt động cửa hàng theo thời gian thực (Asia/Ho_Chi_Minh)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link to="/ai-assistant" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
              <Bot size={16} />
              <span>Hỏi Trợ Lý AI</span>
            </Link>
            <button
              onClick={fetchDashboardData}
              className="btn btn-secondary btn-icon"
              title="Làm mới dữ liệu"
              style={{ width: '38px', height: '38px' }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Today's Revenue */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Doanh Thu Hôm Nay</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
            {formatCurrency(summary?.todayRevenue)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Hôm qua: {formatCurrency(summary?.yesterdayRevenue)}
          </div>
        </div>

        {/* This Month's Revenue */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Doanh Thu Tháng Này</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--info-bg)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatCurrency(summary?.thisMonthRevenue)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Tổng đơn tháng: {summary?.thisMonthInvoicesCount || 0} đơn
          </div>
        </div>

        {/* Invoices & Units Sold Today */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Đơn Hàng Hôm Nay</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {summary?.todayInvoicesCount || 0} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>đơn</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Đã bán: {summary?.todaySoldUnits || 0} sản phẩm
          </div>
        </div>

        {/* Inventory Value & Alerts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tồn Kho Cảnh Báo</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: summary?.lowStockCount > 0 ? 'var(--warning-bg)' : 'rgba(255,255,255,0.06)', color: summary?.lowStockCount > 0 ? 'var(--warning)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: summary?.lowStockCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {summary?.lowStockCount || 0} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>mặt hàng sắp hết</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Giá trị kho: {formatCurrency(summary?.inventoryCostValue)}
          </div>
        </div>
      </div>

      {/* AI Revenue Forecasting Card */}
      {forecast && (
        <div className="card" style={{
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
          borderColor: 'var(--primary-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '16px' }}>AI Dự Báo Doanh Thu Tháng {forecast.forecast_month}</h3>
                  <span className="badge badge-success">Mô hình ML Độc Lập</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Phân tích chuỗi thời gian (Trend & Seasonality) dựa trên dữ liệu hóa đơn lịch sử thực tế
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dự kiến đạt được:</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)' }}>
                {formatCurrency(forecast.predicted_revenue)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Khoảng 95%: {formatCurrency(forecast.lower_bound)} - {formatCurrency(forecast.upper_bound)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Trend Chart & Period Selector */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px' }}>Biểu Đồ Doanh Thu</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Xu hướng doanh số theo từng ngày</p>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'today', label: 'Hôm nay' },
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

        <div style={{ height: '280px', width: '100%' }}>
          {chartData?.dailyTrend && chartData.dailyTrend.length > 0 ? (
            <Line data={lineChartConfig} options={chartOptions} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu bán hàng trong khoảng thời gian này.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Top Selling Products & Low Stock Items */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Top Selling Products */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px' }}>Top Sản Phẩm Bán Chạy (Tháng Này)</h3>
            <Link to="/analytics" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Xem thêm →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {summary?.topSellingProducts && summary.topSellingProducts.length > 0 ? (
              summary.topSellingProducts.map((p, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-card-secondary)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: idx === 0 ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                      color: idx === 0 ? '#000' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.product_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.product_code}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{p.total_sold_units} {p.unit || 'cái'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatCurrency(p.total_sales_amount)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Chưa có đơn hàng nào trong tháng.
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Preview Alert */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px' }}>Hàng Sắp Hết (Cần Nhập)</h3>
              {summary?.lowStockCount > 0 && (
                <span className="badge badge-warning">{summary.lowStockCount}</span>
              )}
            </div>
            <Link to="/inventory" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Quản lý kho →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {summary?.lowStockItems && summary.lowStockItems.length > 0 ? (
              summary.lowStockItems.map((item) => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-card-secondary)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '3px solid var(--warning)'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mã: {item.product_code}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)' }}>
                      Còn: {item.stock_quantity} {item.unit}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tối thiểu: {item.minimum_stock}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Tất cả sản phẩm đều đủ tồn kho an toàn.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
