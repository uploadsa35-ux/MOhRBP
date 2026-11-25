import React, { useState } from 'react';
import { 
  HUMOR_SOAR_CARDS, 
  MUSIC_SOAR_CARDS, 
  OPERATIONS_SOAR_CARDS,
  CINEMA_SOAR_CARDS,
  WISDOM_SOAR_CARDS,
  MILITARY_SOAR_CARDS,
  SPORTS_SOAR_CARDS, 
  getStoredCustomCards, 
  saveAllCustomCards as saveStoredCustomCards, 
  SoarCardTemplate 
} from '../utils/cardBanks';
import { 
  X, 
  Plus, 
  Trash2, 
  Music, 
  Smile, 
  Check, 
  Sparkles, 
  Layers, 
  Shield, 
  FileText 
} from 'lucide-react';

interface CustomCardBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardsUpdated?: () => void;
}

type TabType = 'humor' | 'music' | 'cinema' | 'wisdom' | 'military' | 'sports' | 'operations' | 'custom';

export const CustomCardBankModal: React.FC<CustomCardBankModalProps> = ({ isOpen, onClose, onCardsUpdated }) => {
  const [activeTab, setActiveTab] = useState<TabType>('humor');
  const [customCards, setCustomCards] = useState<SoarCardTemplate[]>(() => getStoredCustomCards());

  // Form for adding new card
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newObs, setNewObs] = useState<string>('');
  const [newAction, setNewAction] = useState<string>('');
  const [newZone, setNewZone] = useState<string>('Rig Floor');
  const [newRole, setNewRole] = useState<string>('Floorman');
  const [newAssessment, setNewAssessment] = useState<'Safe' | 'Unsafe'>('Safe');
  const [newObsType, setNewObsType] = useState<string>('Behavior Observation');

  if (!isOpen) return null;

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObs.trim() || !newAction.trim()) return;

    const newCard: SoarCardTemplate = {
      id: `custom_${Date.now()}`,
      categoryTheme: 'custom',
      zone: newZone,
      role: newRole,
      assessment: newAssessment,
      obsType: newObsType,
      category: newObsType === 'STOP Work Authority (SWA)' ? 'Stop Work Authority (SWA)' : (newObsType === 'Condition' ? 'Condition & Equipment' : 'General Safety'),
      observation: newObs.trim(),
      action: newAction.trim()
    };

    const updated = [newCard, ...customCards];
    setCustomCards(updated);
    saveStoredCustomCards(updated);
    setNewObs('');
    setNewAction('');
    setIsAdding(false);
    setActiveTab('custom');
    if (onCardsUpdated) onCardsUpdated();
  };

  const handleDeleteCustomCard = (id: string) => {
    const updated = customCards.filter(c => c.id !== id);
    setCustomCards(updated);
    saveStoredCustomCards(updated);
    if (onCardsUpdated) onCardsUpdated();
  };

  const getCardsToDisplay = () => {
    if (activeTab === 'humor') return HUMOR_SOAR_CARDS;
    if (activeTab === 'music') return MUSIC_SOAR_CARDS;
    if (activeTab === 'cinema') return CINEMA_SOAR_CARDS;
    if (activeTab === 'wisdom') return WISDOM_SOAR_CARDS;
    if (activeTab === 'military') return MILITARY_SOAR_CARDS;
    if (activeTab === 'sports') return SPORTS_SOAR_CARDS;
    if (activeTab === 'operations') return OPERATIONS_SOAR_CARDS;
    return customCards;
  };

  const displayedCards = getCardsToDisplay();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>Rig 50 SOAR Card Bank &amp; Theme Library</span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Browse offshore comedy, music lyrics, movie quotes, ancient wisdom, and custom cards
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => { setActiveTab('humor'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'humor'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🎭 Comedy ({HUMOR_SOAR_CARDS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('music'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'music'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🎵 Music ({MUSIC_SOAR_CARDS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('cinema'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'cinema'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🎬 Cinema ({CINEMA_SOAR_CARDS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('wisdom'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'wisdom'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🧠 Wisdom ({WISDOM_SOAR_CARDS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('military'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'military'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🎖️ Military ({MILITARY_SOAR_CARDS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('sports'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'sports'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🏆 Sports ({SPORTS_SOAR_CARDS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('operations'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'operations'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🏗️ Operations ({OPERATIONS_SOAR_CARDS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('custom'); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'custom'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>✍️ Custom ({customCards.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Card</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Add Custom Card Form */}
          {isAdding && (
            <form onSubmit={handleAddCard} className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Create a New Custom / Funny / Music Card</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Zone:</label>
                  <select
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Rig Floor">Rig Floor</option>
                    <option value="Cantilever / Pipe Deck">Cantilever / Pipe Deck</option>
                    <option value="Main Deck">Main Deck</option>
                    <option value="BOP">BOP</option>
                    <option value="Cranes">Cranes</option>
                    <option value="Shakers">Shakers</option>
                    <option value="Mud Pit / Sack Room">Mud Pit / Sack Room</option>
                    <option value="Accommodations">Accommodations</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Role:</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Floorman">Floorman</option>
                    <option value="Roustabout">Roustabout</option>
                    <option value="Driller">Driller</option>
                    <option value="Assistant Driller">Assistant Driller</option>
                    <option value="Crane Operator">Crane Operator</option>
                    <option value="Mechanic">Mechanic</option>
                    <option value="Barge Engineer">Barge Engineer</option>
                    <option value="OIM">OIM</option>
                    <option value="Rig Safety Coach (RSC)">Rig Safety Coach (RSC)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Assessment:</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setNewAssessment('Safe')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        newAssessment === 'Safe' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700'
                      }`}
                    >
                      Safe
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAssessment('Unsafe')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        newAssessment === 'Unsafe' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700'
                      }`}
                    >
                      Unsafe
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Observation Text:</label>
                <textarea
                  rows={2}
                  value={newObs}
                  onChange={(e) => setNewObs(e.target.value)}
                  placeholder="e.g. Observed the Barge Engineer recalculating center of gravity..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Action Taken / Safety Note:</label>
                <textarea
                  rows={2}
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  placeholder="e.g. Safety Note or lyrics: 'Wake me up before you go-go...'"
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  Save to My Custom Cards
                </button>
              </div>
            </form>
          )}

          {/* Cards List */}
          {displayedCards.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs">No custom cards saved yet.</p>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                Click here to add your first custom card!
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedCards.map((card, idx) => (
                <div 
                  key={card.id || idx}
                  className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 relative group hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 font-mono">#{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-900">{card.zone}</span>
                      <span className="text-xs text-slate-500">· {card.role}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        card.assessment === 'Safe' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {card.assessment}
                      </span>

                      {activeTab === 'custom' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomCard(card.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete custom card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <strong className="text-slate-800 font-semibold block text-[11px] uppercase tracking-wide">Observation:</strong>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] whitespace-pre-line">
                        {card.observation}
                      </p>
                    </div>

                    <div>
                      <strong className="text-slate-800 font-semibold block text-[11px] uppercase tracking-wide">Action Taken / Safety Note:</strong>
                      <p className="text-slate-700 leading-relaxed bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 text-[11px] whitespace-pre-line">
                        {card.action}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Total cards available in this theme: <strong>{displayedCards.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
