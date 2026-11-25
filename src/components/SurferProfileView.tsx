import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  Compass,
  LogIn,
  LogOut,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  BOARD_TYPE_LABELS,
  getSmartWaveDefaults,
  IMG_QUIVER_BOARDS,
  SURF_REGIONS,
  SURFER_LEVEL_LABELS,
} from '../data/spots';
import {
  formatFrenchDateLabel,
  getLocalDateKey,
  rankSpotsForDate,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type {
  AlertLogRecord,
  BoardType,
  SpotForecast,
  SurferLevel,
  SurferPreferences,
  SurfSpot,
} from '../types/surf';
import { SpotImage } from './SpotImage';

interface SurferProfileViewProps {
  prefs: SurferPreferences;
  allSpots: SurfSpot[];
  favoriteSpotIds: string[];
  forecasts: Record<string, SpotForecast>;
  alertLogs: AlertLogRecord[];
  isSignedIn: boolean;
  userEmail: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSaveProfile: (next: SurferPreferences & { favoriteSpotIds: string[] }) => Promise<void>;
  onTriggerTestAlert: () => void;
  onDeleteAlertLog: (logId: string) => Promise<void>;
  onOpenCatalog: () => void;
}

const LEVELS: SurferLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const BOARDS: BoardType[] = ['longboard', 'midlength', 'fish', 'shortboard'];

export function SurferProfileView({
  prefs,
  allSpots,
  favoriteSpotIds,
  forecasts,
  alertLogs,
  isSignedIn,
  userEmail,
  onSignIn,
  onSignOut,
  onSaveProfile,
  onTriggerTestAlert,
  onDeleteAlertLog,
  onOpenCatalog,
}: SurferProfileViewProps) {
  const [draft, setDraft] = useState<SurferPreferences>(prefs);
  const [draftSpots, setDraftSpots] = useState<string[]>(favoriteSpotIds);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  useEffect(() => {
    setDraft(prefs);
  }, [prefs]);

  useEffect(() => {
    setDraftSpots(favoriteSpotIds);
  }, [favoriteSpotIds]);

  const handleLevelChange = (level: SurferLevel) => {
    const smart = getSmartWaveDefaults(level, draft.boardType);
    setDraft({
      ...draft,
      surferLevel: level,
      minWaveHeight: smart.minWaveHeight,
      maxWaveHeight: smart.maxWaveHeight,
      maxWindSpeed: smart.maxWindSpeed,
    });
  };

  const handleBoardChange = (board: BoardType) => {
    const smart = getSmartWaveDefaults(draft.surferLevel, board);
    setDraft({
      ...draft,
      boardType: board,
      minWaveHeight: smart.minWaveHeight,
      maxWaveHeight: smart.maxWaveHeight,
    });
  };

  const toggleDraftSpot = (spotId: string) => {
    setDraftSpots((prev) => {
      if (prev.includes(spotId)) return prev.filter((id) => id !== spotId);
      if (prev.length >= 15) return prev;
      return [...prev, spotId];
    });
  };

  const regionalQuickSpots = useMemo(() => {
    const inRegion = allSpots.filter(
      (s) => draft.homeRegion === 'Toutes' || s.region === draft.homeRegion
    );
    return inRegion.length > 0 ? inRegion : allSpots.slice(0, 8);
  }, [allSpots, draft.homeRegion]);

  const tomorrowKey = useMemo(() => getLocalDateKey(1), []);
  const tomorrowTop = useMemo(() => {
    const chosen = allSpots.filter((s) => draftSpots.includes(s.id));
    const list = rankSpotsForDate(chosen, forecasts, tomorrowKey, draft, {
      morningOnly: true,
      includePastToday: true,
    });
    return list[0] ?? null;
  }, [allSpots, draftSpots, forecasts, tomorrowKey, draft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveProfile({
        ...draft,
        onboardingCompleted: true,
        favoriteSpotIds: draftSpots,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2600);
    } finally {
      setSaving(false);
    }
  };

  const handleEnableBrowserNotifs = async () => {
    if (!('Notification' in window)) {
      setNotifStatus('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Photographic Quiver Hero Header */}
      <section className="surf-card rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 relative min-h-[240px]">
          <SpotImage
            src={IMG_QUIVER_BOARDS}
            alt="Planches de surf devant les dunes atlantiques au lever du jour"
            title="Mon Quiver"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060E15]/92 via-[#060E15]/25 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <div className="text-xs text-[#F7C266] font-semibold">
              Profil Surfeur · Quiver actif
            </div>
            <h1 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-none">
              {draft.displayName || 'Surfeur'}
            </h1>
            <div className="mt-1.5 text-xs text-white/85">
              {SURFER_LEVEL_LABELS[draft.surferLevel].label} ·{' '}
              {BOARD_TYPE_LABELS[draft.boardType].label} · {draftSpots.length} spots API
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="surfer-name"
                className="block text-xs font-medium text-[#CBD8E1] mb-1.5"
              >
                Prénom / Pseudo surfeur
              </label>
              <input
                id="surfer-name"
                type="text"
                maxLength={60}
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                placeholder="Ex. Lucas"
                className="surf-input w-full px-3.5 py-2.5 text-sm rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="home-region"
                className="block text-xs font-medium text-[#CBD8E1] mb-1.5"
              >
                Zone de surf principale
              </label>
              <select
                id="home-region"
                value={draft.homeRegion}
                onChange={(e) => setDraft({ ...draft, homeRegion: e.target.value })}
                className="surf-input w-full px-3.5 py-2.5 text-sm rounded-xl"
              >
                {SURF_REGIONS.filter((r) => r !== 'Toutes').map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
            {isSignedIn ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs text-[#94ACB9]">
                  Connecté : <span className="text-[#F8FBFE] font-medium">{userEmail}</span>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 text-xs text-[#94ACB9] hover:text-[#FB7185] transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-[#A9C0CE]">
                  Sauvegarde locale active — connectez Google pour synchroniser avec vos amis.
                </span>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="surf-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Connexion Google
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="surf-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {savedNotice && <Check className="w-4 h-4" />}
              {saving
                ? 'Enregistrement...'
                : savedNotice
                ? 'Profil enregistré'
                : 'Enregistrer mon profil'}
            </button>
          </div>
        </div>
      </section>

      {/* Step 1: Level & Quiver Selection */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surf-card rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
              01 · Mon niveau de surf
            </h2>
            <p className="text-xs text-[#8AA6B7] mt-0.5">
              Ajuste automatiquement la cohérence des spots et évite les conditions inadaptées.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEVELS.map((lvl) => {
              const active = draft.surferLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleLevelChange(lvl)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-[#F0A53A]/15 border-[#F0A53A] text-[#F8FBFE] shadow-[0_0_24px_-12px_rgba(240,165,58,0.65)]'
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

        <div className="surf-card rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
              02 · Ma planche principale (Quiver)
            </h2>
            <p className="text-xs text-[#8AA6B7] mt-0.5">
              Privilégie les vagues et les types de breaks qui marchent le mieux sous vos pieds.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BOARDS.map((board) => {
              const active = draft.boardType === board;
              return (
                <button
                  key={board}
                  type="button"
                  onClick={() => handleBoardChange(board)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-[#2DD4BF]/15 border-[#2DD4BF] text-[#F8FBFE] shadow-[0_0_24px_-12px_rgba(45,212,191,0.55)]'
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
      </section>

      {/* Step 2: Quick Free-API Spot Selection in Home Region */}
      <section className="surf-card rounded-2xl p-6 space-y-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
              03 · Mes spots choisis ({draftSpots.length} / 15)
            </h2>
            <p className="text-xs text-[#8AA6B7] mt-0.5">
              Sélection rapide pour la zone <strong className="text-[#F8FBFE]">{draft.homeRegion}</strong> —
              tous alimentés gratuitement par Open-Meteo Marine.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCatalog}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F7C266] hover:underline whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5" />
            Voir les {allSpots.length} spots API
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {regionalQuickSpots.map((spot) => {
            const active = draftSpots.includes(spot.id);
            const cur = forecasts[spot.id]?.current;
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => toggleDraftSpot(spot.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                  active
                    ? 'bg-[#2DD4BF]/12 border-[#2DD4BF]/50 text-[#F8FBFE]'
                    : 'bg-[#071119] border-white/10 text-[#CBD8E1] hover:border-white/25'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {spot.town} — {spot.name}
                  </div>
                  <div className="text-[11px] text-[#8AA6B7] font-mono tabular-nums mt-0.5">
                    {SURFER_LEVEL_LABELS[spot.difficulty].label} ·{' '}
                    {cur ? `${cur.waveHeight.toFixed(1).replace('.', ',')} m` : 'API live'}
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
      </section>

      {/* Step 3: Dawn Patrol Morning Alert Configuration */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 surf-card rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
                04 · Réglages de mon alerte matinale
              </h2>
              <p className="text-xs text-[#8AA6B7] mt-0.5">
                Déclenche le bulletin du meilleur spot & meilleur créneau à l’heure choisie.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={draft.alertEnabled}
                onChange={(e) => setDraft({ ...draft, alertEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/15 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F0A53A]" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="alert-time" className="block text-xs font-medium text-[#CBD8E1] mb-1.5">
                Heure du réveil surf
              </label>
              <input
                id="alert-time"
                type="time"
                value={draft.alertTime}
                onChange={(e) => setDraft({ ...draft, alertTime: e.target.value })}
                className="surf-input w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="max-wind" className="flex items-center justify-between text-xs font-medium text-[#CBD8E1] mb-1.5">
                <span>Vent maximum toléré</span>
                <span className="font-mono tabular-nums text-[#F7C266] font-semibold">
                  {draft.maxWindSpeed} km/h
                </span>
              </label>
              <input
                id="max-wind"
                type="range"
                min={10}
                max={45}
                step={1}
                value={draft.maxWindSpeed}
                onChange={(e) => setDraft({ ...draft, maxWindSpeed: Number(e.target.value) })}
                className="w-full mt-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="min-wave" className="flex items-center justify-between text-xs font-medium text-[#CBD8E1] mb-1.5">
                <span>Houle minimale</span>
                <span className="font-mono tabular-nums text-[#38BDF8] font-semibold">
                  {draft.minWaveHeight.toFixed(1).replace('.', ',')} m
                </span>
              </label>
              <input
                id="min-wave"
                type="range"
                min={0.4}
                max={2.5}
                step={0.1}
                value={draft.minWaveHeight}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDraft({
                    ...draft,
                    minWaveHeight: v,
                    maxWaveHeight: Math.max(draft.maxWaveHeight, v + 0.3),
                  });
                }}
                className="w-full mt-2"
              />
            </div>

            <div>
              <label htmlFor="max-wave" className="flex items-center justify-between text-xs font-medium text-[#CBD8E1] mb-1.5">
                <span>Houle maximale</span>
                <span className="font-mono tabular-nums text-[#38BDF8] font-semibold">
                  {draft.maxWaveHeight.toFixed(1).replace('.', ',')} m
                </span>
              </label>
              <input
                id="max-wave"
                type="range"
                min={0.8}
                max={5.0}
                step={0.1}
                value={draft.maxWaveHeight}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDraft({
                    ...draft,
                    maxWaveHeight: Math.max(v, draft.minWaveHeight),
                  });
                }}
                className="w-full mt-2"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/10">
            <div>
              <div className="text-sm font-medium text-[#F8FBFE]">
                Priorité vent offshore / glassy
              </div>
              <div className="text-xs text-[#8AA6B7]">
                Écarte les créneaux hachés par le vent onshore dans votre classement.
              </div>
            </div>
            <input
              type="checkbox"
              checked={draft.preferOffshoreOnly}
              onChange={(e) => setDraft({ ...draft, preferOffshoreOnly: e.target.checked })}
              className="w-4 h-4 accent-[#F0A53A] rounded"
            />
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={onTriggerTestAlert}
              className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
            >
              <BellRing className="w-3.5 h-3.5 text-[#F0A53A]" />
              Tester mon alerte maintenant
            </button>
            <button
              type="submit"
              disabled={saving}
              className="surf-btn-primary inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {savedNotice && <Check className="w-3.5 h-3.5" />}
              {saving ? 'Sauvegarde...' : savedNotice ? 'Profil sauvegardé' : 'Valider mes réglages'}
            </button>
          </div>
        </div>

        {/* Tomorrow Preview + Notifications */}
        <div className="lg:col-span-5 space-y-5">
          <div className="surf-card-amber rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#F7C266]">
                Aperçu {formatFrenchDateLabel(tomorrowKey)} matin
              </span>
              <span className="font-mono tabular-nums text-[#CBD8E1]">
                {draft.alertTime.replace(':', 'h')}
              </span>
            </div>
            {tomorrowTop ? (
              <div>
                <div className="font-display text-3xl font-extrabold tracking-tight text-[#F8FBFE] leading-tight">
                  {tomorrowTop.spot.town} — {tomorrowTop.spot.name}
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-sm font-semibold text-[#4AE8D1]">
                  {tomorrowTop.recommendation.windowLabel} ·{' '}
                  {tomorrowTop.recommendation.avgScore.toFixed(1).replace('.', ',')} / 10
                </div>
                <p className="mt-2 text-xs text-[#D3E0E8] leading-relaxed">
                  {tomorrowTop.recommendation.coherenceNote}
                </p>
                <p className="mt-1 text-xs text-[#94ACB9]">{tomorrowTop.recommendation.summary}</p>
              </div>
            ) : (
              <p className="text-xs text-[#94ACB9]">
                Sélectionnez au moins un spot pour prévisualiser votre alerte de demain matin.
              </p>
            )}
          </div>

          <div className="surf-card rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-[#F8FBFE]">
              <Bell className="w-4 h-4 text-[#F0A53A]" />
              Notifications navigateur
            </div>
            <p className="text-xs text-[#A9C0CE] leading-relaxed">
              Recevez une notification directe à{' '}
              <span className="font-mono text-[#F8FBFE]">{draft.alertTime.replace(':', 'h')}</span>{' '}
              avec le spot n°1 du matin.
            </p>
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-[#8AA6B7]">
                État :{' '}
                <strong className="text-[#F8FBFE]">
                  {notifStatus === 'granted'
                    ? 'Activées'
                    : notifStatus === 'denied'
                    ? 'Bloquées'
                    : notifStatus === 'unsupported'
                    ? 'Non supportées'
                    : 'En attente'}
                </strong>
              </span>
              {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
                <button
                  type="button"
                  onClick={() => void handleEnableBrowserNotifs()}
                  className="surf-btn-glass px-3.5 py-1.5 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
                >
                  Autoriser
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Alert History */}
      {alertLogs.length > 0 && (
        <section className="surf-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
              Journal de mes alertes matinales
            </h2>
          </div>
          <div className="divide-y divide-white/10">
            {alertLogs.map((log) => (
              <div
                key={log.id}
                className="px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono tabular-nums text-xs text-[#8AA6B7]">
                      {log.dateKey}
                    </span>
                    <span className="font-semibold text-[#F8FBFE]">{log.bestSpotName}</span>
                    <span className="font-mono tabular-nums text-xs text-[#4AE8D1]">
                      {log.windowLabel}
                    </span>
                  </div>
                  <div className="text-xs text-[#94ACB9] font-mono tabular-nums mt-0.5">
                    {log.waveHeight.toFixed(1).replace('.', ',')} m · {Math.round(log.wavePeriod)}{' '}
                    s · {Math.round(log.windSpeed)} km/h ({windQualityLabelFr(log.windQuality)})
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-[#F7C266]">
                    {log.score.toFixed(1).replace('.', ',')}
                    <span className="text-xs font-mono font-normal text-[#8AA6B7]">/10</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void onDeleteAlertLog(log.id)}
                    aria-label="Supprimer du journal"
                    className="p-1.5 text-[#6D8796] hover:text-[#FB7185] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </form>
  );
}
