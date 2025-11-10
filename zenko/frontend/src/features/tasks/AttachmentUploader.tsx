import { useState } from 'react';
import Button from '../../components/ui/Button';
import { uploadAttachment } from './api';
import { useToastStore } from '../../components/ui/ToastProvider';

interface Props {
  attachments: { name: string; url: string }[];
  onChange: (attachments: { name: string; url: string }[]) => void;
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Anexos</p>
        <label className="cursor-pointer text-xs text-zenko-primary">
          <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          {isUploading ? 'Enviando...' : 'Adicionar'}
        </label>
      </div>
      <ul className="space-y-1 text-xs text-slate-300">
        {attachments.map((attachment) => (
          <li key={attachment.url} className="flex items-center justify-between">
            <a href={attachment.url} target="_blank" rel="noreferrer" className="text-zenko-primary underline">
              {attachment.name}
            </a>
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-red-400"
              onClick={() => onChange(attachments.filter((item) => item.url !== attachment.url))}
            >
              remover
            </Button>
          </li>
        ))}
        {attachments.length === 0 && <li>Nenhum anexo</li>}
      </ul>
    </div>
  );
}
