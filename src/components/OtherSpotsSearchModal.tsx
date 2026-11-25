import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { SURF_REGIONS, SURFER_LEVEL_LABELS } from '../data/spots';
import {
  degreesToCompass,
  findBestWindowForSpot,
  getLocalDateKey,
  haversineKm,
  scoreLabelFr,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type {
  SpotForecast,
  SurferPreferences,
  SurfSpot,
  UserLocation,
} from '../types/surf';

interface OtherSpotsSearchModalProps {
  open: boolean;
  onClose: () => void;
  spots: SurfSpot[];
  favoriteSpotIds: string[];
  forecasts: Record<string, SpotForecast>;
  surferPrefs: SurferPreferences;
  userLocation: UserLocation | null;
  radiusKm?: number;
  isSignedIn: boolean;
  onSelectSpot: (spotId: string) => void;
  onToggleFavorite: (spotId: string) => void;
  onOpenAddSpot: () => void;
  onRequireAuth: () => void;
}

export function OtherSpotsSearchModal({
  open,
  onClose,
  spots,
  favoriteSpotIds,
  forecasts,
  surferPrefs,
  userLocation,
  radiusKm = 100,
  isSignedIn,
  onSelectSpot,
  onToggleFavorite,
  onOpenAddSpot,
  onRequireAuth,
}: OtherSpotsSearchModalProps) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string>('Toutes');
  const [scope, setScope] = useState<'outside' | 'all'>(userLocation ? 'outside' : 'all');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const todayKey = useMemo(() => getLocalDateKey(0), []);

  useEffect(() => {
    if (!open) return;
    setScope(userLocation ? 'outside' : 'all');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, userLocation, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots
      .map((spot) => {
        const distanceKm = userLocation
          ? haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
          : null;
        const forecast = forecasts[spot.id];
        const bestToday = findBestWindowForSpot(spot, forecast, todayKey, surferPrefs);
        return { spot, distanceKm, forecast, bestToday };
      })
      .filter(({ spot, distanceKm }) => {
        if (scope === 'outside' && distanceKm !== null && distanceKm <= radiusKm) {
          return false;
        }
        if (region !== 'Toutes' && spot.region !== region) {
          return false;
        }
        if (q) {
          const hay = `${spot.name} ${spot.town} ${spot.region} ${spot.waveCharacter}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (q) {
          const aStarts = a.spot.name.toLowerCase().startsWith(q) || a.spot.town.toLowerCase().startsWith(q);
          const bStarts = b.spot.name.toLowerCase().startsWith(q) || b.spot.town.toLowerCase().startsWith(q);
          if (aStarts !== bStarts) return aStarts ? -1 : 1;
        }
        return (b.bestToday?.avgScore ?? 0) - (a.bestToday?.avgScore ?? 0);
      });
  }, [spots, userLocation, radiusKm, forecasts, todayKey, surferPrefs, scope, region, query]);

  const outsideCount = useMemo(() => {
    if (!userLocation) return spots.length;
    return spots.filter(
      (s) => haversineKm(userLocation.lat, userLocation.lng, s.lat, s.lng) > radiusKm
    ).length;
  }, [spots, userLocation, radiusKm]);

  if (!open) return null;

  const windColor = (q: string) => {
    if (q === 'glassy' || q === 'offshore') return 'text-[#2DD4BF]';
    if (q === 'cross') return 'text-[#F7C266]';
    return 'text-[#FB7185]';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#03090E]/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche d’autres spots de surf"
    >
      <div
        className="w-full max-w-3xl my-4 sm:my-8 surf-card rounded-3xl overflow-hidden border border-white/15 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.95)] flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10 space-y-4 bg-[#07121B]/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4AE8D1]">
                <Compass className="w-3.5 h-3.5" />
                Menu recherche · Catalogue complet ({spots.length} spots API)
              </div>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F8FBFE] leading-none">
                Explorer les autres spots
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la recherche"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/12 text-[#94ACB9] hover:text-[#F8FBFE] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#6D8796] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un spot, une ville ou une région (Hossegor, Biarritz, La Torche, Mundaka, Siouville...)"
              className="surf-input w-full pl-10 pr-10 py-3 text-sm rounded-xl"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7D9BAC] hover:text-[#F8FBFE]"
                aria-label="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Scope switcher + Region pills */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {userLocation && (
              <div className="flex items-center gap-1 p-1 bg-[#060E15] border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScope('outside')}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    scope === 'outside'
                      ? 'surf-btn-primary font-semibold'
                      : 'text-[#94ACB9] hover:text-[#F3F7FA] font-medium'
                  }`}
                >
                  Au-delà de {radiusKm} km ({outsideCount})
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    scope === 'all'
                      ? 'surf-btn-primary font-semibold'
                      : 'text-[#94ACB9] hover:text-[#F3F7FA] font-medium'
                  }`}
                >
                  Toute la côte ({spots.length})
                </button>
              </div>
            )}

            <div className="text-xs font-mono tabular-nums text-[#8AA6B7]">
              {results.length} spot{results.length > 1 ? 's' : ''} affiché{results.length > 1 ? 's' : ''}
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {SURF_REGIONS.map((reg) => {
              const active = region === reg;
              return (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setRegion(reg)}
                  className={`px-3 py-1.5 text-xs rounded-xl transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white/15 text-[#F8FBFE] font-semibold border border-white/15'
                      : 'text-[#8AA6B7] hover:text-[#F3F7FA] hover:bg-white/5 font-medium border border-transparent'
                  }`}
                >
                  {reg}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Results List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/8 px-3 sm:px-4 py-2">
          {results.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <p className="text-sm font-medium text-[#F3F7FA]">
                Aucun spot ne correspond à cette recherche.
              </p>
              <p className="text-xs text-[#8AA6B7]">
                Essayez une autre région, basculez sur « Toute la côte », ou ajoutez un spot par GPS.
              </p>
            </div>
          ) : (
            results.map(({ spot, distanceKm, forecast, bestToday }) => {
              const isChosen = favoriteSpotIds.includes(spot.id);
              const cur = forecast?.current;
              const verdict = bestToday
                ? scoreLabelFr(bestToday.avgScore, bestToday.avgWaveHeight)
                : null;

              return (
                <div
                  key={spot.id}
                  onClick={() => {
                    onSelectSpot(spot.id);
                    onClose();
                  }}
                  className="py-3.5 px-2.5 sm:px-3 hover:bg-white/[0.04] rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-xl font-extrabold tracking-tight text-[#F8FBFE] truncate">
                        {spot.town} — {spot.name}
                      </span>
                      {distanceKm !== null && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-[#8AA6B7]">
                          <MapPin className="w-3 h-3 text-[#2DD4BF]" />
                          {distanceKm} km
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-[#94ACB9]">
                      <span>{spot.region}</span>
                      <span className="text-white/25">·</span>
                      <span>{SURFER_LEVEL_LABELS[spot.difficulty].label}</span>
                      {cur && (
                        <>
                          <span className="text-white/25">·</span>
                          <span className="font-mono tabular-nums text-[#38BDF8]">
                            {cur.waveHeight.toFixed(1).replace('.', ',')} m ({Math.round(cur.swellPeriod)} s)
                          </span>
                          <span className="text-white/25">·</span>
                          <span className={`font-mono tabular-nums ${windColor(cur.windQuality)}`}>
                            {cur.windSpeed} km/h {degreesToCompass(cur.windDirection)}{' '}
                            {windQualityLabelFr(cur.windQuality)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    {bestToday && (
                      <div className="text-right">
                        <div className="font-display text-2xl font-extrabold tabular-nums text-[#F7C266] leading-none">
                          {bestToday.avgScore.toFixed(1).replace('.', ',')}
                          <span className="text-[11px] font-mono font-normal text-[#8AA6B7]">/10</span>
                        </div>
                        {verdict && (
                          <div className="text-[10px] text-[#94ACB9] mt-0.5">{verdict.label}</div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(spot.id);
                      }}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                        isChosen
                          ? 'bg-[#2DD4BF]/15 text-[#4AE8D1] border border-[#2DD4BF]/35 hover:bg-[#2DD4BF]/25'
                          : 'surf-btn-glass text-[#F3F7FA]'
                      }`}
                    >
                      {isChosen ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {isChosen ? 'Choisi' : 'Suivre'}
                    </button>

                    <ArrowRight className="w-4 h-4 text-[#6D8796] hidden sm:block" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Action */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-white/10 bg-[#060E15]/90 flex items-center justify-between gap-3 flex-wrap text-xs">
          <span className="text-[#8AA6B7]">
            Vous cherchez un spot secret hors catalogue ?
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (isSignedIn) onOpenAddSpot();
              else onRequireAuth();
            }}
            className="surf-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#F0A53A]" />
            Ajouter un spot par GPS
          </button>
        </div>
      </div>
    </div>
  );
}
