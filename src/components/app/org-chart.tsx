"use client";

import { useMemo, useState } from "react";

import {
  buildOrgChartTree,
  careerServiceLevelLabels,
  orgChartRagLabels,
  operatingModelLabels,
  type OrgChartNode,
  type OrgChartRag,
  type OrgChartTreeNode,
} from "@/lib/domain/team";

type OrgChartProps = {
  nodes: readonly OrgChartNode[];
  onSelect?: (node: OrgChartNode) => void;
};

type RagFilter = "all" | OrgChartRag;

const ragValues: OrgChartRag[] = ["GREEN", "AMBER", "RED", "UNRESOLVED"];

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function effectiveRag(node: OrgChartNode): OrgChartRag {
  return node.sourceStatus === "confirmed" ? node.rag : "UNRESOLVED";
}

function roleWithoutCluster(node: OrgChartNode): string {
  const suffix = ` · ${node.cluster}`;
  return node.title.endsWith(suffix) ? node.title.slice(0, -suffix.length) : node.title;
}

function signalsFor(node: OrgChartNode): string[] {
  const signals: string[] = [];
  if (node.operatingModel === "SPECIALIST_CASE") {
    if ((node.specialistCaseCount ?? 0) > 0) signals.push(`${node.specialistCaseCount} active case${node.specialistCaseCount === 1 ? "" : "s"}`);
    if ((node.affectedTaxpayers ?? 0) > 0) signals.push(`${node.affectedTaxpayers} affected taxpayer${node.affectedTaxpayers === 1 ? "" : "s"}`);
    if ((node.specialistAttention ?? 0) > 0) signals.push(`${node.specialistAttention} attention`);
    return signals;
  }
  if ((node.assignedClients ?? 0) > 0) signals.push(`${node.assignedClients} clients`);
  if ((node.activeWork ?? 0) > 0) signals.push(`${node.activeWork} active`);
  if ((node.coverageGaps ?? 0) > 0) signals.push(`${node.coverageGaps} gap${node.coverageGaps === 1 ? "" : "s"}`);
  return signals;
}

function matches(node: OrgChartNode, query: string, cluster: string, rag: RagFilter): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  const text = `${node.name} ${node.title} ${node.role} ${node.cluster}`.toLowerCase();
  return (!normalizedQuery || text.includes(normalizedQuery))
    && (cluster === "all" || node.cluster === cluster)
    && (rag === "all" || effectiveRag(node) === rag);
}

function pruneTree(node: OrgChartTreeNode, query: string, cluster: string, rag: RagFilter): OrgChartTreeNode | null {
  const children = node.children
    .map((child) => pruneTree(child, query, cluster, rag))
    .filter((child): child is OrgChartTreeNode => child !== null);

  if (!matches(node, query, cluster, rag) && children.length === 0) return null;
  return { ...node, children };
}

function pathIds(tree: OrgChartTreeNode[], query: string, cluster: string, rag: RagFilter): Set<string> {
  const ids = new Set<string>();
  function visit(node: OrgChartTreeNode): boolean {
    const childMatch = node.children.some(visit);
    const nodeMatch = matches(node, query, cluster, rag);
    if (nodeMatch || childMatch) ids.add(node.id);
    return nodeMatch || childMatch;
  }
  tree.forEach(visit);
  return ids;
}

export function OrgChart({ nodes, onSelect }: OrgChartProps) {
  const tree = useMemo(() => buildOrgChartTree(nodes), [nodes]);
  const clusters = useMemo(() => Array.from(new Set(nodes.map((node) => node.cluster))).sort(), [nodes]);
  const overviewIds = useMemo(() => new Set(nodes.filter((node) => node.parentId === null || node.careerServiceLevel === "5.1").map((node) => node.id)), [nodes]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(overviewIds));
  const [query, setQuery] = useState("");
  const [cluster, setCluster] = useState("all");
  const [rag, setRag] = useState<RagFilter>("all");

  const isFiltered = Boolean(query.trim() || cluster !== "all" || rag !== "all");
  const filteredTree = useMemo(() => {
    if (!isFiltered) return tree;
    return tree.map((node) => pruneTree(node, query, cluster, rag)).filter((node): node is OrgChartTreeNode => node !== null);
  }, [cluster, isFiltered, query, rag, tree]);
  const matchingCount = useMemo(() => nodes.filter((node) => matches(node, query, cluster, rag)).length, [cluster, nodes, query, rag]);

  const expandedForRender = useMemo(() => {
    if (!isFiltered) return expanded;
    return new Set([...expanded, ...pathIds(tree, query, cluster, rag)]);
  }, [cluster, expanded, isFiltered, query, rag, tree]);

  const resetOverview = () => setExpanded(new Set(overviewIds));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="org-chart" aria-label="Interactive team organization chart">
      <div className="org-chart__topline">
        <div className="org-chart__title-block">
          <strong>Team hierarchy</strong>
          <span>{nodes.length} people · {clusters.length} clusters</span>
        </div>
        <div className="org-chart__tools">
          <label className="org-chart__search">
            <span className="sr-only">Search people</span>
            <input aria-label="Search people" onChange={(event) => setQuery(event.target.value)} placeholder="Search people…" type="search" value={query} />
          </label>
          <label className="sr-only" htmlFor="org-chart-cluster">Filter by cluster</label>
          <select aria-label="Filter by cluster" id="org-chart-cluster" onChange={(event) => setCluster(event.target.value)} value={cluster}>
            <option value="all">All clusters</option>
            {clusters.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="org-chart-rag">Filter by status</label>
          <select aria-label="Filter by status" id="org-chart-rag" onChange={(event) => setRag(event.target.value as RagFilter)} value={rag}>
            <option value="all">All status</option>
            {ragValues.map((item) => <option key={item} value={item}>{orgChartRagLabels[item]}</option>)}
          </select>
        </div>
      </div>

      <div className="org-chart__context">
        <span className="org-chart__context-note">{isFiltered ? `${matchingCount} matching people · reporting context retained` : "Click a person to inspect operating context"}</span>
        <div aria-label="Team operating models" className="org-chart__model-key">
          <span><i className="org-chart__model-dot org-chart__model-dot--delivery" />{operatingModelLabels.DELIVERY}</span>
          <span><i className="org-chart__model-dot org-chart__model-dot--specialist" />{operatingModelLabels.SPECIALIST_CASE}</span>
        </div>
        <div className="org-chart__actions">
          <button className="org-chart__action" onClick={resetOverview} type="button">Reset overview</button>
          <button className="org-chart__action" onClick={collapseAll} type="button">Collapse all</button>
        </div>
      </div>

      <div className="org-chart__surface">
        {filteredTree.length > 0 ? (
          <div aria-label="Team reporting hierarchy" className="org-tree" role="tree">
            {filteredTree.map((node) => <OrgChartBranch expanded={expandedForRender} key={node.id} level={1} node={node} onSelect={onSelect} onToggle={toggle} />)}
          </div>
        ) : (
          <div className="org-chart__empty">No people match these filters.</div>
        )}
      </div>
    </div>
  );
}

function OrgChartBranch({ expanded, level, node, onSelect, onToggle }: { expanded: Set<string>; level: number; node: OrgChartTreeNode; onSelect?: (node: OrgChartNode) => void; onToggle: (id: string) => void }) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <div aria-expanded={hasChildren ? isExpanded : undefined} aria-level={level} aria-selected={false} className="org-tree__branch" role="treeitem">
      <OrgNodeCard childCount={node.children.length} expanded={isExpanded} hasChildren={hasChildren} node={node} onSelect={onSelect} onToggle={onToggle} />
      {hasChildren && isExpanded && <div className="org-tree__children" role="group">
        {node.children.map((child) => <OrgChartBranch expanded={expanded} key={child.id} level={level + 1} node={child} onSelect={onSelect} onToggle={onToggle} />)}
      </div>}
    </div>
  );
}

function OrgNodeCard({ childCount, node, expanded, hasChildren, onSelect, onToggle }: { childCount: number; node: OrgChartNode; expanded: boolean; hasChildren: boolean; onSelect?: (node: OrgChartNode) => void; onToggle: (id: string) => void }) {
  const rag = effectiveRag(node);
  const signals = signalsFor(node);
  const levelLabel = careerServiceLevelLabels[node.careerServiceLevel];

  return (
    <article className={`org-node${node.sourceStatus !== "confirmed" ? " org-node--provisional" : ""}`}>
      <button aria-label={`Open details for ${node.name}`} className="org-node__identity" onClick={() => onSelect?.(node)} type="button">
        <span aria-hidden="true" className="org-node__avatar">{node.photoUrl ? <span className="org-node__photo" style={{ backgroundImage: `url("${node.photoUrl}")` }} /> : initialsFor(node.name)}</span>
        <span className="org-node__content">
          <strong>{node.name}</strong>
          <span className="org-node__role">{roleWithoutCluster(node)}</span>
          <span className="org-node__meta">
            <b className="org-node__level">{node.careerServiceLevel} · {levelLabel}</b>
            <span className={`org-node__status org-node__status--${rag.toLowerCase()}`}><i aria-hidden="true" />{orgChartRagLabels[rag]}</span>
          </span>
          {node.operatingModel === "SPECIALIST_CASE" && <span className="org-node__model">{operatingModelLabels.SPECIALIST_CASE}</span>}
          {signals.length > 0 && <span className="org-node__signals">{signals.map((signal) => <span key={signal}>{signal}</span>)}</span>}
          {node.sourceStatus !== "confirmed" && <span className="org-node__provisional">{node.sourceStatus === "chart-label-pending" ? "Name confirmation pending" : "Provisional structural role"}</span>}
        </span>
      </button>
      {node.cluster !== "All A&T" && <span className="org-node__cluster">{node.cluster}</span>}
      {hasChildren && <button aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}; ${childCount} direct reports`} className="org-node__disclosure" onClick={() => onToggle(node.id)} type="button"><span aria-hidden="true">{expanded ? "⌄" : "›"}</span>{childCount} direct report{childCount === 1 ? "" : "s"}</button>}
    </article>
  );
}
