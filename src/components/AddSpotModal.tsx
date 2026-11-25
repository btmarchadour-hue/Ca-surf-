import { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Search, X } from 'lucide-react';
import { searchCoastalLocation, type GeoSearchResult } from '../lib/surfEngine';
import type { BreakType } from '../types/surf';

interface AddSpotModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (spot: {
    name: string;
    region: string;
    lat: number;
    lng: number;
    offshoreDeg: number;
    idealMinWave: number;
    idealMaxWave: number;
    breakType: BreakType;
    idealTide: string;
  }) => Promise<void>;
}

const OFFSHORE_PRESETS = [
  { label: 'Est (90° — Côte Ouest / Landes)', deg: 90 },
  { label: 'Est-Nord-Est (70° — Bretagne / Vendée)', deg: 70 },
  { label: 'Est-Sud-Est (115° — Pays Basque)', deg: 115 },
  { label: 'Sud-Est (135° — Côte Nord-Ouest)', deg: 135 },
  { label: 'Nord (0° — Côte Sud)', deg: 0 },
  { label: 'Sud (180° — Côte Nord)', deg: 180 },
];

export function AddSpotModal({ open, onClose, onSubmit }: AddSpotModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [name, setName] = useState('');
  const [region, setRegion] = useState('Côte Atlantique');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [offshoreDeg, setOffshoreDeg] = useState(90);
  const [breakType, setBreakType] = useState<BreakType>('beach');
  const [idealMinWave, setIdealMinWave] = useState(0.8);
  const [idealMaxWave, setIdealMaxWave] = useState(2.4);
  const [idealTide, setIdealTide] = useState('Mi-marée');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError('');
    try {
      const found = await searchCoastalLocation(query);
      setResults(found);
      if (found.length === 0) {
        setError('Aucun lieu trouvé. Essayez le nom de la commune côtière.');
      }
    } catch {
      setError('Erreur lors de la recherche géographique.');
    } finally {
      setSearching(false);
    }
  };

  const applyLocation = (loc: GeoSearchResult) => {
    setName((prev) => prev || loc.name);
    setRegion(loc.admin1 || loc.country || 'Côte Atlantique');
    setLat(loc.latitude.toFixed(4));
    setLng(loc.longitude.toFixed(4));
    setResults([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (name.trim().length < 2) {
      setError('Indiquez un nom de spot (au moins 2 caractères).');
      return;
    }
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || !lat || !lng) {
      setError('Sélectionnez une localisation côtière ou saisissez des coordonnées valides.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        region: region.trim() || 'Côte Atlantique',
        lat: parsedLat,
        lng: parsedLng,
        offshoreDeg,
        idealMinWave,
        idealMaxWave: Math.max(idealMaxWave, idealMinWave),
        breakType,
        idealTide: idealTide.trim() || 'Toutes marées',
      });
      onClose();
    } catch {
      setError('Impossible d’enregistrer ce spot. Vérifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'surf-input w-full px-3.5 py-2.5 text-sm rounded-xl';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#03080D]/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-spot-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="surf-card rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl text-[#F3F7FA]"
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2
              id="add-spot-title"
              className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]"
            >
              Ajouter un spot connecté à l’API gratuite
            </h2>
            <p className="text-xs text-[#8AA6B7] mt-0.5">
              Open-Meteo Marine fournit la houle et la température d’eau sur toutes les côtes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#94ACB9] hover:text-white rounded-lg hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">
              Rechercher une plage ou commune côtière
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder="Ex. Peniche, Taghazout, Audierne, Lacanau..."
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searching}
                className="surf-btn-glass px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                {searching ? '...' : 'Chercher'}
              </button>
            </div>
            {results.length > 0 && (
              <div className="mt-2 border border-white/15 rounded-xl divide-y divide-white/10 max-h-40 overflow-y-auto bg-[#071119]">
                {results.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => applyLocation(loc)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-[#F3F7FA] flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#F0A53A] shrink-0" />
                      {loc.name}
                      {loc.admin1 ? `, ${loc.admin1}` : ''}
                      {loc.country ? ` (${loc.country})` : ''}
                    </span>
                    <span className="font-mono tabular-nums text-[#94ACB9] shrink-0">
                      {loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Nom du spot</label>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Supertubos"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Zone / Région</label>
              <input
                type="text"
                required
                maxLength={60}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ex. Bretagne"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="43.5124"
                className={`${inputCls} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="-1.5312"
                className={`${inputCls} font-mono tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">
                Vent offshore idéal
              </label>
              <select
                value={offshoreDeg}
                onChange={(e) => setOffshoreDeg(Number(e.target.value))}
                className={inputCls}
              >
                {OFFSHORE_PRESETS.map((p) => (
                  <option key={p.deg} value={p.deg}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Type de spot</label>
              <select
                value={breakType}
                onChange={(e) => setBreakType(e.target.value as BreakType)}
                className={inputCls}
              >
                <option value="beach">Beach break</option>
                <option value="reef">Reef break</option>
                <option value="point">Point break</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Houle min (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="5"
                value={idealMinWave}
                onChange={(e) => setIdealMinWave(Number(e.target.value))}
                className={`${inputCls} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Houle max (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="8"
                value={idealMaxWave}
                onChange={(e) => setIdealMaxWave(Number(e.target.value))}
                className={`${inputCls} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1">Marée idéale</label>
              <input
                type="text"
                maxLength={40}
                value={idealTide}
                onChange={(e) => setIdealTide(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {error && <p className="text-xs text-[#FB7185]">{error}</p>}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#94ACB9] hover:text-white whitespace-nowrap shrink-0"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="surf-btn-primary px-5 py-2.5 text-xs font-semibold rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Ajout...' : 'Ajouter à mes spots'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
