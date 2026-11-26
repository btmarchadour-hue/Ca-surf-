import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LocateFixed,
  LogIn,
  MapPin,
  Plus,
  Search,
  Waves,
} from 'lucide-react';
import {
  BOARD_TYPE_LABELS,
  getSmartWaveDefaults,
  SURF_REGIONS,
  SURFER_LEVEL_LABELS,
} from '../data/spots';
import { haversineKm } from '../lib/surfEngine';
import type {
  BoardType,
  SurferLevel,
  SurferPreferences,
  SurfSpot,
  UserLocation,
} from '../types/surf';

interface OnboardingGateProps {
  initialPrefs: SurferPreferences;
  allSpots: SurfSpot[];
  userLocation: UserLocation | null;
  geoStatus: 'idle' | 'locating' | 'granted' | 'denied' | 'error';
  isSignedIn: boolean;
  onRequestGps: () => void;
  onSignIn: () => void;
  onComplete: (next: SurferPreferences & { favoriteSpotIds: string[] }) => Promise<void>;
}

const LEVELS: SurferLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const BOARDS: BoardType[] = ['longboard', 'midlength', 'fish', 'shortboard'];

export function OnboardingGate({
  initialPrefs,
  allSpots,
  userLocation,
  geoStatus,
  isSignedIn,
  onRequestGps,
  onSignIn,
  onComplete,
}: OnboardingGateProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<SurferPreferences>({
    ...initialPrefs,
    displayName: initialPrefs.displayName === 'Surfeur' ? '' : initialPrefs.displayName,
  });
  const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>([]);
  const [spotRegionFilter, setSpotRegionFilter] = useState<string>(
    initialPrefs.homeRegion || 'Presqu’île de Crozon'
  );
  const [spotQuery, setSpotQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLevelChange = (level: SurferLevel) => {
    const smart = getSmartWaveDefaults(level, draft.boardType);
    setDraft((prev) => ({
      ...prev,
      surferLevel: level,
      minWaveHeight: smart.minWaveHeight,
      maxWaveHeight: smart.maxWaveHeight,
      maxWindSpeed: smart.maxWindSpeed,
    }));
  };

  const handleBoardChange = (board: BoardType) => {
    const smart = getSmartWaveDefaults(draft.surferLevel, board);
    setDraft((prev) => ({
      ...prev,
      boardType: board,
      minWaveHeight: smart.minWaveHeight,
      maxWaveHeight: smart.maxWaveHeight,
    }));
  };

  const handleRegionChange = (region: string) => {
    setDraft((prev) => ({ ...prev, homeRegion: region }));
    setSpotRegionFilter(region);
  };

  const toggleSpot = (spotId: string) => {
    setError('');
    setSelectedSpotIds((prev) => {
      if (prev.includes(spotId)) return prev.filter((id) => id !== spotId);
      if (prev.length >= 15) return prev;
      return [...prev, spotId];
    });
  };

  const filteredSpots = useMemo(() => {
    const q = spotQuery.trim().toLowerCase();
    const list = allSpots.filter((spot) => {
      if (q) {
        const hay = `${spot.name} ${spot.town} ${spot.region}`.toLowerCase();
        return hay.includes(q);
      }
      if (spotRegionFilter === 'Toutes') return true;
      return spot.region === spotRegionFilter;
    });

    if (userLocation) {
      return [...list].sort(
        (a, b) =>
          haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    }
    return list;
  }, [allSpots, spotQuery, spotRegionFilter, userLocation]);

  const handleNextFromStep2 = () => {
    if (selectedSpotIds.length === 0) {
      setError('Sélectionnez au moins 1 spot préféré (3 recommandés pour le podium d’accueil).');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSpotIds.length === 0) {
      setStep(2);
      setError('Sélectionnez au moins 1 spot préféré pour continuer.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onComplete({
        ...draft,
        displayName: draft.displayName.trim() || 'Surfeur',
        onboardingCompleted: true,
        favoriteSpotIds: selectedSpotIds,
      });
    } catch {
      setError('Impossible d’enregistrer vos préférences. Réessayez dans un instant.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'surf-input w-full px-3.5 py-2.5 text-sm rounded-xl';

  return (
    <div className="min-h-screen text-[#F3F7FA] flex flex-col">
      {/* Minimal Single-Row Header (No Escaping to Main App Before Setup) */}
      <header className="border-b border-white/10 bg-[#060D13]/85 backdrop-blur-xl">
        <div className="max-w-[960px] mx-auto h-16 px-4 sm:px-8 flex items-center justify-between gap-6">
          <div className="font-display text-2xl font-extrabold tracking-wide text-[#F8FBFE] whitespace-nowrap shrink-0">
            Ça Surf <span className="text-[#F0A53A]">?</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono tabular-nums text-xs text-[#8AA6B7]">
              Étape {step} / 3
            </span>
            {!isSignedIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="surf-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 text-[#2DD4BF]" />
                Déjà un compte ?
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[960px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Progress Indicator */}
        <div className="mb-8 flex items-center gap-2" aria-hidden="true">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= step ? 'bg-gradient-to-r from-[#2DD4BF] to-[#F0A53A]' : 'bg-white/12'
              }`}
            />
          ))}
        </div>

        <form onSubmit={handleFinish} className="space-y-8">
          {step === 1 && (
            <section className="space-y-7">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#F7C266]">
                  <Waves className="w-4 h-4" />
                  Première ouverture · Configuration obligatoire
                </div>
                <h1 className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.98]">
                  Calibrez votre profil surfeur avant d’entrer
                </h1>
                <p className="mt-3 text-sm text-[#A9C0CE] leading-relaxed">
                  Vos préférences servent à classer vos spots préférés chaque matin et à n’afficher
                  sur l’accueil que les 3 meilleures options réelles pour votre niveau.
                </p>
              </div>

              <div className="surf-card rounded-3xl p-6 sm:p-8 space-y-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="onboard-name"
                      className="block text-xs font-medium text-[#CBD8E1] mb-1.5"
                    >
                      Prénom ou pseudo (optionnel)
                    </label>
                    <input
                      id="onboard-name"
                      type="text"
                      maxLength={60}
                      value={draft.displayName}
                      onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                      placeholder="Ex. Baptiste"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="onboard-region"
                      className="block text-xs font-medium text-[#CBD8E1] mb-1.5"
                    >
                      Secteur principal
                    </label>
                    <select
                      id="onboard-region"
                      value={draft.homeRegion}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      className={inputCls}
                    >
                      {SURF_REGIONS.filter((r) => r !== 'Toutes').map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Level */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-[#CBD8E1]">Votre niveau de surf</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {LEVELS.map((lvl) => {
                      const active = draft.surferLevel === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => handleLevelChange(lvl)}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-[#F0A53A]/15 border-[#F0A53A] text-[#F8FBFE]'
                              : 'bg-[#071119] border-white/10 text-[#CBD8E1] hover:border-white/25'
                          }`}
                        >
                          <div className="font-display text-xl font-bold tracking-tight">
                            {SURFER_LEVEL_LABELS[lvl].label}
                          </div>
                          <div className="mt-1 text-xs text-[#94ACB9] leading-snug">
                            {SURFER_LEVEL_LABELS[lvl].desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Board */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-[#CBD8E1]">Votre planche principale</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {BOARDS.map((board) => {
                      const active = draft.boardType === board;
                      return (
                        <button
                          key={board}
                          type="button"
                          onClick={() => handleBoardChange(board)}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-[#2DD4BF]/15 border-[#2DD4BF] text-[#F8FBFE]'
                              : 'bg-[#071119] border-white/10 text-[#CBD8E1] hover:border-white/25'
                          }`}
                        >
                          <div className="font-display text-xl font-bold tracking-tight">
                            {BOARD_TYPE_LABELS[board].label}
                          </div>
                          <div className="mt-1 text-xs text-[#94ACB9] leading-snug">
                            {BOARD_TYPE_LABELS[board].desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional GPS helper */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
                  <button
                    type="button"
                    onClick={onRequestGps}
                    className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#4AE8D1] rounded-xl whitespace-nowrap shrink-0"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    {geoStatus === 'locating'
                      ? 'Localisation GPS...'
                      : userLocation
                      ? `GPS actif · ${userLocation.label}`
                      : 'Activer le GPS pour trier par distance'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="surf-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap shrink-0"
                  >
                    Choisir mes spots préférés
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="max-w-2xl">
                  <div className="text-xs font-semibold text-[#4AE8D1]">
                    Étape 2 · Vos spots préférés
                  </div>
                  <h1 className="mt-1.5 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.98]">
                    Sélectionnez vos spots habituels
                  </h1>
                  <p className="mt-2 text-sm text-[#A9C0CE]">
                    Choisissez au moins 3 spots pour afficher le n°1 en grand et les 2 suivants juste
                    en dessous sur votre page d’accueil.
                  </p>
                </div>

                <div className="font-mono tabular-nums text-sm font-semibold text-[#F7C266]">
                  {selectedSpotIds.length} / 15 sélectionnés
                </div>
              </div>

              <div className="surf-card rounded-3xl p-6 space-y-5">
                {/* Search + Region Filter */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7 relative">
                    <Search className="w-4 h-4 text-[#6D8796] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={spotQuery}
                      onChange={(e) => setSpotQuery(e.target.value)}
                      placeholder="Chercher une plage (ex. Goulien, La Torche, Porz ar Vag...)"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <select
                      value={spotRegionFilter}
                      onChange={(e) => {
                        setSpotRegionFilter(e.target.value);
                        setSpotQuery('');
                      }}
                      className={inputCls}
                      aria-label="Filtrer par secteur"
                    >
                      {SURF_REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r === 'Toutes' ? 'Toute la côte' : r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Spots Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {filteredSpots.map((spot) => {
                    const active = selectedSpotIds.includes(spot.id);
                    const dist = userLocation
                      ? haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
                      : null;
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => toggleSpot(spot.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                          active
                            ? 'bg-[#2DD4BF]/15 border-[#2DD4BF]/60 text-[#F8FBFE]'
                            : 'bg-[#071119] border-white/10 text-[#CBD8E1] hover:border-white/25'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {spot.town} — {spot.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#8AA6B7] flex items-center gap-1.5 flex-wrap">
                            <span>{spot.region}</span>
                            {dist !== null && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[#4AE8D1]">
                                  <MapPin className="w-3 h-3" />
                                  {dist} km
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            active ? 'bg-[#2DD4BF] text-[#071118]' : 'bg-white/10 text-[#94ACB9]'
                          }`}
                        >
                          {active ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {error && <p className="text-xs text-[#FB7185]">{error}</p>}

                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#CBD8E1] rounded-xl whitespace-nowrap shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Retour
                  </button>

                  <div className="flex items-center gap-4 flex-wrap">
                    {selectedSpotIds.length > 0 && selectedSpotIds.length < 3 && (
                      <span className="text-xs text-[#8AA6B7]">
                        Astuce : choisissez-en 3 pour un podium complet
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleNextFromStep2}
                      disabled={selectedSpotIds.length === 0}
                      className="surf-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-45 whitespace-nowrap shrink-0"
                    >
                      Continuer ({selectedSpotIds.length})
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold text-[#F7C266]">
                  Étape 3 · Conditions idéales & alerte matinale
                </div>
                <h1 className="mt-1.5 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.98]">
                  Affinez votre houle et votre réveil surf
                </h1>
                <p className="mt-2 text-sm text-[#A9C0CE]">
                  Déjà pré-calibré pour votre profil{' '}
                  <strong className="text-[#F8FBFE]">
                    {SURFER_LEVEL_LABELS[draft.surferLevel].label.toLowerCase()}
                  </strong>{' '}
                  en{' '}
                  <strong className="text-[#F8FBFE]">
                    {BOARD_TYPE_LABELS[draft.boardType].label.toLowerCase()}
                  </strong>
                  . Modifiable à tout moment dans Mon profil.
                </p>
              </div>

              <div className="surf-card rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="onboard-min-wave"
                      className="flex items-center justify-between text-xs font-medium text-[#CBD8E1] mb-2"
                    >
                      <span>Houle minimale</span>
                      <span className="font-mono tabular-nums text-[#38BDF8] font-semibold">
                        {draft.minWaveHeight.toFixed(1).replace('.', ',')} m
                      </span>
                    </label>
                    <input
                      id="onboard-min-wave"
                      type="range"
                      min={0.4}
                      max={2.5}
                      step={0.1}
                      value={draft.minWaveHeight}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setDraft((prev) => ({
                          ...prev,
                          minWaveHeight: v,
                          maxWaveHeight: Math.max(prev.maxWaveHeight, v + 0.3),
                        }));
                      }}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="onboard-max-wave"
                      className="flex items-center justify-between text-xs font-medium text-[#CBD8E1] mb-2"
                    >
                      <span>Houle maximale</span>
                      <span className="font-mono tabular-nums text-[#38BDF8] font-semibold">
                        {draft.maxWaveHeight.toFixed(1).replace('.', ',')} m
                      </span>
                    </label>
                    <input
                      id="onboard-max-wave"
                      type="range"
                      min={0.8}
                      max={5.0}
                      step={0.1}
                      value={draft.maxWaveHeight}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setDraft((prev) => ({
                          ...prev,
                          maxWaveHeight: Math.max(v, prev.minWaveHeight),
                        }));
                      }}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="onboard-max-wind"
                      className="flex items-center justify-between text-xs font-medium text-[#CBD8E1] mb-2"
                    >
                      <span>Vent maximum toléré</span>
                      <span className="font-mono tabular-nums text-[#F7C266] font-semibold">
                        {draft.maxWindSpeed} km/h
                      </span>
                    </label>
                    <input
                      id="onboard-max-wind"
                      type="range"
                      min={10}
                      max={45}
                      step={1}
                      value={draft.maxWindSpeed}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, maxWindSpeed: Number(e.target.value) }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="onboard-alert-time"
                      className="block text-xs font-medium text-[#CBD8E1] mb-2"
                    >
                      Heure de l’alerte matinale
                    </label>
                    <input
                      id="onboard-alert-time"
                      type="time"
                      value={draft.alertTime}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, alertTime: e.target.value }))
                      }
                      className={`${inputCls} font-mono tabular-nums`}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-[#F8FBFE]">
                      Priorité vent offshore / glassy
                    </div>
                    <div className="text-xs text-[#8AA6B7]">
                      Met en avant les créneaux propres et écarte le vent onshore haché.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.preferOffshoreOnly}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, preferOffshoreOnly: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#F0A53A] rounded shrink-0"
                  />
                </div>

                {error && <p className="text-xs text-[#FB7185]">{error}</p>}

                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#CBD8E1] rounded-xl whitespace-nowrap shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Modifier mes spots
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="surf-btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    {saving ? 'Enregistrement...' : 'Valider et voir mon meilleur spot'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </form>
      </main>
    </div>
  );
}
