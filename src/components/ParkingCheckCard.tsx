import { useEffect, useState } from 'react';
import { Check, Copy, Eye, Send, Trash2 } from 'lucide-react';
import { formatReportAgeFr, windQualityLabelFr } from '../lib/surfEngine';
import type {
  CrowdLevel,
  ParkingReportRecord,
  ParkingVerdict,
  SurfSpot,
  WindQuality,
} from '../types/surf';

export const VERDICT_META: Record<
  ParkingVerdict,
  { label: string; shortLabel: string; textClass: string; activeClass: string; borderClass: string }
> = {
  go: {
    label: 'Feu vert — Ça déroule',
    shortLabel: 'Feu vert',
    textClass: 'text-[#2DD4BF]',
    activeClass: 'surf-btn-teal border-transparent font-semibold',
    borderClass: 'border-[#2DD4BF]/40',
  },
  moyen: {
    label: 'Moyen — Surfable',
    shortLabel: 'Moyen',
    textClass: 'text-[#F7C266]',
    activeClass: 'surf-btn-primary border-transparent font-semibold',
    borderClass: 'border-[#F0A53A]/40',
  },
  carotte: {
    label: 'Carotte — Restez au chaud',
    shortLabel: 'Carotte',
    textClass: 'text-[#FB7185]',
    activeClass: 'bg-[#FB7185] text-[#071118] border-[#FB7185] font-semibold shadow-[0_8px_20px_-8px_rgba(251,113,133,0.6)]',
    borderClass: 'border-[#FB7185]/40',
  },
};

export const CROWD_META: Record<CrowdLevel, string> = {
  vide: 'Vide (0–5)',
  tranquille: 'Tranquille (5–15)',
  monde: 'Du monde (15–30)',
  blinde: 'Blindé (30+)',
};

export interface ParkingCheckSubmitPayload {
  spotId: string;
  spotName: string;
  verdict: ParkingVerdict;
  observedWaveHeight: number;
  crowdLevel: CrowdLevel;
  windFeel: WindQuality;
  note: string;
}

interface ParkingCheckCardProps {
  /** If provided, locks the composer to this spot; otherwise lets the user select from allSpots */
  lockedSpot?: SurfSpot;
  allSpots: SurfSpot[];
  defaultWaveHeight?: number;
  defaultWindFeel?: WindQuality;
  reports: ParkingReportRecord[];
  currentUserId: string | null;
  hasActiveCrew: boolean;
  isSignedIn: boolean;
  onPublish: (payload: ParkingCheckSubmitPayload) => Promise<void>;
  onDeleteReport?: (memberUid: string, spotId?: string) => Promise<void>;
  onSelectSpot?: (spotId: string) => void;
  onNavigateCrew?: () => void;
}

export function ParkingCheckCard({
  lockedSpot,
  allSpots,
  defaultWaveHeight = 1.2,
  defaultWindFeel = 'offshore',
  reports,
  currentUserId,
  hasActiveCrew,
  isSignedIn,
  onPublish,
  onDeleteReport,
  onSelectSpot,
  onNavigateCrew,
}: ParkingCheckCardProps) {
  const [selectedSpotId, setSelectedSpotId] = useState(
    lockedSpot?.id ?? allSpots[0]?.id ?? ''
  );
  const [verdict, setVerdict] = useState<ParkingVerdict>('go');
  const [observedWaveHeight, setObservedWaveHeight] = useState<number>(
    Number(defaultWaveHeight.toFixed(1))
  );
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>('tranquille');
  const [windFeel, setWindFeel] = useState<WindQuality>(defaultWindFeel);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  useEffect(() => {
    if (lockedSpot) {
      setSelectedSpotId(lockedSpot.id);
    }
  }, [lockedSpot]);

  useEffect(() => {
    setObservedWaveHeight(Number(Math.min(5, Math.max(0.2, defaultWaveHeight)).toFixed(1)));
  }, [defaultWaveHeight, lockedSpot?.id]);

  useEffect(() => {
    setWindFeel(defaultWindFeel);
  }, [defaultWindFeel, lockedSpot?.id]);

  const activeSpot = lockedSpot ?? allSpots.find((s) => s.id === selectedSpotId) ?? allSpots[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpot || submitting) return;
    setSubmitting(true);
    try {
      await onPublish({
        spotId: activeSpot.id,
        spotName: `${activeSpot.town} — ${activeSpot.name}`,
        verdict,
        observedWaveHeight,
        crowdLevel,
        windFeel,
        note: note.trim(),
      });
      setNote('');
      setJustPublished(true);
      setTimeout(() => setJustPublished(false), 2600);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyReport = async (r: ParkingReportRecord) => {
    const v = VERDICT_META[r.verdict].shortLabel;
    const text = `Check Parking Ça Surf ? (${r.spotName}) par ${r.authorName} : ${v} · ${r.observedWaveHeight
      .toFixed(1)
      .replace('.', ',')} m réels · ${CROWD_META[r.crowdLevel]} · Vent ${windQualityLabelFr(
      r.windFeel
    ).toLowerCase()}${r.note ? ` · « ${r.note} »` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUid(r.uid);
      setTimeout(() => setCopiedUid(null), 2000);
    } catch {
      // ignore
    }
  };

  const inputCls = 'surf-input w-full px-3.5 py-2.5 text-sm rounded-xl';

  return (
    <section className="surf-card rounded-3xl overflow-hidden">
      {/* Crisp Coastal Header Band (no invented photo) */}
      <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-[#F0A53A]/12 via-[#0C1C28]/60 to-transparent flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F7C266]">
            <Eye className="w-3.5 h-3.5" />
            Terrain &gt; Algo
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-none mt-1">
            Check Parking en direct
          </h2>
        </div>

        {!hasActiveCrew && onNavigateCrew && (
          <button
            type="button"
            onClick={onNavigateCrew}
            className="surf-btn-glass px-3.5 py-1.5 text-xs font-semibold text-[#F7C266] rounded-lg whitespace-nowrap shrink-0"
          >
            {isSignedIn ? 'Synchroniser avec un groupe' : 'Connexion crew live'}
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        <p className="text-xs text-[#A9C0CE]">
          {lockedSpot
            ? `Sur place au-dessus de la dune à ${lockedSpot.name} ? Balance ton vrai verdict en 5 secondes pour éviter une carotte aux potes.`
            : 'Le premier arrivé au parking balance les vraies conditions en direct pour tout le groupe.'}
        </p>

        {/* Quick 5-Second Composer */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {!lockedSpot && (
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">
                  Spot checké
                </label>
                <select
                  value={selectedSpotId}
                  onChange={(e) => setSelectedSpotId(e.target.value)}
                  className={inputCls}
                  required
                >
                  {allSpots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.town} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={lockedSpot ? 'md:col-span-6' : 'md:col-span-5'}>
              <div className="text-xs font-medium text-[#CBD8E1] mb-1.5">Verdict réel sur place</div>
              <div className="grid grid-cols-3 gap-2">
                {(['go', 'moyen', 'carotte'] as ParkingVerdict[]).map((v) => {
                  const active = verdict === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVerdict(v)}
                      className={`px-3 py-2.5 text-xs rounded-xl border transition-all whitespace-nowrap ${
                        active
                          ? VERDICT_META[v].activeClass
                          : 'bg-[#071119] border-white/12 text-[#CBD8E1] hover:border-white/30'
                      }`}
                    >
                      {VERDICT_META[v].shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="flex items-center justify-between text-xs font-medium text-[#CBD8E1] mb-1.5">
                <span>Taille réelle</span>
                <span className="font-mono tabular-nums text-[#F7C266] font-semibold">
                  {observedWaveHeight.toFixed(1).replace('.', ',')} m
                </span>
              </label>
              <input
                type="range"
                min={0.2}
                max={4.0}
                step={0.1}
                value={observedWaveHeight}
                onChange={(e) => setObservedWaveHeight(Number(e.target.value))}
                className="w-full mt-2.5"
              />
            </div>

            {lockedSpot && (
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">
                  Vent ressenti
                </label>
                <select
                  value={windFeel}
                  onChange={(e) => setWindFeel(e.target.value as WindQuality)}
                  className={inputCls}
                >
                  <option value="glassy">Glassy</option>
                  <option value="offshore">Offshore</option>
                  <option value="cross">Cross-shore</option>
                  <option value="onshore">Onshore</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className={lockedSpot ? 'md:col-span-4' : 'md:col-span-3'}>
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">
                Monde à l’eau
              </label>
              <select
                value={crowdLevel}
                onChange={(e) => setCrowdLevel(e.target.value as CrowdLevel)}
                className={inputCls}
              >
                {(Object.keys(CROWD_META) as CrowdLevel[]).map((key) => (
                  <option key={key} value={key}>
                    {CROWD_META[key]}
                  </option>
                ))}
              </select>
            </div>

            {!lockedSpot && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">Vent</label>
                <select
                  value={windFeel}
                  onChange={(e) => setWindFeel(e.target.value as WindQuality)}
                  className={inputCls}
                >
                  <option value="glassy">Glassy</option>
                  <option value="offshore">Offshore</option>
                  <option value="cross">Cross-shore</option>
                  <option value="onshore">Onshore</option>
                </select>
              </div>
            )}

            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">
                Note terrain (bancs de sable, séries, marée...)
              </label>
              <input
                type="text"
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. Banc du sud super propre, 6 gars au pic, venez vite"
                className={inputCls}
              />
            </div>

            <div className={lockedSpot ? 'md:col-span-3' : 'md:col-span-2'}>
              <button
                type="submit"
                disabled={submitting || !activeSpot}
                className="surf-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap"
              >
                {justPublished ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                {justPublished ? 'Publié !' : submitting ? 'Envoi...' : 'Balance le Check'}
              </button>
            </div>
          </div>
        </form>

        {/* Live Reports Feed */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs text-[#8AA6B7]">
            <span>
              {reports.length > 0
                ? `${reports.length} ${reports.length > 1 ? 'checks terrain' : 'check terrain'} récent${reports.length > 1 ? 's' : ''}`
                : 'Aucun Check Parking publié pour le moment'}
            </span>
            {!hasActiveCrew && reports.length > 0 && (
              <span className="text-[#6D8796]">Mode local (rejoignez un groupe pour partager en direct)</span>
            )}
          </div>

          {reports.length > 0 && (
            <div className="divide-y divide-white/10">
              {reports.map((report) => {
                const meta = VERDICT_META[report.verdict];
                const canDelete =
                  Boolean(onDeleteReport) &&
                  (report.uid === currentUserId || report.uid === 'local-guest');

                return (
                  <div
                    key={`${report.uid}-${report.spotId}`}
                    className="py-3.5 first:pt-1 last:pb-0 flex items-start justify-between gap-4 flex-wrap"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-baseline gap-2.5 flex-wrap text-xs">
                        <span className={`font-display text-lg font-bold tracking-tight ${meta.textClass}`}>
                          {meta.label}
                        </span>
                        <span className="text-[#6D8796]">·</span>
                        {onSelectSpot && !lockedSpot ? (
                          <button
                            type="button"
                            onClick={() => onSelectSpot(report.spotId)}
                            className="font-semibold text-[#F8FBFE] hover:text-[#F0A53A] transition-colors"
                          >
                            {report.spotName}
                          </button>
                        ) : (
                          <span className="font-semibold text-[#F8FBFE]">{report.spotName}</span>
                        )}
                        <span className="text-[#6D8796]">·</span>
                        <span className="text-[#CBD8E1]">
                          Par {report.authorName} ({formatReportAgeFr(report)})
                        </span>
                      </div>

                      <div className="font-mono tabular-nums text-xs text-[#8AA6B7]">
                        {report.observedWaveHeight.toFixed(1).replace('.', ',')} m observés ·{' '}
                        {windQualityLabelFr(report.windFeel)} · {CROWD_META[report.crowdLevel]}
                      </div>

                      {report.note && (
                        <p className="text-sm text-[#EAF2F7] leading-relaxed pt-0.5 italic">
                          « {report.note} »
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyReport(report)}
                        className="surf-btn-glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#CBD8E1] rounded-lg whitespace-nowrap"
                        title="Copier pour WhatsApp"
                      >
                        {copiedUid === report.uid ? (
                          <Check className="w-3.5 h-3.5 text-[#2DD4BF]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedUid === report.uid ? 'Copié' : 'WhatsApp'}
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void onDeleteReport?.(report.uid, report.spotId)}
                          className="p-1.5 text-[#6D8796] hover:text-[#FB7185] transition-colors"
                          aria-label="Supprimer ce check"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
