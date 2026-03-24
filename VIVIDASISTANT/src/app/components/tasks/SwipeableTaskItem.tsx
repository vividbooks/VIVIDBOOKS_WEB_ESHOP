import React, { useState } from 'react';
import { motion, PanInfo } from 'motion/react';
import { Check, Trash2, Calendar, Loader2 } from 'lucide-react';
import { Task } from '@/app/contexts/AppContext';
import clsx from 'clsx';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

interface SwipeableTaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SwipeableTaskItem: React.FC<SwipeableTaskItemProps> = ({ task, onToggle, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingCalendar, setIsProcessingCalendar] = useState(false);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -100) {
      setIsDeleting(true);
      setTimeout(() => onDelete(task.id), 200);
    } else if (info.offset.x > 100) {
      onToggle(task.id);
    }
  };

  const createAndDownloadICS = (data: any) => {
    // Helper to format date for ICS (YYYYMMDDTHHMMSS)
    const formatICSDate = (date: string, time: string | null) => {
        const d = new Date(`${date}T${time || '09:00:00'}`);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let start = formatICSDate(data.startDate, data.startTime);
    let end = "";
    
    if (data.endTime) {
         end = formatICSDate(data.endDate || data.startDate, data.endTime);
    } else {
        // Default duration 1 hour
        const d = new Date(`${data.startDate}T${data.startTime || '09:00:00'}`);
        d.setHours(d.getHours() + 1);
        end = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = crypto.randomUUID(); // Native browser UUID
    
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//DictationApp//CS',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${data.title}`,
        `DESCRIPTION:Vytvořeno z aplikace Diktování`,
        data.location ? `LOCATION:${data.location}` : '',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'event.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleAddToCalendar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessingCalendar(true);
    
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/parse-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ text: task.text }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error === "Nelze najít datum v textu" ? "V textu chybí datum" : data.error);
        return;
      }

      if (data.startDate) {
        createAndDownloadICS(data);
        toast.success("Otevírám váš kalendář...");
      } else {
        toast.error("Nepodařilo se rozpoznat datum.");
      }

    } catch (error) {
      console.error(error);
      toast.error("Chyba při komunikaci se serverem.");
    } finally {
      setIsProcessingCalendar(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="relative group touch-pan-y"
    >
      {/* Background Actions */}
      <div className="absolute inset-0 rounded-2xl flex items-center justify-between px-6 overflow-hidden">
        <div className="flex items-center gap-2 text-[#30D158] font-bold opacity-0 group-hover:opacity-20 transition-opacity">
          <Check size={24} /> 
          <span className="text-sm uppercase tracking-wider">Hotovo</span>
        </div>
        <div className="flex items-center gap-2 text-[#FF453A] font-bold opacity-0 group-hover:opacity-20 transition-opacity">
          <span className="text-sm uppercase tracking-wider">Smazat</span>
          <Trash2 size={24} />
        </div>
      </div>

      {/* Foreground Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.02, cursor: "grabbing" }}
        className={clsx(
          "relative bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-sm z-10 transition-colors",
          task.completed && "opacity-60 bg-muted/50"
        )}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button 
            onClick={() => onToggle(task.id)}
            className={clsx(
              "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
              task.completed 
                ? "bg-[#30D158] border-[#30D158]" 
                : "border-muted-foreground hover:border-[#30D158]"
            )}
          >
            {task.completed && <Check size={14} className="text-black" strokeWidth={3} />}
          </button>
          
          <div className="flex flex-col min-w-0">
            <span className={clsx(
              "text-base md:text-lg font-medium transition-all text-foreground whitespace-pre-wrap break-words leading-relaxed",
              task.completed && "line-through text-muted-foreground"
            )}>
              {task.text}
            </span>
            <div className="flex items-center gap-2">
               <span className="text-xs text-muted-foreground">
                 {new Date(task.createdAt).toLocaleDateString('cs-CZ')}
               </span>
               {task.recordingDuration && (
                 <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono">
                   {task.recordingDuration}
                 </span>
               )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pl-2 shrink-0 self-start mt-1">
          {!task.completed && (
            <button
              onClick={handleAddToCalendar}
              disabled={isProcessingCalendar}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              title="Přidat do kalendáře"
            >
              {isProcessingCalendar ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Calendar size={16} strokeWidth={2.5} />
              )}
              <span className="text-xs font-bold uppercase tracking-wide">Do kalendáře</span>
            </button>
          )}
          
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            title="Smazat"
          >
            <Trash2 size={18} />
          </button>
        </div>

      </motion.div>
    </motion.div>
  );
};
