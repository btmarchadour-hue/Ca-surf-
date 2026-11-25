import { useState } from 'react';
import { motion } from 'motion/react';
import { Bell, Check, Copy, Share2, X } from 'lucide-react';
import { BOARD_TYPE_LABELS, SURFER_LEVEL_LABELS } from '../data/spots';
import {
  degreesToCompass,
  formatFrenchDateLabel,
  scoreLabelFr,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type { BestWindowRecommendation, SurferPreferences, SurfSpot } from '../types/surf';
import { SurfScoreDial } from './SurfScoreDial';

interface MorningAlertModalProps {
  open: boolean;
  onClose: () => void;
  prefs: SurferPreferences;
  targetDateKey: string;
  ranked: Array<{ spot: SurfSpot; recommendation: BestWindowRecommendation }>;
  onSaveLog?: (rec: BestWindowRecommendation) => Promise<void>;
  onSelectSpot?: (spotId: string) => void;
  canSaveLog: boolean;
}

export function MorningAlertModal({
  open,
  onClose,
  prefs,
  targetDateKey,
  ranked,
  onSaveLog,
  onSelectSpot,
  canSaveLog,
}: MorningAlertModalProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const winner = ranked[0];
  const alternatives = ranked.slice(1, 3);

  const shareMessage = winner
    ? `Dawn Patrol Ça Surf ? (${formatFrenchDateLabel(targetDateKey)}) — Go sur ${
        winner.recommendation.spotName
      } entre ${winner.recommendation.windowLabel} · ${winner.recommendation.summary} · Eau ${
        winner.recommendation.waterTemp !== null
          ? `${winner.recommendation.waterTemp.toFixed(1).replace('.', ',')}°C (${winner.recommendation.wetsuitLabel})`
          : winner.recommendation.wetsuitLabel
      } · Note ${winner.recommendation.avgScore.toFixed(1).replace('.', ',')}/10.`
    : 'Sélectionnez vos spots dans la liste API pour générer votre bulletin matinal.';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    if (!winner || !onSaveLog || saving) return;
    setSaving(true);
    try {
      await onSaveLog(winner.recommendation);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#03080D]/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-alert-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="surf-card rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl text-[#F3F7FA]"
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-4 h-4 text-[#F0A53A] shrink-0" />
            <h2
              id="morning-alert-title"
              className="font-display text-xl font-bold tracking-tight text-[#F8FBFE] truncate"
            >
              Alerte Dawn Patrol · {prefs.alertTime.replace(':', 'h')} ·{' '}
              {formatFrenchDateLabel(targetDateKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#94ACB9] hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Fermer l’aperçu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {winner ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#F7C266]">
                    Calibré pour {SURFER_LEVEL_LABELS[prefs.surferLevel].label} ·{' '}
                    {BOARD_TYPE_LABELS[prefs.boardType].label}
                  </div>
                  <h3 className="mt-1.5 font-display text-4xl font-extrabold text-[#F8FBFE] tracking-tight leading-[0.98]">
                    {winner.spot.town} — {winner.spot.name}
                  </h3>
                  <p className="mt-2 text-sm text-[#D3E0E8]">
                    {scoreLabelFr(winner.recommendation.avgScore).label} · Créneau feu vert :{' '}
                    <span className="font-mono tabular-nums font-semibold text-[#F8FBFE]">
                      {winner.recommendation.windowLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#4AE8D1]">
                    {winner.recommendation.coherenceNote}
                  </p>
                </div>

                <SurfScoreDial score={winner.recommendation.avgScore} size="md" />
              </div>

              <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/10">
                <div>
                  <div className="text-xs text-[#8AA6B7]">Houle & période</div>
                  <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#38BDF8] leading-none">
                    {winner.recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m ·{' '}
                    {winner.recommendation.avgSwellPeriod} s
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#8AA6B7]">Vent</div>
                  <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#2DD4BF] leading-none">
                    {winner.recommendation.avgWindSpeed} km/h{' '}
                    {degreesToCompass(winner.recommendation.windDirection)}
                  </div>
                  <div className="mt-1 text-xs text-[#94ACB9]">
                    {windQualityLabelFr(winner.recommendation.windQuality)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#8AA6B7]">Eau & combi</div>
                  <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#F8FBFE] leading-none">
                    {winner.recommendation.waterTemp !== null
                      ? `${winner.recommendation.waterTemp.toFixed(1).replace('.', ',')}°C`
                      : `${winner.recommendation.airTemp}°C air`}
                  </div>
                  <div className="mt-1 text-xs text-[#94ACB9] truncate">
                    {winner.recommendation.wetsuitLabel}
                  </div>
                </div>
              </div>

              {alternatives.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-[#8AA6B7] mb-2">
                    Plans B parmi vos spots choisis
                  </div>
                  <div className="divide-y divide-white/10 border-t border-white/10">
                    {alternatives.map(({ spot, recommendation }) => (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => {
                          onSelectSpot?.(spot.id);
                          onClose();
                        }}
                        className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/5 transition-colors px-2 -mx-2 rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#F8FBFE] truncate">
                            {spot.town} — {spot.name}
                          </div>
                          <div className="text-xs text-[#94ACB9] font-mono tabular-nums">
                            {recommendation.windowLabel} ·{' '}
                            {recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m ·{' '}
                            {windQualityLabelFr(recommendation.windQuality)}
                          </div>
                        </div>
                        <div className="font-display text-2xl font-extrabold tabular-nums text-[#F7C266] shrink-0">
                          {recommendation.avgScore.toFixed(1).replace('.', ',')}
                          <span className="text-xs font-mono font-normal text-[#8AA6B7]">/10</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#071119] border border-white/10 rounded-xl p-3.5 text-xs text-[#CBD8E1] leading-relaxed flex items-start justify-between gap-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]">
                <span className="select-all">{shareMessage}</span>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="surf-btn-glass shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F3F7FA] rounded-lg whitespace-nowrap"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#2DD4BF]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#94ACB9]">
              Choisissez au moins un spot dans la liste API pour recevoir votre recommandation
              matinale.
            </p>
          )}
        </div>

        <div className="px-6 py-4 bg-[#071119]/80 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            {winner && canSaveLog && onSaveLog && (
              <button
                type="button"
                disabled={saving || saved}
                onClick={() => void handleSave()}
                className="surf-btn-glass px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {saved
                  ? 'Archivé dans le journal'
                  : saving
                  ? 'Enregistrement...'
                  : 'Archiver ce bulletin'}
              </button>
            )}
            {winner && (
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#94ACB9] hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager WhatsApp
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="surf-btn-primary px-5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
