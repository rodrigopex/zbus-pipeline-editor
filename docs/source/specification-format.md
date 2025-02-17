# Specification format

{{project}} requires a JSON specification that defines the working environment.
It specifies all nodes, properties, available connections, and metadata for the editor.
It can be either provided from a file or fetched from an [external application](external-app-communication).

Such a specification defining the nodes needs to be loaded through the front end in order for you to be able to load any dataflow.

## Format description

The specification needs to be provided in a JSON file.
The specification consists of:

* `metadata` - object of type [Metadata](#metadata) that specifies editor styling and metadata
* `nodes` - array that specifies valid nodes, where every element is of type [Node](#node).
* `subgraphs` - Array of dataflow-like objects defining subgraph nodes, of type [Subgraphs](#subgraphs).
* `version` - string determining version of the specification.
  Should be set to the newest version described in [Changelogs](#changelogs).
  {{project}} uses that value to check the compatibility of the specification with the current implementation, giving warnings about inconsistency in versions.

(specification-format-metadata)=
### Metadata

This object specifies additional editor options and contains the following optional properties:

* `interfaces`  - dictionary which defines interface and connection styling for particular interface types.
  The key in the dictionary is the name of the interface type, and the value is of type [Interface style](#interface-style).
* `allowLoopbacks` - boolean value that determines whether connections with endpoints at the same node are allowed.
  Default value is `false`.
* `readonly` - boolean value determining whether the editor is in read-only mode.
  In read-only mode, the user cannot create or remove nodes and connections.
  Modification of any properties is also disabled.
  The user is only allowed to load existing dataflows.
  Default value is `false`.
* `twoColumn` - boolean value determining the layout of the nodes.
  If set to `true`, then input and output sockets are both rendered in the top part of the node and properties are displayed below.
  Default value is `false`.
* `connectionStyle` - string value that determines the connection style.
  Can choose one out of the two options: `curved` or `orthogonal`.
  Default value is `curved`
* `hideHud` - boolean value determining whether UI elements should be hidden. Components affected by this flag are: popup notifications, navigation bar and terminal window.
  Default value is `false`
* `layers` - layers specyfing groups of interfaces and nodes that can be hidden in the viewer from settings level.
  The entries are of type [Layer](#layer).
  By default there are no layers.
* `urls` - list of URL classes present in the specification and flow.
  It is a dictionary, where key is the name of the URL class, and value is of type [URL class specification](#url-class).
  The given URL classes can be referred later in [Nodes](#node) with proper link suffix.
* `collapseSidebar` - boolean value determining whether nodes sidebar should be collapsed by default
  Default value is `true`
* `movementStep` - Defines offset to which nodes snap in the grid.
  Default value is `1`.
* `backgroundSize` - Defines size of the background grid.
  Default value is `100`.
* `layout` - String specifying the name of autolayout algorithm used in placing nodes from dataflow
  Default value is `NoLayout`

An example:

```json
"metadata": {
    "interfaces": {
        "Dataset": {
            "interfaceColor": "#FF00FF",
            "interfaceConnectionPattern": "dashed",
            "interfaceConnectionColor": "#FF0000"
        }
    },
    "allowLoopbacks": false,
    "readonly": true,
    "connectionStyle": "orthogonal",
    "hideHud": false,
    "layers": [
        {
            "name": "Example Layer",
            "nodeTypes": ["processing"],
            "nodeInterfaces": ["BinaryImage"]
        }
    ],
    "layout": "NoLayout"
}
```

#### Layer

Layer is used to describe a set of types of nodes and interfaces.
Layers can be used to hide nodes of given types.
They can be also used to hide connections for given interface types.

The layers can be enabled or disabled in editor settings.

Every layer has three properties (at least `name` and one of `nodeTypes` or `nodeInterfaces` need to be defined):

* `name` - name of the layer displayed in the editor,
* `nodeTypes` (optional) - array of names of node types that belong to the layer,
* `nodeInterfaces` (optional) - array of names of interface types that belong to the layer.

#### URL class

URL class provides links with additional information for a given node.
They are represented in nodes as icons leading to a URL with additional information on node.

The name of the URL class is specified as key in `urls` entry in metadata.

The URL class parameters are following:

* `name` - name of the URL class, appears as hint on hover over the icon,
* `icon` - path to the icon representing the URL class,
* `url` - base URL for URL class.
  The suffixes for URLs are present in [Node](#node) parameters.

#### Interface style

Interface style describes how interfaces of a given type should look like, as well as its input or output connections.
It consists of the following properties:

* `interfaceColor` - describes the color of the interface, should be a hexadecimal number representing RGB values.
* `interfaceConnectionPattern` - describes how the connection line should look like.
  The possible variants are `solid`, `dashed` and `dotted`.
* `interfaceConnectionColor` - describes the color of connection lines, should be a hexadecimal number representing RGB values.

### Node

This object specifies a single node.
Every input object requires six properties:

* `name` - name displayed in the editor.
* `type` - value used for styling.
* `category` - context menu category displayed in the editor.
* `icon` - name of an SVG icon that is going to be displayed next to the name of the node.
  The icons have to be placed in the `assets` directory in the built frontend (default is `pipeline_manager/frontend/dist/assets`).
  The path in `icon` should be the path within the `assets` directory, e.g. `filter.svg` for `pipeline_manager/frontend/dist/assets/filter.svg`.
  ``````{note}
  The `assets` directory can be created and filled manually or added by `build` script with `--assets-directory <path-to-directory-with-icons>`, e.g.:
  ```bash
  ./build --assets-directory examples/sample-assets static-html static-html examples/sample-specification.json
  ```
  ``````
* `interfaces` - array representing inputs, outputs and bidirectional ports for node.
  The entries are of type [Interface](#interface).
* `properties` - array with elements of type [Property](#property),
* `interfaceGroups` - array with elements of type [Interface Groups](#interface-groups),
* `defaultInterfaceGroups` - array of objects that specifies which interfaces groups are enabled by default.
  Every object should contain a `name` and `direction` of an [Interface Groups](#interface-groups).
* `urls` - a dictionary of [URL class](#url-class) and URL suffixes pairs.
  The key should be a URL class key from `urls` in `metadata`.
  The value of the entry is appended to the URL base from the URL class.
* `additionalData` - can be any JSON-like object (array, dictionary, number, string, ...), it is only used for storing some additional, node-specific data, such as comments etc.

Some or all of the properties above (except for `name`) can be derived from existing node types using the `extends` list - check [Node type inheritance](#node-type-inheritance).

Here is an example of a node:

```json
{
    "name": "Filter2D",
    "type": "filters",
    "category": "Filters",
    "icon": "filter.svg",
    "properties": [
        {
            "name": "iterations",
            "type": "integer",
            "default": 1
        },
        {
            "name": "border type",
            "type": "select",
            "values": ["constant", "replicate", "wrap", "reflect"],
            "default": "constant"
        }
    ],
    "interfaces": [
        {
            "name": "image",
            "type": "Image",
            "direction": "input"
        },
        {
            "name": "kernel",
            "type": "Image",
            "direction": "input"
        },
        {
            "name": "output",
            "type": "Image",
            "direction": "output"
        }
    ]
}
```

#### Interface

An object that specifies a single input, output or inout interface of node.
Every interface object has following properties:

* `name` - name of the input displayed in the editor
* `type` - type of the input used for styling and validation purposes.
  Can be either a list of strings or a single string.
  If two interfaces have at least one matching type, they can be connected.
  The first type in the list is a "base" type - it is used to color the interface based on [Interface style](#interface-style).
  If only one type between two interfaces is matching, the connection style matches the one defined for this particular type.
  Otherwise, if multiple types are matching, a white solid line for connection is rendered.
* `direction` - type of the interface in terms of direction, it can be:

    * `input` - interface accepts input data,
    * `output` - interface returns output data.
    * `inout` - interface can both produce outputs and receive inputs.
* `maxConnectionsCount` (optional) - specifies the maximum allowed number of connections for a given port.
  Value less than 0 means no limit for connections for a given interface.
  Value equal to 0 means default behavior - one allowed connection to inputs, many allowed connections from outputs.
  The default value is 0.
* `side` (optional) - specifies the side on which the interface is rendered.
  Value can be either `left` or `right`.
  Interfaces with `direction` set to `input` or `inout` are by default rendered on the left side of the node.
  Interfaces with `direction` set to `output` are by default rendered on the right side of the node.
* `array` (optional) - special keyword to easily define a range of interfaces.
  Value has to be a list with two integer values that specify the range of interfaces.
  For example for an `example` interface with `array: [0, 2]` two interfaces called `example[0]` and `example[1]` are created.

```{note}
Only interfaces of the same `type` can be connected together.
```

#### Property

An object that specifies a single property.
Every project object has two required base properties:
* `name` - name of the property.
* `type` - type of the property.
* `default` - specifies a default selected value
  Its type depends on the `type` chosen.

There are eight possible values for the `type` property.
* `text` - property is a string.
  A text field is displayed to the user.
* `constant` - property is a string.
  A non-modifiable text field is displayed to the user.
* `number` - property is a float.
  A number field is displayed to the user.
* `integer` - property is an int.
  A number field that only accepts integers is displayed to the user.
* `select` - property is a string with a defined range.
  It requires a `values` property.
* `checkbox` - property is a bool.
  A checkbox representing boolean value
* `slider` - property is a float with a specified range.
  It requires `min` and `max` properties.
* `list` - property is a list of arguments of the same type, which can be specified using `dtype`.


Additional properties:

* `min` - specifies the left end of a range.
* `max` - specifies the right end of a range.
* `values` - specifies a range of possible values for `select`.
* `dtype` - specifies data type of elements in a `list`.
  Supported values are `string`, `number`, `integer`, `boolean`.
* `description` - description of the property.
  In some cases, it can be displayed to the user.

#### Node type inheritance

It is possible to inherit:

* `type`
* `category`
* `icon`
* `interfaces`
* `properties`
* `urls`

From existing node types using the `extends` parameter.
The parameter accepts a list of node types.
The node type is computed by iteratively updating node type definition structures, going through all node types in the `extends` list (in the specified order), and then applying parameters from the currenty node type.

Below is a sample specification with used inheritance mechanism:

```json
{
    "nodes": [
        {
            "name": "Type A",
            "type": "class",
            "category": "Classes",
            "properties": [
                {"name": "prop-a", "type": "text", "default": ""}
            ],
            "interfaces": [
                {"name": "output-a", "type": "Interface", "direction": "output"}
            ]
        },
        {
            "name": "Type B",
            "extends": ["Type A"],
            "properties": [
                {"name": "prop-b", "type": "text", "default": ""}
            ],
            "interfaces": [
                {"name": "output-b", "type": "Interface", "direction": "output"}
            ]
        },
        {
            "name": "Type C",
            "type": "class",
            "category": "Classes",
            "properties": [
                {"name": "prop-c", "type": "text", "default": ""}
            ],
            "interfaces": [
                {"name": "input-c", "type": "Interface", "direction": "input"}
            ]
        },
        {
            "name": "Type D",
            "extends": ["Type B", "Type C"],
            "properties": [
                {"name": "prop-d", "type": "text", "default": ""}
            ],
            "interfaces": [
                {"name": "inout-d", "type": "Interface", "direction": "inout"}
            ]
        }
    ]
}
```

```{warning}
Node types can not be repeated (explicitly in list or implicitly through inheritance) in the `extends` list.
```

### Interface Groups

Object similar to a single interface but reserves a range of interfaces.
`name`, `type`, `direction`, `maxConnectionsCount` and `side` are the same as in a regular [Interface](#interface).
The only difference is that a range of interfaces has to be defined which describes constraints of an interface.
For example two interface groups can be defined that have consist of common interfaces and thus cannot coexist.

```json
"interfaceGroups": [
  {
    "name": "1",
    "type": "test",
    "direction": "input",
    "interfaces": [
      {"name": "1[1]", "direction": "output"},
      {"name": "1", "array": [3, 15], "direction": "output"},
      {"name": "1", "array": [35, 48], "direction": "output"}
    ]
  }
]
```

The interface group called `1` consists of three ranges of interfaces: `1[1]`, interfaces `1[3], 1[4], ..., 1[14]` and `1[35], 1[36], ..., 1[47]`.

### Subgraphs

Each object defines node representing defined subgraph.
Fields `name`, `type`, `category`, `icon` are defined the same way as in standard nodes.
Apart from those, subgraph node contains additional properties:

* `nodes` - List of nodes in a subgraph, specified in [Dataflow format](#dataflow-format)
* `connections` - List of connections in a subgraph, specified in [Dataflow format](dataflow-format)
* `interfaces` - Apart from properties defined in [Node interface](#interface), contains:
  * `nodeInterface` - ID of an interface of a node defined in subgraph to which this particular interface is tied to.

## Example

Below, you can see a sample specification containing a hypothetical definition of nodes for image processing purposes:

```json
{
    "nodes": [
        {
            "name": "LoadVideo",
            "type": "filesystem",
            "category": "Filesystem",
            "properties": [
                {"name": "filename", "type": "text", "default": ""}
            ],
            "inputs": [],
            "outputs": [{"name": "frames", "type": "Image"}]
        },
        {
            "name": "SaveVideo",
            "type": "filesystem",
            "category": "Filesystem",
            "properties": [
                {"name": "filename", "type": "text", "default": ""}
            ],
            "inputs": [
                {"name": "color", "type": "Image"},
                {"name": "binary", "type": "BinaryImage"}
            ],
            "outputs": []
        },
        {
            "name": "GaussianKernel",
            "type": "kernel",
            "category": "Generators",
            "properties": [
                {"name": "size", "type": "integer", "default": 5},
                {"name": "sigma", "type": "number", "default": 1.0}
            ],
            "inputs": [],
            "outputs": [{"name": "kernel", "type": "Image"}]
        },
        {
            "name": "StructuringElement",
            "type": "kernel",
            "category": "Generators",
            "properties": [
                {"name": "size", "type": "integer", "default": 5},
                {
                    "name": "shape",
                    "type": "select",
                    "values": ["Rectangle", "Cross", "Ellipse"],
                    "default": "Cross"
                }
            ],
            "inputs": [],
            "outputs": [{"name": "kernel", "type": "BinaryImage"}]
        },
        {
            "name": "Filter2D",
            "type": "processing",
            "category": "Processing",
            "properties": [
                {"name": "iterations", "type": "integer", "default": 1},
                {
                    "name": "border type",
                    "type": "select",
                    "values": ["constant", "replicate", "wrap", "reflect"],
                    "default": "constant"
                }
            ],
            "inputs": [
                {"name": "image", "type": "Image"},
                {"name": "kernel", "type": "Image"}
            ],
            "outputs": [{"name": "output", "type": "Image"}]
        },
        {
            "name": "Threshold",
            "type": "processing",
            "category": "Processing",
            "properties": [
                {"name": "threshold_value", "type": "integer", "default": 1},
                {
                    "name": "threshold_type",
                    "type": "select",
                    "values": ["Binary", "Truncate", "Otsu"],
                    "default": "constant"
                }
            ],
            "inputs": [{"name": "image", "type": "Image"}],
            "outputs": [{"name": "output", "type": "BinaryImage"}]
        },
        {
            "name": "Morphological operation",
            "type": "processing",
            "category": "Processing",
            "properties": [
                {"name": "iterations", "type": "integer", "default": 1},
                {
                    "name": "border type",
                    "type": "select",
                    "values": ["constant", "replicate", "wrap", "reflect"],
                    "default": "constant"
                },
                {
                    "name": "operation type",
                    "type": "select",
                    "values": ["dilation", "erosion", "closing", "opening"],
                    "default": "dilation"
                }
            ],
            "inputs": [
                {"name": "image", "type": "BinaryImage"},
                {"name": "kernel", "type": "BinaryImage"}
            ],
            "outputs": [{"name": "output", "type": "BinaryImage"}]
        }
    ],
    "metadata": {
        "interfaces": {
            "Image": "#00FF00",
            "BinaryImage": "#FF0000"
        }
    },
    "version": "20230720.5"
}
```

Thanks to the flexibility of the specification format, you can use any combination of properties, inputs, and outputs to create a custom node.
It is also readable and divided into distinct parts, so you can implement a process of automated specification generation into an external application.
See the [External App Communication](external-app-communication) section to find out more.

A sample node created from the specification above:

![Sample node created from specification](img/example_specification.png)
