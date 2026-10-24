import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Users, Activity, Repeat, Target, Shield, Server, 
  Terminal, BarChart3, Microscope, FlaskConical, RefreshCw,
  Cpu, Lock, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Zap, Play, Layers,
  Award, ShieldCheck, Database, Key, Building2
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

const API_URL = typeof window !== 'undefined' && window.location.origin && window.location.origin.includes('http')
  ? window.location.origin
  : 'http://localhost:8000';

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
  const userScrolledUp = useRef(false);

  useEffect(() => {
    fetchStatus();
    fetchXAI();
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el && !userScrolledUp.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [status?.logs]);

  const fetchStatus = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/status`);
      setStatus(data);
    } catch (err) {
      console.error("Aggregation Server offline");
    }
  };

  const fetchXAI = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/xai/importance`);
      if (data && data.feature_importance) setXai(data.feature_importance);
    } catch (err) {}
  };

  const handleTestPrediction = async () => {
    setTestLoading(true);
    try {
      const sample = FEATURE_NAMES.map(f => parseFloat(testInputs[f] || 0));
      const { data } = await axios.post(`${API_URL}/predict`, { sample });
      setTestResult(data);
    } catch (err) {
      alert('Prediction failed. Make sure global model is initialized after Round 1.');
    } finally {
      setTestLoading(false);
    }
  };

  const [aggregating, setAggregating] = useState(false);

  const handleAggregateNow = async () => {
    setAggregating(true);
    try {
      await axios.post(`${API_URL}/admin/aggregate-now`);
      await fetchStatus();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to trigger aggregation. Ensure client updates are buffered.');
    } finally {
      setAggregating(false);
    }
  };

  const handleSetMinClients = async (val) => {
    try {
      await axios.post(`${API_URL}/admin/set-min-clients`, { min_clients: val });
      await fetchStatus();
    } catch (err) {
      console.error(err);
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
    <div className="min-h-screen bg-[#05070d] flex items-center justify-center text-slate-100 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-950/20 via-[#05070d] to-black pointer-events-none"></div>
      <div className="bento-card-gold p-10 rounded-3xl flex flex-col items-center gap-6 max-w-md text-center relative z-10">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20">
            <ShieldCheck size={36} strokeWidth={2.5} />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight gold-gradient-text">
            FedVault AI
          </h2>
          <p className="text-xs text-amber-300/80 mt-1 uppercase tracking-widest font-mono">Central Aggregation Server</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-4 py-2 rounded-xl border border-amber-500/20">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          Connecting to Aggregator Hub on port 8000...
        </div>
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
        label: 'Global Federated Accuracy (%)',
        data: accuracyData,
        borderColor: '#eab308',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 320);
          gradient.addColorStop(0, 'rgba(234, 179, 8, 0.28)');
          gradient.addColorStop(0.6, 'rgba(16, 185, 129, 0.08)');
          gradient.addColorStop(1, 'rgba(5, 7, 13, 0.0)');
          return gradient;
        },
        borderWidth: 2.5,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#05070d',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.38,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a0e1a',
        borderColor: 'rgba(212, 175, 55, 0.4)',
        borderWidth: 1,
        titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 'bold' },
        bodyFont: { family: 'JetBrains Mono', size: 12 },
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context) => `Global FL Accuracy: ${context.parsed.y}%`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } }
      },
      y: {
        min: Math.max(0, Math.min(...accuracyData) - 10),
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { 
          color: '#94a3b8', 
          font: { family: 'JetBrains Mono', size: 11 },
          callback: (val) => `${val}%`
        }
      }
    }
  };

  const liveNodes = Object.entries(status.connected_clients || {}).map(([uid, info]) => {
    const isOnline = info.is_online !== undefined
      ? Boolean(info.is_online)
      : (info.status && !info.status.toLowerCase().includes('offline'));
    return {
      id: uid,
      name: info.username || `Node-${uid}`,
      status: info.status || (isOnline ? 'Online' : 'Offline'),
      is_online: isOnline,
      last_seen: info.last_seen || '--',
      accuracy: info.accuracy != null ? `${Number(info.accuracy).toFixed(1)}%` : '--',
      loss: info.loss != null ? Number(info.loss).toFixed(4) : '--',
      num_samples: info.num_samples || 0,
      dataset_name: info.dataset_name || 'N/A',
    };
  });
  const totalSamples = liveNodes.reduce((s, n) => s + n.num_samples, 0);

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/15 via-[#05070d] to-black pointer-events-none"></div>

      {/* Top Sovereign Navbar */}
      <header className="bento-card sticky top-0 z-30 mx-4 mt-3 px-6 py-3.5 flex items-center justify-between border-b border-amber-500/20">
        <div className="flex items-center gap-4">
          <div className="relative bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-2.5 rounded-2xl text-slate-950 shadow-lg shadow-amber-500/20">
            <ShieldCheck size={26} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight gold-gradient-text">
                FedVault AI
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/25 rounded-md">
                Sovereign Core
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                Basel III/IV Compliant
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Decentralized Banking Privacy Aggregator</p>
          </div>
        </div>

        {/* Global Badges & Refresh */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-200">Mesh Active</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono">
              <Lock size={12} className="text-amber-400" /> CKKS HE Active
            </div>
          </div>

          <button 
            onClick={() => { fetchStatus(); fetchXAI(); }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all shadow-sm shadow-amber-500/10"
          >
            <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-500" /> Sync Mesh
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden px-4 py-4 gap-4 relative z-10">
        {/* Navigation Sidebar */}
        <aside className="w-64 bento-card p-5 hidden lg:flex flex-col gap-6 justify-between shrink-0">
          <div className="space-y-1.5">
            <div className="px-3 text-[11px] font-bold text-amber-400/80 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Sparkles size={13} /> Aggregator Terminal
            </div>
            
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <BarChart3 size={17} className={activeTab === 'overview' ? 'text-amber-400' : ''} />
              Overview Matrix
            </button>

            <button
              onClick={() => setActiveTab('nodes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'nodes'
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Building2 size={17} className={activeTab === 'nodes' ? 'text-amber-400' : ''} />
              Bank Node Mesh
            </button>

            <button
              onClick={() => setActiveTab('xai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'xai'
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Microscope size={17} className={activeTab === 'xai' ? 'text-amber-400' : ''} />
              Global XAI Intelligence
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'logs'
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Terminal size={17} className={activeTab === 'logs' ? 'text-amber-400' : ''} />
              Audit Trail Logs
            </button>
          </div>

          <div className="bento-card-gold p-4 rounded-2xl text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Cpu size={15} /> FedAvg Aggregator
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Consolidating weights strictly weighted by client transaction volume: <code className="text-amber-200 font-mono">w = Σ(n_k × W_k)/N</code>
            </p>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Top Bento Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bento Card 1: Accuracy */}
            <div className="bento-card-emerald p-5 rounded-2xl relative overflow-hidden glass-card-hover">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider font-mono">Global FL Accuracy</p>
                  <h3 className="text-2xl font-black mt-2 text-white font-mono">
                    {status.accuracy_history && status.accuracy_history.length > 0
                      ? `${Number(status.accuracy_history[status.accuracy_history.length - 1]).toFixed(1)}%`
                      : <span className="text-slate-500 text-sm font-normal">Awaiting Round 1</span>}
                  </h3>
                </div>
                <div className="bg-emerald-500/15 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Target size={20} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                <Award size={13} /> Sample-Weighted Standard
              </div>
            </div>

            {/* Bento Card 2: Connected Nodes */}
            <div className="bento-card p-5 rounded-2xl border-amber-500/20 relative overflow-hidden glass-card-hover">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-amber-400/80 uppercase tracking-wider font-mono">Active Bank Mesh</p>
                  <h3 className="text-2xl font-black mt-2 text-white font-mono">
                    {liveNodes.length} <span className="text-xs text-slate-400 font-sans font-normal">Institution{liveNodes.length !== 1 ? 's' : ''}</span>
                  </h3>
                </div>
                <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-400 border border-amber-500/20">
                  <Users size={20} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>{totalSamples.toLocaleString()} Private Records Shielded</span>
              </div>
            </div>

            {/* Bento Card 3: Round Counter */}
            <div className="bento-card-gold p-5 rounded-2xl relative overflow-hidden glass-card-hover">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider font-mono">Consensus Rounds</p>
                  <h3 className="text-2xl font-black mt-2 text-white font-mono">
                    Round #{status.round || 0}
                  </h3>
                </div>
                <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-300 border border-amber-500/30">
                  <Repeat size={20} />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-amber-200/80 font-medium font-mono">
                Convergence Target: 95.0%
              </div>
            </div>

            {/* Bento Card 4: Cryptographic Guarantee */}
            <div className="bento-card p-5 rounded-2xl border-slate-800 relative overflow-hidden glass-card-hover">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Privacy Architecture</p>
                  <h3 className="text-base font-extrabold mt-2 text-amber-300 font-mono">
                    TenSEAL CKKS
                  </h3>
                </div>
                <div className="bg-slate-800 p-2.5 rounded-xl text-slate-300 border border-slate-700">
                  <Lock size={20} />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Zero Raw Data Leakage
              </div>
            </div>
          </div>

          {/* TAB CONTENT: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Aggregation Queue Bento Banner */}
              <div className="bento-card-gold p-6 rounded-2xl relative overflow-hidden">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-amber-500/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Consensus Engine
                      </span>
                      <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                        Round #{(status.round || 0) + 1} Aggregation Quorum
                      </h2>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Buffer status: <span className="font-mono text-amber-300 font-bold">{status.pending_updates_count || 0}</span> of <span className="font-mono text-white font-bold">{status.min_clients_per_round || 2}</span> bank nodes submitted. Auto-aggregates once quorum is satisfied.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-amber-500/25 text-xs font-mono">
                      <span className="text-[11px] text-amber-400/80 px-2 font-bold">Min Nodes:</span>
                      {[1, 2, 3].map(q => (
                        <button
                          key={q}
                          onClick={() => handleSetMinClients(q)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            (status.min_clients_per_round || 2) === q
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'text-slate-400 hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          {q} {q === 1 ? 'Node' : 'Nodes'}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleAggregateNow}
                      disabled={aggregating || (status.pending_updates_count || 0) === 0}
                      className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
                        (status.pending_updates_count || 0) > 0
                          ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 shadow-lg shadow-amber-500/25 cursor-pointer font-black'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                      }`}
                    >
                      <Zap size={15} />
                      {aggregating
                        ? 'Consolidating Weights...'
                        : (status.pending_updates_count || 0) >= (status.min_clients_per_round || 2)
                          ? 'Quorum Satisfied — Run FedAvg'
                          : (status.pending_updates_count || 0) > 0
                            ? `Consolidate Now (${status.pending_updates_count} Buffered)`
                            : 'Awaiting Bank Node Weights'}
                    </button>
                  </div>
                </div>

                {/* Buffered submissions pill preview */}
                <div className="mt-4">
                  <div className="text-[11px] font-mono uppercase text-amber-400/80 mb-2 flex items-center justify-between font-bold">
                    <span>Buffered Branch Submissions (Round #{(status.round || 0) + 1}):</span>
                    <span className="text-slate-400">{status.status}</span>
                  </div>

                  {(!status.pending_updates || status.pending_updates.length === 0) ? (
                    <div className="p-3.5 bg-slate-950/80 border border-slate-800/90 rounded-xl text-xs text-slate-400 font-mono flex items-center justify-between">
                      <span>No bank updates buffered yet. Submit local weights from Bank Client Node(s) to commence.</span>
                      <span className="text-[10px] text-amber-400/60 font-bold">Pending Round #{(status.round || 0) + 1}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {status.pending_updates.map((p, idx) => (
                        <div key={idx} className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-center justify-between font-mono text-xs">
                          <div>
                            <span className="text-amber-300 font-bold block">{p.username}</span>
                            <span className="text-[10px] text-slate-400">{p.num_samples.toLocaleString()} records</span>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg text-xs">
                            Acc: {p.accuracy.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Convergence Graph Bento */}
              <div className="bento-card p-6 rounded-2xl border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Activity size={18} className="text-amber-400" />
                      Global Model Federated Accuracy Trajectory
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sample-weighted convergence across federated iterations: <span className="font-mono text-amber-300">W_global = Σ(n_k × W_k) / Σ(n_k)</span>
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs font-mono text-amber-300 font-bold">
                    Protocol: Sample-Weighted FedAvg
                  </div>
                </div>

                <div className="h-80 w-full">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              {/* Node Summary List */}
              <div className="bento-card p-6 rounded-2xl border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers size={18} className="text-amber-400" /> Active Institution Contributions
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{liveNodes.length} node{liveNodes.length !== 1 ? 's' : ''} enrolled</span>
                </div>
                {liveNodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                      <Building2 size={28} className="text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">No financial nodes connected to this mesh</p>
                    <p className="text-xs text-slate-500 max-w-sm">Launch a client node at localhost:8001, authenticate, load a bank dataset, and perform local training to contribute.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {liveNodes.map((node) => {
                      const isOnline = Boolean(node.is_online);
                      const flWeight = totalSamples > 0 ? ((node.num_samples / totalSamples) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={node.id} className="bento-card p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-200 truncate max-w-[130px]" title={node.name}>{node.name}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border ${
                              isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                            }`}>{isOnline ? 'Online' : 'Offline'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/70 p-2.5 rounded-xl border border-slate-900">
                            <div>
                              <span className="text-slate-500 block text-[10px]">Records</span>
                              <span className="text-amber-300 font-bold">{node.num_samples.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">FedAvg Weight</span>
                              <span className="text-amber-300 font-bold">{flWeight}%</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Test Acc</span>
                              <span className="text-emerald-400 font-bold">{node.accuracy}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Heartbeat</span>
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

          {/* TAB CONTENT: Bank Nodes */}
          {activeTab === 'nodes' && (
            <div className="bento-card p-6 rounded-2xl border-slate-800 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Building2 size={20} className="text-amber-400" /> Enrolled Financial Institutions & Mesh Nodes
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Distributed banking cluster participating in CKKS encrypted federated learning.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-slate-300">{status.online_users_count ?? 0} Online</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{liveNodes.length} Total</span>
                </div>
              </div>

              {liveNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                  <div className="p-6 bg-slate-950 rounded-3xl border border-slate-800">
                    <Building2 size={40} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-300">No Branch Nodes Connected</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Open http://localhost:8001, authenticate as a branch operator, and upload training data to activate telemetry.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {liveNodes.map((node) => {
                    const isOnline = Boolean(node.is_online);
                    const hasTrainedModel = node.accuracy !== '--' || node.num_samples > 0 || (node.status && (node.status.includes('Trained') || node.status.includes('Contributed')));
                    const flWeight = totalSamples > 0 ? ((node.num_samples / totalSamples) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={node.id} className={`bento-card p-5 rounded-2xl border space-y-4 ${
                        isOnline ? 'border-amber-500/30' : 'border-slate-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2.5 rounded-xl ${
                              isOnline ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-900 text-slate-600'
                            }`}>
                              <Building2 size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">{node.name}</h4>
                              <span className="text-[10px] text-slate-500 font-mono">NODE_ID: {node.id}</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-0.5 text-[10px] font-mono rounded-full border ${
                            isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
                        </div>

                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">Vault Dataset:</span>
                            <span className="text-amber-300 font-bold truncate ml-2 max-w-[130px]" title={node.dataset_name}>{node.dataset_name}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">Local Samples:</span>
                            <span className="text-amber-300 font-bold">{node.num_samples.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">FedAvg Weight:</span>
                            <span className="text-amber-300 font-bold">{flWeight}%</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800">
                            <span className="text-slate-400">Local Accuracy:</span>
                            <span className={`font-bold ${hasTrainedModel ? 'text-emerald-400' : 'text-slate-500'}`}>{node.accuracy}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400">Heartbeat:</span>
                            <span className="text-slate-300 font-bold">{node.last_seen}</span>
                          </div>
                        </div>

                        <div className="pt-1">
                          {hasTrainedModel ? (
                            <span className="w-full inline-flex justify-center items-center gap-1.5 py-2 px-3 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                              <CheckCircle2 size={14} /> Ciphertext Updates Transmitted
                            </span>
                          ) : (
                            <span className="w-full inline-flex justify-center items-center gap-1.5 py-2 px-3 text-xs font-semibold text-amber-300 bg-amber-500/10 rounded-xl border border-amber-500/20">
                              <Activity size={14} /> Awaiting Local Epochs
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
            <div className="space-y-5">
              {/* Global Feature Importance */}
              <div className="bento-card p-6 rounded-2xl border-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Microscope size={20} className="text-amber-400" />
                      Federated Global Feature Importance (XAI)
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Consolidated risk indicator weighting across all member banks using first-layer gradient attribution.
                    </p>
                  </div>
                  <button 
                    onClick={fetchXAI}
                    className="px-3.5 py-1.5 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs rounded-xl border border-amber-500/30 font-bold"
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
                      <div key={index} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-200 font-bold">{item.feature}</span>
                          <span className="text-amber-300 font-bold">{pct}% Attribution</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Prediction Sandbox */}
              <div className="bento-card p-6 rounded-2xl border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FlaskConical size={18} className="text-amber-400" /> Financial Fraud & Risk Inference Simulator
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Test live customer parameters against the consolidated FedAvg global model.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => loadPreset('low_risk')}
                      className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs rounded-xl border border-emerald-500/30 font-bold"
                    >
                      Preset: Prime / Clean
                    </button>
                    <button 
                      onClick={() => loadPreset('high_fraud')}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs rounded-xl border border-rose-500/30 font-bold"
                    >
                      Preset: Suspicious / Fraud
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
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleTestPrediction}
                    disabled={testLoading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20"
                  >
                    {testLoading ? 'Computing Global Model Inference...' : 'Run Real-Time Risk Assessment (XAI)'}
                  </button>
                </div>

                {testResult && (
                  <div className="bento-card-gold p-5 rounded-xl border border-amber-500/30 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-slate-300">Model Decision:</span>
                      <span className={`px-3.5 py-1 rounded-full text-xs font-black font-mono uppercase ${
                        testResult.prediction === 1 || testResult.risk_level === 'High'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {testResult.risk_level || (testResult.prediction === 1 ? 'High Risk / Suspicious' : 'Low Risk / Prime Customer')}
                      </span>
                    </div>

                    {testResult.confidence !== undefined && (
                      <div className="text-xs font-mono text-slate-300">
                        Confidence Score: <span className="text-amber-300 font-bold">{(testResult.confidence).toFixed(1)}%</span>
                      </div>
                    )}

                    {testResult.explanation && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-200">Gradient Saliency Attribution:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                          {Object.entries(testResult.explanation).map(([k, v]) => (
                            <div key={k} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                              <span className="text-slate-400 truncate max-w-[100px]">{k}:</span>
                              <span className={v > 0 ? 'text-amber-300 font-bold' : 'text-slate-500'}>{v.toFixed(4)}</span>
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
            <div className="bento-card p-6 rounded-2xl border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Terminal size={18} className="text-amber-400" /> Immutable FL Audit Console
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live stream of decentralized weight syncs, CKKS encryption handshakes, and FedAvg aggregations.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-mono bg-slate-950 border border-slate-800 text-amber-300 rounded-lg">
                    {status.logs ? status.logs.length : 0} records
                  </span>
                  <button
                    onClick={() => {
                      if (logContainerRef.current) {
                        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                        userScrolledUp.current = false;
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all"
                  >
                    Jump to Latest
                  </button>
                  <button
                    onClick={() => fetchStatus()}
                    className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-all"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-[11px] font-mono">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span><span className="text-amber-400">[FL]</span> <span className="text-slate-400">Federated training steps</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span><span className="text-slate-400">[INFO]</span> <span className="text-slate-400">System events</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span><span className="text-yellow-400">[WARN]</span> <span className="text-slate-400">Warnings</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span><span className="text-rose-400">[ERROR]</span> <span className="text-slate-400">Alerts</span></span>
              </div>

              <div
                ref={logContainerRef}
                onScroll={() => {
                  const el = logContainerRef.current;
                  if (!el) return;
                  userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
                }}
                className="bg-[#020408] p-4 rounded-xl border border-slate-800 font-mono text-xs h-[520px] overflow-y-auto space-y-0.5 leading-relaxed"
              >
                {(status.logs || ["[INFO] FedVault AI Aggregation Server initialized. Waiting for bank node connections..."]).map((log, i) => {
                  const tsMatch = log.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*/);
                  const ts = tsMatch ? tsMatch[1] : null;
                  const msg = tsMatch ? log.slice(tsMatch[0].length) : log;

                  const isRoundStart  = msg.includes('========== FEDERATED ROUND') && msg.includes('START');
                  const isRoundEnd    = msg.includes('========== ROUND') && msg.includes('COMPLETE');

                  const isFL    = msg.startsWith('[FL]');
                  const isWarn  = msg.startsWith('[WARN]');
                  const isError = msg.startsWith('[ERROR]');

                  let textColor = 'text-slate-400';
                  if (isFL)    textColor = msg.includes('==========') ? 'text-amber-300 font-bold' : msg.includes('[FL]   ') ? 'text-slate-300' : 'text-amber-400';
                  if (isWarn)  textColor = 'text-yellow-400';
                  if (isError) textColor = 'text-rose-400';

                  return (
                    <div key={i}>
                      {isRoundStart && (
                        <div className="my-2 border-t border-amber-500/20 border-dashed" />
                      )}
                      <div className={`flex gap-3 hover:bg-slate-900/50 px-1.5 py-0.5 rounded ${isRoundEnd ? 'mb-2' : ''}`}>
                        <span className="text-slate-600 select-none shrink-0 w-[62px]">
                          {ts ? ts : ''}
                        </span>
                        <span className={textColor}>{msg}</span>
                      </div>
                      {isRoundEnd && (
                        <div className="my-2 border-t border-amber-500/20 border-dashed" />
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
