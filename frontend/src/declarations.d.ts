// Déclarations ambiantes — workflow Docker
// node_modules vit dans le container, pas sur le host.
// Ces types couvrent tous les usages du projet sans npm install local.

// Namespace global React — requis pour la syntaxe React.FormEvent, React.FC, etc.
// dans les fichiers .tsx sans import React explicite (JSX transform moderne).
declare namespace React {
  type FormEvent<T = Element>   = import('react').FormEvent<T>;
  type ChangeEvent<T = Element> = import('react').ChangeEvent<T>;
  type MouseEvent<T = Element>  = import('react').MouseEvent<T>;
  type KeyboardEvent<T = Element> = import('react').KeyboardEvent<T>;
  type ReactNode                = import('react').ReactNode;
  type ReactElement             = import('react').ReactElement;
  type FC<P = object>           = import('react').FC<P>;
  type RefObject<T>             = import('react').RefObject<T>;
  type MutableRefObject<T>      = import('react').MutableRefObject<T>;
  type Dispatch<A>              = import('react').Dispatch<A>;
  type SetStateAction<S>        = import('react').SetStateAction<S>;
  type Context<T>               = import('react').Context<T>;
  // Fragment : requis pour <React.Fragment key={...}> dans les listes JSX
  const Fragment: FC<{ children?: ReactNode }>;
}

declare module 'react' {
  // --- Types utilitaires ---
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type ReactNode = ReactElement | string | number | boolean | null | undefined;
  export type ReactElement = object;
  export type FC<P = object> = (props: P & { children?: ReactNode }) => ReactElement | null;
  export type RefObject<T> = { readonly current: T | null };
  export type MutableRefObject<T> = { current: T };

  // --- Événements synthétiques ---
  export interface SyntheticEvent<T = Element> {
    preventDefault(): void;
    stopPropagation(): void;
    target: EventTarget & T;
    currentTarget: EventTarget & T;
  }
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
    target: EventTarget & T & { value: string; name: string; checked: boolean };
  }
  export interface MouseEvent<T = Element> extends SyntheticEvent<T> {}
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    key: string;
    code: string;
    preventDefault(): void;
  }

  // --- Hooks ---
  export function useState<S>(init: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<unknown>): void;
  export function useCallback<T extends (...args: unknown[]) => unknown>(cb: T, deps: ReadonlyArray<unknown>): T;
  export function useMemo<T>(factory: () => T, deps: ReadonlyArray<unknown>): T;
  export function useRef<T>(init: T): MutableRefObject<T>;
  export function useRef<T>(init: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useContext<T>(ctx: Context<T>): T;

  // --- Context ---
  export interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }>; }
  export function createContext<T>(defaultValue: T): Context<T>;

  // --- Export par défaut (import React from 'react') ---
  const React: { [key: string]: unknown };
  export default React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown, key?: unknown): object;
  export function jsxs(type: unknown, props: unknown, key?: unknown): object;
  export const Fragment: unique symbol;
}

declare module 'lucide-react' {
  import type { FC } from 'react';
  export interface LucideProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    className?: string;
    style?: Record<string, unknown>;
    [key: string]: unknown;
  }
  export type LucideIcon = FC<LucideProps>;
  export const Leaf: LucideIcon;
  export const Sprout: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const Plus: LucideIcon;
  export const Search: LucideIcon;
  export const X: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Edit2: LucideIcon;
  export const FlaskConical: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Archive: LucideIcon;
  export const Trash2: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const MapPin: LucideIcon;
  export const ShoppingCart: LucideIcon;
  export const Settings2: LucideIcon;
  export const Clock: LucideIcon;
  export const XCircle: LucideIcon;
  export const PackageCheck: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const Ban: LucideIcon;
  export const Building2: LucideIcon;
  export const Package: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const BarChart2: LucideIcon;
  export const Filter: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Send: LucideIcon;
  export const Bell: LucideIcon;
  export const User: LucideIcon;
  export const Users: LucideIcon;
  export const LogOut: LucideIcon;
  export const Home: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const Info: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Circle: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const Loader2: LucideIcon;
  export const Calendar: LucideIcon;
  export const Globe: LucideIcon;
  export const Lock: LucideIcon;
  export const Unlock: LucideIcon;
  export const FileText: LucideIcon;
  export const Clipboard: LucideIcon;
  export const Tag: LucideIcon;
  export const Layers: LucideIcon;
  export const Activity: LucideIcon;
  export const Database: LucideIcon;
  export const Server: LucideIcon;
  export const Shield: LucideIcon;
  export const Star: LucideIcon;
  export const Heart: LucideIcon;
  export const Zap: LucideIcon;
  export const Target: LucideIcon;
  // Catch-all pour les autres icônes utilisées ailleurs dans le projet
  const _default: { [key: string]: LucideIcon };
  export default _default;
}
