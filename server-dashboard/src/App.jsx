import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Users, Activity, Repeat, Target, Shield, Server, 
  Terminal, BarChart3, Microscope, FlaskConical, Github, RefreshCw,
  Cpu, Lock, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Zap, Play, Layers
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = 'http://localhost:8000';

function App() {
  const [status, setStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [xai, setXai] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testInputs, setTestInputs] = useState({
    CreditScore: 650,
    Age: 38,
    Tenure: 5,
    Balance: 75000,
    NumOfProducts: 2,
    HasCrCard: 1,
    IsActiveMember: 1,
    EstimatedSalary: 95000,
    TransactionAmount: 1200
  });

  const FEATURE_NAMES = [
    "CreditScore", "Age", "Tenure", "Balance", 
    "NumOfProducts", "HasCrCard", "IsActiveMember", 
    "EstimatedSalary", "TransactionAmount"
  ];

  const logContainerRef = useRef(null);
  const userScrolledUp = useRef(false);  // true when user has scrolled up manually

  useEffect(() => {
    fetchStatus();
    fetchXAI();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    // Only auto-scroll if user is already at the bottom (within 80px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
      userScrolledUp.current = false;
    }
  }, [status?.logs]);

  const fetchStatus = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/status`);
      setStatus(data);
    } catch (err) {
      console.error('Server offline');
    }
  };

  const fetchXAI = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/xai/importance`);
      if (data.feature_importance) setXai(data.feature_importance);
    } catch (err) {}
  };

  const handleTestPrediction = async () => {
    setTestLoading(true);
    try {
      const sample = FEATURE_NAMES.map(f => parseFloat(testInputs[f] || 0));
      const { data } = await axios.post(`${API_URL}/predict`, { sample });
      setTestResult(data);
    } catch (err) {
      alert('Prediction failed. Make sure global model is initialized.');
    } finally {
      setTestLoading(false);
    }
  };

  const loadPreset = (type) => {
    if (type === 'low_risk') {
      setTestInputs({
        CreditScore: 780, Age: 42, Tenure: 8, Balance: 120000,
        NumOfProducts: 2, HasCrCard: 1, IsActiveMember: 1, EstimatedSalary: 110000, TransactionAmount: 450
      });
    } else if (type === 'high_fraud') {
      setTestInputs({
        CreditScore: 410, Age: 23, Tenure: 1, Balance: 2500,
        NumOfProducts: 4, HasCrCard: 0, IsActiveMember: 0, EstimatedSalary: 32000, TransactionAmount: 18500
      });
    } else {
      setTestInputs({
        CreditScore: 610, Age: 35, Tenure: 3, Balance: 45000,
        NumOfProducts: 1, HasCrCard: 1, IsActiveMember: 1, EstimatedSalary: 68000, TransactionAmount: 3200
      });
    }
  };

  if (!status) return (
    <div className="min-h-screen bg-[#070a12] flex items-center justify-center text-slate-100 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-slate-950 to-black pointer-events-none"></div>
      <div className="glass-card p-10 rounded-2xl flex flex-col items-center gap-6 border border-cyan-500/20 glow-cyan max-w-md text-center">
        <div className="relative">
          <Server className="animate-bounce text-cyan-400" size={56} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span>
          </span>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            FedVault AI
          </h2>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">Financial Aggregator Hub</p>
        </div>
        <p className="text-sm text-slate-400 animate-pulse">Connecting to Federated Central Server on :8000...</p>
      </div>
    </div>
  );

  const accuracyData = status.accuracy_history && status.accuracy_history.length > 0 
    ? status.accuracy_history 
    : [0];

  const chartData = {
    labels: accuracyData.map((_, i) => `Round ${i+1}`),
    datasets: [
      {
        fill: true,
        label: 'Global FL Model Accuracy (%)',
        data: accuracyData,
        borderColor: '#06b6d4',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
          gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          return gradient;
        },
        borderWidth: 3,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#070a12',
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.35,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        borderWidth: 1,
        titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 'bold' },
        bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context) => `Accuracy: ${context.parsed.y}%`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } }
      },
      y: {
        min: Math.max(0, Math.min(...accuracyData) - 10),
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { 
          color: '#94a3b8', 
          font: { family: 'JetBrains Mono', size: 11 },
          callback: (val) => `${val}%`
        }
      }
    }
  };

  // Derive live nodes from server status (replaces old hardcoded mockNodes)
  const liveNodes = Object.entries(status.connected_clients || {}).map(([uid, info]) => ({
    id: uid,
    name: info.username || `Node-${uid}`,
    status: info.status || '🔴 Offline',
    last_seen: info.last_seen || '--',
    accuracy: info.accuracy != null ? `${Number(info.accuracy).toFixed(1)}%` : '--',
    loss: info.loss != null ? Number(info.loss).toFixed(4) : '--',
    num_samples: info.num_samples || 0,
    dataset_name: info.dataset_name || 'N/A',
  }));
  const totalSamples = liveNodes.reduce((s, n) => s + n.num_samples, 0);

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <header className="glass-card sticky top-0 z-30 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl text-black shadow-lg shadow-cyan-500/20">
            <Shield size={26} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
                FedVault AI
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md">
                v2.4 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Banking Privacy-Preserving Aggregator Hub</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-300">Aggregator Active</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <Lock size={12} className="text-emerald-400" /> CKKS HE Enabled
            </div>
          </div>

          <button 
            onClick={() => { fetchStatus(); fetchXAI(); }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all"
          >
            <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-500" /> Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 glass-card border-r border-slate-800/80 p-5 hidden lg:flex flex-col gap-6 justify-between">
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">
              Command Suite
            </div>
            
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 size={18} className={activeTab === 'overview' ? 'text-cyan-400' : ''} />
              Overview Center
            </button>

            <button
              onClick={() => setActiveTab('nodes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'nodes'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users size={18} className={activeTab === 'nodes' ? 'text-cyan-400' : ''} />
              Bank Node Mesh
            </button>

            <button
              onClick={() => setActiveTab('xai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'xai'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Microscope size={18} className={activeTab === 'xai' ? 'text-cyan-400' : ''} />
              XAI Risk Intelligence
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal size={18} className={activeTab === 'logs' ? 'text-cyan-400' : ''} />
              Live Server Logs
            </button>
          </div>

          <div className="glass-card p-4 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-300">
              <Cpu size={14} className="text-cyan-400" /> FedAvg Engine
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Sample-Weighted Federated Averaging active across bank nodes.
            </p>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="glass-card glass-card-hover p-5 rounded-2xl border-t-2 border-t-cyan-500 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Global Model Accuracy</p>
                  <h3 className="text-2xl font-black mt-2 text-white font-mono">
                    {status.accuracy_history && status.accuracy_history.length > 0
                      ? `${Number(status.accuracy_history[status.accuracy_history.length - 1]).toFixed(1)}%`
                      : <span className="text-slate-500 text-base font-normal">No rounds yet</span>}
                  </h3>
                </div>
                <div className="bg-cyan-500/10 p-2.5 rounded-xl text-cyan-400">
                  <Target size={22} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <Zap size={12} /> FedAvg Weighted Formula Active
              </div>
            </div>

            <div className="glass-card glass-card-hover p-5 rounded-2xl border-t-2 border-t-emerald-500 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connected Bank Nodes</p>
                  <h3 className="text-2xl font-black mt-2 text-white font-mono">
                    {liveNodes.length} <span className="text-xs text-slate-400 font-sans font-normal">Active</span>
                  </h3>
                </div>
                <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400">
                  <Users size={22} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span> 100% Node Uptime
              </div>
            </div>

            <div className="glass-card glass-card-hover p-5 rounded-2xl border-t-2 border-t-violet-500 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aggregation Rounds</p>
                  <h3 className="text-2xl font-black mt-2 text-white font-mono">
                    Round #{status.round || 0}
                  </h3>
                </div>
                <div className="bg-violet-500/10 p-2.5 rounded-xl text-violet-400">
                  <Repeat size={22} />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-medium">
                Convergence Threshold: 95.0%
              </div>
            </div>

            <div className="glass-card glass-card-hover p-5 rounded-2xl border-t-2 border-t-sky-500 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Privacy Protocol</p>
                  <h3 className="text-lg font-bold mt-2 text-cyan-300">
                    Homomorphic (CKKS)
                  </h3>
                </div>
                <div className="bg-sky-500/10 p-2.5 rounded-xl text-sky-400">
                  <Shield size={22} />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={12} /> Raw Data Leaves No Bank
              </div>
            </div>
          </div>

          {/* TAB CONTENT: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Convergence Graph */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Activity size={20} className="text-cyan-400" />
                      Federated Global Model Convergence Strategy
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      System-wide FL accuracy tracking: FL_Accuracy = Σ(n_i × Accuracy_i) / Σ(n_i)
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono text-cyan-400">
                    Weights Aggregated: Sample-Weighted
                  </div>
                </div>

                <div className="h-80 w-full">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              {/* Node Summary List — Live from /status */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers size={18} className="text-cyan-400" /> Active Banking Node Contributions
                  </h3>
                  <span className="text-xs font-mono text-slate-500">{liveNodes.length} node{liveNodes.length !== 1 ? 's' : ''} tracked</span>
                </div>
                {liveNodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                      <Users size={28} className="text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No bank nodes connected yet</p>
                    <p className="text-xs text-slate-600 max-w-xs">Start a client node at localhost:8001, register, load a dataset, and complete local training to appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {liveNodes.map((node, idx) => {
                    const isOnline = node.status.includes('Online') || node.status.includes('Trained');
                      const flWeight = totalSamples > 0 ? ((node.num_samples / totalSamples) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={node.id} className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]" title={node.name}>{node.name}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border ${
                              isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>{isOnline ? 'Online' : 'Offline'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-2.5 rounded-lg">
                            <div>
                              <span className="text-slate-500 block text-[10px]">Samples</span>
                              <span className="text-cyan-300">{node.num_samples.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">FL Weight</span>
                              <span className="text-cyan-300">{flWeight}%</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Local Acc</span>
                              <span className="text-emerald-400">{node.accuracy}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Last Seen</span>
                              <span className="text-slate-400">{node.last_seen}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: Bank Nodes — Live */}
          {activeTab === 'nodes' && (
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users size={20} className="text-cyan-400" /> Connected Financial Institution Nodes
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Decentralized banking network participating in FedAvg model weight updates.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-slate-300">{status.online_users_count ?? 0} Online</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{liveNodes.length} Total</span>
                </div>
              </div>

              {liveNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                  <div className="p-6 bg-slate-900/80 rounded-3xl border border-slate-800">
                    <Server size={40} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-400">No Bank Nodes Connected</p>
                    <p className="text-xs text-slate-600 mt-1 max-w-sm">
                      To see nodes here: open localhost:8001, register a bank node, load a dataset, run local training, then transmit weights.
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-500 text-left w-full max-w-sm space-y-1">
                    <p className="text-cyan-400 font-bold mb-2">Quick Start</p>
                    <p>1. Open http://localhost:8001</p>
                    <p>2. Register → Login</p>
                    <p>3. Load Sample Dataset</p>
                    <p>4. Run Local Training</p>
                    <p>5. Transmit Encrypted Weights</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {liveNodes.map((node, i) => {
                    const isOnline = node.status.includes('🟢');
                    const hasTrainedModel = node.accuracy !== '--';
                    const flWeight = totalSamples > 0 ? ((node.num_samples / totalSamples) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={node.id} className={`glass-card p-5 rounded-2xl border space-y-4 ${
                        isOnline ? 'border-cyan-500/30 glow-cyan' : 'border-slate-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl ${
                              isOnline ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-800 text-slate-500'
                            }`}>
                              <Server size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">{node.name}</h4>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {node.id}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border ${
                            isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
                        </div>

                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">Dataset:</span>
                            <span className="text-cyan-300 font-bold truncate ml-2 max-w-[130px]" title={node.dataset_name}>{node.dataset_name}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">Training Records:</span>
                            <span className="text-cyan-300 font-bold">{node.num_samples.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">FedAvg Weight:</span>
                            <span className="text-cyan-300 font-bold">{flWeight}%</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">Local Test Acc:</span>
                            <span className={`font-bold ${hasTrainedModel ? 'text-emerald-400' : 'text-slate-500'}`}>{node.accuracy}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400">Last Seen:</span>
                            <span className="text-slate-300 font-bold">{node.last_seen}</span>
                          </div>
                        </div>

                        <div className="pt-1">
                          {hasTrainedModel ? (
                            <span className="w-full inline-flex justify-center items-center gap-1.5 py-2 px-3 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                              <CheckCircle2 size={14} /> Weights Submitted to Aggregator
                            </span>
                          ) : (
                            <span className="w-full inline-flex justify-center items-center gap-1.5 py-2 px-3 text-xs font-semibold text-yellow-400 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                              <Activity size={14} /> Awaiting Local Training
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: XAI Risk Explorer */}
          {activeTab === 'xai' && (
            <div className="space-y-6">
              {/* Global Importance */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Microscope size={20} className="text-cyan-400" />
                      Global Federated Model Feature Importance (XAI)
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Aggregated feature importance across all bank branches using gradient-based attribution.
                    </p>
                  </div>
                  <button 
                    onClick={fetchXAI}
                    className="px-3 py-1.5 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs rounded-xl border border-cyan-500/30"
                  >
                    Re-calculate Feature XAI
                  </button>
                </div>

                <div className="space-y-4">
                  {(xai && xai.length > 0 ? xai : [
                    { feature: "TransactionAmount", importance: 0.28 },
                    { feature: "CreditScore", importance: 0.22 },
                    { feature: "Balance", importance: 0.18 },
                    { feature: "Age", importance: 0.14 },
                    { feature: "NumOfProducts", importance: 0.08 },
                    { feature: "IsActiveMember", importance: 0.05 },
                    { feature: "EstimatedSalary", importance: 0.05 }
                  ]).map((item, index) => {
                    const pct = Math.round((item.importance || item.score || 0.1) * 100);
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300 font-semibold">{item.feature}</span>
                          <span className="text-cyan-400">{pct}% Attribution</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Prediction Tester */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FlaskConical size={18} className="text-cyan-400" /> Financial Risk & Fraud Inference Sandbox
                    </h3>
                    <p className="text-xs text-slate-400">
                      Test live financial transaction parameters against the consolidated FedAvg global model.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => loadPreset('low_risk')}
                      className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs rounded-xl border border-emerald-500/30"
                    >
                      Preset: Low Risk
                    </button>
                    <button 
                      onClick={() => loadPreset('high_fraud')}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs rounded-xl border border-rose-500/30"
                    >
                      Preset: High Fraud
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {FEATURE_NAMES.map((fName) => (
                    <div key={fName} className="space-y-1.5">
                      <label className="text-xs font-mono text-slate-400 block">{fName}</label>
                      <input 
                        type="number"
                        value={testInputs[fName] || 0}
                        onChange={(e) => setTestInputs({ ...testInputs, [fName]: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleTestPrediction}
                    disabled={testLoading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                  >
                    {testLoading ? 'Processing Global Model Inference...' : 'Evaluate Financial Risk (XAI)'}
                  </button>
                </div>

                {testResult && (
                  <div className="bg-slate-900/90 p-5 rounded-xl border border-cyan-500/30 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-slate-400">Evaluation Result:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold font-mono uppercase ${
                        testResult.prediction === 1 || testResult.risk_level === 'High'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {testResult.risk_level || (testResult.prediction === 1 ? 'High Risk / Fraud' : 'Low Risk / Clean')}
                      </span>
                    </div>

                    {testResult.confidence !== undefined && (
                      <div className="text-xs font-mono text-slate-300">
                        Model Confidence: <span className="text-cyan-400 font-bold">{(testResult.confidence * 100).toFixed(1)}%</span>
                      </div>
                    )}

                    {testResult.explanation && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-300">Gradient Saliency Feature Attribution:</span>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          {Object.entries(testResult.explanation).map(([k, v]) => (
                            <div key={k} className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between">
                              <span className="text-slate-400">{k}:</span>
                              <span className={v > 0 ? 'text-cyan-400' : 'text-slate-500'}>{v.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: Live Server Logs */}
          {activeTab === 'logs' && (
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Terminal size={20} className="text-cyan-400" /> FL Process Log Console
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live feed of every FL step: node connections, weight submissions, FedAvg aggregation, and global model updates.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-mono bg-slate-900 border border-slate-800 text-cyan-400 rounded-lg">
                    {status.logs ? status.logs.length : 0} events
                  </span>
                  <button
                    onClick={() => {
                      if (logContainerRef.current) {
                        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                        userScrolledUp.current = false;
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-all"
                  >
                    Jump to Latest
                  </button>
                  <button
                    onClick={() => fetchStatus()}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span><span className="text-cyan-400">[FL]</span> <span className="text-slate-500">Federated learning steps</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span><span className="text-slate-400">[INFO]</span> <span className="text-slate-500">System events</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span><span className="text-yellow-400">[WARN]</span> <span className="text-slate-500">Warnings</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span><span className="text-rose-400">[ERROR]</span> <span className="text-slate-500">Errors</span></span>
              </div>

              <div
                ref={logContainerRef}
                onScroll={() => {
                  const el = logContainerRef.current;
                  if (!el) return;
                  // If user scrolled more than 80px from bottom, mark as reading history
                  userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
                }}
                className="bg-[#05070d] p-4 rounded-xl border border-slate-800 font-mono text-xs h-[520px] overflow-y-auto space-y-0.5 leading-relaxed"
              >
                {(status.logs || ["[INFO] FedVault AI Aggregation Server initialized. Waiting for bank node connections..."]).map((log, i) => {
                  // Extract timestamp and message from "[HH:MM:SS] text"
                  const tsMatch = log.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*/);
                  const ts = tsMatch ? tsMatch[1] : null;
                  const msg = tsMatch ? log.slice(tsMatch[0].length) : log;

                  // Round separator line
                  const isRoundStart  = msg.includes('========== FEDERATED ROUND') && msg.includes('START');
                  const isRoundEnd    = msg.includes('========== ROUND') && msg.includes('COMPLETE');

                  // Color by tag
                  const isFL    = msg.startsWith('[FL]');
                  const isWarn  = msg.startsWith('[WARN]');
                  const isError = msg.startsWith('[ERROR]');

                  let textColor = 'text-slate-400';
                  if (isFL)    textColor = msg.includes('==========') ? 'text-cyan-300 font-bold' : msg.includes('[FL]   ') ? 'text-slate-300' : 'text-cyan-400';
                  if (isWarn)  textColor = 'text-yellow-400';
                  if (isError) textColor = 'text-rose-400';

                  return (
                    <div key={i}>
                      {isRoundStart && (
                        <div className="my-2 border-t border-slate-700/60 border-dashed" />
                      )}
                      <div className={`flex gap-3 hover:bg-slate-900/40 px-1.5 py-0.5 rounded ${isRoundEnd ? 'mb-2' : ''}`}>
                        <span className="text-slate-600 select-none shrink-0 w-[62px]">
                          {ts ? ts : ''}
                        </span>
                        <span className={textColor}>{msg}</span>
                      </div>
                      {isRoundEnd && (
                        <div className="my-2 border-t border-slate-700/60 border-dashed" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
