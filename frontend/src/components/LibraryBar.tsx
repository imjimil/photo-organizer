export type CollectionScope =
  | { kind: 'grid' }
  | { kind: 'album'; id: string; name: string }
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'source'; id: string; name: string }

export const defaultCollectionScope: CollectionScope = { kind: 'grid' }
