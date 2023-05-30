/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/*
 * Custom pipeline editor - Implements logic for adding, removing, editing nodes and
 * conections between them.
 * Inherits from baklavajs/core/src/editor.ts
 */

import { Editor, DummyConnection, createGraphNodeType, useGraph, GraphTemplate, GRAPH_NODE_TYPE_PREFIX } from 'baklavajs';
import { v4 as uuidv4 } from "uuid";

export default class PipelineManagerEditor extends Editor {
    readonly = false;

    hideHud = false;

    allowLoopbacks = false;

    nodeIcons = new Map();

    baseURLs = new Map();

    nodeURLs = new Map();

    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */

    registerGraph(graph) {
        graph.checkConnection = function (from, to) {
            if (!from || !to) {
                return { connectionAllowed: false };
            }

            const fromNode = this.findNodeById(from.nodeId);
            const toNode = this.findNodeById(to.nodeId);
            if (fromNode && toNode && fromNode === toNode && !this.editor.allowLoopbacks) {
                // connections must be between two separate nodes.
                return { connectionAllowed: false };
            }

            // reverse connection so that 'from' is input and 'to' is output
            if (
                (from.direction === 'input' && to.direction === 'output') ||
                (from.direction === 'input' && to.direction === 'inout') ||
                (from.direction === 'inout' && to.direction === 'output')
            ) {
                const tmp = from;
                from = to;
                to = tmp;
            }

            if (from.isInput && from.direction !== 'inout') {
                // connections are only allowed from input to output or inout interface
                return { connectionAllowed: false };
            }

            if (!to.isInput) {
                // we can connect only to input
                return { connectionAllowed: false };
            }

            // prevent duplicate connections
            if (this.connections.some((c) => c.from === from && c.to === to)) {
                return { connectionAllowed: false };
            }

            // the default behavior for outputs is to provide any number of
            // output connections
            if (
                from.maxConnectionsCount > 0 &&
                from.connectionCount + 1 > from.maxConnectionsCount
            ) {
                return { connectionAllowed: false };
            }

            // the default behavior for inputs is to allow only one connection
            if (
                (to.maxConnectionsCount === 0 || to.maxConnectionsCount === undefined) &&
                to.connectionCount > 0
            ) {
                return { connectionAllowed: false };
            }

            if (to.maxConnectionsCount > 0 && to.connectionCount + 1 > to.maxConnectionsCount) {
                return { connectionAllowed: false };
            }

            if (this.events.checkConnection.emit({ from, to }).prevented) {
                return { connectionAllowed: false };
            }

            const hookResults = this.hooks.checkConnection.execute({ from, to });
            if (hookResults.some((hr) => !hr.connectionAllowed)) {
                return { connectionAllowed: false };
            }

            // List of connections that are removed once the dummyConnection is created
            const connectionsInDanger = [];
            return {
                connectionAllowed: true,
                dummyConnection: new DummyConnection(from, to),
                connectionsInDanger,
            };
        };

        graph.updateTemplate = function() {
            const interfaceConnections = [];
            const SUBGRAPH_INPUT_NODE_TYPE = "__baklava_SubgraphInputNode";
            const SUBGRAPH_OUTPUT_NODE_TYPE = "__baklava_SubgraphOutputNode";

            const inputs = [];
            const inputNodes = this.nodes.filter((n) => n.type === SUBGRAPH_INPUT_NODE_TYPE);
            for (const n of inputNodes) {
                const connections = this.connections.filter((c) => c.from === n.outputs.placeholder);
                connections.forEach((c) => {
                    inputs.push({
                        id: n.graphInterfaceId,
                        name: n.inputs.name.value,
                        nodeInterfaceId: c.to.id,
                    });
                });
                interfaceConnections.push(...connections);
            }

            const outputs = [];
            const outputNodes = this.nodes.filter((n) => n.type === SUBGRAPH_OUTPUT_NODE_TYPE);
            for (const n of outputNodes) {
                const connections = this.connections.filter((c) => c.to === n.inputs.placeholder);
                connections.forEach((c) => {
                    outputs.push({
                        id: n.graphInterfaceId,
                        name: n.inputs.name.value,
                        nodeInterfaceId: c.from.id,
                    });
                });
                interfaceConnections.push(...connections);
            }

            const innerConnections = this.connections.filter((c) => !interfaceConnections.includes(c));
            const nodes = this.nodes.filter(
                (n) => n.type !== SUBGRAPH_INPUT_NODE_TYPE && n.type !== SUBGRAPH_OUTPUT_NODE_TYPE,
            );

            this.template.update({
                inputs,
                outputs,
                connections: innerConnections.map((c) => ({ id: c.id, from: c.from.id, to: c.to.id })),
                nodes: nodes.map((n) => n.save()),
            });

            this.template.panning = this.panning;
            this.template.scaling = this.scaling;
        };

        graph.addNode = function(node) {
            if (this.events.beforeAddNode.emit(node).prevented) {
                return;
            }
            this.nodeEvents.addTarget(node.events);
            this.nodeHooks.addTarget(node.hooks);
            node.registerGraph(this);

            if(node.template !== undefined) {
                const newState = {
                    id: uuidv4(),
                    nodes: node.template.nodes,
                    connections: node.template.connections,
                    inputs: node.template.inputs,
                    outputs: node.template.outputs,
                    name: node.template.name
                }
                node.template = new GraphTemplate(newState, this.editor)
            }

            this._nodes.push(node);
            // when adding the node to the array, it will be made reactive by Vue.
            // However, our current reference is the non-reactive version.
            // Therefore, we need to get the reactive version from the array.
            node = this.nodes.find((n) => n.id === node.id);
            node.onPlaced();
            this.events.addNode.emit(node);
            return node;
        }

        super.registerGraph(graph);
    }

    save() {
        const state = super.save();
        state.graph.panning = this._graph.panning;
        state.graph.scaling = this._graph.scaling;
        state.graphTemplateInstances = [];
        // subgraphs are stored in state.graphTemplates, there is no need to store it
        // in nodes itself
        state.graph.nodes.forEach(node => {
            if(node.type.startsWith(GRAPH_NODE_TYPE_PREFIX)) {
                node.type = node.type.slice(GRAPH_NODE_TYPE_PREFIX.length);
                node.subgraph = node.graphState.id;
                state.graphTemplateInstances.push(node.graphState);
            }
            delete node.graphState
        })

        return state;
    }

    load(state) {
        state.graph.nodes.forEach(node => {
            if(node.subgraph !== undefined) {
                const fittingTemplate = state.graphTemplateInstances.filter(template => template.id == node.subgraph)
                if (fittingTemplate.length != 1) {
                    throw new Error(`Expected exactly one template with ID ${node.type}, got ${fittingTemplate.length}`)
                }
                node.graphState = structuredClone(fittingTemplate[0]);
                node.type = `${GRAPH_NODE_TYPE_PREFIX}${node.type}`
                delete node.subgraph;
            }
        })

        super.load(state);
        state.graph.nodes.forEach((node, ind) => {
            if(node.graphState !== undefined) {
                const newState = {
                    inputs: node.graphState.inputs,
                    outputs: node.graphState.outputs,
                    connections: node.graphState.connections,
                    nodes: node.graphState.nodes,
                    id: this._graph.nodes[ind].template.id,
                    name: this._graph.nodes[ind].template.name
                }
                this._graph.nodes[ind].template.update(newState);
            }
        })
        if (state.graph.panning !== undefined) {
            this._graph.panning = state.graph.panning;
        }
        if (state.graph.scaling !== undefined) {
            this._graph.scaling = state.graph.scaling;
        }
    }

    getNodeURLs(nodeName) {
        const urls = this.nodeURLs.get(nodeName) || {};

        const fullUrls = [];
        Object.entries(urls).forEach(([urlName, url]) => {
            const t = { ...this.baseURLs.get(urlName) };
            t.url += url;
            fullUrls.push(t);
        });

        return fullUrls;
    }

    getNodeIconPath(nodeName) {
        return this.nodeIcons.get(nodeName) || undefined;
    }

    getNodeIconPath(nodeType) {
        return this.nodeIcons.get(nodeType) || undefined;
    }

    addGraphTemplate(template, category, type) {
        if (this.events.beforeAddGraphTemplate.emit(template).prevented) {
            return;
        }
        if (this.nodeTypes.has(`${GRAPH_NODE_TYPE_PREFIX}${template.id}`)) {
            return;
        }
        this._graphTemplates.push(template);
        this.graphTemplateEvents.addTarget(template.events);
        this.graphTemplateHooks.addTarget(template.hooks);

        const nt = createGraphNodeType(template);
        class stuff extends nt {
            constructor() {
                super()
                this.type = `${GRAPH_NODE_TYPE_PREFIX}${type}`
            }
        }
        this.registerNodeType(stuff, { category: category, title: template.name });

        this.events.addGraphTemplate.emit(template);
    }

    switchToMainGraph(displayedGraph) {
        // SwitchGraph must be defined after viewPlugin and editor are initialized in EditorManager
        if(this.switchGraph == undefined) {
            const { switchGraph } = useGraph();
            this.switchGraph = switchGraph;
        }
        // this.saveSubgraphTemplate(displayedGraph)
        displayedGraph.updateTemplate();
        this.switchGraph(this.graph);
    }

    swapGraph(newGraph) {
        const aaa = this._graph;
        this._graph = newGraph;
        return aaa;
    }
}
