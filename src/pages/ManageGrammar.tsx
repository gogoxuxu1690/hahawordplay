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

interface GrammarGroup {
  id: string;
  name: string;
  emoji: string;
  icon_name: string | null;
}

interface GrammarPair {
  id: string;
  question: string;
  answer: string;
  question_image_url: string | null;
  answer_image_url: string | null;
  voice_gender: string;
  group_id: string;
}

const GroupIcon = ({ group, size = 24 }: { group: GrammarGroup; size?: number }) => {
  if (group.icon_name && group.icon_name.startsWith('http')) {
    return <img src={group.icon_name} alt="" className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  }
  return <span className="text-2xl">{group.emoji || '📝'}</span>;
};

const ManageGrammar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GrammarGroup[]>([]);
  const [pairs, setPairs] = useState<GrammarPair[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Group form
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GrammarGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupIconName, setGroupIconName] = useState('');

  // Pair form
  const [pairDialogOpen, setPairDialogOpen] = useState(false);
  const [editingPair, setEditingPair] = useState<GrammarPair | null>(null);
  const [pairQuestion, setPairQuestion] = useState('');
  const [pairAnswer, setPairAnswer] = useState('');
  const [pairQuestionImage, setPairQuestionImage] = useState('');
  const [pairAnswerImage, setPairAnswerImage] = useState('');
  const [pairVoice, setPairVoice] = useState('female');
  const [pairGroupId, setPairGroupId] = useState('');

  const fetchData = async () => {
    const [{ data: g }, { data: p }] = await Promise.all([
      supabase.from('grammar_groups').select('*').order('created_at'),
      supabase.from('grammar_pairs').select('*').order('created_at'),
    ]);
    setGroups(g || []);
    setPairs(p || []);
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
      await supabase.from('grammar_groups').update({ name: groupName, icon_name: groupIconName || null }).eq('id', editingGroup.id);
    } else {
      await supabase.from('grammar_groups').insert({ name: groupName, icon_name: groupIconName || null, emoji: '📝', user_id: user!.id });
    }
    setGroupDialogOpen(false);
    setEditingGroup(null);
    setGroupName('');
    setGroupIconName('');
    fetchData();
    toast({ title: editingGroup ? 'Group updated!' : 'Grammar group created! 🎉' });
  };

  const deleteGroup = async (id: string) => {
    await supabase.from('grammar_groups').delete().eq('id', id);
    fetchData();
    toast({ title: 'Group deleted' });
  };

  // Pair CRUD
  const openPairDialog = (groupId: string, pair?: GrammarPair) => {
    setPairGroupId(groupId);
    if (pair) {
      setEditingPair(pair);
      setPairQuestion(pair.question);
      setPairAnswer(pair.answer);
      setPairQuestionImage(pair.question_image_url || '');
      setPairAnswerImage(pair.answer_image_url || '');
      setPairVoice(pair.voice_gender);
    } else {
      setEditingPair(null);
      setPairQuestion('');
      setPairAnswer('');
      setPairQuestionImage('');
      setPairAnswerImage('');
      setPairVoice('female');
    }
    setPairDialogOpen(true);
  };

  const savePair = async () => {
    if (!pairQuestion.trim() || !pairAnswer.trim()) return;
    const data = {
      question: pairQuestion,
      answer: pairAnswer,
      question_image_url: pairQuestionImage || null,
      answer_image_url: pairAnswerImage || null,
      voice_gender: pairVoice,
      group_id: pairGroupId,
      user_id: user!.id,
    };
    if (editingPair) {
      await supabase.from('grammar_pairs').update(data).eq('id', editingPair.id);
    } else {
      await supabase.from('grammar_pairs').insert(data);
    }
    setPairDialogOpen(false);
    fetchData();
    toast({ title: editingPair ? 'Pair updated!' : 'Pair added! 🌟' });
  };

  const deletePair = async (id: string) => {
    await supabase.from('grammar_pairs').delete().eq('id', id);
    fetchData();
    toast({ title: 'Pair deleted' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Manage Grammar</h1>
          <p className="text-muted-foreground mt-1">Create grammar groups with question-answer pairs</p>
        </div>
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2 font-bold" onClick={() => { setEditingGroup(null); setGroupName(''); setGroupIconName(''); }}>
              <Plus className="w-4 h-4" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingGroup ? 'Edit Group' : 'New Grammar Group'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Present Tense" className="rounded-xl" />
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
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">No grammar groups yet</h2>
          <p className="text-muted-foreground">Create your first grammar group to get started!</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, i) => {
            const groupPairs = pairs.filter(p => p.group_id === group.id);
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
                      <p className="text-sm text-muted-foreground">{groupPairs.length} pairs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={e => { e.stopPropagation(); setEditingGroup(group); setGroupName(group.name); setGroupIconName(group.icon_name || ''); setGroupDialogOpen(true); }}>
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
                        {groupPairs.map(pair => (
                          <div key={pair.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
                            <div className="flex items-start gap-3">
                              {pair.question_image_url && (
                                <img src={pair.question_image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Question</p>
                                <p className="font-bold text-foreground">{pair.question}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 pl-4 border-l-2 border-primary/30">
                              {pair.answer_image_url && (
                                <img src={pair.answer_image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Answer</p>
                                <p className="font-bold text-foreground">{pair.answer}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => speak(pair.question, pair.voice_gender)}>
                                <Volume2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => openPairDialog(group.id, pair)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => deletePair(pair.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => openPairDialog(group.id)}>
                          <Plus className="w-4 h-4" /> Add Pair
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

      {/* Pair Dialog */}
      <Dialog open={pairDialogOpen} onOpenChange={setPairDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingPair ? 'Edit Pair' : 'Add Pair'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Input value={pairQuestion} onChange={e => setPairQuestion(e.target.value)} placeholder="e.g. She ___ to school every day." className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Question Image (optional)</Label>
              <WordImagePicker value={pairQuestionImage} onChange={setPairQuestionImage} wordText={pairQuestion} />
            </div>
            <div className="space-y-2">
              <Label>Answer</Label>
              <Input value={pairAnswer} onChange={e => setPairAnswer(e.target.value)} placeholder="e.g. She goes to school every day." className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Answer Image (optional)</Label>
              <WordImagePicker value={pairAnswerImage} onChange={setPairAnswerImage} wordText={pairAnswer} />
            </div>
            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="flex gap-2">
                <Button type="button" variant={pairVoice === 'female' ? 'default' : 'outline'} className="flex-1 rounded-xl" onClick={() => setPairVoice('female')}>
                  👩 Female
                </Button>
                <Button type="button" variant={pairVoice === 'male' ? 'default' : 'outline'} className="flex-1 rounded-xl" onClick={() => setPairVoice('male')}>
                  👨 Male
                </Button>
              </div>
            </div>
            <Button onClick={savePair} className="w-full rounded-xl font-bold">Save Pair</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageGrammar;
