// Déclarations ambiantes — workflow Docker
// node_modules vit dans le container, pas sur le host.
// Ces types couvrent tous les usages du projet sans npm install local.

// import.meta.env — Vite expose ces variables à la compilation
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}

// ─── Namespace global React ──────────────────────────────────────────────────
// Requis pour React.FormEvent, React.FC, React.ElementType, <React.Fragment>
// dans les fichiers .tsx sans import React explicite (JSX transform moderne).
declare namespace React {
  type FormEvent<T = Element>      = import('react').FormEvent<T>;
  type ChangeEvent<T = Element>    = import('react').ChangeEvent<T>;
  type MouseEvent<T = Element>     = import('react').MouseEvent<T>;
  type KeyboardEvent<T = Element>  = import('react').KeyboardEvent<T>;
  type ReactNode                   = import('react').ReactNode;
  type ReactElement                = import('react').ReactElement;
  type FC<P = object>              = import('react').FC<P>;
  type RefObject<T>                = import('react').RefObject<T>;
  type MutableRefObject<T>         = import('react').MutableRefObject<T>;
  type Dispatch<A>                 = import('react').Dispatch<A>;
  type SetStateAction<S>           = import('react').SetStateAction<S>;
  type Context<T>                  = import('react').Context<T>;

  // ElementType : accepte n'importe quelle fonction composant (props non contraints)
  type ElementType = string | ((props: any) => ReactElement | null);

  // Fragment — déclaré comme fonction callable pour éviter TS2604.
  // children: any pour accepter tableaux, éléments, chaînes sans restriction.
  function Fragment(props: { children?: any }): ReactElement;

  // Attributs HTML — utilisés dans Modal.tsx (FormInput / FormSelect)
  interface HTMLAttributes<T> {
    className?   : string;
    style?       : Record<string, unknown>;
    id?          : string;
    onClick?     : (e: MouseEvent<T>) => void;
    onChange?    : (e: ChangeEvent<T>) => void;
    onKeyDown?   : (e: KeyboardEvent<T>) => void;
    children?    : ReactNode;
    [key: string]: unknown;
  }
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    type?        : string;
    value?       : string | number | readonly string[];
    defaultValue?: string | number | readonly string[];
    placeholder? : string;
    disabled?    : boolean;
    readOnly?    : boolean;
    required?    : boolean;
    min?         : string | number;
    max?         : string | number;
    step?        : string | number;
    name?        : string;
    checked?     : boolean;
    accept?      : string;
    multiple?    : boolean;
    autoFocus?   : boolean;
  }
  interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
    value?       : string | number | readonly string[];
    defaultValue?: string | number | readonly string[];
    disabled?    : boolean;
    required?    : boolean;
    multiple?    : boolean;
    name?        : string;
    autoFocus?   : boolean;
  }
  interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
    value?       : string;
    defaultValue?: string;
    placeholder? : string;
    disabled?    : boolean;
    readOnly?    : boolean;
    required?    : boolean;
    rows?        : number;
    cols?        : number;
    name?        : string;
    autoFocus?   : boolean;
  }
}

// ─── Module react ────────────────────────────────────────────────────────────
declare module 'react' {
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A>       = (value: A) => void;
  export type ReactNode         = ReactElement | string | number | boolean | null | undefined;
  export type ReactElement      = object;
  export type FC<P = object>    = (props: P & { children?: ReactNode }) => ReactElement | null;
  export type RefObject<T>      = { readonly current: T | null };
  export type MutableRefObject<T> = { current: T };

  export interface SyntheticEvent<T = Element> {
    preventDefault(): void;
    stopPropagation(): void;
    target: EventTarget & T;
    currentTarget: EventTarget & T;
  }
  export interface FormEvent<T = Element>    extends SyntheticEvent<T> {}
  export interface ChangeEvent<T = Element>  extends SyntheticEvent<T> {
    target: EventTarget & T & { value: string; name: string; checked: boolean };
  }
  export interface MouseEvent<T = Element>   extends SyntheticEvent<T> {}
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    key: string;
    code: string;
    shiftKey  : boolean;
    ctrlKey   : boolean;
    altKey    : boolean;
    metaKey   : boolean;
    repeat    : boolean;
    preventDefault(): void;
  }

  export interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }>; }
  export function createContext<T>(defaultValue: T): Context<T>;

  export function useState<S>(init: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<unknown>): void;
  export function useCallback<T extends (...args: unknown[]) => unknown>(cb: T, deps: ReadonlyArray<unknown>): T;
  export function useMemo<T>(factory: () => T, deps: ReadonlyArray<unknown>): T;
  export function useRef<T>(init: T): MutableRefObject<T>;
  export function useRef<T>(init: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useContext<T>(ctx: Context<T>): T;

  // Export par défaut : objet React avec Fragment + hooks typés
  // (pour `import React from 'react'; React.Fragment`, `React.useEffect`, etc.)
  interface ReactDefaultExport {
    Fragment: (props: { children?: any }) => ReactElement;
    useEffect:  (effect: () => void | (() => void), deps?: ReadonlyArray<unknown>) => void;
    useState:   <S>(init: S | (() => S)) => [S, Dispatch<SetStateAction<S>>];
    useCallback: <T extends (...args: any[]) => any>(cb: T, deps: ReadonlyArray<unknown>) => T;
    useMemo:    <T>(factory: () => T, deps: ReadonlyArray<unknown>) => T;
    useRef:     <T>(init?: T | null) => MutableRefObject<T>;
    useContext: <T>(ctx: Context<T>) => T;
    createContext: <T>(defaultValue: T) => Context<T>;
    [key: string]: any;
  }
  const React: ReactDefaultExport;
  export default React;
}

// ─── Module react/jsx-runtime ────────────────────────────────────────────────
// Le namespace JSX est requis avec jsx:"react-jsx" pour que TypeScript valide
// les types d'éléments (<React.Fragment>, composants fonctionnels, intrinsèques).
declare module 'react/jsx-runtime' {
  namespace JSX {
    type Element = object;
    interface IntrinsicElements        { [tagName: string]: object; }
    interface ElementChildrenAttribute { children: object; }
    // key est un attribut JSX spécial — exclure du type Props des composants
    interface IntrinsicAttributes      { key?: string | number | null; }
  }
  export function jsx(type: unknown, props: unknown, key?: unknown): JSX.Element;
  export function jsxs(type: unknown, props: unknown, key?: unknown): JSX.Element;
  export const Fragment: unique symbol;
}

// ─── Module lucide-react ─────────────────────────────────────────────────────
declare module 'lucide-react' {
  import type { FC } from 'react';

  export interface LucideProps {
    size?        : number | string;
    color?       : string;
    strokeWidth? : number | string;
    className?   : string;
    style?       : Record<string, unknown>;
    [key: string]: unknown;
  }

  export type LucideIcon = FC<LucideProps>;

  // ── Navigation & Layout ──────────────────────────────────────────────────
  export const LayoutDashboard  : LucideIcon;   // Tableau de bord (App.tsx)
  export const Menu             : LucideIcon;   // Bouton hamburger sidebar
  export const ChevronRight     : LucideIcon;
  export const ChevronLeft      : LucideIcon;
  export const ChevronDown      : LucideIcon;
  export const ChevronUp        : LucideIcon;
  export const Home             : LucideIcon;
  export const ArrowRight       : LucideIcon;
  export const ArrowLeft        : LucideIcon;
  export const ArrowRightLeft   : LucideIcon;   // Transferts
  export const ArrowUpDown      : LucideIcon;
  export const ArrowUpRight     : LucideIcon;

  // ── Utilisateurs & Compte ────────────────────────────────────────────────
  export const User             : LucideIcon;
  export const Users            : LucideIcon;
  export const CircleUser       : LucideIcon;   // Avatar / profil (App.tsx)
  export const LogOut           : LucideIcon;
  export const Lock             : LucideIcon;
  export const Unlock           : LucideIcon;
  export const Shield           : LucideIcon;

  // ── Agriculture & Semences ───────────────────────────────────────────────
  export const Leaf             : LucideIcon;
  export const Sprout           : LucideIcon;
  export const Wheat            : LucideIcon;

  // ── Stock & Logistique ───────────────────────────────────────────────────
  export const Package          : LucideIcon;
  export const PackageCheck     : LucideIcon;
  export const Warehouse        : LucideIcon;   // Stock (App.tsx)
  export const ShoppingCart     : LucideIcon;
  export const Truck            : LucideIcon;   // Livraisons (Orders.tsx)
  export const Store            : LucideIcon;   // Catalogue public (App.tsx)
  export const Layers           : LucideIcon;

  // ── Organisation & Localisation ──────────────────────────────────────────
  export const Building2        : LucideIcon;
  export const MapPin           : LucideIcon;
  export const Globe            : LucideIcon;
  export const Navigation       : LucideIcon;

  // ── Production & Planification ───────────────────────────────────────────
  export const Workflow         : LucideIcon;   // Programmes (App.tsx)
  export const Calendar         : LucideIcon;
  export const Clock            : LucideIcon;
  export const GitBranch        : LucideIcon;
  export const Target           : LucideIcon;

  // ── Analytique & Monitoring ──────────────────────────────────────────────
  export const BarChart2        : LucideIcon;
  export const TrendingUp       : LucideIcon;
  export const TrendingDown     : LucideIcon;
  export const Activity         : LucideIcon;
  export const AlertCircle      : LucideIcon;
  export const Database         : LucideIcon;
  export const Server           : LucideIcon;
  export const Zap              : LucideIcon;

  // ── Thème ────────────────────────────────────────────────────────────────
  export const Sun              : LucideIcon;   // Mode clair (App.tsx)
  export const Moon             : LucideIcon;   // Mode sombre (App.tsx)
  export const Monitor          : LucideIcon;   // Mode auto système (App.tsx)

  // ── Messagerie & Communication ───────────────────────────────────────────
  export const MessageCircle    : LucideIcon;
  export const MessageSquare    : LucideIcon;
  export const Bell             : LucideIcon;
  export const Send             : LucideIcon;
  export const Mic              : LucideIcon;   // Enregistrement vocal (Chat)

  // ── Actions CRUD ─────────────────────────────────────────────────────────
  export const Plus             : LucideIcon;
  export const Edit2            : LucideIcon;
  export const Trash2           : LucideIcon;
  export const Archive          : LucideIcon;
  export const Download         : LucideIcon;
  export const Upload           : LucideIcon;
  export const RefreshCw        : LucideIcon;
  export const RotateCcw        : LucideIcon;   // Reset / annuler (Chat)
  export const Search           : LucideIcon;
  export const Filter           : LucideIcon;
  export const Eye              : LucideIcon;
  export const EyeOff           : LucideIcon;
  export const Settings2        : LucideIcon;
  export const Clipboard        : LucideIcon;
  export const Tag              : LucideIcon;

  // ── Statuts & Feedback ───────────────────────────────────────────────────
  export const CheckCircle      : LucideIcon;
  export const CheckCircle2     : LucideIcon;
  export const XCircle          : LucideIcon;
  export const AlertTriangle    : LucideIcon;
  export const Info             : LucideIcon;
  export const Ban              : LucideIcon;
  export const Loader2          : LucideIcon;
  export const Circle           : LucideIcon;
  export const Square           : LucideIcon;   // Stop enregistrement (Chat)

  // ── Fichiers & Documents ─────────────────────────────────────────────────
  export const FileText         : LucideIcon;
  export const Image            : LucideIcon;

  // ── Divers ───────────────────────────────────────────────────────────────
  export const X                : LucideIcon;
  export const Star             : LucideIcon;
  export const Heart            : LucideIcon;
  export const FlaskConical     : LucideIcon;

  // ── Profil & Communication ───────────────────────────────────────────────
  export const Mail             : LucideIcon;
  export const Key              : LucideIcon;
  export const Camera           : LucideIcon;
  export const Edit3            : LucideIcon;
  export const Check            : LucideIcon;
  export const Receipt          : LucideIcon;

  // ── Analytique supplémentaire ────────────────────────────────────────────
  export const BarChart3        : LucideIcon;

  // Catch-all (sécurité) — icônes non listées ci-dessus
  const _default: { [key: string]: LucideIcon };
  export default _default;
}

// ─── Module axios ────────────────────────────────────────────────────────────
// Utilise `any` comme défaut générique pour préserver la compatibilité avec tout
// le code existant qui fait `.then(r => r.data)` sans annotation explicite.
declare module 'axios' {
  export interface AxiosRequestConfig {
    url?        : string;
    method?     : string;
    baseURL?    : string;
    headers?    : Record<string, string | undefined>;
    params?     : any;
    data?       : any;
    timeout?    : number;
    [key: string]: any;
  }

  export interface AxiosResponse<T = any> {
    data       : T;
    status     : number;
    statusText : string;
    headers    : Record<string, string>;
    config     : AxiosRequestConfig;
  }

  export interface AxiosError extends Error {
    response?    : AxiosResponse<any>;
    config       : AxiosRequestConfig;
    isAxiosError : boolean;
  }

  export interface AxiosInstance {
    get<T    = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T   = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T    = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T  = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    interceptors: {
      request : { use(onFulfilled?: (c: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>, onRejected?: (e: any) => any): number };
      response: { use(onFulfilled?: (r: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>,                onRejected?: (e: any) => any): number };
    };
  }

  export function create(config?: AxiosRequestConfig): AxiosInstance;

  const axios: AxiosInstance & { create: typeof create };
  export default axios;
}
