import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, Copy, LogOut, Plus, UserPlus, Users } from 'lucide-react';
import { IMG_PARKING_VAN } from '../data/spots';
import {
  degreesToCompass,
  formatFrenchDateLabel,
  formatReportAgeFr,
  getLocalDateKey,
  rankSpotsForDate,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type {
  CrewMemberRecord,
  ParkingReportRecord,
  SpotForecast,
  SurfCrewRecord,
  SurfSpot,
  UserProfile,
} from '../types/surf';
import {
  ParkingCheckCard,
  VERDICT_META,
  type ParkingCheckSubmitPayload,
} from './ParkingCheckCard';
import { SpotImage } from './SpotImage';

interface CrewViewProps {
  profile: UserProfile | null;
  isSignedIn: boolean;
  crews: SurfCrewRecord[];
  activeCrew: SurfCrewRecord | null;
  crewMembers: CrewMemberRecord[];
  parkingReports: ParkingReportRecord[];
  allSpots: SurfSpot[];
  forecasts: Record<string, SpotForecast>;
  onSignIn: () => void;
  onCreateCrew: (name: string) => Promise<void>;
  onJoinCrew: (code: string) => Promise<{ status: string; crewName?: string }>;
  onSwitchCrew: (crewId: string) => Promise<void>;
  onLeaveCrew: (crew: SurfCrewRecord) => Promise<void>;
  onUpdateCheckIn: (spotId: string, slot: string, note: string) => Promise<void>;
  onPublishParkingReport: (payload: ParkingCheckSubmitPayload) => Promise<void>;
  onDeleteParkingReport: (memberUid: string, spotId?: string) => Promise<void>;
  onSelectSpot: (spotId: string) => void;
}

export function CrewView({
  profile,
  isSignedIn,
  crews,
  activeCrew,
  crewMembers,
  parkingReports,
  allSpots,
  forecasts,
  onSignIn,
  onCreateCrew,
  onJoinCrew,
  onSwitchCrew,
  onLeaveCrew,
  onUpdateCheckIn,
  onPublishParkingReport,
  onDeleteParkingReport,
  onSelectSpot,
}: CrewViewProps) {
  const [newCrewName, setNewCrewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const myMember = useMemo(
    () => crewMembers.find((m) => m.uid === profile?.uid) ?? null,
    [crewMembers, profile]
  );

  const [plannedSpotId, setPlannedSpotId] = useState('');
  const [plannedSlot, setPlannedSlot] = useState('07h30 – 10h00');
  const [statusNote, setStatusNote] = useState('');
  const [checkInSaved, setCheckInSaved] = useState(false);

  useEffect(() => {
    if (!myMember) return;
    setPlannedSpotId(myMember.plannedSpotId || '');
    setPlannedSlot(myMember.plannedSlot || '07h30 – 10h00');
    setStatusNote(myMember.statusNote || '');
  }, [myMember]);

  const todayKey = useMemo(() => getLocalDateKey(0), []);
  const spotById = useMemo(() => {
    const m = new Map<string, SurfSpot>();
    allSpots.forEach((s) => m.set(s.id, s));
    return m;
  }, [allSpots]);

  const crewConsensus = useMemo(() => {
    if (crewMembers.length === 0) return [];
    const votes = new Map<string, number>();
    crewMembers.forEach((member) => {
      member.favoriteSpotIds.forEach((id) => {
        votes.set(id, (votes.get(id) ?? 0) + 1);
      });
    });

    const candidateSpots = Array.from(votes.keys())
      .map((id) => spotById.get(id))
      .filter((s): s is SurfSpot => Boolean(s));

    const ranked = rankSpotsForDate(candidateSpots, forecasts, todayKey);
    return ranked
      .map((item) => ({
        ...item,
        votes: votes.get(item.spot.id) ?? 1,
      }))
      .sort((a, b) => {
        const scoreA = a.recommendation.avgScore + a.votes * 0.45;
        const scoreB = b.recommendation.avgScore + b.votes * 0.45;
        return scoreB - scoreA;
      });
  }, [crewMembers, spotById, forecasts, todayKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrewName.trim() || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await onCreateCrew(newCrewName.trim());
      setNewCrewName('');
    } catch {
      setFeedback('Impossible de créer le groupe pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      const res = await onJoinCrew(joinCode.trim());
      if (res.status === 'not-found') {
        setFeedback('Code d’invitation introuvable. Vérifiez les lettres saisies.');
      } else if (res.status === 'already-member') {
        setFeedback('Vous faites déjà partie de ce groupe.');
      } else {
        setJoinCode('');
        setFeedback(`Vous avez rejoint « ${res.crewName ?? 'le groupe'} ».`);
      }
    } catch {
      setFeedback('Impossible de rejoindre ce groupe. Vérifiez le code.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!activeCrew) return;
    try {
      await navigator.clipboard.writeText(activeCrew.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannedSpotId) return;
    setBusy(true);
    try {
      await onUpdateCheckIn(plannedSpotId, plannedSlot, statusNote);
      setCheckInSaved(true);
      setTimeout(() => setCheckInSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'surf-input w-full px-3.5 py-2.5 text-sm rounded-xl';

  if (!isSignedIn) {
    return (
      <div className="surf-card rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 relative min-h-[240px]">
          <SpotImage
            src={IMG_PARKING_VAN}
            alt="Surfeurs autour d’un van face aux vagues bretonnes au lever du jour"
            title="Surf Crew"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060E15]/90 via-[#060E15]/25 to-transparent" />
        </div>
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#F7C266]">
            <Users className="w-4 h-4" />
            Quartier général du groupe
          </div>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] leading-[0.98]">
            Calez vos sessions & vos Checks Parking entre potes
          </h1>
          <p className="mt-3 text-sm text-[#A9C0CE] leading-relaxed max-w-xl">
            Connectez-vous avec Google pour créer un groupe d’amis, balancer vos Checks Parking en
            direct depuis la dune et croiser les spots favoris de toute la bande.
          </p>
          <div className="mt-7">
            <button
              type="button"
              onClick={onSignIn}
              className="surf-btn-primary px-6 py-3 text-sm font-semibold rounded-xl whitespace-nowrap shrink-0"
            >
              Se connecter avec Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] leading-none">
            Mon groupe d’amis
          </h1>
          <p className="mt-2 text-sm text-[#A9C0CE]">
            Croisez vos spots préférés, balancez les Checks Parking depuis la dune et organisez le
            covoiturage.
          </p>
        </div>

        {crews.length > 1 && (
          <div className="flex items-center gap-1 p-1 bg-[#071119] border border-white/12 rounded-xl">
            {crews.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void onSwitchCrew(c.id)}
                className={`px-3.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  activeCrew?.id === c.id
                    ? 'surf-btn-primary font-semibold'
                    : 'text-[#94ACB9] hover:text-white font-medium'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeCrew && (
        <>
          <section className="surf-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="text-xs font-medium text-[#4AE8D1]">
                Crew actif · {activeCrew.memberIds.length}{' '}
                {activeCrew.memberIds.length > 1 ? 'surfeurs' : 'surfeur'}
              </div>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-[#F8FBFE]">
                {activeCrew.name}
              </h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#071119] border border-white/15 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]">
                <span className="text-xs text-[#8AA6B7]">Code d’invitation :</span>
                <span className="font-mono tabular-nums text-sm font-bold text-[#F7C266] tracking-wider">
                  {activeCrew.inviteCode}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyInvite()}
                  className="ml-1 text-[#94ACB9] hover:text-white transition-colors"
                  aria-label="Copier le code"
                >
                  {copiedCode ? (
                    <Check className="w-4 h-4 text-[#2DD4BF]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {activeCrew.ownerId !== profile?.uid && (
                <button
                  type="button"
                  onClick={() => void onLeaveCrew(activeCrew)}
                  className="surf-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-[#94ACB9] hover:text-[#FB7185] rounded-xl whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Quitter
                </button>
              )}
            </div>
          </section>

          {crewConsensus.length > 0 && (
            <section className="surf-card-teal rounded-2xl p-6 flex items-center justify-between gap-5 flex-wrap">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[#4AE8D1]">
                  Meilleur compromis pour le groupe ({formatFrenchDateLabel(todayKey)})
                </div>
                <h3 className="font-display text-3xl font-extrabold tracking-tight text-[#F8FBFE]">
                  {crewConsensus[0].spot.town} — {crewConsensus[0].spot.name}
                </h3>
                <p className="text-sm text-[#D3E0E8]">
                  Choisi par {crewConsensus[0].votes}{' '}
                  {crewConsensus[0].votes > 1 ? 'membres' : 'membre'} · Créneau{' '}
                  <span className="font-mono tabular-nums font-semibold text-[#F8FBFE]">
                    {crewConsensus[0].recommendation.windowLabel}
                  </span>{' '}
                  · {crewConsensus[0].recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m ·{' '}
                  {crewConsensus[0].recommendation.avgWindSpeed} km/h{' '}
                  {degreesToCompass(crewConsensus[0].recommendation.windDirection)} (
                  {windQualityLabelFr(crewConsensus[0].recommendation.windQuality)})
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectSpot(crewConsensus[0].spot.id)}
                className="surf-btn-primary px-4 py-2.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
              >
                Voir le détail horaire
              </button>
            </section>
          )}

          {/* Live Crew Check Parking Composer + Feed */}
          <ParkingCheckCard
            allSpots={allSpots}
            reports={parkingReports}
            currentUserId={profile?.uid ?? null}
            hasActiveCrew={Boolean(activeCrew)}
            isSignedIn={isSignedIn}
            onPublish={onPublishParkingReport}
            onDeleteReport={onDeleteParkingReport}
            onSelectSpot={onSelectSpot}
          />

          {/* Announce Session */}
          <section className="surf-card rounded-2xl p-6">
            <h3 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE] flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#F0A53A]" />
              Annoncer ma session au groupe
            </h3>
            <form
              onSubmit={handleCheckInSubmit}
              className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">Spot prévu</label>
                <select
                  value={plannedSpotId}
                  onChange={(e) => setPlannedSpotId(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Choisir un spot...</option>
                  {allSpots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.town} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">Créneau</label>
                <input
                  type="text"
                  maxLength={30}
                  value={plannedSlot}
                  onChange={(e) => setPlannedSlot(e.target.value)}
                  placeholder="07h30 – 10h00"
                  className={`${inputCls} font-mono tabular-nums`}
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-[#CBD8E1] mb-1.5">
                  Note (covoit, café...)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Ex. 2 places dans le van à 7h15"
                  className={inputCls}
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy || !plannedSpotId}
                  className="surf-btn-primary w-full px-4 py-2.5 text-xs font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap"
                >
                  {checkInSaved ? 'Publié !' : 'Publier'}
                </button>
              </div>
            </form>
          </section>

          {/* Friends Cards Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {crewMembers.map((member) => {
              const plannedSpot = member.plannedSpotId
                ? spotById.get(member.plannedSpotId)
                : null;
              const favNames = member.favoriteSpotIds
                .map((id) => spotById.get(id)?.name)
                .filter(Boolean);
              const memberReport = parkingReports.find(
                (r) => r.uid === member.uid && r.dateKey === todayKey
              );

              return (
                <div
                  key={member.uid}
                  className="surf-card rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-display text-2xl font-bold tracking-tight text-[#F8FBFE]">
                        {member.displayName}
                        {member.uid === profile?.uid && (
                          <span className="ml-1.5 font-sans text-xs font-normal text-[#8AA6B7]">
                            (vous)
                          </span>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-xs text-[#F7C266]">
                        Alerte {member.alertTime.replace(':', 'h')}
                      </span>
                    </div>

                    <div className="mt-2.5 text-xs text-[#A9C0CE] leading-relaxed">
                      <span className="text-[#6D8796]">Spots : </span>
                      {favNames.length > 0 ? favNames.join(' · ') : 'Aucun spot choisi'}
                    </div>

                    {memberReport && (
                      <div className="mt-3 pt-2.5 border-t border-white/10 text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-semibold ${
                              VERDICT_META[memberReport.verdict].textClass
                            }`}
                          >
                            Check : {VERDICT_META[memberReport.verdict].shortLabel}
                          </span>
                          <span className="text-[#6D8796]">
                            {formatReportAgeFr(memberReport)}
                          </span>
                        </div>
                        <div className="text-[#CBD8E1] truncate">{memberReport.spotName}</div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10 text-xs">
                    {plannedSpot ? (
                      <div>
                        <span className="font-semibold text-[#4AE8D1]">
                          {plannedSpot.town} — {plannedSpot.name}
                        </span>
                        {member.plannedSlot && (
                          <span className="ml-1.5 font-mono tabular-nums text-[#F8FBFE]">
                            · {member.plannedSlot}
                          </span>
                        )}
                        {member.statusNote && (
                          <div className="text-[#A9C0CE] mt-1">{member.statusNote}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#6D8796]">Session non encore annoncée</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      {/* Create or Join */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form
          onSubmit={handleCreate}
          className="surf-card rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-[#F8FBFE]">
            <Plus className="w-5 h-5 text-[#F0A53A]" />
            Créer un groupe d’amis
          </div>
          <p className="text-xs text-[#A9C0CE]">
            Partagez ensuite le code généré pour réunir les favoris et créneaux de toute la bande.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={60}
              value={newCrewName}
              onChange={(e) => setNewCrewName(e.target.value)}
              placeholder="Ex. Dawn Patrol Crozon"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={busy || newCrewName.trim().length < 2}
              className="surf-btn-primary px-4 py-2.5 text-xs font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Créer
            </button>
          </div>
        </form>

        <form
          onSubmit={handleJoin}
          className="surf-card rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-[#F8FBFE]">
            <UserPlus className="w-5 h-5 text-[#2DD4BF]" />
            Rejoindre avec un code
          </div>
          <p className="text-xs text-[#A9C0CE]">
            Saisissez le code partagé par un ami pour synchroniser vos spots et vos sessions.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={12}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ex. HC7K9M2P"
              className={`${inputCls} font-mono uppercase tracking-wider`}
            />
            <button
              type="submit"
              disabled={busy || joinCode.trim().length < 6}
              className="surf-btn-glass px-4 py-2.5 text-xs font-semibold text-[#F8FBFE] rounded-xl disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Rejoindre
            </button>
          </div>
        </form>
      </section>

      {feedback && (
        <p className="text-xs font-medium text-[#2DD4BF]" role="status">
          {feedback}
        </p>
      )}
    </div>
  );
}
