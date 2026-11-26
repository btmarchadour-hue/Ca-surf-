import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  ExternalLink,
  Plus,
  Shield,
  Trash2,
  Video,
} from 'lucide-react';
import { BOARD_TYPE_LABELS, SURFER_LEVEL_LABELS } from '../data/spots';
import {
  degreesToCompass,
  exposureLabelFr,
  findBestWindowForSpot,
  findShelterFallback,
  formatFrenchDateLabel,
  formatShortDayHeader,
  getForecastDateKeys,
  getSpotWebcams,
  recommendWetsuitFr,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type {
  ParkingReportRecord,
  SpotForecast,
  SurferPreferences,
  SurfSpot,
} from '../types/surf';
import { HourlyForecastChart } from './HourlyForecastChart';
import { ParkingCheckCard, type ParkingCheckSubmitPayload } from './ParkingCheckCard';
import { SpotImage } from './SpotImage';
import { SurfScoreDial } from './SurfScoreDial';
import { WindSwellCompass } from './WindSwellCompass';

interface SpotDetailPanelProps {
  spot: SurfSpot;
  allSpots: SurfSpot[];
  forecast: SpotForecast | undefined;
  allForecasts: Record<string, SpotForecast>;
  isFavorite: boolean;
  surferPrefs: SurferPreferences;
  parkingReports: ParkingReportRecord[];
  currentUserId: string | null;
  isSignedIn: boolean;
  onBack: () => void;
  onSelectSpot: (spotId: string) => void;
  onToggleFavorite: (spotId: string) => void;
  onDeleteCustom?: (spotId: string) => void;
  onPlanSession?: (spotId: string, slotLabel: string) => void;
  onPublishParkingReport: (payload: ParkingCheckSubmitPayload) => Promise<void>;
  onDeleteParkingReport: (memberUid: string, spotId?: string) => Promise<void>;
  onNavigateCrew: () => void;
  hasActiveCrew: boolean;
  initialDateKey?: string;
}

export function SpotDetailPanel({
  spot,
  allSpots,
  forecast,
  allForecasts,
  isFavorite,
  surferPrefs,
  parkingReports,
  currentUserId,
  isSignedIn,
  onBack,
  onSelectSpot,
  onToggleFavorite,
  onDeleteCustom,
  onPlanSession,
  onPublishParkingReport,
  onDeleteParkingReport,
  onNavigateCrew,
  hasActiveCrew,
  initialDateKey,
}: SpotDetailPanelProps) {
  const dateKeys = useMemo(() => getForecastDateKeys(7), []);
  const [selectedDate, setSelectedDate] = useState(
    initialDateKey && dateKeys.includes(initialDateKey) ? initialDateKey : dateKeys[0]
  );
  const [sessionConfirmed, setSessionConfirmed] = useState(false);

  useEffect(() => {
    if (initialDateKey && dateKeys.includes(initialDateKey)) {
      setSelectedDate(initialDateKey);
    } else {
      setSelectedDate(dateKeys[0]);
    }
  }, [initialDateKey, spot.id, dateKeys]);

  const dailyScoreMap = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const dk of dateKeys) {
      const w = findBestWindowForSpot(spot, forecast, dk, surferPrefs, {
        includePastToday: dk !== dateKeys[0],
      });
      if (w) scores[dk] = w.avgScore;
    }
    return scores;
  }, [spot, forecast, dateKeys, surferPrefs]);

  const dayPoints = useMemo(
    () => (forecast ? forecast.hourly.filter((p) => p.dateKey === selectedDate) : []),
    [forecast, selectedDate]
  );

  const bestWindow = useMemo(
    () =>
      findBestWindowForSpot(spot, forecast, selectedDate, surferPrefs, {
        includePastToday: selectedDate !== dateKeys[0],
      }),
    [spot, forecast, selectedDate, surferPrefs, dateKeys]
  );

  const shelterFallback = useMemo(
    () =>
      findShelterFallback(spot, bestWindow, allSpots, allForecasts, selectedDate, surferPrefs, {
        includePastToday: selectedDate !== dateKeys[0],
      }),
    [spot, bestWindow, allSpots, allForecasts, selectedDate, surferPrefs, dateKeys]
  );

  const webcam = useMemo(() => getSpotWebcams(spot), [spot]);

  const spotReports = useMemo(
    () => parkingReports.filter((r) => r.spotId === spot.id),
    [parkingReports, spot.id]
  );

  const daylight = forecast?.daylightByDate[selectedDate];
  const current = forecast?.current;

  const breakTypeFr =
    spot.breakType === 'reef'
      ? 'Reef break'
      : spot.breakType === 'point'
      ? 'Point break'
      : 'Beach break';

  const handlePlan = () => {
    if (!onPlanSession || !bestWindow) return;
    onPlanSession(spot.id, bestWindow.windowLabel);
    setSessionConfirmed(true);
    setTimeout(() => setSessionConfirmed(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#94ACB9] hover:text-[#F8FBFE] transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href={webcam.primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
          >
            <Video className="w-3.5 h-3.5 text-[#2DD4BF]" />
            Webcam Live
            <ExternalLink className="w-3 h-3 text-[#94ACB9]" />
          </a>

          {hasActiveCrew && bestWindow && onPlanSession && (
            <button
              type="button"
              onClick={handlePlan}
              className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-[#2DD4BF]" />
              {sessionConfirmed
                ? 'Annoncé au groupe'
                : `J’y vais (${bestWindow.windowLabel})`}
            </button>
          )}
          {spot.isCustom && onDeleteCustom && (
            <button
              type="button"
              onClick={() => onDeleteCustom(spot.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#FB7185] bg-rose-500/10 border border-rose-500/25 rounded-xl hover:bg-rose-500/20 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleFavorite(spot.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${
              isFavorite
                ? 'bg-[#2DD4BF]/15 text-[#4AE8D1] border border-[#2DD4BF]/35 hover:bg-[#2DD4BF]/25'
                : 'surf-btn-primary'
            }`}
          >
            {isFavorite ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isFavorite ? 'Dans mes spots choisis' : 'Choisir ce spot'}
          </button>
        </div>
      </div>

      {/* Hero Split Banner */}
      <div className="surf-card rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 relative min-h-[260px]">
          <SpotImage
            src={spot.imageUrl}
            alt={`${spot.town} — ${spot.name}`}
            title={spot.name}
            lat={spot.lat}
            lng={spot.lng}
            offshoreDeg={spot.offshoreDeg}
            idealSwellDeg={spot.idealSwellDeg}
            breakType={spot.breakType}
            showSourceTag
            className="w-full h-full"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060E15]/95 via-[#060E15]/35 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <div className="text-xs font-medium text-[#F7C266]">
              {spot.region} · {breakTypeFr} · {SURFER_LEVEL_LABELS[spot.difficulty].label}
            </div>
            <h1 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-balance leading-[0.96]">
              {spot.town} — {spot.name}
            </h1>
            <p className="mt-2 text-xs text-white/85 leading-relaxed">{spot.waveCharacter}</p>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-[#8AA6B7]">
                Meilleur créneau ({formatFrenchDateLabel(selectedDate)}) · {spot.apiProvider}
              </div>
              <div className="mt-1 font-display text-4xl font-extrabold tracking-tight tabular-nums text-[#F8FBFE] leading-none">
                {bestWindow ? bestWindow.windowLabel : '—'}
              </div>
              {bestWindow && (
                <>
                  <p className="mt-2 text-sm text-[#D3E0E8]">{bestWindow.summary}</p>
                  <p
                    className={`mt-1.5 text-xs font-medium ${
                      bestWindow.fitStatus === 'challenging'
                        ? 'text-[#FB7185]'
                        : bestWindow.fitStatus === 'ideal'
                        ? 'text-[#2DD4BF]'
                        : 'text-[#F7C266]'
                    }`}
                  >
                    {bestWindow.coherenceNote}
                  </p>
                </>
              )}
            </div>
            {bestWindow && <SurfScoreDial score={bestWindow.avgScore} size="md" />}
          </div>

          {current ? (
            <div className="pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[#8AA6B7]">
                  {current.offshoreWaveHeight - current.waveHeight >= 0.35
                    ? 'Vagues estimées au bord'
                    : 'Houle live'}
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#38BDF8] leading-none">
                  {current.waveHeight.toFixed(1).replace('.', ',')} m
                </div>
                <div className="mt-1 text-xs font-mono tabular-nums text-[#94ACB9]">
                  {Math.round(current.swellPeriod)} s · {degreesToCompass(current.swellDirection)}
                  {current.offshoreWaveHeight - current.waveHeight >= 0.35 && (
                    <span className="block text-[11px] font-sans text-[#F7C266]/90 mt-0.5">
                      Abrité ({current.offshoreWaveHeight.toFixed(1).replace('.', ',')} m au large)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#8AA6B7]">Vent live</div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#F8FBFE] leading-none">
                  {current.windSpeed} km/h {degreesToCompass(current.windDirection)}
                </div>
                <div className="mt-1 text-xs font-medium text-[#2DD4BF]">
                  {windQualityLabelFr(current.windQuality)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#8AA6B7]">Eau & combi</div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#F8FBFE] leading-none">
                  {current.waterTemp !== null
                    ? `${current.waterTemp.toFixed(1).replace('.', ',')}°C`
                    : `${current.airTemp}°C air`}
                </div>
                <div className="mt-1 text-xs text-[#94ACB9] truncate">
                  {recommendWetsuitFr(current.waterTemp)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#8AA6B7]">Jour (soleil)</div>
                <div className="mt-1 font-mono tabular-nums text-base font-semibold text-[#F8FBFE]">
                  {daylight
                    ? `${daylight.sunriseIso.split('T')[1]?.slice(0, 5)} – ${daylight.sunsetIso
                        .split('T')[1]
                        ?.slice(0, 5)}`
                    : '—'}
                </div>
                <div className="mt-0.5 text-xs text-[#94ACB9]">Lever / coucher</div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-sm text-[#94ACB9]">
              Chargement des relevés Open-Meteo Marine...
            </div>
          )}
        </div>
      </div>

      {/* Mode Repli automatique à proximité */}
      {shelterFallback && (
        <section
          className={`${
            shelterFallback.isActiveAlert ? 'surf-card-teal' : 'surf-card'
          } rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4`}
        >
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#4AE8D1]">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              {shelterFallback.isActiveAlert
                ? `Mode Repli activé · ${shelterFallback.distanceKm} km`
                : `Plan Repli le plus proche si le vent tourne · ${shelterFallback.distanceKm} km`}
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
                {shelterFallback.spot.town} — {shelterFallback.spot.name}
              </h2>
              <span className="font-display text-xl font-extrabold tabular-nums text-[#F7C266]">
                {shelterFallback.recommendation.avgScore.toFixed(1).replace('.', ',')}/10
              </span>
              <span className="font-mono tabular-nums text-xs text-[#CBD8E1]">
                {shelterFallback.recommendation.windowLabel} ·{' '}
                {shelterFallback.recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m ·{' '}
                {windQualityLabelFr(shelterFallback.recommendation.windQuality)}
              </span>
            </div>
            <p className="text-xs text-[#A9C0CE] leading-relaxed">{shelterFallback.reason}</p>
          </div>

          <button
            type="button"
            onClick={() => onSelectSpot(shelterFallback.spot.id)}
            className="surf-btn-teal inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 self-start md:self-center"
          >
            Basculer sur ce repli
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>
      )}

      {/* Hourly Forecast + Wind Compass & Webcams */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 surf-card rounded-2xl p-6">
          <div className="space-y-4 mb-5">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
                  Prévisions heure par heure (7 jours)
                </h2>
                <p className="text-xs text-[#8AA6B7] mt-0.5">
                  Choisissez un jour puis cliquez sur une heure pour inspecter houle, période et vent.
                </p>
              </div>
              <span className="text-xs font-medium text-[#F7C266]">
                {formatFrenchDateLabel(selectedDate)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-[#071119] border border-white/10 rounded-xl overflow-x-auto">
              {dateKeys.map((dk) => {
                const header = formatShortDayHeader(dk);
                const dayScore = dailyScoreMap[dk];
                const isActive = selectedDate === dk;
                return (
                  <button
                    key={dk}
                    type="button"
                    onClick={() => setSelectedDate(dk)}
                    className={`flex-1 min-w-[78px] px-2.5 py-2 rounded-lg transition-all text-left whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'surf-btn-primary font-semibold'
                        : 'text-[#94ACB9] hover:text-[#F3F7FA] hover:bg-white/5 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px]">{header.weekday}</span>
                      {dayScore !== undefined && (
                        <span
                          className={`font-mono tabular-nums text-[11px] font-bold ${
                            isActive
                              ? 'text-[#060D13]'
                              : dayScore >= 7.5
                              ? 'text-[#2DD4BF]'
                              : dayScore >= 5.8
                              ? 'text-[#F7C266]'
                              : 'text-[#7D9BAC]'
                          }`}
                        >
                          {dayScore.toFixed(1).replace('.', ',')}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] font-mono tabular-nums mt-0.5 ${
                        isActive ? 'text-[#060D13]/80' : 'text-[#6D8796]'
                      }`}
                    >
                      {header.dayNum}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <HourlyForecastChart points={dayPoints} bestWindow={bestWindow} />
        </div>

        <div className="xl:col-span-4 space-y-6">
          {/* Wind & Swell Compass */}
          <div className="surf-card rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
                Rose houle & vent
              </h2>
              <p className="text-xs text-[#8AA6B7] mt-0.5">
                Secteur turquoise : angle de vent offshore idéal sur ce spot.
              </p>
            </div>

            {current ? (
              <WindSwellCompass
                offshoreDeg={spot.offshoreDeg}
                windDirDeg={current.windDirection}
                windSpeedKmh={current.windSpeed}
                windQuality={current.windQuality}
                swellDirDeg={current.swellDirection}
                swellHeightM={current.waveHeight}
                swellPeriodS={current.swellPeriod}
              />
            ) : (
              <div className="py-8 text-sm text-[#94ACB9]">Données en chargement...</div>
            )}

            <div className="pt-4 border-t border-white/10 space-y-2.5 text-xs text-[#94ACB9]">
              <div className="flex justify-between gap-2">
                <span>Planches conseillées</span>
                <span className="font-medium text-[#F3F7FA] text-right">
                  {spot.bestBoards.map((b) => BOARD_TYPE_LABELS[b].label.split(' ')[0]).join(' · ')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Plage idéale du spot</span>
                <span className="font-mono tabular-nums font-medium text-[#F3F7FA]">
                  {spot.idealMinWave.toFixed(1).replace('.', ',')} m –{' '}
                  {spot.idealMaxWave.toFixed(1).replace('.', ',')} m
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Exposition houle</span>
                <span className="font-medium text-[#F3F7FA] text-right">
                  {exposureLabelFr(spot)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Marée conseillée</span>
                <span className="font-medium text-[#F3F7FA]">{spot.idealTide}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Coordonnées API</span>
                <span className="font-mono tabular-nums text-[#CBD8E1]">
                  {spot.lat.toFixed(3)}°N, {Math.abs(spot.lng).toFixed(3)}°
                  {spot.lng < 0 ? 'O' : 'E'}
                </span>
              </div>
            </div>
          </div>

          {/* Live Webcams Card */}
          <div className="surf-card rounded-2xl p-6 space-y-3.5">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-[#F0A53A]" />
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
                Voir le plan d’eau en direct
              </h2>
            </div>
            <p className="text-xs text-[#A9C0CE] leading-relaxed">{webcam.note}</p>
            <div className="flex flex-col gap-2.5 pt-1">
              <a
                href={webcam.primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="surf-btn-primary w-full inline-flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl"
              >
                <span className="truncate">{webcam.primaryLabel}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
              <a
                href={webcam.secondaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="surf-btn-glass w-full inline-flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-medium text-[#F3F7FA] rounded-xl"
              >
                <span className="truncate">{webcam.secondaryLabel}</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#94ACB9] shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Live On-Site Check Parking Section */}
      <ParkingCheckCard
        lockedSpot={spot}
        allSpots={allSpots}
        defaultWaveHeight={current?.waveHeight ?? bestWindow?.avgWaveHeight ?? 1.2}
        defaultWindFeel={current?.windQuality ?? bestWindow?.windQuality ?? 'offshore'}
        reports={spotReports}
        currentUserId={currentUserId}
        hasActiveCrew={hasActiveCrew}
        isSignedIn={isSignedIn}
        onPublish={onPublishParkingReport}
        onDeleteReport={onDeleteParkingReport}
        onNavigateCrew={onNavigateCrew}
      />
    </div>
  );
}
