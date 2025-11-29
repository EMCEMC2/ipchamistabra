declare module 'react-dom/client' {
  import { Container } from 'react-dom';
  import { ReactNode } from 'react';

  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  export interface RootOptions {
    onRecoverableError?: (error: unknown) => void;
    identifierPrefix?: string;
  }

  export function createRoot(
    container: Container | null,
    options?: RootOptions
  ): Root;

  export function hydrateRoot(
    container: Container | null,
    initialChildren: ReactNode,
    options?: RootOptions
  ): Root;
}
