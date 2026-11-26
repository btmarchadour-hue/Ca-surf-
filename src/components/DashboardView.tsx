import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Compass,
  ExternalLink,
  MapPin,
  Plus,
  SlidersHorizontal,
  Video,
} from 'lucide-react';
import {
  degreesToCompass,
  formatFrenchDateLabel,
  getLocalDateKey,
  getSpotWebcams,
  haversineKm,
  rankSpotsForDate,
  scoreLabelFr,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type {
  ActiveTab,
  SpotForecast,
  SurferPreferences,
  SurfSpot,
  UserLocation,
} from '../types/surf';
import { SpotImage } from './SpotImage';
import { SurfScoreDial } from './SurfScoreDial';

interface DashboardViewProps {
  allSpots: SurfSpot[];
  favoriteSpotIds: string[];
  forecasts: Record<string, SpotForecast>;
  loadingForecasts: boolean;
  surferPrefs: SurferPreferences;
  userLocation: UserLocation | null;
  onSelectSpot: (spotId: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export function DashboardView({
  allSpots,
  favoriteSpotIds,
  forecasts,
  loadingForecasts,
  surferPrefs,
  userLocation,
  onSelectSpot,
  onNavigateTab,
}: DashboardViewProps) {
  const todayKey = useMemo(() => getLocalDateKey(0), []);
  const tomorrowKey = useMemo(() => getLocalDateKey(1), []);
  const [horizon, setHorizon] = useState<'today' | 'tomorrow'>('today');

  const activeDateKey = horizon === 'today' ? todayKey : tomorrowKey;

  const chosenSpots = useMemo(() => {
    const favSet = new Set(favoriteSpotIds);
    return allSpots.filter((s) => favSet.has(s.id));
  }, [allSpots, favoriteSpotIds]);

  const rankedChosen = useMemo(
    () =>
      rankSpotsForDate(chosenSpots, forecasts, activeDateKey, surferPrefs, {
        morningOnly: horizon === 'tomorrow',
        includePastToday: horizon === 'tomorrow',
      }),
    [chosenSpots, forecasts, activeDateKey, surferPrefs, horizon]
  );

  // Strictly Top #1 in large hero + Next #2 and #3 smaller below
  const topPick = rankedChosen[0] ?? null;
  const runnerUps = rankedChosen.slice(1, 3);

  const topDistanceKm =
    topPick && userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, topPick.spot.lat, topPick.spot.lng)
      : null;

  const topWebcam = useMemo(
    () => (topPick ? getSpotWebcams(topPick.spot) : null),
    [topPick]
  );

  const windToneClass = (q: string) => {
    if (q === 'glassy' || q === 'offshore') return 'text-[#2DD4BF]';
    if (q === 'cross') return 'text-[#F0A53A]';
    return 'text-[#FB7185]';
  };

  return (
    <div className="space-y-8">
      {/* Quiet Top Row: Date Context + Horizon Switch */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#94ACB9]">
          <span className="font-semibold text-[#F8FBFE]">
            {horizon === 'today' ? 'Aujourd’hui' : 'Demain matin'}
          </span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span>{formatFrenchDateLabel(activeDateKey)}</span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span className="font-mono tabular-nums">
            {chosenSpots.length} {chosenSpots.length > 1 ? 'spots préférés' : 'spot préféré'}
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#071119] border border-white/12 rounded-xl">
          <button
            type="button"
            onClick={() => setHorizon('today')}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
              horizon === 'today'
                ? 'surf-btn-primary font-semibold'
                : 'text-[#CBD8E1] hover:text-white font-medium'
            }`}
          >
            Aujourd’hui
          </button>
          <button
            type="button"
            onClick={() => setHorizon('tomorrow')}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
              horizon === 'tomorrow'
                ? 'surf-btn-primary font-semibold'
                : 'text-[#CBD8E1] hover:text-white font-medium'
            }`}
          >
            Demain matin
          </button>
        </div>
      </div>

      {/* #1 Best Favorite Spot — Single Dominant Focal Anchor */}
      <section className="relative rounded-3xl overflow-hidden border border-white/15 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.14)] min-h-[440px] sm:min-h-[490px] flex flex-col justify-between">
        <SpotImage
          src={topPick?.spot.imageUrl || ''}
          alt={
            topPick
              ? `${topPick.spot.town} — ${topPick.spot.name}`
              : 'Carte marine d’orientation côtière'
          }
          title={topPick ? `${topPick.spot.town} — ${topPick.spot.name}` : 'Ça Surf ?'}
          lat={topPick?.spot.lat}
          lng={topPick?.spot.lng}
          offshoreDeg={topPick?.spot.offshoreDeg}
          idealSwellDeg={topPick?.spot.idealSwellDeg}
          breakType={topPick?.spot.breakType}
          showSourceTag
          className="absolute inset-0 w-full h-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050C12]/95 via-[#07131D]/74 to-[#07131D]/28" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050C12]/96 via-[#06111A]/25 to-[#060F16]/35" />

        {/* Main Hero Content */}
        <div className="relative z-10 p-6 sm:p-10 flex-1 flex flex-col justify-end gap-7">
          {loadingForecasts && !topPick ? (
            <div className="space-y-3 animate-pulse max-w-xl">
              <div className="h-4 bg-white/15 rounded w-48" />
              <div className="h-14 bg-white/15 rounded w-3/4" />
              <div className="h-4 bg-white/15 rounded w-full" />
            </div>
          ) : topPick ? (
            <>
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-7">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2.5 flex-wrap text-xs sm:text-sm font-medium text-[#F7C266]">
                    <span>Meilleur spot n°1</span>
                    {topDistanceKm !== null && (
                      <>
                        <span aria-hidden="true" className="text-white/35">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#4AE8D1]">
                          <MapPin className="w-3.5 h-3.5" />
                          {topDistanceKm} km
                        </span>
                      </>
                    )}
                    <span aria-hidden="true" className="text-white/35">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-[#F3F7FA]">
                      {topPick.recommendation.windowLabel}
                    </span>
                    <span aria-hidden="true" className="text-white/35">
                      ·
                    </span>
                    <span>
                      {
                        scoreLabelFr(
                          topPick.recommendation.avgScore,
                          topPick.recommendation.avgWaveHeight
                        ).label
                      }
                    </span>
                  </div>

                  <h1 className="mt-2 font-display text-5xl sm:text-6xl lg:text-[68px] font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.95] drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)]">
                    {topPick.spot.town} — {topPick.spot.name}
                  </h1>

                  <p className="mt-3.5 text-sm sm:text-base text-[#D3E0E8] leading-relaxed max-w-xl">
                    {topPick.recommendation.coherenceNote}
                  </p>

                  <div className="mt-6 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onSelectSpot(topPick.spot.id)}
                      className="surf-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap shrink-0"
                    >
                      Voir le détail & Check Parking
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    {topWebcam && (
                      <a
                        href={topWebcam.primaryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
                      >
                        <Video className="w-4 h-4 text-[#2DD4BF]" />
                        Webcam Live
                        <ExternalLink className="w-3.5 h-3.5 text-[#94ACB9]" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <SurfScoreDial score={topPick.recommendation.avgScore} size="lg" />
                </div>
              </div>

              {/* Integrated Single-Line Telemetry Footer Inside Hero (No Duplicate Card Below) */}
              <div className="pt-5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <div className="text-[11px] text-[#8AA6B7]">Houle & période</div>
                  <div className="mt-1 font-mono tabular-nums text-base sm:text-lg font-semibold text-[#38BDF8]">
                    {topPick.recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m{' '}
                    <span className="text-[#F8FBFE]">· {topPick.recommendation.avgSwellPeriod} s</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8AA6B7]">Vent</div>
                  <div
                    className={`mt-1 font-mono tabular-nums text-base sm:text-lg font-semibold ${windToneClass(
                      topPick.recommendation.windQuality
                    )}`}
                  >
                    {topPick.recommendation.avgWindSpeed} km/h{' '}
                    {degreesToCompass(topPick.recommendation.windDirection)}{' '}
                    <span className="text-xs font-sans font-medium">
                      ({windQualityLabelFr(topPick.recommendation.windQuality)})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8AA6B7]">Marée idéale</div>
                  <div className="mt-1 text-sm sm:text-base font-medium text-[#F8FBFE] truncate">
                    {topPick.spot.idealTide}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8AA6B7]">Eau & combinaison</div>
                  <div className="mt-1 font-mono tabular-nums text-sm sm:text-base font-medium text-[#F8FBFE] truncate">
                    {topPick.recommendation.waterTemp !== null
                      ? `${topPick.recommendation.waterTemp.toFixed(1).replace('.', ',')}°C · `
                      : ''}
                    <span className="font-sans text-[#CBD8E1]">
                      {topPick.recommendation.wetsuitLabel}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="max-w-xl">
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.98]">
                Choisissez vos spots préférés
              </h1>
              <p className="mt-3 text-sm text-[#CBD8E1]">
                Ajoutez vos spots habituels pour voir ici le meilleur spot du jour et les deux
                suivants.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('spots')}
                className="surf-btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap shrink-0"
              >
                <Compass className="w-4 h-4" />
                Choisir mes spots
              </button>
            </div>
          )}
        </div>
      </section>

      {/* #2 and #3 Next Best Favorite Spots — Compact 2-Column Pair */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
            Les deux suivants dans vos favoris
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('spots')}
              className="font-semibold text-[#F7C266] hover:underline whitespace-nowrap shrink-0"
            >
              Gérer mes favoris ({chosenSpots.length})
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('profile')}
              className="inline-flex items-center gap-1.5 text-[#94ACB9] hover:text-[#F8FBFE] transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Préférences
            </button>
          </div>
        </div>

        {runnerUps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {runnerUps.map(({ spot, recommendation }, idx) => {
              const dist = userLocation
                ? haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
                : null;
              return (
                <article
                  key={spot.id}
                  onClick={() => onSelectSpot(spot.id)}
                  className="surf-card-interactive rounded-2xl overflow-hidden cursor-pointer group flex flex-col"
                >
                  <div className="relative h-40 overflow-hidden">
                    <SpotImage
                      src={spot.imageUrl}
                      alt={`${spot.town} — ${spot.name}`}
                      title={spot.name}
                      lat={spot.lat}
                      lng={spot.lng}
                      offshoreDeg={spot.offshoreDeg}
                      idealSwellDeg={spot.idealSwellDeg}
                      breakType={spot.breakType}
                      className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08131C] via-[#08131C]/35 to-transparent" />
                    <div className="absolute bottom-3.5 left-5 right-5 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-white/75">
                          <span className="font-mono font-semibold text-[#F7C266]">#{idx + 2}</span>
                          <span>{spot.region}</span>
                          {dist !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-[#4AE8D1]">
                                {dist} km
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display text-2xl font-extrabold tracking-tight text-white truncate leading-tight">
                          {spot.town} — {spot.name}
                        </h3>
                      </div>

                      <div className="font-display text-3xl font-extrabold tabular-nums text-[#F7C266] shrink-0 leading-none">
                        {recommendation.avgScore.toFixed(1).replace('.', ',')}
                        <span className="text-xs font-mono font-normal text-white/70">/10</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-mono tabular-nums text-xs sm:text-sm text-[#D3E0E8]">
                      <span className="font-semibold text-[#F8FBFE]">
                        {recommendation.windowLabel}
                      </span>
                      <span className="mx-2 text-white/25">·</span>
                      <span>
                        {recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m (
                        {recommendation.avgSwellPeriod} s)
                      </span>
                      <span className="mx-2 text-white/25">·</span>
                      <span className={windToneClass(recommendation.windQuality)}>
                        {recommendation.avgWindSpeed} km/h{' '}
                        {degreesToCompass(recommendation.windDirection)}{' '}
                        {windQualityLabelFr(recommendation.windQuality)}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#94ACB9] group-hover:text-[#F8FBFE] transition-colors whitespace-nowrap shrink-0">
                      Détail
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="surf-card rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap text-sm text-[#A9C0CE]">
            <span>
              Ajoutez au moins 3 spots préférés pour comparer votre n°1 avec les deux suivants.
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('spots')}
              className="surf-btn-glass inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#F8FBFE] rounded-xl whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#F0A53A]" />
              Ajouter des favoris
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
