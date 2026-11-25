import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Upload, 
  Download, 
  RotateCcw, 
  Search, 
  Shield, 
  Sliders, 
  FileText,
  UserX,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Save,
  Database
} from 'lucide-react';
import { 
  CrewMember, 
  getStoredCrewMembers, 
  saveStoredCrewMembers, 
  getAnonymousRatio, 
  saveAnonymousRatio,
  syncCrewWithServer,
  INITIAL_RIG50_CREW 
} from '../utils/crewStore';

export const CrewManager: React.FC = () => {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [anonymousRatio, setAnonymousRatioState] = useState<number>(30);

  // New Crew Member form state
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('Floorman');
  const [newShift, setNewShift] = useState<'Day' | 'Night' | 'Rotation'>('Day');
  const [newDept, setNewDept] = useState<'Drilling' | 'Deck & Crane' | 'Maintenance' | 'HSE' | 'Marine'>('Drilling');

  // Bulk paste modal / box
  const [showBulkPaste, setShowBulkPaste] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');
  const [bulkDefaultRole, setBulkDefaultRole] = useState<string>('Floorman');
  const [bulkDefaultDept, setBulkDefaultDept] = useState<'Drilling' | 'Deck & Crane' | 'Maintenance' | 'HSE' | 'Marine'>('Drilling');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('');
  const [isConfirmingReset, setIsConfirmingReset] = useState<boolean>(false);

  // Status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    syncCrewWithServer().then(synced => {
      if (synced && synced.length > 0) setCrew(synced);
      else setCrew(getStoredCrewMembers());
      setAnonymousRatioState(getAnonymousRatio());
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    let currentCrew = [...crew];
    if (editingId && editName.trim()) {
      currentCrew = currentCrew.map(c => c.id === editingId ? { ...c, name: editName.trim(), role: editRole } : c);
      setCrew(currentCrew);
      setEditingId(null);
    }
    const success = await saveStoredCrewMembers(currentCrew);
    await saveAnonymousRatio(anonymousRatio);
    setIsSaving(false);
    setLastSaved(new Date().toLocaleTimeString());
    showToast(success ? 'Crew roster saved to disk & browser successfully!' : 'Saved to browser cache');
  };

  const handleRatioChange = (val: number) => {
    setAnonymousRatioState(val);
    saveAnonymousRatio(val);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newMember: CrewMember = {
      id: `crew_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newName.trim(),
      role: newRole,
      shift: newShift,
      department: newDept,
      isActive: true
    };

    const updated = [newMember, ...crew];
    setCrew(updated);
    setNewName('');
    await saveStoredCrewMembers(updated);
    showToast(`Added and saved ${newMember.name} to Rig 50 crew`);
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;

    // Split by newlines or commas
    const lines = bulkText
      .split(/[\r\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    if (lines.length === 0) return;

    const newMembers: CrewMember[] = lines.map((name, idx) => ({
      id: `crew_bulk_${Date.now()}_${idx}`,
      name,
      role: bulkDefaultRole,
      shift: 'Day',
      department: bulkDefaultDept,
      isActive: true
    }));

    const updated = [...newMembers, ...crew];
    setCrew(updated);
    setBulkText('');
    setShowBulkPaste(false);
    await saveStoredCrewMembers(updated);
    showToast(`Successfully imported and saved ${newMembers.length} crew members!`);
  };

  const handleDelete = async (id: string) => {
    const updated = crew.filter(c => c.id !== id);
    setCrew(updated);
    await saveStoredCrewMembers(updated);
    showToast('Crew member removed');
  };

  const handleToggleActive = async (id: string) => {
    const updated = crew.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
    setCrew(updated);
    await saveStoredCrewMembers(updated);
  };

  const handleStartEdit = (member: CrewMember) => {
    setEditingId(member.id);
    setEditName(member.name);
    setEditRole(member.role);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const updated = crew.map(c => c.id === id ? { ...c, name: editName.trim(), role: editRole } : c);
    setCrew(updated);
    setEditingId(null);
    await saveStoredCrewMembers(updated);
    showToast(`Saved changes for ${editName.trim()}`);
  };

  const handleResetToDefault = () => {
    setIsConfirmingReset(false);
    setCrew(INITIAL_RIG50_CREW);
    saveStoredCrewMembers(INITIAL_RIG50_CREW);
    showToast('Reset to default crew roster');
  };

  const handleExportCsv = () => {
    const header = 'Name,Role,Department,Shift,IsActive\n';
    const rows = crew.map(c => `"${c.name}","${c.role}","${c.department}","${c.shift}",${c.isActive}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rig50_Crew_Roster_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredCrew = crew.filter(c => {
    const matchQuery = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       c.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept = filterDept === 'all' || c.department === filterDept;
    return matchQuery && matchDept;
  });

  const activeCount = crew.filter(c => c.isActive).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <Users className="w-5 h-5 text-teal-300" />
            </span>
            <h2 className="text-base sm:text-lg font-bold">
              Rig 50 Crew Members &amp; Name Roster
            </h2>
            <span className="bg-teal-500/30 text-teal-200 text-[11px] font-bold px-2 py-0.5 rounded border border-teal-400/40">
              {activeCount} Active Members
            </span>
            <span className="bg-emerald-500/20 text-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-400/40 flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Firestore Database Synced</span>
            </span>
          </div>
          <p className="text-xs text-teal-100/80 max-w-2xl leading-relaxed">
            Manage crew members for <strong>Rig 50 (50 Bob Palmer)</strong>. When submitting cards in batch or generating from operations reports, the system automatically rotates names across active crew or keeps cards anonymous according to your configured ratio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            {isSaving ? <CheckCircle2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>

          <button
            onClick={() => setShowBulkPaste(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Bulk Paste Names</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs font-semibold text-teal-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ANONYMOUS vs CREW NAME RATIO CONTROLLER */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Card Submission Name Distribution Strategy
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold">
            <span className="text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              {anonymousRatio}% Anonymous (Blank)
            </span>
            <span>:</span>
            <span className="text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
              {100 - anonymousRatio}% Crew Names
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1 font-medium">
              <UserX className="w-3.5 h-3.5 text-slate-400" />
              <span>More Anonymous Cards (Empty Name)</span>
            </span>
            <span className="flex items-center gap-1 font-medium text-teal-800">
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>More Crew Named Cards</span>
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={anonymousRatio}
            onChange={(e) => handleRatioChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
          />

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => handleRatioChange(100)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                anonymousRatio === 100 
                  ? 'bg-slate-900 text-white border-slate-900 font-bold' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              100% Anonymous (All Empty)
            </button>
            <button
              onClick={() => handleRatioChange(50)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                anonymousRatio === 50 
                  ? 'bg-slate-900 text-white border-slate-900 font-bold' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              50% Anonymous / 50% Crew
            </button>
            <button
              onClick={() => handleRatioChange(30)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                anonymousRatio === 30 
                  ? 'bg-slate-900 text-white border-slate-900 font-bold' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              30% Anonymous / 70% Crew (Recommended)
            </button>
            <button
              onClick={() => handleRatioChange(0)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                anonymousRatio === 0 
                  ? 'bg-slate-900 text-white border-slate-900 font-bold' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              0% Anonymous (100% Crew Named)
            </button>
          </div>
        </div>
      </div>

      {/* BULK PASTE MODAL */}
      {showBulkPaste && (
        <div className="bg-white rounded-xl border-2 border-teal-500 p-5 shadow-md space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-teal-600" />
                <span>Bulk Paste Crew Names</span>
              </h3>
              <p className="text-xs text-slate-500">
                Paste any list of names (one per line, or comma-separated). Perfect for pasting from Excel or WhatsApp rosters!
              </p>
            </div>
            <button
              onClick={() => setShowBulkPaste(false)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Default Observer Role for this batch:
              </label>
              <select
                value={bulkDefaultRole}
                onChange={(e) => setBulkDefaultRole(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              >
                <option value="Driller">Driller</option>
                <option value="Assistant Driller">Assistant Driller</option>
                <option value="Floorman">Floorman</option>
                <option value="Crane Operator">Crane Operator</option>
                <option value="Derrickman">Derrickman</option>
                <option value="HSE Specialist">HSE Specialist</option>
                <option value="Rig Safety Coach (RSC)">Rig Safety Coach (RSC)</option>
                <option value="Roustabout">Roustabout</option>
                <option value="Mechanic">Mechanic</option>
                <option value="Electrician">Electrician</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Department:
              </label>
              <select
                value={bulkDefaultDept}
                onChange={(e: any) => setBulkDefaultDept(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              >
                <option value="Drilling">Drilling</option>
                <option value="Deck & Crane">Deck &amp; Crane</option>
                <option value="Maintenance">Maintenance</option>
                <option value="HSE">HSE</option>
                <option value="Marine">Marine</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1 text-xs">
              Paste Crew Names (e.g. from Excel column):
            </label>
            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Mohammed Al-Otaibi\nAhmed Al-Ghamdi\nKhalid Al-Zahrani\nJohn Smith\nDavid Miller\n...`}
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBulkPaste(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkAdd}
              disabled={!bulkText.trim()}
              className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-xs font-bold text-white shadow-xs"
            >
              Import Names Now
            </button>
          </div>
        </div>
      )}

      {/* ADD SINGLE CREW MEMBER BAR */}
      <form onSubmit={handleAddMember} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-3">
          Add Single Crew Member
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Full Name:
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Saud Al-Harbi"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Role:
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="Driller">Driller</option>
              <option value="Assistant Driller">Assistant Driller</option>
              <option value="Floorman">Floorman</option>
              <option value="Crane Operator">Crane Operator</option>
              <option value="Derrickman">Derrickman</option>
              <option value="HSE Specialist">HSE Specialist</option>
              <option value="Rig Safety Coach (RSC)">Rig Safety Coach (RSC)</option>
              <option value="Roustabout">Roustabout</option>
              <option value="Mechanic">Mechanic</option>
              <option value="Electrician">Electrician</option>
              <option value="Toolpusher">Toolpusher</option>
              <option value="Rig Manager">Rig Manager</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Department:
            </label>
            <select
              value={newDept}
              onChange={(e: any) => setNewDept(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="Drilling">Drilling</option>
              <option value="Deck & Crane">Deck &amp; Crane</option>
              <option value="Maintenance">Maintenance</option>
              <option value="HSE">HSE</option>
              <option value="Marine">Marine</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Shift:
            </label>
            <select
              value={newShift}
              onChange={(e: any) => setNewShift(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="Day">Day Shift</option>
              <option value="Night">Night Shift</option>
              <option value="Rotation">Rotation</option>
            </select>
          </div>

          <div className="sm:col-span-1">
            <button
              type="submit"
              disabled={!newName.trim()}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center"
              title="Add Crew Member"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      {/* CREW ROSTER TABLE & SEARCH */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or role..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 w-48 sm:w-64"
              />
            </div>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">All Departments</option>
              <option value="Drilling">Drilling</option>
              <option value="Deck & Crane">Deck &amp; Crane</option>
              <option value="Maintenance">Maintenance</option>
              <option value="HSE">HSE</option>
              <option value="Marine">Marine</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isConfirmingReset ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                <span className="text-[11px] font-bold text-rose-700">Reset 20 defaults?</span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(false)}
                  className="px-1.5 py-0.5 text-[10px] bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingReset(true)}
                className="flex items-center gap-1 text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200/60"
                title="Reset to default 20 crew list"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Crew Name</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Shift</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCrew.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No crew members found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCrew.map((member) => (
                  <tr key={member.id} className={`hover:bg-slate-50/80 ${!member.isActive ? 'opacity-50 bg-slate-50/40' : ''}`}>
                    {/* Active toggle */}
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(member.id)}
                        className={`w-7 h-4 rounded-full transition-colors relative ${member.isActive ? 'bg-teal-600' : 'bg-slate-300'}`}
                      >
                        <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${member.isActive ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {editingId === member.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(member.id);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          className="px-2 py-1 text-xs border border-teal-500 rounded bg-white shadow-inner font-semibold text-slate-900 w-full focus:ring-1 focus:ring-teal-500 outline-none"
                          autoFocus
                        />
                      ) : (
                        <span>{member.name}</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-2.5 px-4 text-slate-700">
                      {editingId === member.id ? (
                        <input
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(member.id);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          className="px-2 py-1 text-xs border border-teal-500 rounded bg-white shadow-inner text-slate-900 w-full focus:ring-1 focus:ring-teal-500 outline-none"
                        />
                      ) : (
                        <span>{member.role}</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {member.department}
                      </span>
                    </td>

                    {/* Shift */}
                    <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                      {member.shift}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      {editingId === member.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(member.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(member)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(member.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
