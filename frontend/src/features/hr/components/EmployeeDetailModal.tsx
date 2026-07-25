import { useEffect, useState, useCallback } from "react";
import {
  User,
  DollarSign,
  Clock,
  FileText,
  Briefcase,
  Mail,
  Building,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { historiqueEmployee, listSlipsValides } from "../api";
import type { Employee, PaySlip, TimeShift } from "../types";

interface EmployeeDetailModalProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  onOpenPayslip?: (slip: PaySlip) => void;
}

export function EmployeeDetailModal({
  open,
  onClose,
  employee,
  onOpenPayslip,
}: EmployeeDetailModalProps) {
  const [shifts, setShifts] = useState<TimeShift[]>([]);
  const [slips, setSlips] = useState<PaySlip[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [loadingSlips, setLoadingSlips] = useState(false);

  const loadData = useCallback(async (empId: number) => {
    setLoadingShifts(true);
    setLoadingSlips(true);

    try {
      const [shiftData, slipData] = await Promise.all([
        historiqueEmployee(empId).catch(() => []),
        listSlipsValides(empId).catch(() => []),
      ]);
      setShifts(shiftData);
      setSlips(slipData);
    } finally {
      setLoadingShifts(false);
      setLoadingSlips(false);
    }
  }, []);

  useEffect(() => {
    if (open && employee) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadData(employee.id);
    }
  }, [open, employee, loadData]);

  if (!employee) return null;

  // Salary calculations
  const salaireBaseNum = parseFloat(employee.salaireBase) || 0;
  const cnssEst = (salaireBaseNum * 0.0448).toFixed(2);
  const amoEst = (salaireBaseNum * 0.0226).toFixed(2);
  const netEst = (
    salaireBaseNum -
    (parseFloat(cnssEst) + parseFloat(amoEst))
  ).toFixed(2);

  // Experience calculation
  const hireDate = new Date(employee.dateEmbauche);
  const today = new Date();
  const diffMonths =
    (today.getFullYear() - hireDate.getFullYear()) * 12 +
    (today.getMonth() - hireDate.getMonth());
  const experienceText =
    diffMonths < 12
      ? `${diffMonths} mois`
      : `${Math.floor(diffMonths / 12)} an(s) et ${diffMonths % 12} mois`;

  // Initials
  const initials = employee.user.nom
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl border border-primary/20">
                {initials}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {employee.user.nom}
                  <Badge
                    variant={employee.actif ? "default" : "secondary"}
                    className="ml-2"
                  >
                    {employee.actif ? "Actif" : "Inactif"}
                  </Badge>
                </DialogTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {employee.user.email}
                  </span>
                  {employee.user.role?.nom && (
                    <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-foreground font-medium">
                      <Briefcase className="size-3.5" />
                      {employee.user.role.nom}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Building className="size-3.5" />
                    ID Employé #{employee.id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Financial Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">
              Salaire de Base
            </p>
            <p className="text-lg font-bold font-mono text-primary mt-1">
              {salaireBaseNum.toLocaleString("fr-FR")} MAD
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">
              Net Estimé (CNSS/AMO)
            </p>
            <p className="text-lg font-bold font-mono text-emerald-600 mt-1">
              {parseFloat(netEst).toLocaleString("fr-FR")} MAD
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">
              Matricule CNSS
            </p>
            <p className="text-sm font-semibold font-mono mt-1 text-slate-800">
              {employee.matriculeCnss || "Non renseigné"}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">
              Ancienneté
            </p>
            <p className="text-sm font-semibold mt-1">{experienceText}</p>
          </div>
        </div>

        <Tabs defaultValue="contract" className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contract" className="gap-1.5 text-xs">
              <User className="size-3.5" />
              Contrat & Profil
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-1.5 text-xs">
              <History className="size-3.5" />
              Pointage & Historique ({shifts.length})
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-1.5 text-xs">
              <FileText className="size-3.5" />
              Bulletins de Paie ({slips.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CONTRAT ET PROFIL */}
          <TabsPanel value="contract" className="space-y-4 pt-4">
            <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <h4 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
                <Briefcase className="size-4 text-primary" />
                Dossier Administratif
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Nom & Prénom
                  </span>
                  <span className="font-semibold">{employee.user.nom}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Email de connexion
                  </span>
                  <span className="font-mono text-xs">
                    {employee.user.email}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Matricule CNSS
                  </span>
                  <span className="font-mono text-xs">
                    {employee.matriculeCnss ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        CNSS: {employee.matriculeCnss}
                      </Badge>
                    ) : (
                      <span className="text-amber-600 font-normal">
                        À régulariser
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Date d'embauche
                  </span>
                  <span className="font-medium">
                    {new Date(employee.dateEmbauche).toLocaleDateString(
                      "fr-FR",
                      {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Compte Utilisateur Système
                  </span>
                  <span className="font-mono text-xs">
                    User ID #{employee.userId}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Statut du dossier
                  </span>
                  <Badge
                    variant={employee.actif ? "default" : "secondary"}
                    className="mt-0.5"
                  >
                    {employee.actif ? "En activité" : "Suspendu / Inactif"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3 bg-card">
              <h4 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
                <DollarSign className="size-4 text-emerald-600" />
                Décomposition Fiscale Légale (Cotisations Réglementaires)
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-muted-foreground">
                    Salaire Brut de Base
                  </span>
                  <span className="font-mono font-semibold">
                    {salaireBaseNum.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b text-amber-700">
                  <span>- Retenue CNSS Salariale (4,48% plafonné)</span>
                  <span className="font-mono">-{cnssEst} MAD</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b text-amber-700">
                  <span>- Retenue AMO Salariale (2,26%)</span>
                  <span className="font-mono">-{amoEst} MAD</span>
                </div>
                <div className="flex justify-between items-center py-2 font-bold text-sm text-emerald-700 bg-emerald-50/50 px-2 rounded">
                  <span>Salaire Net Estimé</span>
                  <span className="font-mono">{netEst} MAD</span>
                </div>
              </div>
            </div>
          </TabsPanel>

          {/* TAB 2: HISTORIQUE DE POINTAGE */}
          <TabsPanel value="attendance" className="space-y-3 pt-4">
            {loadingShifts ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Chargement de l'historique de présence…
              </p>
            ) : shifts.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/10">
                <Clock className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">
                  Aucun enregistrement de pointage
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Les futurs démarrages de service apparaîtront automatiquement
                  ici.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold flex items-center gap-1.5 text-sm">
                        <span>Service #{shift.id}</span>
                        <span className="text-muted-foreground font-normal text-xs">
                          •{" "}
                          {new Date(shift.startedAt).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                      </div>
                      <Badge
                        variant={
                          shift.statut === "ACTIF"
                            ? "default"
                            : shift.statut === "EN_PAUSE"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {shift.statut}
                      </Badge>
                    </div>

                    <div className="text-muted-foreground flex items-center gap-3 my-1">
                      <span>
                        Début:{" "}
                        {new Date(shift.startedAt).toLocaleTimeString("fr-FR")}
                      </span>
                      <span>
                        Fin:{" "}
                        {shift.endedAt
                          ? new Date(shift.endedAt).toLocaleTimeString("fr-FR")
                          : "En cours"}
                      </span>
                    </div>

                    {shift.segments.length > 0 && (
                      <div className="mt-2 pt-2 border-t space-y-1">
                        <p className="font-medium text-slate-700 text-[11px]">
                          Segments temporels:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {shift.segments.map((seg) => (
                            <div
                              key={seg.id}
                              className="bg-muted/40 p-1.5 rounded flex items-center justify-between"
                            >
                              <span className="font-mono text-[10px]">
                                {seg.type === "TRAVAIL"
                                  ? "💼 Travail"
                                  : "☕ Pause"}
                              </span>
                              <span className="text-[10px]">
                                {new Date(seg.debut).toLocaleTimeString(
                                  "fr-FR",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                                {" → "}
                                {seg.fin
                                  ? new Date(seg.fin).toLocaleTimeString(
                                      "fr-FR",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )
                                  : "en cours"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsPanel>

          {/* TAB 3: BULLETINS DE PAIE */}
          <TabsPanel value="payroll" className="space-y-3 pt-4">
            {loadingSlips ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Chargement des bulletins de paie…
              </p>
            ) : slips.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/10">
                <FileText className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">
                  Aucun bulletin de paie généré
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Allez dans l'onglet "Paie" pour calculer et valider les
                  bulletins de cet employé.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {slips.map((slip) => (
                  <div
                    key={slip.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 text-xs"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        Bulletin {slip.mois.toString().padStart(2, "0")}/
                        {slip.annee}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Base:{" "}
                        {parseFloat(slip.salaireBase).toLocaleString("fr-FR")}{" "}
                        MAD • Deductions CNSS/AMO
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono font-bold text-emerald-700 text-sm">
                          {parseFloat(slip.salaireNet).toLocaleString("fr-FR")}{" "}
                          MAD
                        </p>
                        <Badge
                          variant={slip.estValide ? "default" : "outline"}
                          className="text-[10px] py-0"
                        >
                          {slip.estValide ? "Validé" : "Brouillon"}
                        </Badge>
                      </div>
                      {onOpenPayslip && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenPayslip(slip)}
                          className="text-xs gap-1"
                        >
                          <FileText className="size-3.5" />
                          Imprimer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
