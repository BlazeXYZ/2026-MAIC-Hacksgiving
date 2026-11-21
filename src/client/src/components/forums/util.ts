import type { AuthorRole, ReplyView } from '../../contracts/forums';

export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

const ROLE_LABEL: Record<AuthorRole, string> = {
  coordinator: 'ComForce coordinator',
  volunteer: 'volunteer',
  organization: 'local business',
  neighbor: 'neighbor',
};

/** "Denise · ComForce coordinator", without repeating a label that is already the name. */
export function byline(author: string, role: AuthorRole): string {
  const label = ROLE_LABEL[role];
  return author === label ? author : `${author} · ${label}`;
}

export interface ReplyNode {
  reply: ReplyView;
  children: ReplyNode[];
}

/** Nest replies under their parent, keeping each level oldest first. */
export function replyTree(replies: ReplyView[]): ReplyNode[] {
  const nodes = new Map<string, ReplyNode>();
  for (const reply of replies) nodes.set(reply.id, { reply, children: [] });
  const roots: ReplyNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.reply.parent_id ? nodes.get(node.reply.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
