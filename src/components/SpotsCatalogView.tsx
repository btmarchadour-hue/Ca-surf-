import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { BOARD_TYPE_LABELS, SURF_REGIONS, SURFER_LEVEL_LABELS } from '../data/spots';
import {
  degreesToCompass,
  findBestWindowForSpot,
  getLocalDateKey,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type { SpotForecast, SurferPreferences, SurfSpot } from '../types/surf';
import { SpotImage } from './SpotImage';

interface SpotsCatalogViewProps {
  spots: SurfSpot[];
  favoriteSpotIds: string[];
  forecasts: Record<string, SpotForecast>;
  loadingForecasts: boolean;
  surferPrefs: SurferPreferences;
  isSignedIn: boolean;
  onSelectSpot: (spotId: string) => void;
  onToggleFavorite: (spotId: string) => void;
  onOpenAddSpot: () => void;
  onRequireAuth: () => void;
  onDoneChoosing: () => void;
}

export function SpotsCatalogView({
  spots,
  favoriteSpotIds,
  forecasts,
  loadingForecasts,
  surferPrefs,
  isSignedIn,
  onSelectSpot,
  onToggleFavorite,
  onOpenAddSpot,
  onRequireAuth,
  onDoneChoosing,
}: SpotsCatalogViewProps) {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string>('Toutes');
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [onlyCoherent, setOnlyCoherent] = useState(false);

  const todayKey = useMemo(() => getLocalDateKey(0), []);

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Toutes: spots.length,
      'Tout le Finistère': 0,
      'Mes spots perso': 0,
    };
    spots.forEach((s) => {
      counts[s.region] = (counts[s.region] ?? 0) + 1;
      if (
        s.region === 'Presqu’île de Crozon' ||
        s.region === 'Finistère Sud' ||
        s.region === 'Finistère Nord'
      ) {
        counts['Tout le Finistère'] += 1;
      }
      if (s.isCustom) {
        counts['Mes spots perso'] += 1;
      }
    });
    return counts;
  }, [spots]);

  const enriched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spots
      .map((spot) => {
        const forecast = forecasts[spot.id];
        const bestToday = findBestWindowForSpot(spot, forecast, todayKey, surferPrefs);
        return { spot, forecast, bestToday };
      })
      .filter(({ spot, bestToday }) => {
        if (onlyChosen && !favoriteSpotIds.includes(spot.id)) return false;
        if (onlyCoherent && bestToday?.fitStatus === 'challenging') return false;
        if (region === 'Mes spots perso') {
          if (!spot.isCustom) return false;
        } else if (region === 'Tout le Finistère') {
          if (
            spot.region !== 'Presqu’île de Crozon' &&
            spot.region !== 'Finistère Sud' &&
            spot.region !== 'Finistère Nord'
          ) {
            return false;
          }
        } else if (region !== 'Toutes' && spot.region !== region) {
          return false;
        }
        if (q) {
          const hay = `${spot.name} ${spot.town} ${spot.region} ${spot.waveCharacter}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.bestToday?.avgScore ?? 0) - (a.bestToday?.avgScore ?? 0));
  }, [spots, favoriteSpotIds, forecasts, todayKey, surferPrefs, search, region, onlyChosen, onlyCoherent]);

  const windToneClass = (q: string) => {
    if (q === 'glassy' || q === 'offshore') return 'text-[#2DD4BF]';
    if (q === 'cross') return 'text-[#F7C266]';
    return 'text-[#FB7185]';
  };

  const regionTabs = [
    'Toutes',
    'Tout le Finistère',
    ...SURF_REGIONS.filter((r) => r !== 'Toutes'),
    'Mes spots perso',
  ];

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold text-[#4AE8D1]">
            API gratuite Open-Meteo Marine & Weather · Houle · Période · Eau · Vent
          </div>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.98]">
            {spots.length} spots en direct sur la côte
          </h1>
          <p className="mt-2.5 text-sm text-[#A9C0CE]">
            Sélectionnez jusqu’à 15 breaks habituels. Ils sont classés automatiquement selon votre
            profil{' '}
            <span className="text-[#F8FBFE] font-medium">
              {SURFER_LEVEL_LABELS[surferPrefs.surferLevel].label} (
              {BOARD_TYPE_LABELS[surferPrefs.boardType].label})
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => (isSignedIn ? onOpenAddSpot() : onRequireAuth())}
            className="surf-btn-glass inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un spot GPS
          </button>
          <button
            type="button"
            onClick={onDoneChoosing}
            className="surf-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
          >
            Voir mes propositions ({favoriteSpotIds.length})
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="surf-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[230px] max-w-md">
            <Search className="w-4 h-4 text-[#6D8796] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher La Palue, Goulien, Pen Hat, La Torche, Petit Minou..."
              className="surf-input w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono tabular-nums text-[#8AA6B7] mr-1">
              {favoriteSpotIds.length} / 15 choisis
            </span>
            <button
              type="button"
              onClick={() => setOnlyCoherent((v) => !v)}
              className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition-all whitespace-nowrap shrink-0 ${
                onlyCoherent
                  ? 'bg-[#2DD4BF]/15 text-[#4AE8D1] border-[#2DD4BF]/45'
                  : 'bg-[#071119] text-[#CBD8E1] border-white/12 hover:border-white/30'
              }`}
            >
              Adaptés à mon niveau
            </button>
            <button
              type="button"
              onClick={() => setOnlyChosen((v) => !v)}
              className={`px-3.5 py-2 text-xs rounded-xl border transition-all whitespace-nowrap shrink-0 ${
                onlyChosen
                  ? 'surf-btn-primary border-transparent font-semibold'
                  : 'bg-[#071119] text-[#CBD8E1] border-white/12 hover:border-white/30 font-medium'
              }`}
            >
              Mes spots choisis
            </button>
          </div>
        </div>

        {/* Region segmented bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {regionTabs.map((reg) => {
            const count = regionCounts[reg] ?? 0;
            const active = region === reg;
            return (
              <button
                key={reg}
                type="button"
                onClick={() => setRegion(reg)}
                className={`px-3.5 py-1.5 text-xs rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white/15 text-[#F8FBFE] font-semibold border border-white/15'
                    : 'text-[#8AA6B7] hover:text-[#F3F7FA] hover:bg-white/5 font-medium border border-transparent'
                }`}
              >
                {reg}
                <span className="ml-1.5 font-mono tabular-nums text-[11px] opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Photographic Surf Cards Grid */}
      {loadingForecasts && enriched.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-76 surf-card rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : enriched.length === 0 ? (
        <div className="surf-card rounded-2xl p-10 text-center space-y-2">
          <p className="text-sm font-medium text-[#F3F7FA]">
            Aucun spot trouvé pour ces filtres.
          </p>
          <p className="text-xs text-[#94ACB9]">
            Essayez une autre région ou ajoutez n’importe quelle plage côtière via GPS.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {enriched.map(({ spot, forecast, bestToday }) => {
            const isChosen = favoriteSpotIds.includes(spot.id);
            const cur = forecast?.current;
            const fitColor =
              bestToday?.fitStatus === 'ideal'
                ? 'text-[#2DD4BF]'
                : bestToday?.fitStatus === 'challenging'
                ? 'text-[#FB7185]'
                : 'text-[#F7C266]';

            return (
              <article
                key={spot.id}
                onClick={() => onSelectSpot(spot.id)}
                className={`surf-card-interactive rounded-2xl overflow-hidden cursor-pointer group flex flex-col ${
                  isChosen ? 'border-[#F0A53A]/55' : ''
                }`}
              >
                <div className="relative h-48 overflow-hidden">
                  <SpotImage
                    src={spot.imageUrl}
                    alt={`${spot.town} — ${spot.name}`}
                    title={spot.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08131C] via-[#08131C]/35 to-transparent" />

                  <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-white/75">
                        {spot.region} · {SURFER_LEVEL_LABELS[spot.difficulty].label}
                      </div>
                      <h2 className="font-display text-2xl font-extrabold tracking-tight text-white truncate leading-tight">
                        {spot.town} — {spot.name}
                      </h2>
                    </div>
                    {bestToday && (
                      <div className="text-right shrink-0">
                        <div className="font-display text-3xl font-extrabold tabular-nums text-[#F7C266] leading-none">
                          {bestToday.avgScore.toFixed(1).replace('.', ',')}
                          <span className="text-xs font-mono font-normal text-white/70">/10</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2.5">
                    <p className="text-xs text-[#A9C0CE] line-clamp-1">{spot.waveCharacter}</p>

                    {cur ? (
                      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/10 text-xs">
                        <div>
                          <div className="text-[11px] text-[#7D9BAC]">Houle live</div>
                          <div className="font-mono tabular-nums font-semibold text-[#38BDF8]">
                            {cur.waveHeight.toFixed(1).replace('.', ',')} m · {Math.round(cur.swellPeriod)}s
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#7D9BAC]">Vent</div>
                          <div
                            className={`font-mono tabular-nums font-semibold ${windToneClass(
                              cur.windQuality
                            )}`}
                          >
                            {cur.windSpeed} km/h {degreesToCompass(cur.windDirection)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#7D9BAC]">Eau / Créneau</div>
                          <div className="font-mono tabular-nums font-semibold text-[#F3F7FA]">
                            {cur.waterTemp !== null
                              ? `${cur.waterTemp.toFixed(0)}°C`
                              : `${cur.airTemp}°C`}{' '}
                            · {bestToday ? bestToday.windowLabel.slice(0, 5) : '—'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#6D8796]">Chargement Open-Meteo...</div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-[11px] font-medium truncate ${fitColor}`}>
                        {bestToday?.fitStatus === 'ideal'
                          ? 'Cohérent avec votre profil'
                          : bestToday?.fitStatus === 'challenging'
                          ? 'Spot exigeant pour vous'
                          : 'Compatible'}
                      </div>
                      <div className="text-[11px] text-[#6D8796] truncate">
                        {cur ? windQualityLabelFr(cur.windQuality) : spot.apiProvider}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(spot.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                        isChosen
                          ? 'bg-[#2DD4BF]/15 text-[#4AE8D1] border border-[#2DD4BF]/35 hover:bg-[#2DD4BF]/25'
                          : 'surf-btn-primary'
                      }`}
                    >
                      {isChosen ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Choisi
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Choisir
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
