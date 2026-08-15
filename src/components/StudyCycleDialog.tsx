import { useState, useEffect } from "react";
import { Music } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Subject } from "@/services/subjects";
import { NewBlock, StudyCycle, CyclePlanningMetadata } from "@/services/studyCycles";
import StudyCycleModeSelector from "@/components/study-cycle/StudyCycleModeSelector";
import StudyCycleSimpleForm from "@/components/study-cycle/StudyCycleSimpleForm";
import StudyCycleAdvancedWizard from "@/components/study-cycle/StudyCycleAdvancedWizard";
import { AnimatePresence, motion } from "framer-motion";

interface StudyCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  onSave: (name: string, blocks: NewBlock[], planning?: CyclePlanningMetadata) => Promise<void>;
  cycleToEdit?: StudyCycle | null;
  userId?: string;
  onSubjectsChanged?: () => void;
}

type WizardMode = "select" | "simple" | "advanced";

const StudyCycleDialog = ({ open, onOpenChange, subjects, onSave, cycleToEdit, userId, onSubjectsChanged }: StudyCycleDialogProps) => {
  const [mode, setMode] = useState<WizardMode>("select");
  const isEditing = !!cycleToEdit;

  useEffect(() => {
    if (open) {
      setMode(isEditing ? "simple" : "select");
    }
  }, [open, isEditing]);

  const handleSave = async (name: string, blocks: NewBlock[], planning?: CyclePlanningMetadata) => {
    await onSave(name, blocks, planning);
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (mode !== "select" && !isEditing) {
      setMode("select");
    } else {
      onOpenChange(false);
    }
  };

  const getTitle = () => {
    if (isEditing) return "Editar Ciclo";
    if (mode === "select") return "Criar Novo Ciclo";
    if (mode === "simple") return "Ciclo Simples";
    return "Ciclo Avançado (Inteligente)";
  };

  const getDescription = () => {
    if (isEditing) return "Edite o nome, reordene ou altere as disciplinas do ciclo.";
    if (mode === "select") return "Escolha como deseja montar o seu ciclo de estudos.";
    if (mode === "simple") return "Monte seu ciclo como uma playlist: adicione disciplinas e defina o tempo de cada uma.";
    return "O Zenit calcula a distribuição ideal com base na sua carga horária e pesos.";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {mode === "select" && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <StudyCycleModeSelector onSelect={(m) => setMode(m)} />
            </motion.div>
          )}

          {mode === "simple" && (
            <motion.div key="simple" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <StudyCycleSimpleForm
                subjects={subjects}
                onSave={handleSave}
                cycleToEdit={cycleToEdit}
                userId={userId}
                onSubjectsChanged={onSubjectsChanged}
                onCancel={handleCancel}
              />
            </motion.div>
          )}

          {mode === "advanced" && (
            <motion.div key="advanced" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <StudyCycleAdvancedWizard
                subjects={subjects}
                onSave={handleSave}
                onCancel={handleCancel}
                userId={userId}
                onSubjectsChanged={onSubjectsChanged}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default StudyCycleDialog;
