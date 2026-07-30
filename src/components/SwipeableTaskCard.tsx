import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Check, Archive } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { registerActivity } from "@/services/activity";
import TaskCard from "./TaskCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SwipeableTaskCardProps {
  id: string;
  subjectName: string;
  description?: string;
  dueDate: string | null;
  isGroupWork: boolean;
  status: string;
  checklist?: { text: string; completed: boolean }[];
  availableStatuses?: string[];
  completedStatusName?: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange?: (id: string, newStatus: string) => void;
  onArchive?: (id: string) => void;
}

const SWIPE_THRESHOLD = 100;

const SwipeableTaskCard = ({
  id,
  subjectName,
  description,
  dueDate,
  isGroupWork,
  status,
  checklist = [],
  availableStatuses = [],
  completedStatusName = "Concluído",
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onDelete,
  onStatusChange,
  onArchive,
}: SwipeableTaskCardProps) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const x = useMotionValue(0);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Background opacity based on swipe distance
  const rightOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const leftOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  
  // Scale for icons
  const rightScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const leftScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);

  const isCompleted = status.toLowerCase().includes("conclu");

  const handleDragEnd = async (_: any, info: PanInfo) => {
    setIsDragging(false);
    const swipeDistance = info.offset.x;

    // Swipe right - complete task
    if (swipeDistance > SWIPE_THRESHOLD && !isCompleted && onStatusChange) {
      onStatusChange(id, completedStatusName);
      if (user) {
        await registerActivity(user.id);
      }
    }
    // Swipe left - archive task
    else if (swipeDistance < -SWIPE_THRESHOLD && onArchive) {
      setShowArchiveConfirm(true);
    }
  };

  const handleConfirmArchive = () => {
    setShowArchiveConfirm(false);
    onArchive?.(id);
  };

  // On desktop, just render the normal TaskCard
  if (!isMobile || selectionMode) {
    return (
      <TaskCard
        id={id}
        subjectName={subjectName}
        description={description}
        dueDate={dueDate}
        isGroupWork={isGroupWork}
        status={status}
        checklist={checklist}
        availableStatuses={availableStatuses}
        selectionMode={selectionMode}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
      />
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-lg">
        {/* Right swipe background (success - complete) */}
        <motion.div
          className="absolute inset-0 bg-success flex items-center justify-start pl-6 rounded-lg"
          style={{ opacity: rightOpacity }}
        >
          <motion.div style={{ scale: rightScale }}>
            <Check className="w-8 h-8 text-success-foreground" />
          </motion.div>
          <span className="text-success-foreground font-medium ml-2">Concluir</span>
        </motion.div>

        {/* Left swipe background (archive) */}
        <motion.div
          className="absolute inset-0 bg-warning flex items-center justify-end pr-6 rounded-lg"
          style={{ opacity: leftOpacity }}
        >
          <span className="text-warning-foreground font-medium mr-2">Arquivar</span>
          <motion.div style={{ scale: leftScale }}>
            <Archive className="w-8 h-8 text-warning-foreground" />
          </motion.div>
        </motion.div>

        {/* Draggable card */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          style={{ x }}
          whileDrag={{ cursor: "grabbing" }}
          className="relative z-10 touch-pan-y"
        >
          <div 
            className={isDragging ? "pointer-events-none" : ""}
            onClickCapture={(e) => {
              // Prevent clicks while dragging
              if (isDragging) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
          >
            <TaskCard
              id={id}
              subjectName={subjectName}
              description={description}
              dueDate={dueDate}
              isGroupWork={isGroupWork}
              status={status}
              checklist={checklist}
              availableStatuses={availableStatuses}
              selectionMode={selectionMode}
              selected={selected}
              onToggleSelect={onToggleSelect}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
            />
          </div>
        </motion.div>
      </div>

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar "{subjectName}"? Você pode restaurá-la em Tarefas Arquivadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchive}>
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SwipeableTaskCard;
