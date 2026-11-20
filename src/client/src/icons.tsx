import {
  ArrowUp,
  Bell,
  Car,
  Check,
  ChevronRight,
  CloudLightning,
  EyeOff,
  HandHelping,
  Home,
  Lightbulb,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  PersonStanding,
  Plus,
  Search,
  Send,
  Shield,
  Sparkles,
  User,
  Users,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  food: Utensils,
  shield: Shield,
  ride: Car,
  youth: PersonStanding,
  storm: CloudLightning,
  family: Users,
  mic: Mic,
  msg: MessageCircle,
  pin: MapPin,
  hand: HandHelping,
  mega: Megaphone,
  spark: Sparkles,
  bell: Bell,
  check: Check,
  lock: Lock,
  lamp: Lightbulb,
  plus: Plus,
  send: Send,
  user: User,
  chev: ChevronRight,
  home: Home,
  x: X,
  up: ArrowUp,
  eyeoff: EyeOff,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const Glyph = ICONS[name] ?? MessageCircle;
  return <Glyph className="ic" size={size} strokeWidth={2} aria-hidden="true" />;
}

export function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="16" y="1.5" width="20.5" height="20.5" rx="2" transform="rotate(45 16 1.5)" fill="#0F6B3A" />
      <path d="M10.5 10.5l11 11M21.5 10.5l-11 11" stroke="#FCFCF9" strokeWidth="3.2" strokeLinecap="square" fill="none" />
    </svg>
  );
}
