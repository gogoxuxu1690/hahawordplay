import { useState, useMemo } from 'react';
import { icons } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const categorized: Record<string, string[]> = {
  Education: ['Book', 'BookOpen', 'GraduationCap', 'Pencil', 'PenTool', 'School', 'Library', 'Notebook', 'FileText', 'Lightbulb', 'Brain', 'Calculator', 'Ruler', 'Globe'],
  Animals: ['Bug', 'Cat', 'Dog', 'Fish', 'Bird', 'Rabbit', 'Squirrel', 'Turtle', 'Egg', 'Feather', 'PawPrint', 'Snail'],
  Food: ['Apple', 'Cherry', 'Grape', 'Banana', 'Carrot', 'Pizza', 'Cake', 'Coffee', 'CupSoda', 'IceCream', 'Cookie', 'Beef', 'Sandwich', 'Salad', 'Soup'],
  Nature: ['TreePine', 'Trees', 'Flower', 'Leaf', 'Sun', 'Moon', 'Cloud', 'Mountain', 'Waves', 'Snowflake', 'Droplets', 'Rainbow', 'Sprout'],
  Sports: ['Dumbbell', 'Trophy', 'Medal', 'Bike', 'Volleyball', 'Target', 'Swords', 'Footprints'],
  Music: ['Music', 'Headphones', 'Mic', 'Radio', 'Speaker', 'Volume2', 'Guitar'],
  Travel: ['Plane', 'Car', 'Bus', 'Train', 'Ship', 'Compass', 'Map', 'MapPin', 'Luggage', 'Tent', 'Anchor'],
  Home: ['Home', 'Building', 'Bed', 'Sofa', 'Lamp', 'Bath', 'DoorOpen', 'Key', 'Lock'],
  People: ['User', 'Users', 'Baby', 'PersonStanding', 'HandMetal', 'Heart', 'Star', 'Smile', 'ThumbsUp'],
  Tech: ['Monitor', 'Smartphone', 'Tablet', 'Gamepad2', 'Camera', 'Wifi', 'Cpu', 'Zap', 'Rocket'],
};

interface LucideIconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

const LucideIconPicker = ({ value, onChange }: LucideIconPickerProps) => {
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    if (!search) return categorized;
    const q = search.toLowerCase();
    const result: Record<string, string[]> = {};
    for (const [cat, names] of Object.entries(categorized)) {
      const filtered = names.filter(n => n.toLowerCase().includes(q));
      if (filtered.length) result[cat] = filtered;
    }
    return result;
  }, [search]);

  const renderIcon = (name: string) => {
    const Icon = icons[name as keyof typeof icons];
    if (!Icon || typeof Icon !== 'function') return null;
    const isSelected = value === name;
    return (
      <button
        key={name}
        type="button"
        onClick={() => onChange(name)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          isSelected ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'
        }`}
        title={name}
      >
        <Icon size={20} />
      </button>
    );
  };

  const categoryKeys = Object.keys(filteredCategories);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search icons..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="rounded-xl"
      />
      <Tabs defaultValue={categoryKeys[0] || 'Education'}>
        <ScrollArea className="w-full">
          <TabsList className="flex w-max gap-1 bg-muted/50 rounded-xl p-1">
            {categoryKeys.map(cat => (
              <TabsTrigger key={cat} value={cat} className="rounded-lg text-xs px-3 py-1.5">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>
        {categoryKeys.map(cat => (
          <TabsContent key={cat} value={cat} className="mt-2">
            <div className="flex flex-wrap gap-2">
              {filteredCategories[cat].map(renderIcon)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default LucideIconPicker;
