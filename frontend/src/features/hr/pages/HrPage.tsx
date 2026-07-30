import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ajusterSegment,
  calculerPaie,
  createEmployee,
  historiqueEmployee,
  listEmployees,
  listSlipsValides,
  validerPaie,
} from '../api';
import type { Employee, PaySlip, TimeShift, TimeShiftSegment } from '../types';

// Écran RH (refonte visuelle batch 3 design handoff, RH.dc.html) : page
// unique à sections empilées (KPI, Employés, Historique de pointage, Paie),
// remplace l'ancien commutateur d'onglets — même convention de mise en page
// que GuestsPage/CompaniesPage (Lot #1 du même dossier de handoff).
// `employees` est chargé une seule fois ici et partagé par les 3 sections
// (KPI calculées côté client, résolution du nom d'employé sur l'historique
// de pointage — TimeShift n'embarque que `employeeId`, jamais un nom).
export function HrPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const refetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      setEmployees(await listEmployees());
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchEmployees();
  }, [refetchEmployees]);

  const kpi = useMemo(() => {
    const actifs = employees.filter((e) => e.actif);
    const masseSalariale = actifs.reduce(
      (sum, e) => sum + Number(e.salaireBase),
      0,
    );
    return { nbActifs: actifs.length, masseSalariale };
  }, [employees]);

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      {/* Employés actifs / Masse salariale — calculées côté client depuis la
          liste déjà chargée. "En service maintenant" et "Bulletins à
          valider" (visibles sur le mockup) exigeraient un endpoint
          d'agrégation qui n'existe pas côté backend (statutCourant() ne
          renvoie que le statut de l'utilisateur courant, et aucune route ne
          liste les PaySlip en brouillon) — omis plutôt que fabriqués,
          cohérent avec la convention "compte courant honnête" déjà en place
          sur CompaniesPage. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Employés actifs
          </span>
          <span className="text-2xl font-bold tracking-tight">
            {loadingEmployees ? '—' : kpi.nbActifs}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Masse salariale (base/mois)
          </span>
          <span className="text-2xl font-bold tracking-tight">
            {loadingEmployees
              ? '—'
              : `${kpi.masseSalariale.toLocaleString('fr-FR')} MAD`}
          </span>
        </div>
      </div>

      <EmployeesSection
        employees={employees}
        loading={loadingEmployees}
        onRefetch={refetchEmployees}
      />
      <AttendanceHistorySection employees={employees} />
      <PayrollSection />
    </div>
  );
}

interface EmployeesSectionProps {
  employees: Employee[];
  loading: boolean;
  onRefetch: () => Promise<void>;
}

function EmployeesSection({
  employees,
  loading,
  onRefetch,
}: EmployeesSectionProps) {
  const [userId, setUserId] = useState('');
  const [matriculeCnss, setMatriculeCnss] = useState('');
  const [salaireBase, setSalaireBase] = useState('');
  const [dateEmbauche, setDateEmbauche] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = userId && salaireBase && dateEmbauche;

  async function handleCreate() {
    if (!canSubmit) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await createEmployee({
        userId: Number(userId),
        matriculeCnss: matriculeCnss || undefined,
        salaireBase,
        dateEmbauche,
      });
      setUserId('');
      setMatriculeCnss('');
      setSalaireBase('');
      setDateEmbauche('');
      await onRefetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Employés — dossiers liés à un compte de connexion
        </span>
      </div>

      <div className="bg-muted/60 text-muted-foreground grid grid-cols-[1fr_130px_110px_100px] gap-2 px-4.5 py-2 text-[11px] font-bold">
        <span>Employé</span>
        <span>Salaire de base</span>
        <span>Embauché le</span>
        <span>Statut</span>
      </div>

      {loading ? (
        <p className="text-muted-foreground px-4.5 py-3 text-sm">Chargement…</p>
      ) : employees.length === 0 ? (
        <p className="text-muted-foreground px-4.5 py-3 text-sm">
          Aucun employé.
        </p>
      ) : (
        employees.map((emp) => (
          <div
            key={emp.id}
            className="grid grid-cols-[1fr_130px_110px_100px] items-center gap-2 border-t px-4.5 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{emp.user.nom}</p>
              <p className="text-muted-foreground truncate text-xs">
                {emp.user.email}
              </p>
            </div>
            <span className="text-xs">{emp.salaireBase} MAD</span>
            <span className="text-xs">{emp.dateEmbauche.slice(0, 10)}</span>
            <Badge
              variant={emp.actif ? 'success' : 'outline'}
              className="w-fit"
            >
              {emp.actif ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        ))
      )}

      <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
        <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          Nouveau dossier employé
        </span>
        <div className="grid grid-cols-4 items-end gap-2.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="userId" className="text-xs font-normal">
              ID compte *
            </Label>
            <Input
              id="userId"
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="matriculeCnss" className="text-xs font-normal">
              Matricule CNSS
            </Label>
            <Input
              id="matriculeCnss"
              value={matriculeCnss}
              onChange={(e) => setMatriculeCnss(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="salaireBase" className="text-xs font-normal">
              Salaire base (MAD) *
            </Label>
            <Input
              id="salaireBase"
              type="number"
              step="0.01"
              value={salaireBase}
              onChange={(e) => setSalaireBase(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dateEmbauche" className="text-xs font-normal">
              Embauche *
            </Label>
            <Input
              id="dateEmbauche"
              type="date"
              value={dateEmbauche}
              onChange={(e) => setDateEmbauche(e.target.value)}
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={submitting || !canSubmit}
          onClick={() => void handleCreate()}
        >
          {submitting ? 'Création…' : 'Créer'}
        </Button>
        {formError && <p className="text-destructive text-sm">{formError}</p>}
        <p className="text-muted-foreground text-[11px]">
          Suppose un compte de connexion déjà existant — la création composite
          (compte + fiche employé) n'est pas encore disponible.
        </p>
      </div>
    </div>
  );
}

const SEGMENT_TYPE_LABEL: Record<TimeShiftSegment['type'], string> = {
  TRAVAIL: 'Travail',
  PAUSE: 'Pause',
};

interface AttendanceHistorySectionProps {
  employees: Employee[];
}

function AttendanceHistorySection({
  employees,
}: AttendanceHistorySectionProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [shifts, setShifts] = useState<TimeShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustingSegment, setAdjustingSegment] =
    useState<TimeShiftSegment | null>(null);
  const [nouvelleFin, setNouvelleFin] = useState('');
  const [motif, setMotif] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refetch(id: number) {
    setLoading(true);
    setError(null);
    try {
      setShifts(await historiqueEmployee(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdjust() {
    if (!adjustingSegment || motif.trim().length < 10) return;
    setSaving(true);
    setAdjustError(null);
    try {
      await ajusterSegment(adjustingSegment.id, { nouvelleFin, motif });
      setAdjustingSegment(null);
      setNouvelleFin('');
      setMotif('');
      if (employeeId) await refetch(Number(employeeId));
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Historique de pointage — corrections rétroactives
        </span>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (employeeId) void refetch(Number(employeeId));
          }}
        >
          <Label htmlFor="employeeId" className="text-xs font-normal">
            Employé #
          </Label>
          <Input
            id="employeeId"
            type="number"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-7.5 w-20"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!employeeId}
          >
            Afficher
          </Button>
        </form>
      </div>

      {error && <p className="text-destructive px-4.5 py-3 text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground px-4.5 py-3 text-sm">Chargement…</p>
      ) : shifts.length === 0 ? (
        <p className="text-muted-foreground px-4.5 py-3 text-sm">
          Aucun service à afficher.
        </p>
      ) : (
        shifts.map((shift) => {
          const nomEmploye = employees.find((e) => e.id === shift.employeeId)
            ?.user.nom;
          return (
            <div key={shift.id}>
              <div className="bg-muted/60 flex items-center justify-between px-4.5 py-2.5">
                <span className="text-sm font-semibold">
                  Service #{shift.id}
                  {nomEmploye ? ` — ${nomEmploye}` : ''} —{' '}
                  {new Date(shift.startedAt).toLocaleString('fr-FR')}
                </span>
                <Badge
                  variant={shift.statut === 'TERMINE' ? 'outline' : 'success'}
                >
                  {shift.statut}
                </Badge>
              </div>
              <div className="text-muted-foreground grid grid-cols-[110px_1fr_90px] gap-2 border-t px-4.5 py-2 text-[11px] font-bold">
                <span>Type</span>
                <span>Plage horaire</span>
                <span>Action</span>
              </div>
              {shift.segments.map((seg) => (
                <div
                  key={seg.id}
                  className={`grid grid-cols-[110px_1fr_90px] items-center gap-2 border-t px-4.5 py-2 text-sm ${
                    adjustingSegment?.id === seg.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="font-semibold">
                    {SEGMENT_TYPE_LABEL[seg.type]}
                  </span>
                  <span>
                    {new Date(seg.debut).toLocaleTimeString('fr-FR')}
                    {' → '}
                    {seg.fin
                      ? new Date(seg.fin).toLocaleTimeString('fr-FR')
                      : 'en cours'}
                  </span>
                  <button
                    type="button"
                    className="text-primary w-fit text-xs font-semibold hover:underline"
                    onClick={() => {
                      setAdjustingSegment(seg);
                      setNouvelleFin('');
                      setMotif('');
                      setAdjustError(null);
                    }}
                  >
                    Ajuster{adjustingSegment?.id === seg.id ? ' ▾' : ''}
                  </button>
                </div>
              ))}
            </div>
          );
        })
      )}

      {adjustingSegment && (
        <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
            Ajuster le segment sélectionné —{' '}
            {SEGMENT_TYPE_LABEL[adjustingSegment.type]}{' '}
            {new Date(adjustingSegment.debut).toLocaleTimeString('fr-FR')}
            {adjustingSegment.fin
              ? ` → ${new Date(adjustingSegment.fin).toLocaleTimeString('fr-FR')}`
              : ''}
          </span>
          <div className="grid grid-cols-[1fr_2fr_auto] items-end gap-2.5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="nouvelleFin" className="text-xs font-normal">
                Nouvelle heure de fin
              </Label>
              <Input
                id="nouvelleFin"
                type="datetime-local"
                value={nouvelleFin}
                onChange={(e) => setNouvelleFin(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="motifAjust" className="text-xs font-normal">
                Motif (≥ 10 caractères, obligatoire)
              </Label>
              <Input
                id="motifAjust"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. Oubli de pointage confirmé par le responsable de salle"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || motif.trim().length < 10 || !nouvelleFin}
              onClick={() => void handleAdjust()}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          {adjustError && (
            <p className="text-destructive text-sm">{adjustError}</p>
          )}
          <p className="text-muted-foreground text-[11px]">
            Toute correction rétroactive est journalisée dans l'audit — l'heure
            d'origine, saisie par l'horloge serveur, n'est jamais écrasée
            silencieusement.
          </p>
        </div>
      )}
    </div>
  );
}

function PayrollSection() {
  const [employeeId, setEmployeeId] = useState('');
  const [mois, setMois] = useState(String(new Date().getMonth() + 1));
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [indemnites, setIndemnites] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [lastSlip, setLastSlip] = useState<PaySlip | null>(null);
  const [slips, setSlips] = useState<PaySlip[]>([]);
  const [validatingId, setValidatingId] = useState<number | null>(null);

  const refetchSlips = useCallback(async () => {
    setSlips(await listSlipsValides());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchSlips();
  }, [refetchSlips]);

  async function handleCalculer() {
    if (!employeeId) return;
    setCalculating(true);
    setCalcError(null);
    try {
      setLastSlip(
        await calculerPaie({
          employeeId: Number(employeeId),
          mois: Number(mois),
          annee: Number(annee),
          indemnites: indemnites || undefined,
        }),
      );
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCalculating(false);
    }
  }

  async function handleValider(id: number) {
    setValidatingId(id);
    try {
      await validerPaie(id);
      setLastSlip(null);
      await refetchSlips();
    } finally {
      setValidatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
        Paie — calcul CNSS/AMO
      </span>
      <div className="grid grid-cols-2 items-start gap-4">
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="border-b px-4.5 py-3.5 text-sm font-semibold">
            Calculer un bulletin
          </div>
          <div className="flex flex-col gap-2.5 p-4.5">
            <div className="flex flex-wrap gap-2.5">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="employeeIdPaie" className="text-xs font-normal">
                  ID employé
                </Label>
                <Input
                  id="employeeIdPaie"
                  type="number"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="mois" className="text-xs font-normal">
                  Mois
                </Label>
                <Input
                  id="mois"
                  type="number"
                  min={1}
                  max={12}
                  value={mois}
                  onChange={(e) => setMois(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="annee" className="text-xs font-normal">
                  Année
                </Label>
                <Input
                  id="annee"
                  type="number"
                  value={annee}
                  onChange={(e) => setAnnee(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="indemnites" className="text-xs font-normal">
                Indemnités (MAD, optionnel)
              </Label>
              <Input
                id="indemnites"
                type="number"
                step="0.01"
                value={indemnites}
                onChange={(e) => setIndemnites(e.target.value)}
              />
            </div>
            {calcError && (
              <p className="text-destructive text-sm">{calcError}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              disabled={calculating || !employeeId}
              onClick={() => void handleCalculer()}
            >
              {calculating ? 'Calcul…' : 'Calculer'}
            </Button>

            {lastSlip && (
              <div className="bg-muted/40 mt-1 flex flex-col gap-1 rounded-md p-3">
                <span className="text-sm">
                  Salaire de base : {lastSlip.salaireBase} MAD
                </span>
                <span className="text-sm">
                  Retenue CNSS : {lastSlip.retenueCnss} MAD
                </span>
                <span className="text-sm">
                  Retenue AMO : {lastSlip.retenueAmo} MAD
                </span>
                <span className="mt-0.5 text-sm font-bold">
                  Salaire net : {lastSlip.salaireNet} MAD
                </span>
                {!lastSlip.estValide && (
                  <Button
                    size="sm"
                    className="mt-1.5 w-fit"
                    disabled={validatingId === lastSlip.id}
                    onClick={() => handleValider(lastSlip.id)}
                  >
                    Valider ce bulletin
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="border-b px-4.5 py-3.5 text-sm font-semibold">
            Bulletins validés
          </div>
          <div className="text-muted-foreground grid grid-cols-[1fr_auto] px-4.5 py-2 text-[11px] font-bold">
            <span>Employé</span>
            <span>Net</span>
          </div>
          {slips.length === 0 ? (
            <p className="text-muted-foreground border-t px-4.5 py-3 text-sm">
              Aucun bulletin validé.
            </p>
          ) : (
            slips.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-t px-4.5 py-2 text-sm"
              >
                <span>
                  #{s.employeeId} — {s.mois}/{s.annee}
                </span>
                <span className="font-mono font-semibold">
                  {s.salaireNet} MAD
                </span>
              </div>
            ))
          )}
          <p className="text-muted-foreground px-4.5 pb-3.5 text-[11px]">
            Un bulletin validé devient définitif — la modification exige une
            nouvelle validation.
          </p>
        </div>
      </div>
    </div>
  );
}
