import { useState } from 'react';
import { Upload, Link, Loader2, X, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GroupImagePickerProps {
  value: string;
  onChange: (url: string) => void;
}

const GroupImagePicker = ({ value, onChange }: GroupImagePickerProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `group-icons/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('word-images').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('word-images').getPublicUrl(path);
      onChange(urlData.publicUrl);
      toast({ title: 'Icon uploaded! 🎨' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {value && (
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted mx-auto">
          <img src={value} alt="Group icon" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { onChange(''); setUrlInput(''); }}
            className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 hover:bg-background"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <Tabs defaultValue="upload">
        <TabsList className="w-full rounded-xl">
          <TabsTrigger value="upload" className="flex-1 gap-1 rounded-lg text-xs">
            <Upload size={14} /> Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1 gap-1 rounded-lg text-xs">
            <Link size={14} /> URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-2">
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
            {uploading ? (
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImageIcon size={20} className="text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Click to upload</span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </TabsContent>

        <TabsContent value="url" className="mt-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="rounded-xl flex-1 text-sm"
            />
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onChange(urlInput)} disabled={!urlInput}>
              Set
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GroupImagePicker;
