/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { stringify } from 'ajv';

import { useBaklava, BaklavaInterfaceTypes } from 'baklavajs';

import PipelineManagerEditor from '../custom/Editor';

import NotificationHandler from './notifications';
import { NodeFactory, readInterfaceTypes } from './NodeFactory';
import specificationSchema from '../../../resources/schemas/dataflow_spec_schema.json';
import ConnectionRenderer from './ConnectionRenderer';

export default class EditorManager {
    static instance;

    editor = new PipelineManagerEditor();

    baklavaView = useBaklava(this.editor);

    nodeInterfaceTypes = new BaklavaInterfaceTypes(this.editor, {
        viewPlugin: this.baklavaView,
    });

    specificationLoaded = false;

    interfacesStyleId = 'interfaces-style';

    constructor() {
        this.baklavaView.connectionRenderer = new ConnectionRenderer(this.baklavaView);
    }

    /**
     * Loads the dataflow specification passed in `dataflowSpecification`.
     * The specification describes what nodes are available in the editor.
     *
     * If the current editor already has a specification loaded then the editor
     * and its plugins are reinitialized and then the specification is loaded.
     *
     * @param dataflowSpecification Specification to load
     */
    /* eslint-disable no-underscore-dangle */
    updateEditorSpecification(dataflowSpecification) {
        if (!dataflowSpecification) return;
        if (this.specificationLoaded) {
            this.cleanEditor();
        }

        const { nodes, metadata } = dataflowSpecification;

        const interfaceTypes = readInterfaceTypes(nodes);
        this.nodeInterfaceTypes.addTypes(...Object.values(interfaceTypes));
        this.updateInterfacesStyle(metadata);

        nodes.forEach((node) => {
            const myNode = NodeFactory(
                node.name,
                node.name,
                node.inputs,
                node.properties,
                node.outputs,
                interfaceTypes,
                'twoColumn' in metadata ? metadata.twoColumn : false,
            );
            this.editor.registerNodeType(myNode, { title: node.name, category: node.category });
        });

        this.editor.readonly = 'readonly' in metadata ? metadata.readonly : false;
        this.editor.hideHud = 'hideHud' in metadata ? metadata.hideHud : false;
        NotificationHandler.setShowOption(!this.editor.hideHud);
        if (this.editor.readonly) {
            NotificationHandler.showToast(
                'info',
                'The specification is read-only. Only dataflow loading is allowed.',
            );
        }
        this.editor.allowLoopbacks = 'allowLoopbacks' in metadata ? metadata.allowLoopbacks : false;
        if ('connectionStyle' in metadata) {
            this.baklavaView.connectionRenderer.style = metadata.connectionStyle;
        }
        this.specificationLoaded = true;
    }

    /**
     * Removes interfaces stylesheet registered using id `interfacesStyleId`.
     * It is used to cleanup the editor enviornment when chaning a specification.
     */
    removeInterfacesStyle() {
        const styleSheet = document.getElementById(this.interfacesStyleId);
        if (styleSheet !== null) {
            document.head.removeChild(styleSheet);
        }
    }

    /**
     * Updates global stylesheet with coloring specified in the metadata argument.
     * The stylesheet is registered with id `interfacesStyleId`.
     *
     * @param metadata metadata of the specification
     */
    updateInterfacesStyle(metadata) {
        if ('interfaces' in metadata) {
            const styleSheet = document.createElement('style');
            let styles = '';

            Object.entries(metadata.interfaces).forEach(([name, color]) => {
                styles += `.baklava-node-interface[data-interface-type="${name}"] .__port { background-color: ${color}; }`;
            });

            styleSheet.innerText = styles;
            styleSheet.type = 'text/css';
            styleSheet.id = this.interfacesStyleId;

            document.head.appendChild(styleSheet);
        }
    }

    /**
     * Cleans up the editor.
     *
     * Removes all nodes and connections from the editor and unregisters all
     * nodes. Its important that registered interface types are not removed, as there
     * is no support for that in baklavajs, but it should not result in any malfunction.
     */
    cleanEditor() {
        const graphInstance = this.editor._graph;

        for (let i = graphInstance.connections.length - 1; i >= 0; i -= 1) {
            graphInstance.removeConnection(graphInstance.connections[i]);
        }
        for (let i = graphInstance.nodes.length - 1; i >= 0; i -= 1) {
            graphInstance.removeNode(graphInstance.nodes[i]);
        }

        this.editor.nodeTypes.forEach((_, nodeKey) => {
            this.editor.unregisterNodeType(nodeKey);
        });

        this.removeInterfacesStyle();
    }

    /**
     * Translates from Pipeline Manager dataflow to Baklava format
     *
     * @param dataflow Dataflow in Pipeline Manager format
     * @returns Dataflow ready to be loaded into Baklava Editor
     */
    static dataflowFromPipelineManagerToBaklava(dataflow) {
        /* eslint-disable no-param-reassign */
        dataflow.graph.nodes.forEach((node) => {
            if ('name' in node) {
                node.title = node.name;
            } else {
                node.title = '';
            }
            delete node.name;
        });
        return dataflow;
        /* eslint-enable no-param-reassign */
    }

    /**
     * Translates from Baklava format to Pipeline Manager
     *
     * @param dataflow Dataflow in Baklava Format
     * @returns Dataflow ready to be exported from Baklava editor
     */
    static dataflowFromBaklavaToPipelineManager(dataflow) {
        /* eslint-disable no-param-reassign */
        dataflow.graph.nodes.forEach((node) => {
            node.name = node.title;
            delete node.title;
        });
        return dataflow;
        /* eslint-enable no-param-reassign */
    }

    /**
     * Serializes and returns current dataflow in Pipeline Manager format.
     *
     * @returns Serialized dataflow.
     */
    saveDataflow() {
        return EditorManager.dataflowFromBaklavaToPipelineManager(this.editor.save());
    }

    /**
     * Loads the dataflow passed in `dataflow` and renders it.
     * If the dataflow is not compatible with the currently loaded specification or is not
     * in the dataflow format, then some of the dataflow may be not loaded and an
     * error is returned. Dataflow should be passed in PipelineManager format (translation
     * to Baklava format is done )
     *
     * @param dataflow Dataflow to load
     * @returns An array of errors that occured during the dataflow loading.
     * If the array is empty, the loading was successful.
     */
    loadDataflow(dataflow) {
        try {
            return this.editor.load(EditorManager.dataflowFromPipelineManagerToBaklava(dataflow));
        } catch (err) {
            return [
                'Unrecognized format. Make sure that the passed dataflow is correct.',
                err.toString(),
            ];
        }
    }

    /**
     * Static function used to get the instance of the EditorManager in a singleton manner.
     * If there is no existing instance of the EditorManager then a new one is created.
     *
     * @returns Instance of EditorManager.
     */
    static getEditorManagerInstance() {
        if (!EditorManager.instance) {
            EditorManager.instance = new EditorManager();
        }
        return EditorManager.instance;
    }

    /**
     * Validates specification passed in `specification` using jsonSchema.
     *
     * @param specification Specification to validate
     * @returns An array of errors. If the array is empty, the validation was successful.
     */
    /* eslint-disable class-methods-use-this */
    validateSpecification(specification) {
        const ajv = new Ajv();

        const validate = ajv.compile(specificationSchema);
        const valid = validate(specification);
        if (valid) {
            return [];
        }

        // Parsing errors messages to a human readable string
        const errors = validate.errors.map((error) => {
            const path = `specification${error.instancePath}`;
            switch (error.keyword) {
                case 'enum':
                    return `${path} ${error.message} - ${stringify(error.params.allowedValues)}`;
                default:
                    return `${path} ${error.message}`;
            }
        });
        return errors;
    }
}
