/**
 * graphStore.js
 * In-Memory & SQLite-Backed Financial Knowledge Graph Engine.
 * 
 * Provides:
 * - O(1) Node & Edge Indexing with bidirectional adjacency maps.
 * - Subgraph Extraction with cycle detection for LLM Prompt Context & UI Visualizers.
 * - Semantic Querying by EntityType, RelationType, and Property Predicates.
 * - Persistence integration with SQLite / tieredStore.
 */

import { EntityTypes, RelationTypes } from './schema.js';
import { defaultDb } from '../db.js';

export class OntologyGraphStore {
  /**
   * @param {Object} [options]
   * @param {Object} [options.db] Database adapter (defaults to defaultDb)
   * @param {boolean} [options.persist=true] Whether to persist to SQLite/Firestore
   */
  constructor(options = {}) {
    this.db = options.db || defaultDb;
    this.persist = options.persist !== false;

    // Fast In-Memory Graph Index
    this.nodes = new Map();         // id -> node
    this.edges = new Map();         // edgeId -> edge
    this.outEdges = new Map();      // fromId -> Set<edgeId>
    this.inEdges = new Map();       // toId -> Set<edgeId>
    this.typeIndex = new Map();     // entityType -> Set<nodeId>

    this._initTables();
  }

  /**
   * Initializes SQLite tables for nodes and edges if supported by current DB adapter.
   * @private
   */
  async _initTables() {
    if (!this.persist || !this.db) return;
    try {
      if (typeof this.db.run === 'function') {
        await this.db.run(`
          CREATE TABLE IF NOT EXISTS ontology_nodes (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            properties TEXT NOT NULL,
            valid_from TEXT,
            updated_at INTEGER NOT NULL
          )
        `);
        await this.db.run(`
          CREATE TABLE IF NOT EXISTS ontology_edges (
            id TEXT PRIMARY KEY,
            from_id TEXT NOT NULL,
            to_id TEXT NOT NULL,
            relation TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            properties TEXT,
            updated_at INTEGER NOT NULL
          )
        `);
      }
    } catch (err) {
      // Non-critical fallback to memory-only
      console.warn('[OntologyGraphStore] Table init warning:', err.message);
    }
  }

  /**
   * Adds or updates a node in the graph.
   * @param {Object} node
   * @param {string} node.id e.g. "company:AAPL"
   * @param {string} node.type EntityType e.g. EntityTypes.COMPANY
   * @param {string} node.name e.g. "Apple Inc."
   * @param {Object} [node.properties={}]
   * @param {string} [node.validFrom]
   * @returns {Object} Canonical node
   */
  addNode(node) {
    if (!node || !node.id) throw new Error('[OntologyGraphStore] Node must have an id');
    if (!node.type) throw new Error('[OntologyGraphStore] Node must have a type');

    const canonicalNode = {
      id: String(node.id),
      type: node.type,
      name: node.name || node.id,
      properties: node.properties || {},
      validFrom: node.validFrom || new Date().toISOString().slice(0, 10),
      updatedAt: Date.now()
    };

    this.nodes.set(canonicalNode.id, canonicalNode);

    // Update Type Index
    if (!this.typeIndex.has(canonicalNode.type)) {
      this.typeIndex.set(canonicalNode.type, new Set());
    }
    this.typeIndex.get(canonicalNode.type).add(canonicalNode.id);

    // Async persist to SQLite if enabled
    if (this.persist && this.db && typeof this.db.run === 'function') {
      this.db.run(
        `INSERT OR REPLACE INTO ontology_nodes (id, type, name, properties, valid_from, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          canonicalNode.id,
          canonicalNode.type,
          canonicalNode.name,
          JSON.stringify(canonicalNode.properties),
          canonicalNode.validFrom,
          canonicalNode.updatedAt
        ]
      ).catch(() => {});
    }

    return canonicalNode;
  }

  /**
   * Retrieves a node by ID.
   * @param {string} id 
   * @returns {Object|null}
   */
  getNode(id) {
    return this.nodes.get(String(id)) || null;
  }

  /**
   * Checks if a node exists.
   * @param {string} id 
   * @returns {boolean}
   */
  hasNode(id) {
    return this.nodes.has(String(id));
  }

  /**
   * Returns all nodes of a given EntityType.
   * @param {string} type 
   * @returns {Array<Object>}
   */
  getNodesByType(type) {
    const idSet = this.typeIndex.get(type);
    if (!idSet) return [];
    return Array.from(idSet).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Adds or updates a directed edge between two existing or implicit nodes.
   * @param {Object} edge
   * @param {string} edge.from Source node ID
   * @param {string} edge.to Target node ID
   * @param {string} edge.relation RelationType
   * @param {number} [edge.weight=1.0]
   * @param {Object} [edge.properties={}]
   * @returns {Object} Canonical edge
   */
  addEdge(edge) {
    if (!edge || !edge.from || !edge.to || !edge.relation) {
      throw new Error('[OntologyGraphStore] Edge must specify from, to, and relation');
    }

    const fromId = String(edge.from);
    const toId = String(edge.to);
    const relation = String(edge.relation);
    const edgeId = edge.id || `${fromId}:${relation}:${toId}`;

    const canonicalEdge = {
      id: edgeId,
      from: fromId,
      to: toId,
      relation,
      weight: typeof edge.weight === 'number' ? edge.weight : 1.0,
      properties: edge.properties || {},
      updatedAt: Date.now()
    };

    this.edges.set(edgeId, canonicalEdge);

    // Update Adjacency Index
    if (!this.outEdges.has(fromId)) this.outEdges.set(fromId, new Set());
    this.outEdges.get(fromId).add(edgeId);

    if (!this.inEdges.has(toId)) this.inEdges.set(toId, new Set());
    this.inEdges.get(toId).add(edgeId);

    // Async persist to SQLite if enabled
    if (this.persist && this.db && typeof this.db.run === 'function') {
      this.db.run(
        `INSERT OR REPLACE INTO ontology_edges (id, from_id, to_id, relation, weight, properties, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          canonicalEdge.id,
          canonicalEdge.from,
          canonicalEdge.to,
          canonicalEdge.relation,
          canonicalEdge.weight,
          JSON.stringify(canonicalEdge.properties),
          canonicalEdge.updatedAt
        ]
      ).catch(() => {});
    }

    return canonicalEdge;
  }

  /**
   * Gets outgoing edges from a node, optionally filtered by relation type.
   * @param {string} fromId 
   * @param {string} [relation] 
   * @returns {Array<Object>}
   */
  getOutEdges(fromId, relation = null) {
    const edgeIdSet = this.outEdges.get(String(fromId));
    if (!edgeIdSet) return [];
    const list = Array.from(edgeIdSet).map(id => this.edges.get(id)).filter(Boolean);
    return relation ? list.filter(e => e.relation === relation) : list;
  }

  /**
   * Gets incoming edges to a node, optionally filtered by relation type.
   * @param {string} toId 
   * @param {string} [relation] 
   * @returns {Array<Object>}
   */
  getInEdges(toId, relation = null) {
    const edgeIdSet = this.inEdges.get(String(toId));
    if (!edgeIdSet) return [];
    const list = Array.from(edgeIdSet).map(id => this.edges.get(id)).filter(Boolean);
    return relation ? list.filter(e => e.relation === relation) : list;
  }

  /**
   * Retrieves neighboring nodes connected by outgoing edges.
   * @param {string} fromId 
   * @param {string} [relation] 
   * @returns {Array<Object>} Target nodes
   */
  getNeighbors(fromId, relation = null) {
    const edges = this.getOutEdges(fromId, relation);
    return edges.map(e => this.nodes.get(e.to)).filter(Boolean);
  }

  /**
   * Extracts a bounded subgraph centered at a target node.
   * Designed for AI LLM prompts and Cytoscape/D3 graph visualizations.
   * 
   * @param {string} centerNodeId 
   * @param {number} [maxDepth=1] 
   * @returns {{ nodes: Array<Object>, edges: Array<Object>, centerId: string }}
   */
  extractSubgraph(centerNodeId, maxDepth = 1) {
    const center = this.getNode(centerNodeId);
    if (!center) {
      return { nodes: [], edges: [], centerId: centerNodeId };
    }

    const visitedNodeIds = new Set([center.id]);
    const collectedEdges = new Map();
    let currentLevel = [center.id];

    for (let depth = 0; depth < maxDepth; depth++) {
      const nextLevel = [];

      for (const nodeId of currentLevel) {
        // Outgoing
        const outEdges = this.getOutEdges(nodeId);
        for (const edge of outEdges) {
          collectedEdges.set(edge.id, edge);
          if (!visitedNodeIds.has(edge.to)) {
            visitedNodeIds.add(edge.to);
            nextLevel.push(edge.to);
          }
        }

        // Incoming
        const inEdges = this.getInEdges(nodeId);
        for (const edge of inEdges) {
          collectedEdges.set(edge.id, edge);
          if (!visitedNodeIds.has(edge.from)) {
            visitedNodeIds.add(edge.from);
            nextLevel.push(edge.from);
          }
        }
      }

      currentLevel = nextLevel;
      if (currentLevel.length === 0) break;
    }

    const resultNodes = Array.from(visitedNodeIds)
      .map(id => this.nodes.get(id))
      .filter(Boolean);

    return {
      centerId: center.id,
      nodeCount: resultNodes.length,
      edgeCount: collectedEdges.size,
      nodes: resultNodes,
      edges: Array.from(collectedEdges.values())
    };
  }

  /**
   * Returns a statistical summary of the ontology graph.
   * @returns {Object}
   */
  getStats() {
    const typeDistribution = {};
    for (const [type, idSet] of this.typeIndex.entries()) {
      typeDistribution[type] = idSet.size;
    }

    const relationDistribution = {};
    for (const edge of this.edges.values()) {
      relationDistribution[edge.relation] = (relationDistribution[edge.relation] || 0) + 1;
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      typeDistribution,
      relationDistribution
    };
  }

  /**
   * Clears the graph store.
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.outEdges.clear();
    this.inEdges.clear();
    this.typeIndex.clear();
  }
}

// Global default singleton
export const defaultOntologyGraph = new OntologyGraphStore();

