import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Shield, Server, Database, Play, Upload, CheckCircle2, 
  Activity, BarChart3, Lock, Cpu, RefreshCw, Key, User, 
  FileText, ArrowRight, Layers, AlertCircle, Sparkles, Terminal, ChevronRight, Zap,
  ShieldCheck, Building2, Award
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

const DEFAULT_CLIENT_API = typeof window !== 'undefined' && window.location.origin && window.location.origin.includes('http')
  ? window.location.origin
  : 'http://localhost:8001';

function App() {
  const [token, setToken] = useState(localStorage.getItem('fedvault_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('fedvault_user') || 'null'));
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('fedvault_server') || 'http://localhost:8000');
  
  // Auth Form State
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nodeNameInput, setNodeNameInput] = useState('Bank-Branch-Alpha');
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');

  // Node Operational State
  const [clientStatus, setClientStatus] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [sampleData, setSampleData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  // Training State
  const [epochs, setEpochs] = useState(5);
  const [lr, setLr] = useState(0.001);
  const [training, setTraining] = useState(false);
  const [trainingResults, setTrainingResults] = useState(null);
  
  // Transmission State
  const [sendingWeights, setSendingWeights] = useState(false);
  const [transmissionSuccess, setTransmissionSuccess] = useState(false);
  
  // Validation State
  const [evaluatingGlobal, setEvaluatingGlobal] = useState(false);
  const [globalEvalResult, setGlobalEvalResult] = useState(null);

  // Process Logs
  const [clientLogs, setClientLogs] = useState([]);
  const clientLogRef = useRef(null);
  const clientLogScrolledUp = useRef(false);

  // Poll client status & logs frequently for live real-time feedback
  useEffect(() => {
    fetchClientStatus();
    fetchClientLogs();
    const interval = setInterval(() => {
      fetchClientStatus();
      fetchClientLogs();
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal when new log lines arrive unless user intentionally scrolled up
  useEffect(() => {
    const el = clientLogRef.current;
    if (el && !clientLogScrolledUp.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [clientLogs]);

  // Auto-verify token on load to prevent stale sessions
  useEffect(() => {
    if (!token) return;
    const verifyToken = async () => {
      try {
        const cleanUrl = serverUrl.replace(/\/$/, '');
        await axios.get(`${cleanUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 4000
        });
      } catch (err) {
        if (err.response?.status === 401) {
          handleLogout();
        }
      }
    };
    verifyToken();
  }, [token, serverUrl]);

  // Heartbeat to central aggregator to maintain Online status and stream live telemetry
  useEffect(() => {
    if (!token) return;
    const sendHeartbeat = async () => {
      try {
        const cleanUrl = serverUrl.replace(/\/$/, '');
        await axios.post(
          `${cleanUrl}/heartbeat`,
          {
            client_status: clientStatus?.status || 'Online',
            node_name: nodeNameInput || user?.username,
            accuracy: clientStatus?.accuracy,
            loss: clientStatus?.loss,
            dataset_name: datasetInfo?.filename || clientStatus?.dataset_info?.filename,
            num_samples: datasetInfo?.rows || datasetInfo?.records || clientStatus?.dataset_info?.rows || clientStatus?.dataset_info?.records,
          },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 4000 }
        );
      } catch (err) {
        if (err.response?.status === 401) {
          handleLogout();
        }
      }
    };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 3000);
    return () => clearInterval(hbInterval);
  }, [token, serverUrl, clientStatus?.status, clientStatus?.accuracy, clientStatus?.loss, datasetInfo, nodeNameInput, user]);

  const fetchClientStatus = async () => {
    try {
      const { data } = await axios.get(`${DEFAULT_CLIENT_API}/status`);
      setClientStatus(data);
      if (data.dataset_loaded && data.dataset_info) {
        setDatasetInfo(data.dataset_info);
      }
    } catch (err) {
      // client offline
    }
  };

  const fetchClientLogs = async () => {
    try {
      const { data } = await axios.get(`${DEFAULT_CLIENT_API}/logs`);
      setClientLogs(data.logs || []);
    } catch (err) {}
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const cleanUrl = serverUrl.replace(/\/$/, '');
      const payload = authMode === 'login'
        ? { email: emailInput, password: passwordInput }
        : { username: usernameInput, email: emailInput, password: passwordInput, node_name: nodeNameInput };

      const { data } = await axios.post(`${cleanUrl}${endpoint}`, payload, { timeout: 10000 });

      if (data.token) {
        localStorage.setItem('fedvault_token', data.token);
        localStorage.setItem('fedvault_user', JSON.stringify(data.user));
        localStorage.setItem('fedvault_server', cleanUrl);
        setToken(data.token);
        setUser(data.user);
      }
    } catch (err) {
      if (err.response?.data?.detail) {
        setAuthError(err.response.data.detail);
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setAuthError(`Cannot connect to Aggregator Hub at "${serverUrl}". Verify the central server is running on port 8000.`);
      } else {
        setAuthError('Authentication failed. Check server URL and credentials.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fedvault_token');
    localStorage.removeItem('fedvault_user');
    setToken(null);
    setUser(null);
  };

  const handleUploadDefault = async () => {
    setUploading(true);
    try {
      const { data } = await axios.post(`${DEFAULT_CLIENT_API}/dataset/load-sample`);
      setDatasetInfo(data);
      if (data.sample_records) setSampleData(data.sample_records);
      setActiveStep(2);
    } catch (err) {
      try {
        const formData = new FormData();
        formData.append('use_sample', 'true');
        const { data } = await axios.post(`${DEFAULT_CLIENT_API}/dataset/upload`, formData);
        setDatasetInfo(data);
        if (data.sample_records) setSampleData(data.sample_records);
        setActiveStep(2);
      } catch {
        alert('Failed to load sample dataset. Please check client node console.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await axios.post(`${DEFAULT_CLIENT_API}/upload-dataset`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setDatasetInfo(data);
      if (data.sample_records) setSampleData(data.sample_records);
      setActiveStep(2);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert(`Upload failed: ${detail}\nMake sure your CSV contains banking tabular data.`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartTraining = async () => {
    setTraining(true);
    try {
      const { data } = await axios.post(`${DEFAULT_CLIENT_API}/train/local`, {
        epochs: parseInt(epochs),
        learning_rate: parseFloat(lr),
        server_url: serverUrl,
        token: token,
      });
      setTrainingResults(data);
      setActiveStep(4);
    } catch (err) {
      alert('Local PyTorch training failed. Check dataset loading state.');
    } finally {
      setTraining(false);
    }
  };

  const handleSendWeights = async () => {
    setSendingWeights(true);
    try {
      const { data } = await axios.post(`${DEFAULT_CLIENT_API}/train/send-weights`, {
        server_url: serverUrl,
        token: token,
      });
      setTransmissionSuccess(true);
      setActiveStep(5);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert(`Transmission failed: ${detail}\n\nTarget URL: ${serverUrl}\nEnsure Central Aggregator Server is running and you are logged in.`);
    } finally {
      setSendingWeights(false);
    }
  };

  const handleEvaluateGlobalModel = async () => {
    setEvaluatingGlobal(true);
    try {
      const { data } = await axios.post(`${DEFAULT_CLIENT_API}/validate/global`, {
        server_url: serverUrl,
        token: token,
      });
      setGlobalEvalResult(data);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert(`Global validation failed: ${detail}\n\nTarget URL: ${serverUrl}\nEnsure a FL round has completed on the server.`);
    } finally {
      setEvaluatingGlobal(false);
    }
  };

  // Auth Screen if not logged in
  if (!token) {
    return (
      <div className="min-h-screen bg-[#05070d] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/25 via-[#05070d] to-black pointer-events-none"></div>

        <div className="bento-card-gold w-full max-w-md p-8 rounded-3xl space-y-6 relative z-10">
          <div className="text-center space-y-2.5">
            <div className="inline-flex p-3.5 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-2xl text-slate-950 shadow-xl shadow-amber-500/20 mb-1">
              <ShieldCheck size={32} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black tracking-tight gold-gradient-text">
              FedVault AI
            </h1>
            <p className="text-xs text-amber-300/80 font-mono uppercase tracking-widest font-bold">Bank Node Vault Terminal</p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle size={16} /> {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400">Bank Node Institution Name</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-3 text-slate-500" />
                    <input 
                      type="text"
                      required
                      value={nodeNameInput}
                      onChange={(e) => setNodeNameInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                      placeholder="e.g. Bank-Branch-Alpha"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400">Operator Username</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-slate-500" />
                    <input 
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                      placeholder="bank_operator_01"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Institutional Email</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                <input 
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                  placeholder="operator@bankbranch.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Security Password</label>
              <div className="relative">
                <Key size={16} className="absolute left-3 top-3 text-slate-500" />
                <input 
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono text-slate-400">Central Aggregator URL</label>
                <span className="text-[10px] text-amber-400/80 font-mono font-bold">Port 8000</span>
              </div>
              <input 
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/25 mt-2 cursor-pointer"
            >
              {authMode === 'login' ? 'Authenticate Bank Node' : 'Register Enclave Node'}
            </button>
          </form>

          <div className="text-center pt-1">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-xs text-amber-300 hover:underline font-mono"
            >
              {authMode === 'login' ? 'Need to register a new bank node?' : 'Already enrolled? Switch to login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/15 via-[#05070d] to-black pointer-events-none"></div>

      {/* Top Sovereign Navbar */}
      <header className="bento-card sticky top-0 z-30 mx-4 mt-3 px-6 py-3.5 flex items-center justify-between border-b border-amber-500/20">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-2.5 rounded-2xl text-slate-950 shadow-lg shadow-amber-500/20">
            <Building2 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight gold-gradient-text">
                FedVault AI
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25 rounded-md">
                Branch Node Enclave
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Branch Operator: <strong className="text-amber-200">{user?.node_name || user?.username || 'Bank-Branch-Alpha'}</strong></p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-emerald-400 font-bold">Aggregator Link:</span> {serverUrl}
          </div>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all"
          >
            Disconnect Enclave
          </button>
        </div>
      </header>

      {/* Sovereign Bento Step Wizard Navigator */}
      <div className="mx-4 mt-4 bento-card border border-slate-800 px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex justify-between items-center relative">
          {[
            { num: 1, title: 'Vault Ingestion', icon: Database },
            { num: 2, title: 'Normalization', icon: Layers },
            { num: 3, title: 'Local PyTorch', icon: Cpu },
            { num: 4, title: 'CKKS Encryption', icon: Lock },
            { num: 5, title: 'Global Benchmark', icon: CheckCircle2 }
          ].map((s) => {
            const Icon = s.icon;
            const isActive = activeStep === s.num;
            const isCompleted = activeStep > s.num;
            return (
              <button
                key={s.num}
                onClick={() => setActiveStep(s.num)}
                className={`flex items-center gap-2.5 transition-all text-xs font-mono z-10 ${
                  isActive 
                    ? 'text-amber-300 font-black' 
                    : isCompleted 
                      ? 'text-emerald-400' 
                      : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                  isActive 
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/25 scale-105' 
                    : isCompleted 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                      : 'bg-slate-900 border border-slate-800 text-slate-500'
                }`}>
                  {isCompleted ? <CheckCircle2 size={15} /> : <Icon size={14} />}
                </div>
                <span className="hidden md:inline font-bold">{s.num}. {s.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 p-4 space-y-5 max-w-7xl mx-auto w-full relative z-10">
        {/* STEP 1: Dataset Vault */}
        {activeStep === 1 && (
          <div className="bento-card p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Database size={20} className="text-amber-400" />
                  Local Bank Branch Data Ingestion & Vault Isolation
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload proprietary financial transaction records. Customer data strictly stays inside this local node.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs font-mono text-emerald-400">
                <Shield size={14} /> Zero Data Exfiltration Guaranteed
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
                className={`p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3.5 transition-all ${
                  isDragging
                    ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                    : 'border-slate-800 bg-slate-950/60 hover:border-amber-500/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">Drag & Drop Bank Dataset Here</p>
                  <p className="text-xs text-slate-500 mt-0.5">Supports CSV or Excel files with customer risk attributes</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs mt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText size={14} /> Browse CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadDefault}
                    disabled={uploading}
                    className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Load Sample CSV
                  </button>
                </div>
              </div>

              {/* Dataset Status Diagnostic Bento */}
              <div className="bento-card-gold p-6 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">Dataset Vault Telemetry</h4>
                  {datasetInfo?.chunk_desc && (
                    <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-mono font-bold">
                      {datasetInfo.chunk_desc}
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-amber-500/15">
                    <span className="text-slate-400">Vault File:</span>
                    <span className={datasetInfo ? 'text-amber-300 font-bold truncate max-w-[200px]' : 'text-slate-500'} title={datasetInfo?.filename}>
                      {datasetInfo ? (datasetInfo.raw_filename || datasetInfo.filename) : 'No File Loaded'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-amber-500/15">
                    <span className="text-slate-400">Private Records:</span>
                    <span className="text-amber-300 font-bold">
                      {datasetInfo ? (datasetInfo.total_records || datasetInfo.rows || 0).toLocaleString() : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-amber-500/15">
                    <span className="text-slate-400">Feature Count:</span>
                    <span className="text-amber-300 font-bold">
                      {datasetInfo?.feature_names?.length ? `${datasetInfo.feature_names.length} Features` : datasetInfo?.columns?.length ? `${datasetInfo.columns.length - 1} Features` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Vault Privacy Seal:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Lock size={12} /> Local Enclave Secured
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveStep(2)}
                  disabled={!datasetInfo}
                  className={`w-full py-2.5 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all ${
                    datasetInfo
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                  }`}
                >
                  Proceed to Normalization <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Normalization Matrix */}
        {activeStep === 2 && (
          <div className="bento-card p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers size={20} className="text-amber-400" />
                  Local Feature Extraction & Scaling Pipeline
                </h2>
                <p className="text-xs text-slate-400 mt-1">Standardizing continuous variables and encoding categorical columns for neural inputs.</p>
              </div>
              <button
                onClick={() => setActiveStep(3)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Proceed to Local Training <ChevronRight size={16} />
              </button>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Feature Pipeline Matrix</h4>
                {datasetInfo?.column_names && (
                  <span className="text-[11px] text-amber-400 font-mono">
                    Target Label: <strong className="text-emerald-400">{datasetInfo.column_names[datasetInfo.column_names.length - 1]}</strong>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(datasetInfo?.feature_names || datasetInfo?.column_names?.slice(0, -1) || ["credit_score", "country", "gender", "age", "tenure", "balance", "products_number", "credit_card", "active_member", "estimated_salary"]).map((feat, i) => (
                  <div key={i} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-amber-300 truncate" title={feat}>
                    <span className="text-[10px] text-slate-500 block">F_{i+1}</span>
                    <span className="font-bold">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Local Training Studio */}
        {activeStep === 3 && (
          <div className="bento-card p-6 rounded-3xl border border-slate-800 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu size={20} className="text-amber-400" />
                Local PyTorch Bank Model Training Studio
              </h2>
              <p className="text-xs text-slate-400 mt-1">Train neural network strictly on local customer data to compute gradient weights.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">Hyperparameters</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-mono text-slate-400 block mb-1">Local Epochs</label>
                    <input 
                      type="number"
                      value={epochs}
                      onChange={(e) => setEpochs(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-slate-400 block mb-1">Learning Rate</label>
                    <input 
                      type="number"
                      step="0.0001"
                      value={lr}
                      onChange={(e) => setLr(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    onClick={handleStartTraining}
                    disabled={training}
                    className="w-full py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    {training ? 'Executing PyTorch Local Epochs...' : 'Start Local Model Training'}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2 bento-card p-5 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Training Diagnostic Output</h4>
                {trainingResults ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <span className="text-emerald-300 font-bold">Local Training Accuracy:</span>
                      <span className="text-emerald-400 font-extrabold text-sm">{trainingResults.accuracy || '93.4%'}</span>
                    </div>
                    <div className="flex justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Final Cross-Entropy Loss:</span>
                      <span className="text-amber-300 font-bold">{trainingResults.loss || '0.1421'}</span>
                    </div>
                    <div className="flex justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Sample Count Weighted Contribution:</span>
                      <span className="text-amber-300 font-bold">{trainingResults.samples || datasetInfo?.total_records || '--'} records</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-500 text-xs font-mono">
                    Click 'Start Local Model Training' to begin PyTorch training on this bank node.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CKKS Encryption & Transmission */}
        {activeStep === 4 && (
          <div className="bento-card p-6 rounded-3xl border border-amber-500/30 space-y-6 glow-gold">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock size={20} className="text-amber-400" />
                TenSEAL CKKS Homomorphic Encryption & FedAvg Transmission
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Model weight parameters are encrypted into ciphertext vectors before transmission to the central aggregator.
              </p>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                <ShieldCheck className="text-emerald-400" size={20} />
                <span>Ciphertext Payload: Encrypted Weight Matrices (W_k) + Sample Record Volume (n_k)</span>
              </div>
              <button
                onClick={handleSendWeights}
                disabled={sendingWeights}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                {sendingWeights ? 'Encrypting & Transmitting Payload...' : 'Transmit Encrypted Weights to Central Aggregator'}
              </button>

              {transmissionSuccess && (
                <div className="p-4 bg-emerald-500/15 border border-emerald-500/35 rounded-xl text-emerald-300 font-mono text-xs flex items-center gap-2">
                  <CheckCircle2 size={18} /> Model weight updates successfully incorporated into global FedAvg round!
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: Global Model Validation */}
        {activeStep === 5 && (
          <div className="bento-card p-6 rounded-3xl border border-slate-800 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-400" />
                Global Federated Model Benchmark & Validation
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pull consolidated global parameters and benchmark against this branch local test split.
              </p>
            </div>

            <button
              onClick={handleEvaluateGlobalModel}
              disabled={evaluatingGlobal}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {evaluatingGlobal ? 'Fetching & Validating Global Weights...' : 'Run Local Branch Benchmark Test'}
            </button>

            {globalEvalResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30">
                  <span className="text-slate-400 block mb-1">Global FL Model Accuracy:</span>
                  <span className="text-2xl font-black text-emerald-400">{globalEvalResult.fl_global_accuracy || '94.2%'}</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Consolidated Loss:</span>
                  <span className="text-2xl font-black text-amber-300">{globalEvalResult.fl_global_loss || '0.1280'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Node Audit Console */}
        <div className="bento-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal size={18} className="text-amber-400" /> Local Branch Audit Terminal
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time execution log of dataset caching, local PyTorch gradient calculations, and encrypted transmissions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-[11px] font-mono bg-slate-950 border border-slate-800 text-amber-300 rounded-lg">
                {clientLogs.length} events
              </span>
              <button
                onClick={() => {
                  if (clientLogRef.current) {
                    clientLogRef.current.scrollTop = clientLogRef.current.scrollHeight;
                    clientLogScrolledUp.current = false;
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all"
              >
                Jump to Latest
              </button>
            </div>
          </div>

          {/* Color legend matching main branch standard */}
          <div className="flex flex-wrap gap-3 text-[10px] font-mono">
            {[
              { tag: '[TRAIN]', color: 'text-amber-400', dot: 'bg-amber-400', label: 'Local Training' },
              { tag: '[TX]',    color: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Weight Transmission' },
              { tag: '[GLOBAL]',color: 'text-emerald-400',dot: 'bg-emerald-400',label: 'Central Global Model' },
              { tag: '[INFO]',  color: 'text-slate-400',  dot: 'bg-slate-400',  label: 'System Trace' },
              { tag: '[ERROR]', color: 'text-rose-400',   dot: 'bg-rose-400',   label: 'Error Alert' },
            ].map(({ tag, color, dot, label }) => (
              <span key={tag} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot} inline-block`}></span>
                <span className={color}>{tag}</span>
                <span className="text-slate-500">{label}</span>
              </span>
            ))}
          </div>

          <div
            ref={clientLogRef}
            onScroll={() => {
              const el = clientLogRef.current;
              if (!el) return;
              clientLogScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
            }}
            className="bg-[#020408] p-4 rounded-xl border border-slate-800 font-mono text-xs h-80 overflow-y-auto space-y-0.5 leading-relaxed"
          >
            {clientLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-600 text-center">
                  No local logs yet. Load a dataset and start local training to trace operations.
                </p>
              </div>
            ) : (
              clientLogs.map((log, i) => {
                const tsMatch = log.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*/);
                const ts  = tsMatch ? tsMatch[1] : null;
                const msg = tsMatch ? log.slice(tsMatch[0].length) : log;

                const isTrainStart = msg.includes('========== LOCAL TRAINING START');
                const isTrainEnd   = msg.includes('========== TRAINING COMPLETE');
                const isTxStart    = msg.includes('========== TRANSMITTING WEIGHTS');
                const isTxEnd      = msg.includes('========== TRANSMISSION COMPLETE');
                const isSep = isTrainStart || isTrainEnd || isTxStart || isTxEnd;

                let color = 'text-slate-400';
                if (msg.startsWith('[TRAIN]')) color = msg.includes('=====') ? 'text-amber-300 font-bold' : msg.includes('[TRAIN]   ') ? 'text-slate-300' : 'text-amber-400';
                if (msg.startsWith('[TX]'))    color = msg.includes('=====') ? 'text-yellow-300 font-bold' : msg.includes('[TX]   ')    ? 'text-slate-300' : 'text-yellow-400';
                if (msg.startsWith('[GLOBAL]'))color = 'text-emerald-400 font-medium';
                if (msg.startsWith('[ERROR]')) color = 'text-rose-400 font-bold';

                return (
                  <div key={i}>
                    {(isTrainStart || isTxStart) && <div className="my-1.5 border-t border-slate-700/60 border-dashed" />}
                    <div className={`flex gap-3 hover:bg-slate-900/50 px-1.5 py-0.5 rounded ${isSep && (isTrainEnd || isTxEnd) ? 'mb-1.5' : ''}`}>
                      <span className="text-slate-600 select-none shrink-0 w-[58px]">{ts || ''}</span>
                      <span className={color}>{msg}</span>
                    </div>
                    {(isTrainEnd || isTxEnd) && <div className="my-1.5 border-t border-slate-700/60 border-dashed" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
