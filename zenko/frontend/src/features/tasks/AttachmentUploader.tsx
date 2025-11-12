import { useState } from 'react';
import Button from '../../components/ui/Button';
import { uploadAttachment } from './api';
import { useToastStore } from '../../components/ui/ToastProvider';
import type { Attachment } from './types';

interface Props {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
}

export default function AttachmentUploader({ attachments, onChange }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToastStore((state) => state.show);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);
    try {
      const uploads = await Promise.all(Array.from(files).map(uploadAttachment));
      onChange([...attachments, ...uploads]);
      toast({ title: 'Anexos enviados', type: 'success' });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar', description: error.message, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900 dark:text-white">Anexos</p>
        <label className="cursor-pointer rounded-2xl border border-dashed border-zenko-primary/40 px-3 py-1 text-xs font-medium text-zenko-primary hover:border-zenko-primary/60">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
          {isUploading ? 'Enviando...' : 'Adicionar'}
        </label>
      </div>
      <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-200">
        {attachments.map((attachment) => (
          <li
            key={attachment.offlineId ?? attachment.url}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5"
          >
            <a href={attachment.url} target="_blank" rel="noreferrer" className="text-zenko-primary underline">
              {attachment.name}
            </a>
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
              onClick={() =>
                onChange(
                  attachments.filter(
                    (item) => (item.offlineId ?? item.url) !== (attachment.offlineId ?? attachment.url)
                  )
                )
              }
            >
              remover
            </Button>
          </li>
        ))}
        {attachments.length === 0 && <li className="text-slate-500 dark:text-slate-400">Nenhum anexo</li>}
      </ul>
    </div>
  );
}
