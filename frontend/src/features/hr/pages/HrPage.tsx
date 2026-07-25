import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Clock,
  Calculator,
  Plus,
  Search,
  FileText,
  Eye,
  DollarSign,
  Play,
  Pause,
  Square,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ajusterSegment,
  calculerPaie,
  createEmployee,
  demarrerService,
  historiqueEmployee,
  listAvailableUsers,
  listEmployees,
  listSlipsValides,
  mettreEnPause,
  reprendreService,
  statutCourant,
  terminerService,
  validerPaie,
} from "../api";
import type {
  AvailableUser,
  Employee,
  PaySlip,
  StatutCourant,
  TimeShift,
} from "../types";
import { EmployeeDetailModal } from "../components/EmployeeDetailModal";
import { PayslipPreviewDialog } from "../components/PayslipPreviewDialog";
import { HrAnalyticsChart } from "../components/HrAnalyticsChart";

type Section = "employes" | "pointage" | "paie" | "analytique";

export function HrPage() {
  const [section, setSection] = useState<Section>("employes");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slips, setSlips] = useState<PaySlip[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected employee / slip for detailed view modals
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [employeeDetailOpen, setEmployeeDetailOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PaySlip | null>(null);
  const [slipEmployee, setSlipEmployee] = useState<Employee | null>(null);
  const [slipPreviewOpen, setSlipPreviewOpen] = useState(false);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const [empList, slipList] = await Promise.all([
        listEmployees().catch(() => []),
        listSlipsValides().catch(() => []),
      ]);
      setEmployees(empList);
      setSlips(slipList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMetrics();
  }, [loadMetrics]);

  // Calculated metrics
  const activeEmployeesCount = employees.filter((e) => e.actif).length;
  const totalMasseSalariale = employees
    .filter((e) => e.actif)
    .reduce((sum, e) => sum + (parseFloat(e.salaireBase) || 0), 0);
  const cnssCoveredCount = employees.filter(
    (e) => e.matriculeCnss && e.matriculeCnss.trim() !== "",
  ).length;

  const handleOpenEmployeeDetail = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmployeeDetailOpen(true);
  };

  const handleOpenSlipPreview = (slip: PaySlip) => {
    const emp = employees.find((e) => e.id === slip.employeeId) || null;
    setSelectedSlip(slip);
    setSlipEmployee(emp);
    setSlipPreviewOpen(true);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* HEADER TITLE & SUMMARY CARDS */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="size-6 text-primary" />
              Ressources Humaines & Gestion de la Paie
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestion des dossiers du personnel, pointage inviolable et paie
              réglementaire CNSS / AMO.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadMetrics}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="size-3.5" />
            Actualiser
          </Button>
        </div>

        {/* METRICS DASHBOARD BANNER */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Effectif Total
              </span>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Users className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{employees.length}</span>
              <span className="text-xs text-muted-foreground">
                ({activeEmployeesCount} actifs)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Couverture CNSS:{" "}
              <span className="font-semibold text-foreground">
                {cnssCoveredCount}/{employees.length}
              </span>
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Masse Salariale Mensuelle
              </span>
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                <DollarSign className="size-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold font-mono text-emerald-700">
                {totalMasseSalariale.toLocaleString("fr-FR")}{" "}
                <span className="text-xs font-normal">MAD</span>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Cumul des salaires de base actifs
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Bulletins Validés
              </span>
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                <FileText className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{slips.length}</span>
              <span className="text-xs text-muted-foreground">
                bulletins émis
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Conformes aux barèmes CNSS
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Pointage Self-Service
              </span>
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-sm font-semibold text-slate-800">
                Système Inviolable
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Horodatage serveur certifié
            </p>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={section === "employes" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("employes")}
          className="gap-2 font-medium"
        >
          <Users className="size-4" />
          Dossiers Employés ({employees.length})
        </Button>
        <Button
          variant={section === "pointage" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("pointage")}
          className="gap-2 font-medium"
        >
          <Clock className="size-4" />
          Pointage & Présences
        </Button>
        <Button
          variant={section === "paie" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("paie")}
          className="gap-2 font-medium"
        >
          <Calculator className="size-4" />
          Gestion de la Paie CNSS
        </Button>
        <Button
          variant={section === "analytique" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("analytique")}
          className="gap-2 font-medium text-blue-700 dark:text-blue-400 font-bold"
        >
          <BarChart3 className="size-4" />
          Analytique & Audits 12M
        </Button>
      </div>

      {/* SECTION CONTENT */}
      {section === "employes" && (
        <EmployeesSection
          employees={employees}
          loading={loading}
          onRefetch={loadMetrics}
          onOpenDetail={handleOpenEmployeeDetail}
        />
      )}
      {section === "pointage" && (
        <AttendanceHistorySection employees={employees} />
      )}
      {section === "paie" && (
        <PayrollSection
          employees={employees}
          slips={slips}
          onRefetchSlips={loadMetrics}
          onOpenSlipPreview={handleOpenSlipPreview}
        />
      )}
      {section === "analytique" && (
        <HrAnalyticsChart employees={employees} slips={slips} />
      )}

      {/* MODAL 1: COMPLETE EMPLOYEE DOSSIER */}
      <EmployeeDetailModal
        open={employeeDetailOpen}
        onClose={() => setEmployeeDetailOpen(false)}
        employee={selectedEmployee}
        onOpenPayslip={handleOpenSlipPreview}
      />

      {/* MODAL 2: PRINTABLE PAYSLIP PREVIEW */}
      <PayslipPreviewDialog
        open={slipPreviewOpen}
        onClose={() => setSlipPreviewOpen(false)}
        slip={selectedSlip}
        employee={slipEmployee}
        onValidate={async (id) => {
          await validerPaie(id);
          await loadMetrics();
          setSlipPreviewOpen(false);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------
// TAB 1: EMPLOYEES SECTION
// ------------------------------------------------------------------
interface EmployeesSectionProps {
  employees: Employee[];
  loading: boolean;
  onRefetch: () => Promise<void>;
  onOpenDetail: (emp: Employee) => void;
}

function EmployeesSection({
  employees,
  loading,
  onRefetch,
  onOpenDetail,
}: EmployeesSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.user.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.matriculeCnss && emp.matriculeCnss.includes(searchTerm));

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && emp.actif) ||
      (statusFilter === "INACTIVE" && !emp.actif);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un employé (nom, email, CNSS)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
            }
            className="h-9 px-3 rounded-md border text-xs bg-background"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs uniquement</option>
            <option value="INACTIVE">Inactifs</option>
          </select>
        </div>

        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-1.5 text-xs font-semibold"
        >
          <Plus className="size-4" />
          Nouveau Dossier Employé
        </Button>
      </div>

      {/* Employee List / Cards */}
      {loading ? (
        <p className="text-muted-foreground text-xs text-center py-8">
          Chargement de l'annuaire RH…
        </p>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-card">
          <Users className="size-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold">Aucun employé trouvé</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchTerm || statusFilter !== "ALL"
              ? "Modifiez vos critères de recherche"
              : "Cliquez sur 'Nouveau Dossier Employé' pour créer une fiche."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const initials = emp.user.nom
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={emp.id}
                className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm border border-primary/20">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">
                          {emp.user.nom}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {emp.user.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={emp.actif ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {emp.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 mt-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Poste / Rôle:
                      </span>
                      <span className="font-semibold text-foreground">
                        {emp.user.role?.nom || "Non assigné"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Salaire de Base:
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        {parseFloat(emp.salaireBase).toLocaleString("fr-FR")}{" "}
                        MAD
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Matricule CNSS:
                      </span>
                      <span className="font-mono">
                        {emp.matriculeCnss ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            {emp.matriculeCnss}
                          </Badge>
                        ) : (
                          <span className="text-amber-600">Non renseigné</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Date d'embauche:
                      </span>
                      <span>
                        {new Date(emp.dateEmbauche).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    ID #{emp.id}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenDetail(emp)}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Eye className="size-3.5" />
                    Fiche Complète
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE EMPLOYEE DIALOG */}
      <CreateEmployeeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={async () => {
          await onRefetch();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------
// CREATE EMPLOYEE DIALOG WITH AVAILABLE USERS LIST
// ------------------------------------------------------------------
interface CreateEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateEmployeeDialog({
  open,
  onClose,
  onCreated,
}: CreateEmployeeDialogProps) {
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [matriculeCnss, setMatriculeCnss] = useState("");
  const [salaireBase, setSalaireBase] = useState("5000");
  const [dateEmbauche, setDateEmbauche] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingUsers(true);
    setError(null);
    listAvailableUsers()
      .then((users) => {
        setAvailableUsers(users);
        if (users.length > 0) {
          setSelectedUserId(String(users[0].id));
        }
      })
      .catch(() => setAvailableUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  const targetUserId = selectedUserId || manualUserId;
  const canSubmit = targetUserId && salaireBase && dateEmbauche;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      await createEmployee({
        userId: Number(targetUserId),
        matriculeCnss: matriculeCnss.trim() || undefined,
        salaireBase,
        dateEmbauche,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            Nouveau Dossier Employé
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="userSelect">Compte Utilisateur Système</Label>
            {loadingUsers ? (
              <p className="text-xs text-muted-foreground">
                Chargement des comptes disponibles…
              </p>
            ) : availableUsers.length > 0 ? (
              <select
                id="userSelect"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border text-xs bg-background"
                required
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom} ({u.email}) {u.role?.nom ? `— ${u.role.nom}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  Aucun compte utilisateur libre détecté. Saisissez directement
                  un ID utilisateur.
                </p>
                <Input
                  type="number"
                  placeholder="ID Utilisateur (ex: 1)"
                  value={manualUserId}
                  onChange={(e) => setManualUserId(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="matriculeCnss">Matricule CNSS (Maroc)</Label>
            <Input
              id="matriculeCnss"
              placeholder="Ex: 198273645"
              value={matriculeCnss}
              onChange={(e) => setMatriculeCnss(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Optionnel — obligatoire pour la paie réglementaire.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="salaireBase">Salaire de base (MAD)</Label>
              <Input
                id="salaireBase"
                type="number"
                step="100"
                value={salaireBase}
                onChange={(e) => setSalaireBase(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateEmbauche">Date d'embauche</Label>
              <Input
                id="dateEmbauche"
                type="date"
                value={dateEmbauche}
                onChange={(e) => setDateEmbauche(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
              {error}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "Création…" : "Créer le dossier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------
// TAB 2: ATTENDANCE HISTORY & REAL-TIME POINTAGE SECTION
// ------------------------------------------------------------------
interface AttendanceHistorySectionProps {
  employees: Employee[];
}

function AttendanceHistorySection({
  employees,
}: AttendanceHistorySectionProps) {
  const [currentShiftStatut, setCurrentShiftStatut] =
    useState<StatutCourant | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [shifts, setShifts] = useState<TimeShift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Segment adjustment dialog state
  const [adjustingSegmentId, setAdjustingSegmentId] = useState<number | null>(
    null,
  );
  const [nouvelleFin, setNouvelleFin] = useState("");
  const [motif, setMotif] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load current user shift status
  const refetchCurrentStatut = useCallback(async () => {
    try {
      setCurrentShiftStatut(await statutCourant());
    } catch {
      setCurrentShiftStatut(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchCurrentStatut();
  }, [refetchCurrentStatut]);

  const runShiftAction = async (action: () => Promise<unknown>) => {
    setShiftLoading(true);
    setShiftError(null);
    try {
      await action();
      await refetchCurrentStatut();
    } catch (err) {
      setShiftError(err instanceof Error ? err.message : "Erreur de pointage");
    } finally {
      setShiftLoading(false);
    }
  };

  const refetchShifts = async (empId: number) => {
    setLoadingShifts(true);
    setError(null);
    try {
      setShifts(await historiqueEmployee(empId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoadingShifts(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustingSegmentId || motif.length < 10) return;
    setSaving(true);
    setAdjustError(null);
    try {
      await ajusterSegment(adjustingSegmentId, { nouvelleFin, motif });
      setAdjustingSegmentId(null);
      setNouvelleFin("");
      setMotif("");
      if (selectedEmployeeId) await refetchShifts(Number(selectedEmployeeId));
    } catch (err) {
      setAdjustError(
        err instanceof Error ? err.message : "Erreur d'ajustement",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* REAL-TIME SELF SERVICE CLOCK BOX */}
      {currentShiftStatut && (
        <div className="rounded-xl border bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                Module de Pointage Self-Service (Mon Service)
              </span>
              <h3 className="text-lg font-bold flex items-center gap-2 mt-0.5">
                Statut Actuel:{" "}
                <Badge
                  variant={
                    currentShiftStatut.statut === "ACTIF"
                      ? "default"
                      : "secondary"
                  }
                  className="bg-primary text-white border-none font-bold"
                >
                  {currentShiftStatut.statut}
                </Badge>
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {currentShiftStatut.statut === "NON_DEMARRE" && (
                <Button
                  size="sm"
                  disabled={shiftLoading}
                  onClick={() => runShiftAction(demarrerService)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Play className="size-4" />
                  Démarrer mon service
                </Button>
              )}
              {currentShiftStatut.statut === "ACTIF" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={shiftLoading}
                    onClick={() => runShiftAction(mettreEnPause)}
                    className="text-slate-900 border-slate-300 bg-white hover:bg-slate-100 gap-1.5"
                  >
                    <Pause className="size-4" />
                    Pause
                  </Button>
                  <Button
                    size="sm"
                    disabled={shiftLoading}
                    onClick={() => runShiftAction(terminerService)}
                    className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                  >
                    <Square className="size-4" />
                    Terminer
                  </Button>
                </>
              )}
              {currentShiftStatut.statut === "EN_PAUSE" && (
                <Button
                  size="sm"
                  disabled={shiftLoading}
                  onClick={() => runShiftAction(reprendreService)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Play className="size-4" />
                  Reprendre le service
                </Button>
              )}
            </div>
          </div>
          {shiftError && <p className="text-xs text-rose-300">{shiftError}</p>}
        </div>
      )}

      {/* ADMINISTRATIVE TIME SHIFT INSPECTION */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Historique & Audit des Pointages Employés
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sélectionnez un employé pour inspecter ses sessions de travail et
              corriger les segments.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                if (e.target.value) void refetchShifts(Number(e.target.value));
              }}
              className="h-9 px-3 rounded-md border text-xs bg-background flex-1 sm:w-64"
            >
              <option value="">-- Choisir un employé --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  #{emp.id} - {emp.user.nom} ({emp.user.role?.nom || "Employé"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {loadingShifts ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Chargement de l'historique…
          </p>
        ) : !selectedEmployeeId ? (
          <p className="text-xs text-muted-foreground text-center py-8 border rounded-lg bg-muted/10">
            Veuillez choisir un employé ci-dessus pour afficher l'historique des
            pointages.
          </p>
        ) : shifts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 border rounded-lg bg-muted/10">
            Aucun historique de pointage enregistré pour cet employé.
          </p>
        ) : (
          <div className="space-y-3">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="rounded-lg border p-4 bg-card shadow-sm space-y-2 text-xs"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span>Service #{shift.id}</span>
                    <span className="text-muted-foreground font-normal text-xs">
                      • Démarré le{" "}
                      {new Date(shift.startedAt).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <Badge
                    variant={
                      shift.statut === "TERMINE" ? "secondary" : "default"
                    }
                  >
                    {shift.statut}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1">
                  <div>
                    <span>Heure Début: </span>
                    <span className="font-mono text-foreground">
                      {new Date(shift.startedAt).toLocaleTimeString("fr-FR")}
                    </span>
                  </div>
                  <div>
                    <span>Heure Fin: </span>
                    <span className="font-mono text-foreground">
                      {shift.endedAt
                        ? new Date(shift.endedAt).toLocaleTimeString("fr-FR")
                        : "En cours"}
                    </span>
                  </div>
                </div>

                {/* Segments table */}
                <div className="mt-2 space-y-1">
                  <p className="font-bold text-slate-700">
                    Segments d'activité:
                  </p>
                  <div className="space-y-1">
                    {shift.segments.map((seg) => (
                      <div
                        key={seg.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/30 border"
                      >
                        <span className="font-medium">
                          {seg.type === "TRAVAIL" ? "💼 Travail" : "☕ Pause"} —{" "}
                          <span className="font-mono">
                            {new Date(seg.debut).toLocaleTimeString("fr-FR")}
                          </span>
                          {" → "}
                          <span className="font-mono">
                            {seg.fin
                              ? new Date(seg.fin).toLocaleTimeString("fr-FR")
                              : "en cours"}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAdjustingSegmentId(seg.id);
                            setNouvelleFin(
                              seg.fin
                                ? new Date(seg.fin).toISOString().slice(0, 16)
                                : "",
                            );
                          }}
                          className="text-[11px] h-7"
                        >
                          Ajuster
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEGMENT ADJUSTMENT DIALOG */}
      <Dialog
        open={adjustingSegmentId !== null}
        onOpenChange={(next) => !next && setAdjustingSegmentId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuster l'horodatage d'un segment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="nouvelleFin">Nouvelle heure de fin</Label>
              <Input
                id="nouvelleFin"
                type="datetime-local"
                value={nouvelleFin}
                onChange={(e) => setNouvelleFin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motifAjust">
                Motif obligatoire (≥ 10 caractères)
              </Label>
              <Input
                id="motifAjust"
                placeholder="Ex: Oubli de pointage lors du départ"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Ce motif sera conservé dans le journal d'audit de
                l'établissement.
              </p>
            </div>

            {adjustError && (
              <p className="text-xs text-destructive">{adjustError}</p>
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
                {saving ? "Enregistrement…" : "Valider la modification"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------------
// TAB 3: PAYROLL & CNSS CALCULATOR SECTION
// ------------------------------------------------------------------
interface PayrollSectionProps {
  employees: Employee[];
  slips: PaySlip[];
  onRefetchSlips: () => Promise<void>;
  onOpenSlipPreview: (slip: PaySlip) => void;
}

function PayrollSection({
  employees,
  slips,
  onRefetchSlips,
  onOpenSlipPreview,
}: PayrollSectionProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [mois, setMois] = useState(String(new Date().getMonth() + 1));
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [indemnites, setIndemnites] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [lastSlip, setLastSlip] = useState<PaySlip | null>(null);

  async function handleCalculer() {
    if (!employeeId) return;
    setCalculating(true);
    setCalcError(null);
    try {
      const result = await calculerPaie({
        employeeId: Number(employeeId),
        mois: Number(mois),
        annee: Number(annee),
        indemnites: indemnites || undefined,
      });
      setLastSlip(result);
      await onRefetchSlips();
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "Erreur de calcul");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* SIMULATOR CARD */}
      <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
        <div className="border-b pb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Calculator className="size-4 text-emerald-600" />
            Moteur de Calcul de Paie Réglementaire (CNSS / AMO Maroc)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calcule automatiquement les retenues obligatoires selon la
            législation sociale marocaine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="employeeIdPaie">Employé Cible</Label>
            <select
              id="employeeIdPaie"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border text-xs bg-background"
            >
              <option value="">-- Choisir un employé --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  #{emp.id} - {emp.user.nom} (Base:{" "}
                  {parseFloat(emp.salaireBase).toLocaleString("fr-FR")} MAD)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mois">Mois de Paie</Label>
            <select
              id="mois"
              value={mois}
              onChange={(e) => setMois(e.target.value)}
              className="w-full h-9 px-3 rounded-md border text-xs bg-background"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  Mois {m.toString().padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="annee">Année</Label>
            <Input
              id="annee"
              type="number"
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end justify-between gap-3 pt-1">
          <div className="space-y-1.5 w-full sm:max-w-xs text-xs">
            <Label htmlFor="indemnites">
              Indemnités & Primes (MAD, Optionnel)
            </Label>
            <Input
              id="indemnites"
              type="number"
              step="50"
              placeholder="Ex: 500"
              value={indemnites}
              onChange={(e) => setIndemnites(e.target.value)}
            />
          </div>

          <Button
            size="sm"
            disabled={calculating || !employeeId}
            onClick={handleCalculer}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold text-xs h-9"
          >
            <Calculator className="size-4" />
            {calculating ? "Calcul en cours…" : "Générer le Bulletin"}
          </Button>
        </div>

        {calcError && <p className="text-xs text-destructive">{calcError}</p>}

        {/* CALCULATED SLIP RESULT */}
        {lastSlip && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <span className="font-bold text-emerald-900 text-sm">
                Bulletin Généré pour le Mois {lastSlip.mois}/{lastSlip.annee}
              </span>
              <Badge variant={lastSlip.estValide ? "default" : "outline"}>
                {lastSlip.estValide ? "Validé" : "Brouillon Provisoire"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Base Brut:</span>
                <span className="font-mono font-bold text-slate-800">
                  {parseFloat(lastSlip.salaireBase).toFixed(2)} MAD
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Retenue CNSS (4,48%):
                </span>
                <span className="font-mono text-rose-700">
                  -{parseFloat(lastSlip.retenueCnss).toFixed(2)} MAD
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Retenue AMO (2,26%):
                </span>
                <span className="font-mono text-rose-700">
                  -{parseFloat(lastSlip.retenueAmo).toFixed(2)} MAD
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Net à Payer:
                </span>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {parseFloat(lastSlip.salaireNet).toFixed(2)} MAD
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={() => onOpenSlipPreview(lastSlip)}
                className="gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white"
              >
                <FileText className="size-3.5" />
                Aperçu & Impression du Bulletin Officiel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* VALIDATED SLIPS TABLE */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          Archive des Bulletins de Paie Validés
        </h3>

        {slips.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 border rounded-lg bg-muted/10">
            Aucun bulletin archivé pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {slips.map((s) => {
              const emp = employees.find((e) => e.id === s.employeeId);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground">
                      {emp?.user.nom || `Employé #${s.employeeId}`}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({s.mois.toString().padStart(2, "0")}/{s.annee})
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      CNSS: -{s.retenueCnss} MAD | AMO: -{s.retenueAmo} MAD
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {parseFloat(s.salaireNet).toLocaleString("fr-FR")} MAD net
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenSlipPreview(s)}
                      className="text-xs gap-1 h-8"
                    >
                      <FileText className="size-3.5" />
                      Imprimer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
