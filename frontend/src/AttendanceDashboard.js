import React, { useState, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import './AttendanceDashboard.css';

// Color palette inspired by Apple's design
const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
};

const AttendanceDashboard = () => {
  // State management
  const [timeRange, setTimeRange] = useState('week');
  const [riskThreshold, setRiskThreshold] = useState(30);
  const [processedData, setProcessedData] = useState(null);
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef();

  // Process CSV data into visualization-ready format
  const processData = useCallback((rawData) => {
    try {
      const lines = typeof rawData === 'string' ? 
        rawData.split('\n').filter(line => line.trim()) :
        rawData;

      // Data processing structures
      const dailyTotals = new Map();
      const memberVisits = new Map();
      const hourlyDistribution = new Array(24).fill(0);
      const dayOfWeekCounts = new Array(7).fill(0);
      const memberFrequency = new Map();

      // Process each attendance record
      lines.forEach(line => {
        const [date, memberId, checkInTime] = typeof line === 'string' ? 
          line.split(',') : [line.date, line.memberId, line.checkInTime];

        // Skip header row
        if (date === 'date') return;

        // Daily totals
        const dayKey = date;
        dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + 1);

        // Member visit tracking
        if (!memberVisits.has(memberId)) {
          memberVisits.set(memberId, []);
        }
        memberVisits.get(memberId).push(date);

        // Hourly distribution
        const hour = parseInt(checkInTime.split(':')[0]);
        hourlyDistribution[hour]++;

        // Day of week distribution
        const dayOfWeek = new Date(date).getDay();
        dayOfWeekCounts[dayOfWeek]++;

        // Member frequency
        memberFrequency.set(memberId, (memberFrequency.get(memberId) || 0) + 1);
      });

      // Prepare visualization data
      const visualizationData = {
        // 1. Daily Attendance Trend
        attendanceTrend: Array.from(dailyTotals.entries())
          .map(([date, count]) => ({ date, visits: count }))
          .sort((a, b) => new Date(a.date) - new Date(b.date)),

        // 2. Hourly Distribution
        hourlyPattern: hourlyDistribution.map((count, hour) => ({
          hour: `${hour}:00`,
          checkins: count
        })),

        // 3. Day of Week Analysis
        dayOfWeek: dayOfWeekCounts.map((count, day) => ({
          day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
          visits: count
        })),

        // 4. Member Frequency Distribution
        memberFrequencyDist: Array.from(memberFrequency.entries())
          .map(([memberId, visits]) => ({ memberId, visits }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 10),

        // 5. Member Retention Analysis
        retentionData: calculateRetentionData(memberVisits),

        // 6. Risk Analysis
        riskAnalysis: analyzeRisk(memberVisits, riskThreshold),

        // 7. Visit Duration Pattern
        visitDuration: calculateVisitDuration(memberVisits),

        // 8. Weekly vs Weekend Analysis
        weekdayWeekend: calculateWeekdayWeekendSplit(dayOfWeekCounts),

        // 9. Peak Hours Analysis
        peakHours: calculatePeakHours(hourlyDistribution),

        // 10. Member Engagement Score
        engagementScores: calculateEngagementScores(memberVisits, memberFrequency)
      };

      setProcessedData(visualizationData);
    } catch (error) {
      console.error('Error processing data:', error);
      alert('Error processing data. Please check the format and try again.');
    }
  }, [riskThreshold]);

  // Utility functions for data analysis
  const calculateRetentionData = (memberVisits) => {
    const totalMembers = memberVisits.size;
    const activeMembers = Array.from(memberVisits.entries())
      .filter(([, visits]) => {
        const lastVisit = new Date(visits[visits.length - 1]);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return lastVisit >= thirtyDaysAgo;
      }).length;

    return [
      { name: 'Active', value: activeMembers },
      { name: 'Inactive', value: totalMembers - activeMembers }
    ];
  };

  const analyzeRisk = (memberVisits, threshold) => {
    const riskLevels = { high: 0, medium: 0, low: 0 };
    memberVisits.forEach((visits) => {
      const daysSinceLastVisit = Math.floor(
        (new Date() - new Date(visits[visits.length - 1])) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastVisit > threshold * 2) riskLevels.high++;
      else if (daysSinceLastVisit > threshold) riskLevels.medium++;
      else riskLevels.low++;
    });
    return Object.entries(riskLevels).map(([level, count]) => ({
      level,
      count
    }));
  };

  const calculateVisitDuration = (memberVisits) => {
    // Simplified duration calculation based on visit frequency
    const durationBuckets = new Map();
    memberVisits.forEach((visits) => {
      const frequency = visits.length;
      const bucket = Math.floor(frequency / 5) * 5;
      durationBuckets.set(bucket, (durationBuckets.get(bucket) || 0) + 1);
    });
    return Array.from(durationBuckets.entries())
      .map(([bucket, count]) => ({
        range: `${bucket}-${bucket + 4} visits`,
        count
      }));
  };

  const calculateWeekdayWeekendSplit = (dayOfWeekCounts) => {
    const weekday = dayOfWeekCounts.slice(1, 6).reduce((a, b) => a + b, 0);
    const weekend = dayOfWeekCounts[0] + dayOfWeekCounts[6];
    return [
      { type: 'Weekday', visits: weekday },
      { type: 'Weekend', visits: weekend }
    ];
  };

  const calculatePeakHours = (hourlyDistribution) => {
    return hourlyDistribution.map((count, hour) => ({
      hour: hour,
      count: count,
      isPeak: count > (Math.max(...hourlyDistribution) * 0.8)
    }));
  };

  const calculateEngagementScores = (memberVisits, memberFrequency) => {
    return Array.from(memberFrequency.entries())
      .map(([memberId, frequency]) => {
        const visits = memberVisits.get(memberId);
        const recency = new Date() - new Date(visits[visits.length - 1]);
        const recencyScore = Math.max(0, 1 - recency / (30 * 24 * 60 * 60 * 1000));
        const frequencyScore = frequency / Math.max(...memberFrequency.values());
        return {
          memberId,
          score: (recencyScore + frequencyScore) / 2
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  // File upload handler
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => processData(e.target.result);
      reader.readAsText(file);
    }
  };

  // Manual input handler
  const handleManualInput = () => {
    if (inputText.trim()) {
      processData(inputText
);
}
};

return (
<div className="dashboard-container">
  {/* Upload Section */}
  <section className="upload-section">
    <h2>Import Attendance Data</h2>
    <p>Upload CSV file or paste data in format: date,memberId,checkInTime</p>
    <div className="upload-controls">
      <input
        type="file"
        ref={fileInputRef}
        className="file-input"
        accept=".csv"
        onChange={handleFileUpload}
      />
      <button 
        className="button-primary"
        onClick={() => fileInputRef.current.click()}
      >
        Upload CSV
      </button>
      <textarea
        className="text-area"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Or paste your data here..."
      />
      <button 
        className="button-primary"
        onClick={handleManualInput}
      >
        Process Data
      </button>
    </div>
  </section>

  {processedData && (
    <>
      {/* Dashboard Header */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">Attendance Analytics</h1>
        <div className="dashboard-controls">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="select-control"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
          </select>
          <select
            value={riskThreshold}
            onChange={(e) => setRiskThreshold(Number(e.target.value))}
            className="select-control"
          >
            <option value={20}>20 Day Risk</option>
            <option value={30}>30 Day Risk</option>
            <option value={40}>40 Day Risk</option>
          </select>
        </div>
      </header>

      {/* Chart Grid */}
      <div className="chart-grid">
        {/* 1. Daily Attendance Trend */}
        <div className="chart-card">
          <h3 className="chart-title">Daily Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processedData.attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${value} visits`, 'Attendance']}
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Line 
                type="monotone" 
                dataKey="visits" 
                stroke={COLORS.primary} 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Hourly Distribution */}
        <div className="chart-card">
          <h3 className="chart-title">Hourly Check-in Pattern</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData.hourlyPattern}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar 
                dataKey="checkins" 
                fill={COLORS.secondary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Day of Week Analysis */}
        <div className="chart-card">
          <h3 className="chart-title">Attendance by Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData.dayOfWeek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar 
                dataKey="visits" 
                fill={COLORS.success}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Top Members by Frequency */}
        <div className="chart-card">
          <h3 className="chart-title">Top 10 Most Frequent Visitors</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={processedData.memberFrequencyDist}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis 
                dataKey="memberId" 
                type="category" 
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Bar 
                dataKey="visits" 
                fill={COLORS.primary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 5. Member Retention */}
        <div className="chart-card">
          <h3 className="chart-title">Member Retention Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={processedData.retentionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell fill={COLORS.success} />
                <Cell fill={COLORS.danger} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 6. Risk Analysis */}
        <div className="chart-card">
          <h3 className="chart-title">Member Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={processedData.riskAnalysis}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="count"
                nameKey="level"
              >
                <Cell fill={COLORS.danger} />
                <Cell fill={COLORS.warning} />
                <Cell fill={COLORS.success} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 7. Visit Duration Pattern */}
        <div className="chart-card">
          <h3 className="chart-title">Visit Frequency Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData.visitDuration}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar 
                dataKey="count" 
                fill={COLORS.secondary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 8. Weekday vs Weekend */}
        <div className="chart-card">
          <h3 className="chart-title">Weekday vs Weekend Attendance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData.weekdayWeekend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar 
                dataKey="visits" 
                fill={COLORS.primary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 9. Peak Hours Analysis */}
        <div className="chart-card">
          <h3 className="chart-title">Peak Hours Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processedData.peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tick={{ fontSize: 12 }}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={(props) => {
                  const { isPeak, cx, cy } = props;
                  return isPeak ? (
                    <circle cx={cx} cy={cy} r={4} fill={COLORS.warning} />
                  ) : null;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 10. Member Engagement Scores */}
        <div className="chart-card">
          <h3 className="chart-title">Top 10 Member Engagement Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={processedData.engagementScores}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                tick={{ fontSize: 12 }}
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <YAxis 
                dataKey="memberId" 
                type="category" 
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Engagement Score']}
              />
              <Bar 
                dataKey="score" 
                fill={COLORS.success}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )}
</div>
);
};

export default AttendanceDashboard;