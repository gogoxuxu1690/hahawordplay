import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Volume2, ChevronDown, ChevronRight, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import GroupImagePicker from '@/components/GroupImagePicker';
import WordImagePicker from '@/components/WordImagePicker';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Group {
  id: string;
  name: string;
  emoji: string;
  icon_name: string | null;
  sort_order: number;
  is_active: boolean;
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
  if (group.icon_name && group.icon_name.startsWith('http')) {
    return <img src={group.icon_name} alt="" className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  }
  return <span className="text-2xl">{group.emoji || '📚'}</span>;
};

interface SortableGroupProps {
  group: Group;
  groupWords: Word[];
  isExpanded: boolean;
  isDragging: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddWord: () => void;
  onEditWord: (word: Word) => void;
  onDeleteWord: (id: string) => void;
  onSpeak: (text: string, gender: string) => void;
  onToggleActive: (id: string, value: boolean) => void;
}

const SortableGroupCard = ({
  group, groupWords, isExpanded, isDragging, onToggleExpand,
  onEdit, onDelete, onAddWord, onEditWord, onDeleteWord, onSpeak, onToggleActive,
}: SortableGroupProps) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
    zIndex: isSortableDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style as React.CSSProperties} className={`bg-card rounded-2xl game-card-shadow overflow-hidden transition-opacity ${!group.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={onToggleExpand}>
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="touch-none p-1 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
            onClick={e => e.stopPropagation()}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <GroupIcon group={group} size={24} />
          <div>
            <h3 className="font-display font-bold text-foreground">{group.name}</h3>
            <p className="text-sm text-muted-foreground">{groupWords.length} words</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2" onClick={e => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground hidden sm:inline">{group.is_active ? 'Visible' : 'Hidden'}</span>
            <Switch
              checked={group.is_active}
              onCheckedChange={(val) => onToggleActive(group.id, val)}
              aria-label="Show in Play Tab"
            />
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={e => { e.stopPropagation(); onEdit(); }}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={e => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
          <div onClick={onToggleExpand} className="cursor-pointer">
            {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          </div>
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
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onSpeak(word.word, word.voice_gender)}>
                    <Volume2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEditWord(word)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => onDeleteWord(word.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-xl gap-2" onClick={onAddWord}>
                <Plus className="w-4 h-4" /> Add Word
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ManageWords = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchData = async () => {
    const [{ data: g }, { data: w }] = await Promise.all([
      supabase.from('groups').select('*').order('sort_order'),
      supabase.from('words').select('*').order('created_at'),
    ]);
    setGroups((g as Group[]) || []);
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
      const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.sort_order)) + 1 : 0;
      await supabase.from('groups').insert({ name: groupName, icon_name: groupIconName, emoji: '📚', user_id: user!.id, sort_order: maxOrder });
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = groups.findIndex(g => g.id === active.id);
    const newIndex = groups.findIndex(g => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groups, oldIndex, newIndex);
    setGroups(reordered);

    // Persist new order
    const updates = reordered.map((g, i) =>
      supabase.from('groups').update({ sort_order: i }).eq('id', g.id)
    );
    await Promise.all(updates);
    sonnerToast.success('Group order updated!');
  }, [groups]);

  const toggleGroupActive = useCallback(async (id: string, value: boolean) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, is_active: value } : g));
    await supabase.from('groups').update({ is_active: value }).eq('id', id);
    sonnerToast.success(value ? 'Group visible in Play Tab' : 'Group hidden from Play Tab');
  }, []);

  const toggleAll = useCallback(async (value: boolean) => {
    setGroups(prev => prev.map(g => ({ ...g, is_active: value })));
    const updates = groups.map(g => supabase.from('groups').update({ is_active: value }).eq('id', g.id));
    await Promise.all(updates);
    sonnerToast.success(value ? 'All groups enabled' : 'All groups disabled');
  }, [groups]);

  const activeGroup = activeId ? groups.find(g => g.id === activeId) : null;

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
          <DialogContent className="rounded-2xl max-w-md max-h-[85vh] overflow-y-auto">
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
                <GroupImagePicker value={groupIconName} onChange={setGroupIconName} />
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {groups.map(group => {
                const groupWords = words.filter(w => w.group_id === group.id);
                const isExpanded = expandedGroup === group.id;
                return (
                  <SortableGroupCard
                    key={group.id}
                    group={group}
                    groupWords={groupWords}
                    isExpanded={isExpanded}
                    isDragging={activeId === group.id}
                    onToggleExpand={() => setExpandedGroup(isExpanded ? null : group.id)}
                    onEdit={() => { setEditingGroup(group); setGroupName(group.name); setGroupIconName(group.icon_name || 'Book'); setGroupDialogOpen(true); }}
                    onDelete={() => deleteGroup(group.id)}
                    onAddWord={() => openWordDialog(group.id)}
                    onEditWord={(word) => openWordDialog(group.id, word)}
                    onDeleteWord={deleteWord}
                    onSpeak={speak}
                    onToggleActive={toggleGroupActive}
                  />
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeGroup ? (
              <div className="bg-card rounded-2xl game-card-shadow p-4 opacity-90 shadow-xl border-2 border-primary/30">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-5 h-5 text-muted-foreground" />
                  <GroupIcon group={activeGroup} size={24} />
                  <h3 className="font-display font-bold text-foreground">{activeGroup.name}</h3>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
                <Button type="button" variant={wordVoice === 'female' ? 'default' : 'outline'} className="flex-1 rounded-xl" onClick={() => setWordVoice('female')}>
                  👩 Female
                </Button>
                <Button type="button" variant={wordVoice === 'male' ? 'default' : 'outline'} className="flex-1 rounded-xl" onClick={() => setWordVoice('male')}>
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
