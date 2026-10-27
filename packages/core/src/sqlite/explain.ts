import type { Plan, PlanNode } from '../types.js';

interface RawSqliteExplainRow {
  id: number;
  parent: number;
  notused?: number;
  detail: string;
  [key: string]: unknown;
}

/**
 * Parses raw SQLite EXPLAIN QUERY PLAN rows into a hierarchical Plan tree.
 */
export function parseSqliteExplainPlan(rows: RawSqliteExplainRow[]): Plan {
  const nodeMap = new Map<number, PlanNode>();
  const rootNodes: PlanNode[] = [];

  // First pass: create node objects
  for (const row of rows) {
    const node: PlanNode = {
      id: row.id,
      parent: row.parent,
      detail: row.detail,
      operation: extractOperation(row.detail),
      children: [],
    };
    nodeMap.set(row.id, node);
  }

  // Second pass: build hierarchy
  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    if (row.parent === 0 || !nodeMap.has(row.parent)) {
      rootNodes.push(node);
    } else {
      const parentNode = nodeMap.get(row.parent);
      parentNode?.children?.push(node);
    }
  }

  // Format as readable indented text
  const text = formatPlanAsText(rootNodes);

  return {
    dialect: 'sqlite',
    raw: rows,
    text,
    nodes: rootNodes,
  };
}

function extractOperation(detail: string): string {
  const match = detail.match(/^([A-Z\s]+)/);
  return match ? match[1].trim() : 'OPERATION';
}

function formatPlanAsText(nodes: PlanNode[], indent = 0): string {
  let result = '';
  const prefix = '  '.repeat(indent);
  for (const node of nodes) {
    result += `${prefix}• ${node.detail}\n`;
    if (node.children && node.children.length > 0) {
      result += formatPlanAsText(node.children, indent + 1);
    }
  }
  return result;
}
