import { useState, useCallback } from 'react';
import { Upload, Link, Search, Loader2, X, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WordImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  wordText: string;
}

interface PixabayImage {
  id: number;
  preview: string;
  web: string;
  thumb: string;
}

const WordImagePicker = ({ value, onChange, wordText }: WordImagePickerProps) => {
  const { toast } = useToast();
  const [pixabayImages, setPixabayImages] = useState<PixabayImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');

  const searchPixabay = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('pixabay-search', {
        body: { query },
      });
      if (error) throw error;
      setPixabayImages(data.images || []);
      if (!data.images?.length) toast({ title: 'No images found' });
    } catch {
      toast({ title: 'Failed to search images', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, [toast]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('word-images').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('word-images').getPublicUrl(path);
      onChange(urlData.publicUrl);
      toast({ title: 'Image uploaded! 📸' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Preview */}
      {value && (
        <div className="relative w-full h-40 rounded-xl overflow-hidden bg-muted">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { onChange(''); setUrlInput(''); }}
            className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-background"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <Tabs defaultValue="pixabay">
        <TabsList className="w-full rounded-xl">
          <TabsTrigger value="pixabay" className="flex-1 gap-1 rounded-lg text-xs">
            <Search size={14} /> Pixabay
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1 gap-1 rounded-lg text-xs">
            <Upload size={14} /> Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1 gap-1 rounded-lg text-xs">
            <Link size={14} /> URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pixabay" className="mt-2 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search images..."
              defaultValue={wordText}
              onKeyDown={e => e.key === 'Enter' && searchPixabay((e.target as HTMLInputElement).value)}
              className="rounded-xl flex-1"
            />
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={searching}
              onClick={() => searchPixabay(wordText)}
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </Button>
          </div>
          {pixabayImages.length > 0 && (
            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
              {pixabayImages.map(img => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onChange(img.web)}
                  className={`rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                    value === img.web ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
            {uploading ? (
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImageIcon size={24} className="text-muted-foreground mb-1" />
                <span className="text-sm text-muted-foreground">Click to upload image</span>
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
              className="rounded-xl flex-1"
            />
            <Button variant="outline" className="rounded-xl" onClick={() => onChange(urlInput)} disabled={!urlInput}>
              Set
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WordImagePicker;
