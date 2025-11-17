export type MindmapTemplateId =
  | 'mindmap'
  | 'orgchart'
  | 'hierarchy'
  | 'goals'
  | 'flow';

export interface MindmapNode {
  id: string;
  text: string;
  position: { x: number; y: number };
  color: string;
  icon?: string;
  children: string[];
}

export interface Mindmap {
  id: string;
  title: string;
  template: MindmapTemplateId;
  nodes: Record<string, MindmapNode>;
  rootId: string;
  updatedAt: number;
}

export interface MindmapTemplate {
  id: MindmapTemplateId;
  name: string;
  description: string;
  accent: string;
  bg: string;
  starter?: string[];
}

export const MINDMAP_TEMPLATES: MindmapTemplate[] = [
  {
    id: 'mindmap',
    name: 'Mapa mental',
    description: 'Organize ideias com tópicos centrais e ramificações livres.',
    accent: '#8b5cf6',
    bg: '#ede9fe',
    starter: ['Ideia principal', 'Pilares', 'Pontos de ação']
  },
  {
    id: 'orgchart',
    name: 'Organograma',
    description: 'Mapeie equipes, áreas e responsabilidades de forma clara.',
    accent: '#06b6d4',
    bg: '#ecfeff',
    starter: ['Direção', 'Operações', 'Produto']
  },
  {
    id: 'hierarchy',
    name: 'Lista hierárquica',
    description: 'Estruture itens em níveis com uma leitura sequencial.',
    accent: '#f97316',
    bg: '#fff7ed',
    starter: ['Tópico 1', 'Tópico 2', 'Tópico 3']
  },
  {
    id: 'goals',
    name: 'Metas',
    description: 'Quebre metas em marcos, entregas e responsáveis.',
    accent: '#22c55e',
    bg: '#ecfdf3',
    starter: ['Objetivo', 'Marcos', 'Indicadores']
  },
  {
    id: 'flow',
    name: 'Fluxo',
    description: 'Visualize etapas e conexões de um processo ou jornada.',
    accent: '#0ea5e9',
    bg: '#e0f2fe',
    starter: ['Entrada', 'Processar', 'Saída']
  }
];

const pastelPalette = ['#a78bfa', '#60a5fa', '#34d399', '#fb7185', '#fbbf24', '#f472b6', '#38bdf8'];

function pickColor(index: number) {
  return pastelPalette[index % pastelPalette.length];
}

function createNode(text: string, position: { x: number; y: number }, color: string, icon?: string): MindmapNode {
  return {
    id: crypto.randomUUID(),
    text,
    position,
    color,
    icon,
    children: []
  };
}

export function createMindmapFromTemplate(template: MindmapTemplateId, title?: string): Mindmap {
  const now = Date.now();
  const baseTitle = title || 'Novo mapa';
  const templateDef = MINDMAP_TEMPLATES.find((item) => item.id === template) ?? MINDMAP_TEMPLATES[0];
  const root = createNode(baseTitle, { x: 0, y: 0 }, templateDef.accent);

  const starterNodes = (templateDef.starter ?? []).map((label, index) => {
    const node = createNode(label, { x: 220, y: index * 140 - 60 }, pickColor(index));
    root.children.push(node.id);
    return node;
  });

  const nodes: Record<string, MindmapNode> = starterNodes.reduce(
    (acc, node) => {
      acc[node.id] = node;
      return acc;
    },
    { [root.id]: root }
  );

  return {
    id: crypto.randomUUID(),
    title: baseTitle,
    template,
    nodes,
    rootId: root.id,
    updatedAt: now
  };
}

export function updateNodeText(map: Mindmap, nodeId: string, text: string): Mindmap {
  const node = map.nodes[nodeId];
  if (!node) return map;
  return {
    ...map,
    nodes: {
      ...map.nodes,
      [nodeId]: { ...node, text }
    },
    updatedAt: Date.now()
  };
}

export function addChildNode(map: Mindmap, parentId: string, label = 'Novo tópico'): Mindmap {
  const parent = map.nodes[parentId];
  if (!parent) return map;
  const siblingCount = parent.children.length;
  const child = createNode(label, { x: parent.position.x + 220, y: parent.position.y + siblingCount * 120 - 40 }, pickColor(siblingCount + 1));

  return {
    ...map,
    nodes: {
      ...map.nodes,
      [child.id]: child,
      [parentId]: { ...parent, children: [...parent.children, child.id] }
    },
    updatedAt: Date.now()
  };
}

export function addSiblingNode(map: Mindmap, siblingId: string, label = 'Novo tópico'): Mindmap {
  const target = map.nodes[siblingId];
  if (!target) return map;
  const parentEntry = Object.values(map.nodes).find((node) => node.children.includes(siblingId));
  if (!parentEntry) return map;
  const parent = parentEntry;
  const index = parent.children.length;
  const sibling = createNode(label, { x: parent.position.x + 220, y: parent.position.y + index * 120 - 40 }, pickColor(index + 2));

  return {
    ...map,
    nodes: {
      ...map.nodes,
      [sibling.id]: sibling,
      [parent.id]: { ...parent, children: [...parent.children, sibling.id] }
    },
    updatedAt: Date.now()
  };
}

export function updateNodePosition(map: Mindmap, nodeId: string, position: { x: number; y: number }): Mindmap {
  const node = map.nodes[nodeId];
  if (!node) return map;
  return {
    ...map,
    nodes: {
      ...map.nodes,
      [nodeId]: { ...node, position }
    },
    updatedAt: Date.now()
  };
}

export function updateNodeStyle(map: Mindmap, nodeId: string, updates: Partial<Pick<MindmapNode, 'color' | 'icon'>>): Mindmap {
  const node = map.nodes[nodeId];
  if (!node) return map;
  return {
    ...map,
    nodes: {
      ...map.nodes,
      [nodeId]: { ...node, ...updates }
    },
    updatedAt: Date.now()
  };
}

export function removeNode(map: Mindmap, nodeId: string): Mindmap {
  if (nodeId === map.rootId) return map;
  const newNodes = { ...map.nodes };
  delete newNodes[nodeId];

  const parentId = Object.keys(newNodes).find((id) => newNodes[id].children.includes(nodeId));
  if (parentId) {
    newNodes[parentId] = {
      ...newNodes[parentId],
      children: newNodes[parentId].children.filter((child) => child !== nodeId)
    };
  }

  return {
    ...map,
    nodes: newNodes,
    updatedAt: Date.now()
  };
}
