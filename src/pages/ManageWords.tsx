import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Volume2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import GroupImagePicker from '@/components/GroupImagePicker';
import WordImagePicker from '@/components/WordImagePicker';

interface Group {
  id: string;
  name: string;
  emoji: string;
  icon_name: string | null;
}

interface Word {
  id: string;
  word: string;
  description: string | null;
  image_url: string | null;
  voice_gender: string;
  group_id: string;
}

const GroupIcon = ({ group, size = 24 }: { group: Group; size?: number }) => {
  if (group.icon_name) {
    const Icon = icons[group.icon_name as keyof typeof icons];
    if (Icon && typeof Icon === 'function') return <Icon size={size} />;
  }
  return <span className="text-2xl">{group.emoji || '📚'}</span>;
};

const ManageWords = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Group form
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupIconName, setGroupIconName] = useState('Book');

  // Word form
  const [wordDialogOpen, setWordDialogOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [wordText, setWordText] = useState('');
  const [wordDesc, setWordDesc] = useState('');
  const [wordImage, setWordImage] = useState('');
  const [wordVoice, setWordVoice] = useState('female');
  const [wordGroupId, setWordGroupId] = useState('');

  const fetchData = async () => {
    const [{ data: g }, { data: w }] = await Promise.all([
      supabase.from('groups').select('*').order('created_at'),
      supabase.from('words').select('*').order('created_at'),
    ]);
    setGroups(g || []);
    setWords(w || []);
  };

  useEffect(() => { fetchData(); }, []);

  const speak = (text: string, gender: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      gender === 'male' ? v.name.toLowerCase().includes('male') || v.name.includes('David') || v.name.includes('James')
        : v.name.toLowerCase().includes('female') || v.name.includes('Samantha') || v.name.includes('Zira')
    );
    if (preferred) u.voice = preferred;
    speechSynthesis.speak(u);
  };

  // Group CRUD
  const saveGroup = async () => {
    if (!groupName.trim()) return;
    if (editingGroup) {
      await supabase.from('groups').update({ name: groupName, icon_name: groupIconName }).eq('id', editingGroup.id);
    } else {
      await supabase.from('groups').insert({ name: groupName, icon_name: groupIconName, emoji: '📚', user_id: user!.id });
    }
    setGroupDialogOpen(false);
    setEditingGroup(null);
    setGroupName('');
    setGroupIconName('Book');
    fetchData();
    toast({ title: editingGroup ? 'Group updated!' : 'Group created! 🎉' });
  };

  const deleteGroup = async (id: string) => {
    await supabase.from('groups').delete().eq('id', id);
    fetchData();
    toast({ title: 'Group deleted' });
  };

  // Word CRUD
  const openWordDialog = (groupId: string, word?: Word) => {
    setWordGroupId(groupId);
    if (word) {
      setEditingWord(word);
      setWordText(word.word);
      setWordDesc(word.description || '');
      setWordImage(word.image_url || '');
      setWordVoice(word.voice_gender);
    } else {
      setEditingWord(null);
      setWordText('');
      setWordDesc('');
      setWordImage('');
      setWordVoice('female');
    }
    setWordDialogOpen(true);
  };

  const saveWord = async () => {
    if (!wordText.trim()) return;
    const data = {
      word: wordText,
      description: wordDesc || null,
      image_url: wordImage || null,
      voice_gender: wordVoice,
      group_id: wordGroupId,
      user_id: user!.id,
    };
    if (editingWord) {
      await supabase.from('words').update(data).eq('id', editingWord.id);
    } else {
      await supabase.from('words').insert(data);
    }
    setWordDialogOpen(false);
    fetchData();
    toast({ title: editingWord ? 'Word updated!' : 'Word added! 🌟' });
  };

  const deleteWord = async (id: string) => {
    await supabase.from('words').delete().eq('id', id);
    fetchData();
    toast({ title: 'Word deleted' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Manage Words</h1>
          <p className="text-muted-foreground mt-1">Create groups and add vocabulary words</p>
        </div>
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2 font-bold" onClick={() => { setEditingGroup(null); setGroupName(''); setGroupIconName('Book'); }}>
              <Plus className="w-4 h-4" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{editingGroup ? 'Edit Group' : 'New Group'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Animals" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <LucideIconPicker value={groupIconName} onChange={setGroupIconName} />
              </div>
              <Button onClick={saveGroup} className="w-full rounded-xl font-bold">Save Group</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">No groups yet</h2>
          <p className="text-muted-foreground">Create your first vocabulary group to get started!</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, i) => {
            const groupWords = words.filter(w => w.group_id === group.id);
            const isExpanded = expandedGroup === group.id;
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl game-card-shadow overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon group={group} size={24} />
                    <div>
                      <h3 className="font-display font-bold text-foreground">{group.name}</h3>
                      <p className="text-sm text-muted-foreground">{groupWords.length} words</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={e => { e.stopPropagation(); setEditingGroup(group); setGroupName(group.name); setGroupIconName(group.icon_name || 'Book'); setGroupDialogOpen(true); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={e => { e.stopPropagation(); deleteGroup(group.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t"
                    >
                      <div className="p-4 space-y-3">
                        {groupWords.map(word => (
                          <div key={word.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                            {word.image_url && (
                              <img src={word.image_url} alt={word.word} className="w-12 h-12 rounded-lg object-cover" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground">{word.word}</p>
                              {word.description && <p className="text-sm text-muted-foreground truncate">{word.description}</p>}
                            </div>
                            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => speak(word.word, word.voice_gender)}>
                              <Volume2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => openWordDialog(group.id, word)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => deleteWord(word.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => openWordDialog(group.id)}>
                          <Plus className="w-4 h-4" /> Add Word
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Word Dialog */}
      <Dialog open={wordDialogOpen} onOpenChange={setWordDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingWord ? 'Edit Word' : 'Add Word'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Word</Label>
              <Input value={wordText} onChange={e => setWordText(e.target.value)} placeholder="e.g. Cat" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={wordDesc} onChange={e => setWordDesc(e.target.value)} placeholder="A small furry animal..." className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <WordImagePicker value={wordImage} onChange={setWordImage} wordText={wordText} />
            </div>
            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={wordVoice === 'female' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl"
                  onClick={() => setWordVoice('female')}
                >
                  👩 Female
                </Button>
                <Button
                  type="button"
                  variant={wordVoice === 'male' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl"
                  onClick={() => setWordVoice('male')}
                >
                  👨 Male
                </Button>
              </div>
            </div>
            <Button onClick={saveWord} className="w-full rounded-xl font-bold">Save Word</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageWords;
