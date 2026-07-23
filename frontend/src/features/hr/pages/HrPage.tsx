import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ajusterSegment,
  calculerPaie,
  createEmployee,
  historiqueEmployee,
  listEmployees,
  listSlipsValides,
  validerPaie,
} from '../api';
import type {
  CreateEmployeeInput,
  Employee,
  PaySlip,
  TimeShift,
} from '../types';

type Section = 'employes' | 'pointage' | 'paie';

export function HrPage() {
  const [section, setSection] = useState<Section>('employes');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex gap-1 border-b pb-2">
        <Button
          variant={section === 'employes' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('employes')}
        >
          Employés
        </Button>
        <Button
          variant={section === 'pointage' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('pointage')}
        >
          Historique de pointage
        </Button>
        <Button
          variant={section === 'paie' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('paie')}
        >
          Paie
        </Button>
      </div>

      {section === 'employes' && <EmployeesSection />}
      {section === 'pointage' && <AttendanceHistorySection />}
      {section === 'paie' && <PayrollSection />}
    </div>
  );
}

function EmployeesSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setEmployees(await listEmployees());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleCreate(input: CreateEmployeeInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createEmployee(input);
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Dossiers employés reliés à un compte de connexion existant.
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          + Nouvel employé
        </Button>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : employees.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun employé.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {emp.user.nom}{' '}
                  <span className="text-muted-foreground text-xs">
                    {emp.user.email}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Salaire de base {emp.salaireBase} MAD — embauché le{' '}
                  {emp.dateEmbauche.slice(0, 10)}
                </p>
              </div>
              <Badge variant={emp.actif ? 'default' : 'secondary'}>
                {emp.actif ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => !next && setDialogOpen(false)}
      >
        <DialogContent>
          {dialogOpen && (
            <CreateEmployeeForm
              onClose={() => setDialogOpen(false)}
              onConfirm={handleCreate}
              submitting={submitting}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateEmployeeFormProps {
  onClose: () => void;
  onConfirm: (input: CreateEmployeeInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateEmployeeForm({
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateEmployeeFormProps) {
  const [userId, setUserId] = useState('');
  const [matriculeCnss, setMatriculeCnss] = useState('');
  const [salaireBase, setSalaireBase] = useState('');
  const [dateEmbauche, setDateEmbauche] = useState('');

  const canSubmit = userId && salaireBase && dateEmbauche;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouveau dossier employé</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onConfirm({
            userId: Number(userId),
            matriculeCnss: matriculeCnss || undefined,
            salaireBase,
            dateEmbauche,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="userId">ID du compte de connexion</Label>
          <Input
            id="userId"
            type="number"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="matriculeCnss">Matricule CNSS</Label>
          <Input
            id="matriculeCnss"
            value={matriculeCnss}
            onChange={(e) => setMatriculeCnss(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="salaireBase">Salaire de base (MAD)</Label>
          <Input
            id="salaireBase"
            type="number"
            step="0.01"
            value={salaireBase}
            onChange={(e) => setSalaireBase(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateEmbauche">Date d'embauche</Label>
          <Input
            id="dateEmbauche"
            type="date"
            value={dateEmbauche}
            onChange={(e) => setDateEmbauche(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Création…' : 'Créer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function AttendanceHistorySection() {
  const [employeeId, setEmployeeId] = useState('');
  const [shifts, setShifts] = useState<TimeShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustingSegmentId, setAdjustingSegmentId] = useState<number | null>(
    null,
  );
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
    if (!adjustingSegmentId || motif.length < 10) return;
    setSaving(true);
    setAdjustError(null);
    try {
      await ajusterSegment(adjustingSegmentId, { nouvelleFin, motif });
      setAdjustingSegmentId(null);
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
    <div className="flex flex-col gap-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (employeeId) void refetch(Number(employeeId));
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employeeId">ID employé</Label>
          <Input
            id="employeeId"
            type="number"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={!employeeId}>
          Afficher
        </Button>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shifts.map((shift) => (
            <div key={shift.id} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">
                  Service #{shift.id} —{' '}
                  {new Date(shift.startedAt).toLocaleString('fr-FR')}
                </p>
                <Badge
                  variant={shift.statut === 'TERMINE' ? 'secondary' : 'default'}
                >
                  {shift.statut}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                {shift.segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {seg.type} —{' '}
                      {new Date(seg.debut).toLocaleTimeString('fr-FR')}
                      {' → '}
                      {seg.fin
                        ? new Date(seg.fin).toLocaleTimeString('fr-FR')
                        : 'en cours'}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAdjustingSegmentId(seg.id)}
                    >
                      Ajuster
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={adjustingSegmentId !== null}
        onOpenChange={(next) => !next && setAdjustingSegmentId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le segment</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nouvelleFin">Nouvelle heure de fin</Label>
              <Input
                id="nouvelleFin"
                type="datetime-local"
                value={nouvelleFin}
                onChange={(e) => setNouvelleFin(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motifAjust">Motif (≥ 10 caractères)</Label>
              <Input
                id="motifAjust"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
            </div>
            {adjustError && (
              <p className="text-destructive text-sm">{adjustError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustingSegmentId(null)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={saving || motif.length < 10 || !nouvelleFin}
                onClick={handleAdjust}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
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
    <div className="flex flex-col gap-6">
      <div className="flex max-w-md flex-col gap-3 rounded-md border p-3">
        <p className="text-sm font-medium">Calculer un bulletin</p>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="employeeIdPaie">ID employé</Label>
            <Input
              id="employeeIdPaie"
              type="number"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="mois">Mois</Label>
            <Input
              id="mois"
              type="number"
              min={1}
              max={12}
              value={mois}
              onChange={(e) => setMois(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="annee">Année</Label>
            <Input
              id="annee"
              type="number"
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="indemnites">Indemnités (MAD, optionnel)</Label>
          <Input
            id="indemnites"
            type="number"
            step="0.01"
            value={indemnites}
            onChange={(e) => setIndemnites(e.target.value)}
          />
        </div>
        {calcError && <p className="text-destructive text-sm">{calcError}</p>}
        <Button
          size="sm"
          className="w-fit"
          disabled={calculating || !employeeId}
          onClick={handleCalculer}
        >
          {calculating ? 'Calcul…' : 'Calculer'}
        </Button>

        {lastSlip && (
          <div className="mt-2 flex flex-col gap-1 rounded bg-gray-50 p-2 text-sm">
            <p>Salaire de base : {lastSlip.salaireBase} MAD</p>
            <p>Retenue CNSS : {lastSlip.retenueCnss} MAD</p>
            <p>Retenue AMO : {lastSlip.retenueAmo} MAD</p>
            <p className="font-semibold">
              Salaire net : {lastSlip.salaireNet} MAD
            </p>
            {!lastSlip.estValide && (
              <Button
                size="sm"
                className="mt-1 w-fit"
                disabled={validatingId === lastSlip.id}
                onClick={() => handleValider(lastSlip.id)}
              >
                Valider ce bulletin
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Bulletins validés</p>
        {slips.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun bulletin validé.
          </p>
        ) : (
          slips.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border p-2 text-sm"
            >
              <span>
                Employé #{s.employeeId} — {s.mois}/{s.annee}
              </span>
              <span className="font-mono">{s.salaireNet} MAD net</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
