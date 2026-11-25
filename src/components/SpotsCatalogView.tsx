import { useMemo, useState } from 'react';
import {
  Check,
  Compass,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  Search,
} from 'lucide-react';
import { BOARD_TYPE_LABELS, SURFER_LEVEL_LABELS } from '../data/spots';
import {
  degreesToCompass,
  findBestWindowForSpot,
  getLocalDateKey,
  haversineKm,
  scoreLabelFr,
  searchCoastalLocation,
  windQualityLabelFr,
  type GeoSearchResult,
} from '../lib/surfEngine';
import type {
  SpotForecast,
  SurferPreferences,
  SurfSpot,
  UserLocation,
} from '../types/surf';
import { SpotImage } from './SpotImage';

const QUICK_COASTAL_ANCHORS: Array<{ label: string; lat: number; lng: number }> = [
  { label: 'Crozon', lat: 48.245, lng: -4.489 },
  { label: 'Brest', lat: 48.39, lng: -4.486 },
  { label: 'Quimper / La Torche', lat: 47.996, lng: -4.102 },
  { label: 'Quiberon / Lorient', lat: 47.748, lng: -3.37 },
  { label: 'Hossegor / Biarritz', lat: 43.58, lng: -1.49 },
  { label: 'Lacanau / Bordeaux', lat: 44.98, lng: -1.07 },
];

interface SpotsCatalogViewProps {
  spots: SurfSpot[];
  favoriteSpotIds: string[];
  forecasts: Record<string, SpotForecast>;
  loadingForecasts: boolean;
  surferPrefs: SurferPreferences;
  userLocation: UserLocation | null;
  geoStatus: 'idle' | 'locating' | 'granted' | 'denied' | 'error';
  geoError: string;
  radiusKm?: number;
  isSignedIn: boolean;
  onRequestGps: () => void;
  onSetManualLocation: (loc: UserLocation) => void;
  onOpenOtherSpotsSearch: () => void;
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
  userLocation,
  geoStatus,
  geoError,
  radiusKm = 100,
  isSignedIn,
  onRequestGps,
  onSetManualLocation,
  onOpenOtherSpotsSearch,
  onSelectSpot,
  onToggleFavorite,
  onOpenAddSpot,
  onRequireAuth,
  onDoneChoosing,
}: SpotsCatalogViewProps) {
  const [sortBy, setSortBy] = useState<'score' | 'distance'>('score');
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [onlyCoherent, setOnlyCoherent] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<GeoSearchResult[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);

  const todayKey = useMemo(() => getLocalDateKey(0), []);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cityQuery.trim().length < 2) return;
    setSearchingCity(true);
    try {
      const res = await searchCoastalLocation(cityQuery);
      setCityResults(res);
    } finally {
      setSearchingCity(false);
    }
  };

  const nearbyEnriched = useMemo(() => {
    return spots
      .map((spot) => {
        const distanceKm = userLocation
          ? haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
          : null;
        const forecast = forecasts[spot.id];
        const bestToday = findBestWindowForSpot(spot, forecast, todayKey, surferPrefs);
        return { spot, distanceKm, forecast, bestToday };
      })
      .filter(({ spot, distanceKm, bestToday }) => {
        if (userLocation && distanceKm !== null && distanceKm > radiusKm) {
          return false;
        }
        if (onlyChosen && !favoriteSpotIds.includes(spot.id)) return false;
        if (onlyCoherent && bestToday?.fitStatus === 'challenging') return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'distance' && a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        return (b.bestToday?.avgScore ?? 0) - (a.bestToday?.avgScore ?? 0);
      });
  }, [
    spots,
    userLocation,
    radiusKm,
    forecasts,
    todayKey,
    surferPrefs,
    onlyChosen,
    onlyCoherent,
    favoriteSpotIds,
    sortBy,
  ]);

  const totalWithinRadius = useMemo(() => {
    if (!userLocation) return spots.length;
    return spots.filter(
      (s) => haversineKm(userLocation.lat, userLocation.lng, s.lat, s.lng) <= radiusKm
    ).length;
  }, [spots, userLocation, radiusKm]);

  const outsideRadiusCount = Math.max(0, spots.length - totalWithinRadius);

  const windToneClass = (q: string) => {
    if (q === 'glassy' || q === 'offshore') return 'text-[#2DD4BF]';
    if (q === 'cross') return 'text-[#F7C266]';
    return 'text-[#FB7185]';
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4AE8D1]">
            <LocateFixed className="w-3.5 h-3.5" />
            Radar GPS · Rayon {radiusKm} km · Open-Meteo Marine
          </div>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.98]">
            {userLocation
              ? `${totalWithinRadius} spot${totalWithinRadius > 1 ? 's' : ''} à moins de ${radiusKm} km`
              : `Vos spots à moins de ${radiusKm} km`}
          </h1>
          <p className="mt-2.5 text-sm text-[#A9C0CE]">
            {userLocation ? (
              <>
                Autour de <span className="text-[#F8FBFE] font-medium">{userLocation.label}</span>,
                classés pour votre profil{' '}
                <span className="text-[#F8FBFE] font-medium">
                  {SURFER_LEVEL_LABELS[surferPrefs.surferLevel].label} (
                  {BOARD_TYPE_LABELS[surferPrefs.boardType].label})
                </span>
                .
              </>
            ) : (
              <>
                Activez la localisation GPS pour afficher uniquement les spots à moins de {radiusKm}{' '}
                km, ou utilisez le menu de recherche pour explorer les {spots.length} spots de la
                côte.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenOtherSpotsSearch}
            className="surf-btn-teal inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            {userLocation && outsideRadiusCount > 0
              ? `Autres spots (+${radiusKm} km · ${outsideRadiusCount})`
              : 'Rechercher un autre spot'}
          </button>
          <button
            type="button"
            onClick={onDoneChoosing}
            className="surf-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
          >
            Voir ma session ({favoriteSpotIds.length})
          </button>
        </div>
      </div>

      {/* GPS Location Radar Bar */}
      <section
        className={`${
          userLocation ? 'surf-card-teal' : 'surf-card-amber'
        } rounded-2xl p-4 sm:p-5 space-y-4`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                userLocation
                  ? 'bg-[#2DD4BF]/15 text-[#4AE8D1] border border-[#2DD4BF]/30'
                  : 'bg-[#F0A53A]/15 text-[#F7C266] border border-[#F0A53A]/35'
              }`}
            >
              {geoStatus === 'locating' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <MapPin className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#F8FBFE] truncate">
                {userLocation
                  ? userLocation.source === 'gps'
                    ? `GPS actif · ${userLocation.label}`
                    : `Zone choisie · ${userLocation.label}`
                  : 'Localisation GPS non activée'}
              </div>
              <div className="text-xs text-[#A9C0CE]">
                {geoStatus === 'locating'
                  ? 'Acquisition de votre position GPS en cours...'
                  : userLocation
                  ? `Affichage filtré dans un rayon de ${radiusKm} km (${userLocation.lat.toFixed(2)}°N, ${Math.abs(userLocation.lng).toFixed(2)}°${userLocation.lng < 0 ? 'O' : 'E'})`
                  : `Localisez-vous pour filtrer automatiquement les spots à moins de ${radiusKm} km.`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onRequestGps}
              disabled={geoStatus === 'locating'}
              className="surf-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {geoStatus === 'locating'
                ? 'Localisation...'
                : userLocation?.source === 'gps'
                ? 'Actualiser mon GPS'
                : 'Me localiser (GPS)'}
            </button>

            <button
              type="button"
              onClick={() => setShowCityPicker((v) => !v)}
              className="surf-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
            >
              <Compass className="w-3.5 h-3.5 text-[#2DD4BF]" />
              {showCityPicker ? 'Fermer' : 'Définir une ville'}
            </button>
          </div>
        </div>

        {geoError && (
          <div className="text-xs text-[#F7C266] bg-[#071119]/70 border border-[#F0A53A]/30 rounded-xl px-3.5 py-2.5">
            {geoError}
          </div>
        )}

        {/* Manual city / coastal anchor picker (always available or shown on GPS error) */}
        {(showCityPicker || geoStatus === 'denied' || geoStatus === 'error') && (
          <div className="pt-3 border-t border-white/10 space-y-3">
            <form onSubmit={handleCitySearch} className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[#6D8796] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Rechercher votre ville de départ (ex: Crozon, Brest, Biarritz...)"
                  className="surf-input w-full pl-9 pr-3 py-2 text-xs rounded-xl"
                />
              </div>
              <button
                type="submit"
                disabled={searchingCity}
                className="surf-btn-glass px-3.5 py-2 text-xs font-semibold text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
              >
                {searchingCity ? 'Recherche...' : 'Valider la ville'}
              </button>
            </form>

            {cityResults.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {cityResults.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSetManualLocation({
                        lat: r.latitude,
                        lng: r.longitude,
                        label: r.admin1 ? `${r.name} (${r.admin1})` : r.name,
                        source: 'city',
                      });
                      setCityResults([]);
                      setCityQuery('');
                      setShowCityPicker(false);
                    }}
                    className="px-3 py-1.5 text-xs bg-[#2DD4BF]/15 text-[#4AE8D1] border border-[#2DD4BF]/35 rounded-xl hover:bg-[#2DD4BF]/25 transition-colors"
                  >
                    {r.name}
                    {r.admin1 ? `, ${r.admin1}` : ''}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#8AA6B7] mr-1">Accès rapide :</span>
              {QUICK_COASTAL_ANCHORS.map((anchor) => (
                <button
                  key={anchor.label}
                  type="button"
                  onClick={() => {
                    onSetManualLocation({
                      lat: anchor.lat,
                      lng: anchor.lng,
                      label: anchor.label,
                      source: 'city',
                    });
                    setShowCityPicker(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white/5 hover:bg-white/12 text-[#CBD8E1] border border-white/10 rounded-lg transition-colors"
                >
                  {anchor.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Controls Bar */}
      <div className="surf-card rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {userLocation && (
            <div className="flex items-center gap-1 p-1 bg-[#071119] border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setSortBy('score')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  sortBy === 'score'
                    ? 'surf-btn-primary font-semibold'
                    : 'text-[#94ACB9] hover:text-[#F3F7FA] font-medium'
                }`}
              >
                Meilleure note
              </button>
              <button
                type="button"
                onClick={() => setSortBy('distance')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  sortBy === 'distance'
                    ? 'surf-btn-primary font-semibold'
                    : 'text-[#94ACB9] hover:text-[#F3F7FA] font-medium'
                }`}
              >
                Les plus proches (km)
              </button>
            </div>
          )}

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
            Mes spots choisis ({favoriteSpotIds.length}/15)
          </button>
        </div>

        <button
          type="button"
          onClick={() => (isSignedIn ? onOpenAddSpot() : onRequireAuth())}
          className="surf-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-[#F0A53A]" />
          Ajouter un spot GPS
        </button>
      </div>

      {/* Nearby Spots Grid */}
      {loadingForecasts && nearbyEnriched.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-76 surf-card rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : nearbyEnriched.length === 0 ? (
        <div className="surf-card rounded-2xl p-8 sm:p-10 text-center space-y-4">
          <div className="space-y-1.5">
            <p className="font-display text-2xl font-bold text-[#F8FBFE]">
              {userLocation && totalWithinRadius === 0
                ? `Aucun spot de surf répertorié à moins de ${radiusKm} km de ${userLocation.label}`
                : 'Aucun spot ne correspond aux filtres sélectionnés'}
            </p>
            <p className="text-sm text-[#94ACB9] max-w-lg mx-auto">
              Ouvrez le menu de recherche dédié pour explorer les {spots.length} spots de toute la
              côte, ou choisissez une ville côtière comme point de départ.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
            <button
              type="button"
              onClick={onOpenOtherSpotsSearch}
              className="surf-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl"
            >
              <Search className="w-3.5 h-3.5" />
              Rechercher parmi les {spots.length} spots
            </button>
            <button
              type="button"
              onClick={() => setShowCityPicker(true)}
              className="surf-btn-glass inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#F3F7FA] rounded-xl"
            >
              Choisir une côte (Crozon, Biarritz...)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {nearbyEnriched.map(({ spot, distanceKm, forecast, bestToday }) => {
            const isChosen = favoriteSpotIds.includes(spot.id);
            const cur = forecast?.current;
            const verdict = bestToday
              ? scoreLabelFr(bestToday.avgScore, bestToday.avgWaveHeight)
              : null;
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
                    lat={spot.lat}
                    lng={spot.lng}
                    offshoreDeg={spot.offshoreDeg}
                    idealSwellDeg={spot.idealSwellDeg}
                    breakType={spot.breakType}
                    className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08131C] via-[#08131C]/35 to-transparent" />

                  {distanceKm !== null && (
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#060F16]/80 backdrop-blur-md border border-white/15 text-[11px] font-mono font-semibold tabular-nums text-[#4AE8D1]">
                      <MapPin className="w-3 h-3" />
                      {distanceKm} km
                    </div>
                  )}

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
                          <div className="text-[11px] text-[#7D9BAC]">Vagues est.</div>
                          <div className="font-mono tabular-nums font-semibold text-[#38BDF8]">
                            {cur.waveHeight.toFixed(1).replace('.', ',')} m ·{' '}
                            {Math.round(cur.swellPeriod)}s
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
                        {verdict ? verdict.label : 'En cours'}
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
